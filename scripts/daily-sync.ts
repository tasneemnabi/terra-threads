/**
 * daily-sync.ts — Orchestration script that runs both Shopify and catalog
 * sync pipelines in sequence. Designed for scheduled automation (e.g.
 * Claude Code Cloud Scheduled Tasks).
 *
 * Usage:
 *   npx tsx scripts/daily-sync.ts
 *
 * Telemetry:
 *   Each invocation creates a row in `sync_runs` and per-brand rows in
 *   `sync_run_brands`. Failures are written to `sync_run_failures` as they
 *   happen. See sync-reliability-plan.md for the post-mortem playbook.
 */

import { syncBrand, llmPass as shopifyLlmPass, type BrandRow } from "./sync-shopify.js";
import {
  syncCatalogBrand,
  llmPass as catalogLlmPass,
  type CatalogBrandRow,
} from "./sync-catalog.js";
import { loadEnv, getSupabaseAdmin } from "./lib/env.js";
import {
  SyncRunRecorder,
  startRun,
  finishRun,
} from "./lib/sync-reliability.js";

async function main() {
  const env = loadEnv();
  if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }

  const supabase = getSupabaseAdmin();
  const materialCache = new Map<string, string>();
  let hasErrors = false;

  console.log("═══════════════════════════════════════════════════════");
  console.log("DAILY SYNC — Starting automated product sync");
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // Telemetry: open a sync_runs row. If this fails (e.g. Supabase down) we
  // continue with a null runId and the recorder becomes a no-op for writes —
  // counters and summary still work.
  const runId = await startRun(supabase, "daily-sync");
  const recorder = new SyncRunRecorder(supabase, runId);
  if (runId) console.log(`  Telemetry run id: ${runId}\n`);

  const runStartMs = Date.now();

  // ─── 1. Shopify sync ──────────────────────────────────────────────

  console.log("▶ Phase 1: Shopify brands\n");

  const { data: shopifyBrands, error: shopifyError } = await supabase
    .from("brands")
    .select("id, name, slug, shopify_domain, is_fully_natural, scrape_fallback, audience")
    .not("shopify_domain", "is", null)
    .eq("sync_enabled", true);

  if (shopifyError) {
    console.error("Failed to fetch Shopify brands:", shopifyError.message);
    hasErrors = true;
  }

  type ShopifyStats = Awaited<ReturnType<typeof syncBrand>>;
  const shopifyResults: Array<{
    brand: string;
    status: string;
    detail: string;
    stats: ShopifyStats | null;
  }> = [];

  const shopifyPhaseStart = Date.now();
  for (const brand of (shopifyBrands || []) as BrandRow[]) {
    const brandCtx = recorder.beginBrand(brand.id, brand.slug, "shopify");
    try {
      const stats = await syncBrand(
        supabase,
        brand,
        { dryRun: false, brandCtx },
        materialCache
      );
      const detail = `${stats.fetched} fetched, ${stats.skippedUnchanged} unchanged, ${stats.skippedReviewCadence} review-cadence, ${stats.inserted} synced, ${stats.flaggedReview} review, ${stats.availabilityUpdated} avail-updated, ${stats.timeouts} timeouts${stats.abortedByWallCeiling ? " [ABORTED]" : ""}`;
      shopifyResults.push({
        brand: brand.name,
        status: stats.errors > 0 || stats.timeouts > 0 ? "WARN" : "OK",
        detail,
        stats,
      });
      if (stats.errors > 0 || stats.timeouts > 0) hasErrors = true;
    } catch (err) {
      shopifyResults.push({
        brand: brand.name,
        status: "FAIL",
        detail: (err as Error).message,
        stats: null,
      });
      hasErrors = true;
    } finally {
      await brandCtx.finish();
    }
  }
  const shopifyPhaseMs = Date.now() - shopifyPhaseStart;

  // ─── 2. Catalog sync ──────────────────────────────────────────────

  console.log("\n▶ Phase 2: Catalog brands\n");

  // Catalog pipeline is only for brands without a Shopify endpoint. The
  // scrape_fallback flag is a Shopify-pipeline-internal signal (see
  // sync-shopify.ts: it scrapes product pages to fill in materials missing
  // from JSON), not a request to run the catalog pipeline as well — including
  // it here caused brands like nads to be synced twice per day, where the
  // catalog pass burned minutes on availability sweeps Shopify just did.
  const { data: catalogBrands, error: catalogError } = await supabase
    .from("brands")
    .select(
      "id, name, slug, website_url, is_fully_natural, scrape_fallback, shopify_domain, audience, availability_cadence_days"
    )
    .eq("sync_enabled", true)
    .not("website_url", "is", null)
    .is("shopify_domain", null);

  if (catalogError) {
    console.error("Failed to fetch catalog brands:", catalogError.message);
    hasErrors = true;
  }

  type CatalogStats = Awaited<ReturnType<typeof syncCatalogBrand>>;
  const catalogResults: Array<{
    brand: string;
    status: string;
    detail: string;
    stats: CatalogStats | null;
  }> = [];

  const catalogPhaseStart = Date.now();
  for (const brand of (catalogBrands || []) as CatalogBrandRow[]) {
    const brandCtx = recorder.beginBrand(brand.id, brand.slug, "catalog");
    try {
      const stats = await syncCatalogBrand(
        supabase,
        brand,
        { dryRun: false, discoverOnly: false, brandCtx },
        materialCache
      );
      const detail = `${stats.discovered} discovered, ${stats.skippedUnchanged} unchanged, ${stats.inserted} synced, ${stats.flaggedReview} review, ${stats.availabilityUpdated} avail-updated, ${stats.timeouts} timeouts${stats.abortedByWallCeiling ? " [ABORTED]" : ""}`;
      catalogResults.push({
        brand: brand.name,
        status: stats.errors > 0 || stats.timeouts > 0 ? "WARN" : "OK",
        detail,
        stats,
      });
      if (stats.errors > 0 || stats.timeouts > 0) hasErrors = true;
    } catch (err) {
      catalogResults.push({
        brand: brand.name,
        status: "FAIL",
        detail: (err as Error).message,
        stats: null,
      });
      hasErrors = true;
    } finally {
      await brandCtx.finish();
    }
  }
  const catalogPhaseMs = Date.now() - catalogPhaseStart;

  // ─── 3. LLM fallback for residual review products ───────────────

  console.log("\n▶ Phase 3: LLM fallback for locator-missed products\n");

  const llmPhaseStart = Date.now();
  if (!process.env.GEMINI_API_KEY) {
    console.log("Skipping LLM pass — GEMINI_API_KEY not set");
  } else {
    try {
      await shopifyLlmPass(supabase, null, materialCache, { onlyLocatorMissed: true });
      await catalogLlmPass(supabase, null, materialCache, { onlyLocatorMissed: true });
    } catch (err) {
      console.error("LLM pass failed:", (err as Error).message);
      hasErrors = true;
    }
  }
  const llmPhaseMs = Date.now() - llmPhaseStart;

  // ─── 4. Summary ───────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("DAILY SYNC SUMMARY");
  console.log("═══════════════════════════════════════════════════════\n");

  if (shopifyResults.length > 0) {
    console.log("Shopify brands:");
    for (const r of shopifyResults) {
      console.log(`  [${r.status}] ${r.brand}: ${r.detail}`);
    }
  }

  if (catalogResults.length > 0) {
    console.log("\nCatalog brands:");
    for (const r of catalogResults) {
      console.log(`  [${r.status}] ${r.brand}: ${r.detail}`);
    }
  }

  // ─── Aggregate locator source distribution ──────────────────────
  const allLocatorSources: Record<string, number> = {};
  let shopifyFetched = 0;
  let shopifyUnchanged = 0;
  let shopifyReview = 0;
  let shopifyTimeouts = 0;
  for (const r of shopifyResults) {
    if (!r.stats) continue;
    shopifyFetched += r.stats.fetched;
    shopifyUnchanged += r.stats.skippedUnchanged;
    shopifyReview += r.stats.flaggedReview;
    shopifyTimeouts += r.stats.timeouts;
    for (const [k, v] of Object.entries(r.stats.locatorSources || {})) {
      allLocatorSources[k] = (allLocatorSources[k] || 0) + v;
    }
  }

  let catalogScraped = 0;
  let catalogUnchanged = 0;
  let catalogReview = 0;
  let catalogTimeouts = 0;
  for (const r of catalogResults) {
    if (!r.stats) continue;
    catalogScraped += r.stats.scraped;
    catalogUnchanged += r.stats.skippedUnchanged;
    catalogReview += r.stats.flaggedReview;
    catalogTimeouts += r.stats.timeouts;
    for (const [k, v] of Object.entries(r.stats.locatorSources || {})) {
      allLocatorSources[k] = (allLocatorSources[k] || 0) + v;
    }
  }

  console.log(
    `\nShopify: ${shopifyFetched} fetched, ${shopifyUnchanged} unchanged, ${shopifyReview} review, ${shopifyTimeouts} timeouts (${(shopifyPhaseMs / 1000).toFixed(1)}s)`
  );
  console.log(
    `Catalog: ${catalogScraped} scraped, ${catalogUnchanged} unchanged, ${catalogReview} review, ${catalogTimeouts} timeouts (${(catalogPhaseMs / 1000).toFixed(1)}s)`
  );
  console.log(`LLM pass: ${(llmPhaseMs / 1000).toFixed(1)}s`);

  const sourceLine = Object.entries(allLocatorSources)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  console.log(`Locator sources: ${sourceLine || "(none)"}`);

  // ─── Diagnostic: slowest brands + aborted brands + duplicate-work ratio
  const snapshots = recorder.getBrandSnapshots();
  if (snapshots.length > 0) {
    const slowestByTotal = [...snapshots]
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 5);
    console.log("\nSlowest brands by total time:");
    for (const s of slowestByTotal) {
      console.log(
        `  ${s.brandSlug} (${s.pipeline}): ${(s.totalMs / 1000).toFixed(1)}s` +
          (s.stage.scrape_ms != null ? `, scrape ${(s.stage.scrape_ms / 1000).toFixed(1)}s` : "") +
          (s.stage.extract_ms != null ? `, extract ${(s.stage.extract_ms / 1000).toFixed(1)}s` : "") +
          (s.stage.fetch_ms != null ? `, fetch ${(s.stage.fetch_ms / 1000).toFixed(1)}s` : "")
      );
    }

    const slowestByScrape = [...snapshots]
      .filter((s) => (s.stage.scrape_ms ?? 0) > 0)
      .sort((a, b) => (b.stage.scrape_ms ?? 0) - (a.stage.scrape_ms ?? 0))
      .slice(0, 5);
    if (slowestByScrape.length > 0) {
      console.log("\nSlowest brands by scrape time:");
      for (const s of slowestByScrape) {
        console.log(
          `  ${s.brandSlug}: ${((s.stage.scrape_ms ?? 0) / 1000).toFixed(1)}s`
        );
      }
    }

    const withTimeouts = snapshots
      .filter((s) => (s.counters.timeouts ?? 0) > 0 || (s.counters.errors ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.counters.timeouts ?? 0) +
          (b.counters.errors ?? 0) -
          ((a.counters.timeouts ?? 0) + (a.counters.errors ?? 0))
      );
    if (withTimeouts.length > 0) {
      console.log("\nBrands with failures (timeouts / errors):");
      for (const s of withTimeouts) {
        console.log(
          `  ${s.brandSlug}: ${s.counters.timeouts ?? 0} timeouts, ${s.counters.errors ?? 0} errors`
        );
      }
    }

    const aborted = snapshots.filter((s) => s.abortedByWallCeiling);
    if (aborted.length > 0) {
      console.log("\nBrands aborted by wall-time ceiling:");
      for (const s of aborted) {
        console.log(`  ${s.brandSlug} (${s.pipeline}): ${(s.totalMs / 1000).toFixed(1)}s`);
      }
    }

    // Duplicate-work ratio: of products processed (inserted + updated +
    // flagged_review), how many were skipped (settled + unchanged + cadence)?
    // High ratio = the cadence/hash gates are doing their job; low ratio =
    // we're re-doing a lot of work.
    let totalProcessed = 0;
    let totalSkipped = 0;
    for (const s of snapshots) {
      totalProcessed +=
        (s.counters.inserted ?? 0) +
        (s.counters.updated ?? 0) +
        (s.counters.flagged_review ?? 0);
      totalSkipped +=
        (s.counters.skipped_settled ?? 0) +
        (s.counters.skipped_unchanged ?? 0) +
        (s.counters.skipped_review_cadence ?? 0);
    }
    const total = totalProcessed + totalSkipped;
    if (total > 0) {
      const skipPct = ((totalSkipped / total) * 100).toFixed(1);
      console.log(
        `\nSkip ratio: ${totalSkipped}/${total} (${skipPct}%) — higher means the change-detection gates are paying off`
      );
    }
  }

  const totalMs = Date.now() - runStartMs;
  console.log(`\nFinished at: ${new Date().toISOString()}`);
  console.log(`Total wall time: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`Overall status: ${hasErrors ? "COMPLETED WITH ERRORS" : "SUCCESS"}`);

  // Finalize the sync_runs row.
  const errorCount = snapshots.reduce(
    (acc, s) => acc + (s.counters.errors ?? 0) + (s.counters.timeouts ?? 0),
    0
  );
  await finishRun(supabase, runId, {
    shopifyPhaseMs,
    catalogPhaseMs,
    llmPhaseMs,
    errorCount,
    status: hasErrors ? (snapshots.some((s) => s.abortedByWallCeiling) ? "partial" : "failed") : "success",
    summary: {
      shopify: { fetched: shopifyFetched, unchanged: shopifyUnchanged, review: shopifyReview, timeouts: shopifyTimeouts },
      catalog: { scraped: catalogScraped, unchanged: catalogUnchanged, review: catalogReview, timeouts: catalogTimeouts },
      locator_sources: allLocatorSources,
      brand_count: snapshots.length,
    },
  });

  if (hasErrors) process.exit(1);
}

main();
