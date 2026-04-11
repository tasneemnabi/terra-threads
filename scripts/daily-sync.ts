/**
 * daily-sync.ts — Orchestration script that runs both Shopify and catalog
 * sync pipelines in sequence. Designed for scheduled automation (e.g.
 * Claude Code Cloud Scheduled Tasks).
 *
 * Usage:
 *   npx tsx scripts/daily-sync.ts
 */

import { syncBrand, llmPass as shopifyLlmPass, type BrandRow } from "./sync-shopify.js";
import {
  syncCatalogBrand,
  llmPass as catalogLlmPass,
  type CatalogBrandRow,
} from "./sync-catalog.js";
import { loadEnv, getSupabaseAdmin } from "./lib/env.js";

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

  for (const brand of (shopifyBrands || []) as BrandRow[]) {
    try {
      const stats = await syncBrand(supabase, brand, { dryRun: false }, materialCache);
      const detail = `${stats.fetched} fetched, ${stats.skippedUnchanged} unchanged, ${stats.inserted} synced, ${stats.flaggedReview} review, ${stats.availabilityUpdated} avail-updated`;
      shopifyResults.push({
        brand: brand.name,
        status: stats.errors > 0 ? "WARN" : "OK",
        detail,
        stats,
      });
      if (stats.errors > 0) hasErrors = true;
    } catch (err) {
      shopifyResults.push({
        brand: brand.name,
        status: "FAIL",
        detail: (err as Error).message,
        stats: null,
      });
      hasErrors = true;
    }
  }

  // ─── 2. Catalog sync ──────────────────────────────────────────────

  console.log("\n▶ Phase 2: Catalog brands\n");

  const { data: catalogBrands, error: catalogError } = await supabase
    .from("brands")
    .select(
      "id, name, slug, website_url, is_fully_natural, scrape_fallback, shopify_domain, audience, availability_cadence_days"
    )
    .eq("sync_enabled", true)
    .not("website_url", "is", null)
    .or("shopify_domain.is.null,scrape_fallback.eq.true");

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

  for (const brand of (catalogBrands || []) as CatalogBrandRow[]) {
    try {
      const stats = await syncCatalogBrand(
        supabase,
        brand,
        { dryRun: false, discoverOnly: false },
        materialCache
      );
      const detail = `${stats.discovered} discovered, ${stats.skippedUnchanged} unchanged, ${stats.inserted} synced, ${stats.flaggedReview} review, ${stats.availabilityUpdated} avail-updated`;
      catalogResults.push({
        brand: brand.name,
        status: stats.errors > 0 ? "WARN" : "OK",
        detail,
        stats,
      });
      if (stats.errors > 0) hasErrors = true;
    } catch (err) {
      catalogResults.push({
        brand: brand.name,
        status: "FAIL",
        detail: (err as Error).message,
        stats: null,
      });
      hasErrors = true;
    }
  }

  // ─── 3. LLM fallback for residual review products ───────────────

  console.log("\n▶ Phase 3: LLM fallback for locator-missed products\n");

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
  for (const r of shopifyResults) {
    if (!r.stats) continue;
    shopifyFetched += r.stats.fetched;
    shopifyUnchanged += r.stats.skippedUnchanged;
    shopifyReview += r.stats.flaggedReview;
    for (const [k, v] of Object.entries(r.stats.locatorSources || {})) {
      allLocatorSources[k] = (allLocatorSources[k] || 0) + v;
    }
  }

  let catalogScraped = 0;
  let catalogUnchanged = 0;
  let catalogReview = 0;
  for (const r of catalogResults) {
    if (!r.stats) continue;
    catalogScraped += r.stats.scraped;
    catalogUnchanged += r.stats.skippedUnchanged;
    catalogReview += r.stats.flaggedReview;
    for (const [k, v] of Object.entries(r.stats.locatorSources || {})) {
      allLocatorSources[k] = (allLocatorSources[k] || 0) + v;
    }
  }

  console.log(
    `\nShopify: ${shopifyFetched} fetched, ${shopifyUnchanged} unchanged, ${shopifyReview} review`
  );
  console.log(
    `Catalog: ${catalogScraped} scraped, ${catalogUnchanged} unchanged, ${catalogReview} review`
  );

  const sourceLine = Object.entries(allLocatorSources)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  console.log(`Locator sources: ${sourceLine || "(none)"}`);

  console.log(`\nFinished at: ${new Date().toISOString()}`);
  console.log(`Overall status: ${hasErrors ? "COMPLETED WITH ERRORS" : "SUCCESS"}`);

  if (hasErrors) process.exit(1);
}

main();
