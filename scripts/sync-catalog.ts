/**
 * sync-catalog.ts — Discover and sync products from brand websites.
 * Works for any brand (Shopify-blocked, non-Shopify, etc.) by scraping
 * product pages directly via sitemap discovery + Playwright.
 *
 * Usage:
 *   npx tsx scripts/sync-catalog.ts                          # All catalog brands
 *   npx tsx scripts/sync-catalog.ts --brand kotn             # Single brand
 *   npx tsx scripts/sync-catalog.ts --dry-run                # No DB writes
 *   npx tsx scripts/sync-catalog.ts --discover-only          # Just print found URLs
 *   npx tsx scripts/sync-catalog.ts --llm                    # LLM pass on review products
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { discoverProducts } from "./lib/catalog-discoverer.js";
import {
  launchBrowser,
  closeBrowser,
  scrapeProductData,
  type ScrapedProduct,
} from "./lib/page-scraper.js";
import {
  extractMaterialsFromText,
  type ExtractedMaterials,
} from "./lib/material-extractor.js";
import {
  slugify,
  isExtractionBanned,
  determineSyncStatus,
} from "./lib/curation.js";
import { loadEnv, getSupabaseAdmin } from "./lib/env.js";
import { syncProductMaterials } from "./lib/db-helpers.js";
import {
  classifyProductType,
  classifyAudience,
  shouldRejectProduct,
  guessCategory,
} from "./lib/product-classifier.js";
import { initStorageBucket, optimizeProductImages } from "./lib/image-optimizer.js";
import { getLocator } from "./brand-scrapers/registry.js";
import type { LocatedComposition } from "./brand-scrapers/locators/types.js";
import {
  BrandRunContext,
  TIMEOUT_PER_PRODUCT_MS,
  TIMEOUT_SCRAPE_MS,
  BRAND_WALL_TIME_MS,
  DEFAULT_REVIEW_CADENCE_DAYS,
  TimeoutError,
  withTimeout,
  runWithConcurrency,
} from "./lib/sync-reliability.js";

// Default catalog concurrency. Conservative: one shared browser, three
// workers. Start here and tune up once we have a baseline wall-time number
// from telemetry.
const CATALOG_CONCURRENCY = 3;

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ─── Types ──────────────────────────────────────────────────────────

export interface CatalogBrandRow {
  id: string;
  name: string;
  slug: string;
  website_url: string;
  is_fully_natural: boolean;
  scrape_fallback: boolean;
  shopify_domain: string | null;
  audience: string[];
  availability_cadence_days: number;
}

interface SyncStats {
  brand: string;
  discovered: number;
  scraped: number;
  inserted: number;
  autoApproved: number;
  skippedNonClothing: number;
  skippedBanned: number;
  skippedDuplicate: number;
  skippedUnchanged: number;
  skippedReviewCadence: number;
  availabilityUpdated: number;
  availabilitySkipped: boolean;
  flaggedReview: number;
  missingPrice: number;
  missingImage: number;
  timeouts: number;
  errors: number;
  abortedByWallCeiling: boolean;
  locatorSources: Record<string, number>;
}

export async function syncCatalogBrand(
  supabase: SupabaseClient,
  brand: CatalogBrandRow,
  options: {
    dryRun: boolean;
    discoverOnly: boolean;
    forceRescan?: boolean;
    brandCtx?: BrandRunContext;
    reviewCadenceDays?: number;
    wallTimeCeilingMs?: number;
    concurrency?: number;
  },
  materialCache: Map<string, string>
): Promise<SyncStats> {
  const stats: SyncStats = {
    brand: brand.name,
    discovered: 0,
    scraped: 0,
    inserted: 0,
    autoApproved: 0,
    skippedNonClothing: 0,
    skippedBanned: 0,
    skippedDuplicate: 0,
    skippedUnchanged: 0,
    skippedReviewCadence: 0,
    availabilityUpdated: 0,
    availabilitySkipped: false,
    flaggedReview: 0,
    missingPrice: 0,
    missingImage: 0,
    timeouts: 0,
    errors: 0,
    abortedByWallCeiling: false,
    locatorSources: {},
  };
  const brandCtx = options.brandCtx;
  const wallCeilingMs = options.wallTimeCeilingMs ?? BRAND_WALL_TIME_MS;
  const concurrency = options.concurrency ?? CATALOG_CONCURRENCY;
  // reviewCadenceDays is plumbed through but catalog's main cadence gate is
  // the brand-level availability sweep below. Kept for parity with Shopify.
  void (options.reviewCadenceDays ?? DEFAULT_REVIEW_CADENCE_DAYS);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`Syncing: ${brand.name} (${brand.website_url})`);
  console.log(`${"═".repeat(60)}`);

  const discoveryStart = Date.now();
  const discovery = await discoverProducts(brand.website_url, {
    brandSlug: brand.slug,
  });
  const discoveryMs = Date.now() - discoveryStart;
  brandCtx?.addStage("discovery_ms", discoveryMs);

  stats.discovered = discovery.urls.length;
  brandCtx?.bump("fetched_or_discovered", discovery.urls.length);
  console.log(
    `  Discovered ${discovery.urls.length} products via ${discovery.method} (${discoveryMs}ms)`
  );

  if (discovery.urls.length === 0) {
    console.log(`  No products found — skipping`);
    return stats;
  }

  if (options.discoverOnly) {
    for (const url of discovery.urls) {
      console.log(`    ${url}`);
    }
    return stats;
  }

  // Deduplicate against existing DB products
  const { data: existingProducts } = await supabase
    .from("products")
    .select("id, affiliate_url, sync_status, body_hash")
    .eq("brand_id", brand.id)
    .not("affiliate_url", "is", null);

  const existingUrls = new Map<string, { id: string; status: string }>();
  const existingHashMap = new Map<string, string | null>();
  for (const p of existingProducts || []) {
    if (p.affiliate_url) {
      existingUrls.set(p.affiliate_url, { id: p.id, status: p.sync_status });
      existingHashMap.set(p.affiliate_url, p.body_hash ?? null);
    }
  }

  // Separate approved URLs (need availability update) from truly new URLs
  const approvedUrls: Array<{ url: string; id: string }> = [];
  const newUrls: string[] = [];
  for (const url of discovery.urls) {
    const existing = existingUrls.get(url);
    if (!existing) {
      newUrls.push(url);
    } else if (existing.status === "approved") {
      approvedUrls.push({ url, id: existing.id });
    } else if (existing.status === "rejected") {
      // Skip rejected entirely
    } else {
      // review/pending — re-process
      newUrls.push(url);
    }
  }

  stats.skippedDuplicate = discovery.urls.length - newUrls.length - approvedUrls.length;
  if (stats.skippedDuplicate > 0) {
    console.log(`  Skipping ${stats.skippedDuplicate} rejected products`);
  }
  if (approvedUrls.length > 0) {
    console.log(`  ${approvedUrls.length} approved products (availability update)`);
  }

  // Availability fast-path for approved products
  if (approvedUrls.length > 0 && !options.dryRun && !options.discoverOnly) {
    // Cadence gate: only run the availability sweep if the last sweep is older
    // than the brand's configured cadence. Avoids daily full-scrape cost for
    // stable brands.
    //
    // We use brands.last_availability_sweep_at as the explicit source of
    // truth instead of inferring from max(products.last_synced_at). The old
    // implementation was noisy because last_synced_at gets bumped by every
    // write, so a partial sweep could fool the gate into thinking the brand
    // had been swept recently when it hadn't.
    const { data: brandRow } = await supabase
      .from("brands")
      .select("last_availability_sweep_at")
      .eq("id", brand.id)
      .single();
    const lastSweep = brandRow?.last_availability_sweep_at
      ? new Date(brandRow.last_availability_sweep_at)
      : null;
    const cadenceDays = brand.availability_cadence_days ?? 7;
    const cadenceMs = cadenceDays * 24 * 60 * 60 * 1000;
    const daysSince = lastSweep
      ? (Date.now() - lastSweep.getTime()) / (24 * 60 * 60 * 1000)
      : Infinity;

    if (lastSweep && Date.now() - lastSweep.getTime() < cadenceMs) {
      console.log(
        `  availability sweep skipped (last sweep ${daysSince.toFixed(1)}d ago, cadence ${cadenceDays}d)`
      );
      stats.availabilitySkipped = true;
      brandCtx?.bump("skipped_review_cadence", approvedUrls.length);
    } else {
      const availStart = Date.now();
      await launchBrowser();
      try {
        let sweepCompleted = true;
        for (const { url, id } of approvedUrls) {
          if (brandCtx?.checkWallTime(wallCeilingMs)) {
            brandCtx.abortedByWallCeiling = true;
            stats.abortedByWallCeiling = true;
            sweepCompleted = false;
            console.warn(
              `  ! Wall-time ceiling exceeded during availability sweep — aborting brand`
            );
            break;
          }
          const sweepProductStart = Date.now();
          try {
            const scraped = await withTimeout(
              scrapeProductData(url),
              TIMEOUT_SCRAPE_MS,
              `catalog-avail[${brand.slug}]`
            );
            const isAvailable = scraped.success ? scraped.isAvailable : true;
            await supabase
              .from("products")
              .update({ is_available: isAvailable, last_synced_at: new Date().toISOString() })
              .eq("id", id);
            stats.availabilityUpdated++;
            brandCtx?.bump("approved_availability_checked");
          } catch (err) {
            const isTimeout = err instanceof TimeoutError;
            if (isTimeout) stats.timeouts++;
            else stats.errors++;
            sweepCompleted = false;
            await brandCtx?.recordProductFailure({
              stage: "scrape",
              url,
              productRef: id,
              startedAt: new Date(sweepProductStart),
              durationMs: Date.now() - sweepProductStart,
              failureType: isTimeout ? "timeout" : "error",
              message: (err as Error).message,
            });
            console.warn(
              `  availability ${isTimeout ? "TIMEOUT" : "ERROR"} for ${url}: ${(err as Error).message}`
            );
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        // Only mark the brand as freshly swept if every URL succeeded. A
        // partial sweep should NOT advance the cadence — the gate would
        // hide stale stock.
        if (sweepCompleted && stats.availabilityUpdated === approvedUrls.length) {
          await supabase
            .from("brands")
            .update({ last_availability_sweep_at: new Date().toISOString() })
            .eq("id", brand.id);
        }
      } finally {
        await closeBrowser();
      }
      brandCtx?.addStage("availability_ms", Date.now() - availStart);
    }
  }

  if (newUrls.length === 0) {
    console.log(`  All products already synced`);
    return stats;
  }

  console.log(
    `  Scraping ${newUrls.length} new product pages (concurrency=${concurrency})...`
  );

  // Scrape each product page in a bounded concurrency pool. The browser
  // process is shared across workers; each worker opens its own page.
  // Per-product work is wrapped in a 60s timeout so a single slow page
  // can't stall the whole brand.
  const scrapeStart = Date.now();
  let processedCount = 0;
  let aborted = false;
  await launchBrowser();
  try {
    await runWithConcurrency(newUrls, concurrency, async (url, i) => {
      if (aborted) return;
      // Wall-time check before grabbing more work.
      if (brandCtx?.checkWallTime(wallCeilingMs)) {
        if (!aborted) {
          aborted = true;
          brandCtx.abortedByWallCeiling = true;
          stats.abortedByWallCeiling = true;
          console.warn(
            `  ! Wall-time ceiling ${(wallCeilingMs / 1000).toFixed(0)}s exceeded — aborting brand`
          );
          await brandCtx.recordProductFailure({
            stage: "brand",
            startedAt: new Date(),
            durationMs: brandCtx.elapsedMs(),
            failureType: "error",
            message: `wall-time ceiling ${wallCeilingMs}ms exceeded`,
          });
        }
        return;
      }

      const productStart = new Date();
      const productStartMs = Date.now();
      let stageReached: string = "scrape";

      const processProduct = async (): Promise<void> => {
        stageReached = "scrape";
        const scraped: ScrapedProduct = await withTimeout(
          scrapeProductData(url),
          TIMEOUT_SCRAPE_MS,
          `catalog-scrape[${brand.slug}]`
        );
        stats.scraped++;

        if (!scraped.success || !scraped.name) {
          throw new Error(scraped.error || "scrape failed: no name");
        }

        // Clean up name: strip trailing " | Brand Name" suffixes (common in og:title)
        // Require spaces around separator to avoid stripping hyphenated words like "Ultra-Soft"
        const cleanName = scraped.name.replace(/\s+[|–—-]\s+[^|–—-]+$/, "").trim();

        const rejection = shouldRejectProduct(cleanName, brand.slug);
        if (rejection.rejected) {
          stats.skippedNonClothing++;
          brandCtx?.bump("skipped_non_clothing");
          if (options.dryRun) {
            console.log(`  SKIP (${rejection.reason}): ${cleanName}`);
          }
          return;
        }

        // Body-hash skip gate: if the source HTML hasn't changed and the product
        // is already settled (not pending), skip re-processing. Dry-runs and
        // --force-rescan bypass the gate so operators can always force a full pass.
        // NOTE: the page has already been scraped by Playwright above — this gate
        // only saves parser + DB write time. The cadence gate above is where the
        // real Playwright savings come from.
        const incomingHash = sha256(scraped.html || "");
        const existingHash = existingHashMap.get(url);
        const existingInfo = existingUrls.get(url);
        const skippable =
          !options.forceRescan &&
          !options.dryRun &&
          existingHash &&
          existingHash === incomingHash &&
          existingInfo &&
          existingInfo.status !== "pending";

        if (skippable) {
          stats.skippedUnchanged++;
          brandCtx?.bump("skipped_unchanged");
          // Still bump availability/last_synced_at so the cadence gate works
          await supabase
            .from("products")
            .update({
              is_available: scraped.isAvailable,
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", existingInfo!.id);
          return;
        }

        // Extract materials via brand-specific locator (falls back to default)
        stageReached = "extract";
        const locator = getLocator(brand.slug);
        let located: LocatedComposition | null = null;
        try {
          located = await locator({
            brandSlug: brand.slug,
            productUrl: url,
            fetchHtml: async () => scraped.html || "",
          });
        } catch (err) {
          console.warn(
            `  locator failed for ${url}: ${(err as Error).message}`
          );
        }

        if (located) {
          stats.locatorSources[located.source] =
            (stats.locatorSources[located.source] || 0) + 1;
          brandCtx?.recordLocatorSource(located.source);
        }

        const extraction: ExtractedMaterials | null = located
          ? {
              materials: located.materials,
              confidence: located.confidence,
              hasBanned: Object.keys(located.materials).some((m) =>
                /Nylon|Polyester|Acrylic|Polyamide|Polypropylene/i.test(m)
              ),
              method: "regex",
            }
          : null;
        const hasMaterials =
          extraction !== null && Object.keys(extraction.materials).length > 0;

        // If banned, upsert a minimal rejected row so body_hash gets written.
        // Next run will short-circuit via the rejected-status skip above.
        if (extraction && isExtractionBanned(extraction)) {
          stageReached = "db";
          stats.skippedBanned++;
          brandCtx?.bump("skipped_banned");
          if (options.dryRun) {
            console.log(`  SKIP (banned): ${cleanName}`);
            return;
          }
          const existing = existingUrls.get(url);
          if (existing) {
            await supabase
              .from("products")
              .update({
                sync_status: "rejected",
                material_confidence: extraction.confidence,
                body_hash: incomingHash,
              })
              .eq("id", existing.id);
          } else {
            const bannedSlug = `${brand.slug}-${slugify(cleanName)}`;
            const bannedRow = {
              brand_id: brand.id,
              name: cleanName,
              slug: bannedSlug,
              category: guessCategory(cleanName),
              affiliate_url: url,
              sync_status: "rejected",
              material_confidence: extraction.confidence,
              body_hash: incomingHash,
            };
            const { error: bannedErr } = await supabase
              .from("products")
              .insert(bannedRow);
            if (bannedErr?.code === "23505" && bannedErr.message.includes("slug")) {
              await supabase
                .from("products")
                .insert({ ...bannedRow, slug: `${bannedSlug}-${Date.now()}` });
            } else if (bannedErr) {
              throw new Error(`banned-insert ${bannedErr.message}`);
            }
          }
          return;
        }

        // Track missing data
        if (!scraped.price) stats.missingPrice++;
        if (!scraped.imageUrl) stats.missingImage++;

        const syncStatus = hasMaterials
          ? determineSyncStatus(extraction!, scraped.price, scraped.imageUrl)
          : "review";
        const confidence = hasMaterials ? extraction!.confidence : 0;
        const category = guessCategory(cleanName);
        const productType = classifyProductType(cleanName);
        const audience = classifyAudience(cleanName, undefined, productType, brand.audience);
        const productSlug = `${brand.slug}-${slugify(cleanName)}`;

        if (syncStatus === "approved") stats.autoApproved++;
        if (syncStatus === "review") {
          stats.flaggedReview++;
          brandCtx?.bump("flagged_review");
        }

        if (options.dryRun) {
          const mats = hasMaterials
            ? Object.entries(extraction!.materials)
                .map(([m, p]) => `${p}% ${m}`)
                .join(", ")
            : "(none)";
          const icon = syncStatus === "approved" ? "✓" : "?";
          console.log(`  ${icon} ${cleanName} [${syncStatus}]`);
          console.log(`    Materials: ${mats} [conf=${confidence.toFixed(2)}]`);
          console.log(
            `    Price: ${scraped.price ? `$${scraped.price.toFixed(2)}` : "?"} | Category: ${category}`
          );
          return;
        }

        stageReached = "image";
        const optimizedImages = await optimizeProductImages(
          supabase,
          productSlug,
          scraped.imageCandidates
        );

        stageReached = "db";
        // Check if product already exists (e.g. from a previous partial run)
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("brand_id", brand.id)
          .eq("affiliate_url", url)
          .maybeSingle();

        let productId: string;

        if (existing) {
          const { error: updateError } = await supabase
            .from("products")
            .update({
              name: cleanName,
              description: scraped.description,
              category,
              price: scraped.price ?? null,
              currency: scraped.currency || "USD",
              image_url: optimizedImages.imageUrl,
              additional_images: optimizedImages.additionalImages,
              product_type: productType,
              audience,
              is_available: scraped.isAvailable,
              last_synced_at: new Date().toISOString(),
              sync_status: syncStatus,
              material_confidence: confidence,
              body_hash: incomingHash,
              source_updated_at: null,
            })
            .eq("id", existing.id);

          if (updateError) throw updateError;
          productId = existing.id;
        } else {
          const productData = {
            brand_id: brand.id,
            name: cleanName,
            slug: productSlug,
            description: scraped.description,
            category,
            price: scraped.price || 0,
            currency: scraped.currency || "USD",
            image_url: optimizedImages.imageUrl,
            additional_images: optimizedImages.additionalImages,
            affiliate_url: url,
            product_type: productType,
            audience,
            is_available: scraped.isAvailable,
            last_synced_at: new Date().toISOString(),
            sync_status: syncStatus,
            material_confidence: confidence,
            body_hash: incomingHash,
            source_updated_at: null,
          };

          const { data: inserted, error: insertError } = await supabase
            .from("products")
            .insert(productData)
            .select("id")
            .single();

          if (insertError) {
            // Slug collision — append a suffix
            if (
              insertError.code === "23505" &&
              insertError.message.includes("slug")
            ) {
              productData.slug = `${productSlug}-${Date.now()}`;
              const { data: retry, error: retryError } = await supabase
                .from("products")
                .insert(productData)
                .select("id")
                .single();

              if (retryError) throw retryError;
              productId = retry!.id;
            } else {
              throw insertError;
            }
          } else {
            productId = inserted!.id;
          }
        }

        if (hasMaterials) {
          await syncProductMaterials(
            supabase,
            productId,
            extraction!.materials,
            materialCache
          );
        }

        stats.inserted++;
        brandCtx?.bump("inserted");
      };

      try {
        await withTimeout(
          processProduct(),
          TIMEOUT_PER_PRODUCT_MS,
          `catalog[${brand.slug}/${i}]`
        );
      } catch (err) {
        const isTimeout = err instanceof TimeoutError;
        const duration = Date.now() - productStartMs;
        const message = (err as Error).message;
        if (isTimeout) {
          stats.timeouts++;
          console.error(`  TIMEOUT (${duration}ms, stage=${stageReached}): ${url}`);
        } else {
          stats.errors++;
          console.error(`  ERROR: ${url}: ${message}`);
        }
        if (brandCtx) {
          await brandCtx.recordProductFailure({
            stage: stageReached,
            url,
            startedAt: productStart,
            durationMs: duration,
            failureType: isTimeout ? "timeout" : "error",
            message,
          });
        }
      } finally {
        processedCount++;
        if (processedCount % 25 === 0 || processedCount === newUrls.length) {
          console.log(`  Progress: ${processedCount}/${newUrls.length}`);
        }
      }
    });
  } finally {
    await closeBrowser();
  }
  brandCtx?.addStage("scrape_ms", Date.now() - scrapeStart);

  // Update brand sync timestamp
  if (!options.dryRun) {
    await supabase
      .from("brands")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", brand.id);
  }

  return stats;
}

// ─── LLM pass for review products ───────────────────────────────────

export async function llmPass(
  supabase: SupabaseClient,
  brandSlug: string | null,
  materialCache: Map<string, string>,
  options: { onlyLocatorMissed?: boolean } = {}
): Promise<void> {
  const onlyLocatorMissed = options.onlyLocatorMissed === true;

  console.log("\n══════════════════════════════════════════════════════");
  console.log(
    onlyLocatorMissed
      ? "LLM PASS — Locator-missed only (review + confidence=0)"
      : "LLM PASS — Re-extracting materials for review products"
  );
  console.log("══════════════════════════════════════════════════════\n");

  // Dropped brands — skip these entirely in LLM pass
  const DROPPED_BRAND_SLUGS = ["everlane", "quince", "prana", "icebreaker"];

  // Get review products that have affiliate_url but no shopify_product_id
  // (i.e. catalog-scraped products). Exclude dropped brands.
  let query = supabase
    .from("products")
    .select("id, name, price, image_url, affiliate_url, sync_status, brands!inner(slug)")
    .eq("sync_status", "review")
    .is("shopify_product_id", null)
    .not("affiliate_url", "is", null)
    .not("brands.slug", "in", `(${DROPPED_BRAND_SLUGS.join(",")})`);

  if (onlyLocatorMissed) {
    query = query.eq("material_confidence", 0);
  }

  if (brandSlug) {
    query = query.eq("brands.slug", brandSlug);
  }

  const { data: products, error } = await query.limit(500);

  if (error) {
    console.error("Failed to fetch products:", error.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log("No review products to process.");
    return;
  }

  console.log(`Found ${products.length} review products to scrape + re-extract\n`);

  // Pre-filter: reject junk URLs (collection pages, bundles) before scraping
  const JUNK_URL_PATTERNS = [
    /nested-collection/i,     // Fair Indigo collection/category pages
    /\/bdl-/i,                // Pact bundle URLs (no individual price)
  ];

  const validProducts = [];
  let preRejected = 0;
  for (const product of products) {
    const isJunk = JUNK_URL_PATTERNS.some((p) => p.test(product.affiliate_url));
    if (isJunk) {
      await supabase
        .from("products")
        .update({ sync_status: "rejected" })
        .eq("id", product.id);
      preRejected++;
      console.log(`  REJECTED (junk URL): ${product.name}`);
    } else {
      validProducts.push(product);
    }
  }
  if (preRejected > 0) {
    console.log(`  Pre-filtered ${preRejected} junk URLs\n`);
  }

  await launchBrowser();
  let updated = 0;
  let rejected = 0;

  try {
    for (const product of validProducts) {
      // Re-run product classifier on existing name (catches items missed on initial sync)
      const brandSlugVal = (product as any).brands?.slug ?? "";
      const rejection = shouldRejectProduct(product.name, brandSlugVal);
      if (rejection.rejected) {
        await supabase
          .from("products")
          .update({ sync_status: "rejected" })
          .eq("id", product.id);
        rejected++;
        console.log(`  REJECTED (${rejection.reason}): ${product.name}`);
        continue;
      }

      const scraped = await scrapeProductData(product.affiliate_url);
      if (!scraped.success || !scraped.text) continue;

      const extraction = extractMaterialsFromText(scraped.text);
      if (!extraction || Object.keys(extraction.materials).length === 0) continue;

      if (isExtractionBanned(extraction)) {
        await supabase
          .from("products")
          .update({
            sync_status: "rejected",
            material_confidence: extraction.confidence,
          })
          .eq("id", product.id);
        rejected++;
        console.log(`  REJECTED: ${product.name}`);
        continue;
      }

      // Use scraped values if available, otherwise fall back to existing DB values
      const effectivePrice = scraped.price ?? product.price;
      const effectiveImage = scraped.imageUrl ?? product.image_url;
      const newStatus = determineSyncStatus(extraction, effectivePrice, effectiveImage);
      await supabase
        .from("products")
        .update({
          sync_status: newStatus,
          material_confidence: extraction.confidence,
          // Update image/price if we got them
          ...(scraped.imageUrl ? { image_url: scraped.imageUrl } : {}),
          ...(scraped.price ? { price: scraped.price } : {}),
        })
        .eq("id", product.id);

      await syncProductMaterials(
        supabase,
        product.id,
        extraction.materials,
        materialCache
      );

      const mats = Object.entries(extraction.materials)
        .map(([m, p]) => `${p}% ${m}`)
        .join(", ");
      const icon = newStatus === "approved" ? "✓" : "?";
      console.log(
        `  ${icon} ${product.name}: ${mats} [${newStatus}, conf=${extraction.confidence.toFixed(2)}]`
      );
      updated++;

      await new Promise((r) => setTimeout(r, 2000));
    }
  } finally {
    await closeBrowser();
  }

  console.log(`\nLLM pass complete: ${updated} updated, ${rejected} rejected`);
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const discoverOnly = args.includes("--discover-only");
  const llmMode = args.includes("--llm");
  const forceRescan = args.includes("--force-rescan");
  const brandFlag = args.indexOf("--brand");
  const brandSlug = brandFlag !== -1 ? args[brandFlag + 1] : null;

  const env = loadEnv();
  if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }

  const supabase = getSupabaseAdmin();
  const materialCache = new Map<string, string>();

  if (llmMode) {
    await llmPass(supabase, brandSlug, materialCache);
    return;
  }

  if (dryRun) console.log("DRY RUN — no database writes\n");
  if (discoverOnly) console.log("DISCOVER ONLY — just listing URLs\n");

  // Fetch catalog brands: website_url set, either no shopify_domain or scrape_fallback
  let query = supabase
    .from("brands")
    .select(
      "id, name, slug, website_url, is_fully_natural, scrape_fallback, shopify_domain, audience, availability_cadence_days"
    )
    .eq("sync_enabled", true)
    .not("website_url", "is", null);

  if (brandSlug) {
    query = query.eq("slug", brandSlug);
  } else {
    // Only brands that don't have a working Shopify API
    query = query.or("shopify_domain.is.null,scrape_fallback.eq.true");
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch brands:", error.message);
    process.exit(1);
  }

  const brands = (data || []) as CatalogBrandRow[];

  if (brands.length === 0) {
    console.error("No catalog brands found to sync");
    process.exit(1);
  }

  console.log(`Syncing ${brands.length} catalog brand(s)...`);

  // Ensure image storage bucket exists (no-op if already created)
  if (!dryRun) {
    await initStorageBucket(supabase);
  }

  const allStats: SyncStats[] = [];

  for (const brand of brands) {
    const stats = await syncCatalogBrand(
      supabase,
      brand,
      { dryRun, discoverOnly, forceRescan },
      materialCache
    );
    allStats.push(stats);
  }

  // Print summary
  console.log(`\n${"═".repeat(60)}`);
  console.log("CATALOG SYNC SUMMARY");
  console.log(`${"═".repeat(60)}`);

  let totalDiscovered = 0,
    totalScraped = 0,
    totalInserted = 0,
    totalApproved = 0,
    totalNonClothing = 0,
    totalBanned = 0,
    totalDuplicate = 0,
    totalSkippedUnchanged = 0,
    totalAvailabilityUpdated = 0,
    totalReview = 0,
    totalMissingPrice = 0,
    totalMissingImage = 0,
    totalErrors = 0;
  const totalLocatorSources: Record<string, number> = {};

  for (const s of allStats) {
    const missingPart = (s.missingPrice > 0 || s.missingImage > 0)
      ? `, ${s.missingPrice} no-price, ${s.missingImage} no-image`
      : "";
    const sourcesEntries = Object.entries(s.locatorSources);
    const sourcesPart = sourcesEntries.length > 0
      ? ` [${sourcesEntries.map(([k, v]) => `${k}: ${v}`).join(", ")}]`
      : "";
    const availSkippedPart = s.availabilitySkipped ? ", availability skipped" : "";
    console.log(
      `  ${s.brand}: ${s.discovered} discovered, ${s.scraped} scraped, ${s.inserted} synced, ${s.autoApproved} approved, ${s.skippedBanned} banned, ${s.skippedNonClothing} non-clothing, ${s.skippedDuplicate} dupes, ${s.flaggedReview} review, ${s.skippedUnchanged} unchanged${sourcesPart}${missingPart}${availSkippedPart}`
    );
    totalDiscovered += s.discovered;
    totalScraped += s.scraped;
    totalInserted += s.inserted;
    totalApproved += s.autoApproved;
    totalNonClothing += s.skippedNonClothing;
    totalBanned += s.skippedBanned;
    totalDuplicate += s.skippedDuplicate;
    totalSkippedUnchanged += s.skippedUnchanged;
    totalAvailabilityUpdated += s.availabilityUpdated;
    totalReview += s.flaggedReview;
    totalMissingPrice += s.missingPrice;
    totalMissingImage += s.missingImage;
    totalErrors += s.errors;
    for (const [k, v] of Object.entries(s.locatorSources)) {
      totalLocatorSources[k] = (totalLocatorSources[k] || 0) + v;
    }
  }

  const missingTotalPart = (totalMissingPrice > 0 || totalMissingImage > 0)
    ? `, ${totalMissingPrice} no-price, ${totalMissingImage} no-image`
    : "";
  const availPart = totalAvailabilityUpdated > 0 ? `, ${totalAvailabilityUpdated} availability-updated` : "";
  const totalSourcesEntries = Object.entries(totalLocatorSources);
  const totalSourcesPart = totalSourcesEntries.length > 0
    ? ` [${totalSourcesEntries.map(([k, v]) => `${k}: ${v}`).join(", ")}]`
    : "";
  console.log(
    `\nTotal: ${totalDiscovered} discovered, ${totalScraped} scraped, ${totalInserted} synced, ${totalApproved} approved, ${totalBanned} banned, ${totalNonClothing} non-clothing, ${totalDuplicate} dupes, ${totalSkippedUnchanged} unchanged (skipped), ${totalReview} review${totalSourcesPart}${availPart}${missingTotalPart}, ${totalErrors} errors`
  );

  if (totalReview > 0) {
    console.log(
      `\nRun 'npx tsx scripts/sync-catalog.ts --llm' to re-scrape review products`
    );
  }

  if (totalErrors > 0) process.exit(1);
}

// Only run main when executed directly (not imported)
const isDirectRun = process.argv[1]?.endsWith("sync-catalog.ts") || process.argv[1]?.endsWith("sync-catalog.js");
if (isDirectRun) main();
