/**
 * sync-shopify.ts — Fetch products from Shopify stores, extract materials,
 *                   and upsert into Supabase.
 *
 * Pass 1 (default): Regex-only extraction. Fast, free, no API calls.
 *   npx tsx scripts/sync-shopify.ts                     (sync all enabled brands)
 *   npx tsx scripts/sync-shopify.ts --brand layere       (sync single brand)
 *   npx tsx scripts/sync-shopify.ts --dry-run            (fetch + extract, no DB writes)
 *
 * Pass 2 (--llm): Re-extract materials for review products using Gemini.
 *   npx tsx scripts/sync-shopify.ts --llm                (all review products)
 *   npx tsx scripts/sync-shopify.ts --llm --brand layere (single brand)
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllProducts, type ShopifyProduct } from "./lib/shopify-fetcher.js";
import { extractMaterialsRegex, extractMaterialsBatch, type ExtractedMaterials } from "./lib/material-extractor.js";
import { slugify, isExtractionBanned, determineSyncStatus } from "./lib/curation.js";
import { loadEnv, getSupabaseAdmin } from "./lib/env.js";
import { ensureMaterialExists, syncProductMaterials } from "./lib/db-helpers.js";
import { launchBrowser, closeBrowser, scrapePage } from "./lib/page-scraper.js";
import { extractMaterialsFromText } from "./lib/material-extractor.js";
import { initStorageBucket, optimizeProductImages } from "./lib/image-optimizer.js";
import { getLocator } from "./brand-scrapers/registry.js";
import type { LocatedComposition } from "./brand-scrapers/locators/types.js";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ─── Types ──────────────────────────────────────────────────────────

export interface BrandRow {
  id: string;
  name: string;
  slug: string;
  shopify_domain: string;
  is_fully_natural: boolean;
  scrape_fallback: boolean;
  audience: string[];
}

interface SyncStats {
  brand: string;
  fetched: number;
  inserted: number;
  updated: number;
  autoApproved: number;
  skippedBanned: number;
  skippedNonClothing: number;
  skippedSettled: number;
  skippedUnchanged: number;
  availabilityUpdated: number;
  scrapeHits: number;
  flaggedReview: number;
  removed: number;
  missingPrice: number;
  missingImage: number;
  errors: number;
  locatorSources: Record<string, number>;
}

// ─── Helpers ────────────────────────────────────────────────────────

function getFirstVariantPrice(product: ShopifyProduct): number | null {
  const variant = product.variants?.[0];
  if (!variant || !variant.price) return null;
  const parsed = parseFloat(variant.price);
  return isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function getImages(product: ShopifyProduct): { primary: string | null; additional: string[] } {
  const images = (product.images || []).map((img) => img.src);
  return {
    primary: images[0] || null,
    additional: images.slice(1),
  };
}

import { classifyProductType, mapActivewearType, shouldRejectProduct, classifyAudience, guessCategory } from "./lib/product-classifier";

// ─── Pass 1: Sync from Shopify (regex only) ─────────────────────────

export async function syncBrand(
  supabase: SupabaseClient,
  brand: BrandRow,
  options: { dryRun: boolean; forceRescan?: boolean },
  materialCache: Map<string, string>
): Promise<SyncStats> {
  const stats: SyncStats = {
    brand: brand.name,
    fetched: 0,
    inserted: 0,
    updated: 0,
    autoApproved: 0,
    skippedBanned: 0,
    skippedNonClothing: 0,
    skippedSettled: 0,
    skippedUnchanged: 0,
    availabilityUpdated: 0,
    scrapeHits: 0,
    flaggedReview: 0,
    removed: 0,
    missingPrice: 0,
    missingImage: 0,
    errors: 0,
    locatorSources: {},
  };

  console.log(`\n${"═".repeat(60)}`);
  console.log(`Syncing: ${brand.name} (${brand.shopify_domain})`);
  console.log(`${"═".repeat(60)}`);

  let shopifyProducts: ShopifyProduct[];
  try {
    shopifyProducts = await fetchAllProducts(brand.shopify_domain);
  } catch (err) {
    console.error(`  Failed to fetch products: ${(err as Error).message}`);
    stats.errors++;
    return stats;
  }

  stats.fetched = shopifyProducts.length;
  console.log(`  Fetched ${shopifyProducts.length} products from Shopify`);

  if (shopifyProducts.length === 0) return stats;

  const seenShopifyIds = new Set<number>();

  // Fetch existing product statuses so we don't re-process settled products
  const existingStatusMap = new Map<number, string>();
  const existingHashMap = new Map<number, string | null>();
  {
    const { data: existing } = await supabase
      .from("products")
      .select("shopify_product_id, sync_status, body_hash")
      .eq("brand_id", brand.id)
      .not("shopify_product_id", "is", null);
    for (const row of existing || []) {
      existingStatusMap.set(row.shopify_product_id, row.sync_status);
      existingHashMap.set(row.shopify_product_id, row.body_hash ?? null);
    }
    const rejectedCount = [...existingStatusMap.values()].filter((s) => s === "rejected").length;
    const approvedCount = [...existingStatusMap.values()].filter((s) => s === "approved").length;
    if (rejectedCount > 0 || approvedCount > 0) {
      console.log(`  ${approvedCount} approved (availability update) + ${rejectedCount} rejected (skipped)`);
    }
  }

  // Batch availability updates for approved products (collect, then flush)
  const availableIds: number[] = [];
  const unavailableIds: number[] = [];
  for (const shopifyProduct of shopifyProducts) {
    const existingStatus = existingStatusMap.get(shopifyProduct.id);
    if (existingStatus === "approved") {
      const isAvailable = shopifyProduct.variants.some((v) => v.available);
      (isAvailable ? availableIds : unavailableIds).push(shopifyProduct.id);
    }
  }

  if (!options.dryRun && (availableIds.length > 0 || unavailableIds.length > 0)) {
    const now = new Date().toISOString();
    if (availableIds.length > 0) {
      await supabase
        .from("products")
        .update({ is_available: true, last_synced_at: now })
        .eq("brand_id", brand.id)
        .in("shopify_product_id", availableIds);
    }
    if (unavailableIds.length > 0) {
      await supabase
        .from("products")
        .update({ is_available: false, last_synced_at: now })
        .eq("brand_id", brand.id)
        .in("shopify_product_id", unavailableIds);
    }
    stats.availabilityUpdated = availableIds.length + unavailableIds.length;
    console.log(`  Availability batch: ${availableIds.length} available, ${unavailableIds.length} unavailable`);
  }

  // Regex-only extraction for all products
  let regexHits = 0;
  const zeroMaterialProducts: Array<{ url: string; productId: string; name: string; price: number | null; imageUrl: string | null }> = [];
  for (const shopifyProduct of shopifyProducts) {
    seenShopifyIds.add(shopifyProduct.id);

    // Skip rejected products entirely
    const existingStatus = existingStatusMap.get(shopifyProduct.id);
    if (existingStatus === "rejected") {
      stats.skippedSettled++;
      continue;
    }

    // Approved products: already handled in batch above
    if (existingStatus === "approved") {
      stats.skippedSettled++;
      continue;
    }

    // Body-hash skip gate: if the source HTML hasn't changed and the product
    // is already settled (not pending), skip re-processing. Dry-runs and
    // --force-rescan bypass the gate so operators can always force a full pass.
    const incomingHash = sha256(shopifyProduct.body_html ?? "");
    const existingHash = existingHashMap.get(shopifyProduct.id);
    const existingStatusForSkip = existingStatusMap.get(shopifyProduct.id);
    if (
      !options.forceRescan &&
      !options.dryRun &&
      existingHash &&
      existingHash === incomingHash &&
      existingStatusForSkip &&
      existingStatusForSkip !== "pending"
    ) {
      stats.skippedUnchanged++;
      continue;
    }

    // Skip non-clothing products
    const rejection = shouldRejectProduct(shopifyProduct.title, brand.slug, shopifyProduct.product_type, shopifyProduct.tags);
    if (rejection.rejected) {
      stats.skippedNonClothing++;
      if (options.dryRun) {
        console.log(`  SKIP (${rejection.reason}): ${shopifyProduct.title}`);
      }
      continue;
    }

    const locator = getLocator(brand.slug);
    let located: LocatedComposition | null = null;
    try {
      located = await locator({
        brandSlug: brand.slug,
        shopifyProduct,
        productUrl: `https://${brand.shopify_domain}/products/${shopifyProduct.handle}`,
        fetchHtml: async () => {
          const resp = await fetch(`https://${brand.shopify_domain}/products/${shopifyProduct.handle}`);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return resp.text();
        },
      });
    } catch (err) {
      console.error(`  locator error for ${shopifyProduct.title}: ${(err as Error).message}`);
    }

    // Track source distribution for telemetry
    if (located) {
      stats.locatorSources[located.source] = (stats.locatorSources[located.source] || 0) + 1;
    }

    // Convert LocatedComposition to ExtractedMaterials shape for downstream code
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
    const hasMaterials = extraction !== null && Object.keys(extraction.materials).length > 0;

    if (hasMaterials) regexHits++;

    // If regex found banned materials, upsert a minimal rejected row so the
    // body_hash gets written. Next run short-circuits via the settled-status
    // skip (which runs before the body_hash gate).
    if (extraction && isExtractionBanned(extraction)) {
      stats.skippedBanned++;
      if (options.dryRun) {
        console.log(`  SKIP (banned): ${shopifyProduct.title}`);
        continue;
      }
      const bannedCategory = guessCategory(
        `${shopifyProduct.title} ${shopifyProduct.product_type} ${(shopifyProduct.tags || []).join(" ")}`
      );
      const bannedSlug = `${brand.slug}-${slugify(shopifyProduct.title)}`;
      const bannedRow = {
        brand_id: brand.id,
        name: shopifyProduct.title,
        slug: bannedSlug,
        category: bannedCategory,
        shopify_product_id: shopifyProduct.id,
        sync_status: "rejected",
        material_confidence: extraction.confidence,
        body_hash: incomingHash,
      };
      const { error: bannedErr } = await supabase
        .from("products")
        .upsert(bannedRow, {
          onConflict: "brand_id,shopify_product_id",
          ignoreDuplicates: false,
        });
      if (bannedErr?.code === "23505" && bannedErr.message.includes("slug")) {
        await supabase
          .from("products")
          .upsert(
            { ...bannedRow, slug: `${bannedSlug}-${shopifyProduct.id}` },
            { onConflict: "brand_id,shopify_product_id", ignoreDuplicates: false }
          );
      } else if (bannedErr) {
        console.error(
          `  ERROR upserting banned ${shopifyProduct.title}: ${bannedErr.message}`
        );
        stats.errors++;
      }
      continue;
    }

    const variant = shopifyProduct.variants?.[0];
    const images = getImages(shopifyProduct);
    const price = getFirstVariantPrice(shopifyProduct);

    // Track missing data
    if (!price) stats.missingPrice++;
    if (!images.primary) stats.missingImage++;

    // Determine sync status: auto-approve if trusted materials + high confidence + complete data
    const syncStatus = hasMaterials ? determineSyncStatus(extraction!, price, images.primary) : "review";
    if (syncStatus === "review") stats.flaggedReview++;
    const confidence = hasMaterials ? extraction!.confidence : 0;
    const category = guessCategory(`${shopifyProduct.title} ${shopifyProduct.product_type} ${(shopifyProduct.tags || []).join(" ")}`);
    const rawProductType = classifyProductType(shopifyProduct.title, shopifyProduct.product_type, shopifyProduct.tags);
    const productType = rawProductType && category === "activewear" ? mapActivewearType(rawProductType) : rawProductType;
    const audience = classifyAudience(shopifyProduct.title, shopifyProduct.tags, productType, brand.audience);
    const productSlug = `${brand.slug}-${slugify(shopifyProduct.title)}`;

    if (syncStatus === "approved") stats.autoApproved++;

    if (options.dryRun) {
      const mats = hasMaterials
        ? Object.entries(extraction!.materials).map(([m, p]) => `${p}% ${m}`).join(", ")
        : "(none)";
      const icon = syncStatus === "approved" ? "✓" : syncStatus === "review" ? "?" : "+";
      console.log(`  ${icon} ${shopifyProduct.title} [${syncStatus}]`);
      console.log(`    Materials: ${mats} [regex, conf=${confidence.toFixed(2)}]`);
      console.log(`    Price: ${price ? `$${price.toFixed(2)}` : "?"} | Category: ${category}`);
      continue;
    }

    try {
      // Optimize images: download, resize to WebP, upload to Supabase Storage
      const optimizedImages = await optimizeProductImages(
        supabase,
        productSlug,
        images.primary,
        images.additional
      );

      const productData = {
        brand_id: brand.id,
        name: shopifyProduct.title,
        slug: productSlug,
        description: shopifyProduct.body_html
          ? shopifyProduct.body_html.replace(/<[^>]+>/g, "").slice(0, 500)
          : null,
        category,
        price,
        currency: "USD",
        image_url: optimizedImages.imageUrl,
        additional_images: optimizedImages.additionalImages,
        affiliate_url: `https://${brand.shopify_domain}/products/${shopifyProduct.handle}`,
        product_type: productType,
        shopify_product_type: shopifyProduct.product_type || null,
        audience,
        shopify_product_id: shopifyProduct.id,
        shopify_variant_id: variant?.id || null,
        is_available: shopifyProduct.variants.some((v) => v.available),
        last_synced_at: new Date().toISOString(),
        sync_status: syncStatus,
        material_confidence: confidence,
        raw_body_html: shopifyProduct.body_html,
        body_hash: incomingHash,
        source_updated_at: shopifyProduct.updated_at || null,
      };

      const { data: upserted, error: upsertError } = await supabase
        .from("products")
        .upsert(productData, {
          onConflict: "brand_id,shopify_product_id",
          ignoreDuplicates: false,
        })
        .select("id")
        .single();

      if (upsertError) {
        if (upsertError.code === "23505" && upsertError.message.includes("slug")) {
          productData.slug = `${productSlug}-${shopifyProduct.id}`;
          const { data: retry, error: retryError } = await supabase
            .from("products")
            .upsert(productData, {
              onConflict: "brand_id,shopify_product_id",
              ignoreDuplicates: false,
            })
            .select("id")
            .single();

          if (retryError) throw retryError;
          if (!retry) throw new Error("No data returned from upsert");

          if (hasMaterials) {
            await syncProductMaterials(supabase, retry.id, extraction!.materials, materialCache);
          } else if (brand.scrape_fallback) {
            zeroMaterialProducts.push({
              url: productData.affiliate_url,
              productId: retry.id,
              name: shopifyProduct.title,
              price,
              imageUrl: images.primary,
            });
          }
        } else {
          throw upsertError;
        }
      } else if (upserted) {
        if (hasMaterials) {
          await syncProductMaterials(supabase, upserted.id, extraction!.materials, materialCache);
        } else if (brand.scrape_fallback) {
          zeroMaterialProducts.push({
            url: productData.affiliate_url,
            productId: upserted.id,
            name: shopifyProduct.title,
            price,
            imageUrl: images.primary,
          });
        }
      }

      stats.inserted++;
    } catch (err) {
      console.error(`  ERROR: ${shopifyProduct.title}: ${(err as Error).message}`);
      stats.errors++;
    }
  }

  console.log(`  Regex extracted: ${regexHits}/${shopifyProducts.length}, review: ${stats.flaggedReview}`);

  // ─── Scrape fallback for zero-material products ──────────
  if (brand.scrape_fallback && zeroMaterialProducts.length > 0) {
    if (options.dryRun) {
      console.log(`  Scrape fallback: would scrape ${zeroMaterialProducts.length} products (skipped in dry-run)`);
    } else {
      console.log(`  Scrape fallback: scraping ${zeroMaterialProducts.length} products...`);
      await launchBrowser();
      try {
        for (const item of zeroMaterialProducts) {
          const page = await scrapePage(item.url);
          if (!page.success || !page.text) continue;

          const scrapeExtraction = extractMaterialsFromText(page.text);
          if (!scrapeExtraction || Object.keys(scrapeExtraction.materials).length === 0) continue;

          if (isExtractionBanned(scrapeExtraction)) {
            await supabase
              .from("products")
              .update({ sync_status: "rejected", material_confidence: scrapeExtraction.confidence })
              .eq("id", item.productId);
            stats.skippedBanned++;
            stats.flaggedReview--;
            console.log(`    REJECTED (banned): ${item.name}`);
            continue;
          }

          const newStatus = determineSyncStatus(scrapeExtraction, item.price, item.imageUrl);
          await supabase
            .from("products")
            .update({ sync_status: newStatus, material_confidence: scrapeExtraction.confidence })
            .eq("id", item.productId);

          await syncProductMaterials(supabase, item.productId, scrapeExtraction.materials, materialCache);

          stats.scrapeHits++;
          if (newStatus === "approved") {
            stats.autoApproved++;
            stats.flaggedReview--;
          }

          const mats = Object.entries(scrapeExtraction.materials).map(([m, p]) => `${p}% ${m}`).join(", ");
          console.log(`    SCRAPED: ${item.name} → ${mats} [${newStatus}]`);
        }
      } finally {
        await closeBrowser();
      }
      console.log(`  Scrape fallback: ${stats.scrapeHits}/${zeroMaterialProducts.length} extracted`);
    }
  }

  // Remove products no longer in Shopify
  if (!options.dryRun && seenShopifyIds.size > 0) {
    const { data: existingProducts } = await supabase
      .from("products")
      .select("id, shopify_product_id")
      .eq("brand_id", brand.id)
      .not("shopify_product_id", "is", null);

    if (existingProducts) {
      const toRemove = existingProducts.filter(
        (p) => !seenShopifyIds.has(p.shopify_product_id)
      );

      if (toRemove.length > 0) {
        const ids = toRemove.map((p) => p.id);
        await supabase.from("product_materials").delete().in("product_id", ids);
        await supabase.from("products").delete().in("id", ids);
        stats.removed = toRemove.length;
        console.log(`  - Removed ${toRemove.length} products no longer in Shopify`);
      }
    }
  }

  // Update brand sync timestamp
  if (!options.dryRun) {
    await supabase
      .from("brands")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", brand.id);
  }

  return stats;
}

// ─── Pass 2: LLM extraction for products missing materials ──────────

export async function llmPass(
  supabase: SupabaseClient,
  brandSlug: string | null,
  materialCache: Map<string, string>,
  options: { limit?: number; onlyLocatorMissed?: boolean } = {}
): Promise<void> {
  const limit = options.limit ?? 500;
  const onlyLocatorMissed = options.onlyLocatorMissed === true;

  console.log("\n══════════════════════════════════════════════════════");
  console.log(
    onlyLocatorMissed
      ? "LLM PASS — Locator-missed only (review + confidence=0)"
      : "LLM PASS — Extracting materials for products missing them"
  );
  console.log("══════════════════════════════════════════════════════\n");

  // Query products that have raw_body_html
  let query = supabase
    .from("products")
    .select("id, name, price, image_url, raw_body_html, sync_status, brands!inner(slug)")
    .not("raw_body_html", "is", null);

  if (onlyLocatorMissed) {
    query = query.eq("sync_status", "review").eq("material_confidence", 0);
  } else {
    query = query.in("sync_status", ["pending", "review"]);
  }

  if (brandSlug) {
    query = query.eq("brands.slug", brandSlug);
  }

  const { data: products, error } = await query.limit(limit);

  if (error) {
    console.error("Failed to fetch products:", error.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log("No pending/review products with raw_body_html found.");
    return;
  }

  // Check which ones actually have no materials
  const productIds = products.map((p) => p.id);
  const { data: existingMats } = await supabase
    .from("product_materials")
    .select("product_id")
    .in("product_id", productIds);

  const hasMatSet = new Set((existingMats || []).map((m) => m.product_id));
  const needsLLM = products.filter((p) => !hasMatSet.has(p.id));

  console.log(`Found ${products.length} pending/review products, ${needsLLM.length} missing materials\n`);

  if (needsLLM.length === 0) return;

  // Build fake ShopifyProduct objects for the batch extractor
  const fakeProducts: ShopifyProduct[] = needsLLM.map((p) => ({
    id: 0,
    title: p.name,
    handle: "",
    body_html: p.raw_body_html,
    vendor: "",
    product_type: "",
    tags: [],
    variants: [],
    images: [],
    created_at: "",
    updated_at: "",
  }));

  // Run batch extraction (this will use regex first, then LLM)
  const extractions = await extractMaterialsBatch(fakeProducts);

  let updated = 0;
  let skippedBanned = 0;

  for (let i = 0; i < needsLLM.length; i++) {
    const product = needsLLM[i];
    const extraction = extractions.get(i);
    if (!extraction || Object.keys(extraction.materials).length === 0) continue;

    if (isExtractionBanned(extraction)) {
      skippedBanned++;
      // Mark as rejected
      await supabase
        .from("products")
        .update({ sync_status: "rejected", material_confidence: extraction.confidence })
        .eq("id", product.id);
      console.log(`  REJECTED (banned): ${product.name}`);
      continue;
    }

    // Update product with new confidence and status (uses same auto-approve logic)
    const newStatus = determineSyncStatus(extraction, product.price, product.image_url);
    await supabase
      .from("products")
      .update({
        sync_status: newStatus,
        material_confidence: extraction.confidence,
      })
      .eq("id", product.id);

    // Insert materials
    await syncProductMaterials(supabase, product.id, extraction.materials, materialCache);

    const mats = Object.entries(extraction.materials)
      .map(([m, p]) => `${p}% ${m}`)
      .join(", ");
    const icon = newStatus === "approved" ? "✓" : newStatus === "pending" ? "+" : "?";
    console.log(`  ${icon} ${product.name}: ${mats} [${newStatus}, conf=${extraction.confidence.toFixed(2)}]`);
    updated++;
  }

  console.log(`\nLLM pass complete: ${updated} updated, ${skippedBanned} rejected`);
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const llmMode = args.includes("--llm");
  const forceRescan = args.includes("--force-rescan");
  const brandFlag = args.indexOf("--brand");
  const brandSlug = brandFlag !== -1 ? args[brandFlag + 1] : null;

  // Load env
  const env = loadEnv();
  if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }

  const supabase = getSupabaseAdmin();
  const materialCache = new Map<string, string>();

  // Pass 2: LLM mode
  if (llmMode) {
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY required for --llm mode");
      process.exit(1);
    }
    await llmPass(supabase, brandSlug, materialCache);
    return;
  }

  // Pass 1: Sync from Shopify (regex only)
  if (dryRun) {
    console.log("DRY RUN — no database writes will be made\n");
  }

  // Fetch brands to sync
  let query = supabase
    .from("brands")
    .select("id, name, slug, shopify_domain, is_fully_natural, scrape_fallback, audience")
    .not("shopify_domain", "is", null)
    .eq("sync_enabled", true);

  if (brandSlug) {
    query = query.eq("slug", brandSlug);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to fetch brands:", error.message);
    process.exit(1);
  }

  const brands = (data || []) as BrandRow[];

  if (brands.length === 0) {
    console.error("No brands found to sync");
    process.exit(1);
  }

  console.log(`Syncing ${brands.length} brand(s) (regex only)...`);

  // Ensure image storage bucket exists (no-op if already created)
  if (!dryRun) {
    await initStorageBucket(supabase);
  }

  const allStats: SyncStats[] = [];

  for (const brand of brands) {
    const stats = await syncBrand(supabase, brand, { dryRun, forceRescan }, materialCache);
    allStats.push(stats);
  }

  // Print summary
  console.log(`\n${"═".repeat(60)}`);
  console.log("SYNC SUMMARY");
  console.log(`${"═".repeat(60)}`);

  let totalFetched = 0,
    totalInserted = 0,
    totalApproved = 0,
    totalSkipped = 0,
    totalSettled = 0,
    totalSkippedUnchanged = 0,
    totalAvailabilityUpdated = 0,
    totalScrapeHits = 0,
    totalReview = 0,
    totalRemoved = 0,
    totalMissingPrice = 0,
    totalMissingImage = 0,
    totalErrors = 0;
  const totalLocatorSources: Record<string, number> = {};

  for (const s of allStats) {
    const scrapePart = s.scrapeHits > 0 ? `, ${s.scrapeHits} scraped` : "";
    const missingPart = (s.missingPrice > 0 || s.missingImage > 0)
      ? `, ${s.missingPrice} no-price, ${s.missingImage} no-image`
      : "";
    const sourcesEntries = Object.entries(s.locatorSources);
    const sourcesPart = sourcesEntries.length > 0
      ? ` [${sourcesEntries.map(([k, v]) => `${k}: ${v}`).join(", ")}]`
      : "";
    console.log(
      `  ${s.brand}: ${s.fetched} fetched, ${s.skippedSettled} settled, ${s.skippedNonClothing} non-clothing, ${s.inserted} synced, ${s.autoApproved} auto-approved, ${s.skippedBanned} banned, ${s.flaggedReview} review, ${s.skippedUnchanged} unchanged${sourcesPart}${scrapePart}${missingPart}, ${s.removed} removed`
    );
    totalFetched += s.fetched;
    totalInserted += s.inserted;
    totalApproved += s.autoApproved;
    totalSkipped += s.skippedBanned;
    totalSettled += s.skippedSettled;
    totalSkippedUnchanged += s.skippedUnchanged;
    totalAvailabilityUpdated += s.availabilityUpdated;
    totalScrapeHits += s.scrapeHits;
    totalReview += s.flaggedReview;
    totalRemoved += s.removed;
    totalMissingPrice += s.missingPrice;
    totalMissingImage += s.missingImage;
    totalErrors += s.errors;
    for (const [k, v] of Object.entries(s.locatorSources)) {
      totalLocatorSources[k] = (totalLocatorSources[k] || 0) + v;
    }
  }

  const scrapeTotalPart = totalScrapeHits > 0 ? `, ${totalScrapeHits} scraped` : "";
  const missingTotalPart = (totalMissingPrice > 0 || totalMissingImage > 0)
    ? `, ${totalMissingPrice} no-price, ${totalMissingImage} no-image`
    : "";
  const availPart = totalAvailabilityUpdated > 0 ? `, ${totalAvailabilityUpdated} availability-updated` : "";
  const totalSourcesEntries = Object.entries(totalLocatorSources);
  const totalSourcesPart = totalSourcesEntries.length > 0
    ? ` [${totalSourcesEntries.map(([k, v]) => `${k}: ${v}`).join(", ")}]`
    : "";
  console.log(`\nTotal: ${totalFetched} fetched, ${totalSettled} settled (skipped), ${totalSkippedUnchanged} unchanged (skipped), ${totalInserted} synced, ${totalApproved} auto-approved, ${totalSkipped} banned, ${totalReview} review${totalSourcesPart}${availPart}${scrapeTotalPart}${missingTotalPart}, ${totalRemoved} removed, ${totalErrors} errors`);

  if (totalReview > 0) {
    console.log(`\nRun 'npx tsx scripts/sync-shopify.ts --llm' to extract materials for review products`);
  }

  if (totalErrors > 0) process.exit(1);
}

// Only run main when executed directly (not imported)
const isDirectRun = process.argv[1]?.endsWith("sync-shopify.ts") || process.argv[1]?.endsWith("sync-shopify.js");
if (isDirectRun) main();
