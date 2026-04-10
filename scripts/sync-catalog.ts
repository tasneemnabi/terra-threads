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
import { ensureMaterialExists, syncProductMaterials } from "./lib/db-helpers.js";
import {
  classifyProductType,
  classifyAudience,
  shouldRejectProduct,
  guessCategory,
} from "./lib/product-classifier.js";
import { initStorageBucket, optimizeProductImages } from "./lib/image-optimizer.js";

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
  availabilityUpdated: number;
  flaggedReview: number;
  missingPrice: number;
  missingImage: number;
  errors: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

// ─── Sync single brand ─────────────────────────────────────────────

export async function syncCatalogBrand(
  supabase: SupabaseClient,
  brand: CatalogBrandRow,
  options: { dryRun: boolean; discoverOnly: boolean },
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
    availabilityUpdated: 0,
    flaggedReview: 0,
    missingPrice: 0,
    missingImage: 0,
    errors: 0,
  };

  console.log(`\n${"═".repeat(60)}`);
  console.log(`Syncing: ${brand.name} (${brand.website_url})`);
  console.log(`${"═".repeat(60)}`);

  // 1. Discover product URLs
  const discovery = await discoverProducts(brand.website_url, {
    brandSlug: brand.slug,
  });

  stats.discovered = discovery.urls.length;
  console.log(`  Discovered ${discovery.urls.length} products via ${discovery.method}`);

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

  // 2. Deduplicate against existing DB products
  const { data: existingProducts } = await supabase
    .from("products")
    .select("id, affiliate_url, sync_status")
    .eq("brand_id", brand.id)
    .not("affiliate_url", "is", null);

  const existingUrls = new Map<string, { id: string; status: string }>();
  for (const p of existingProducts || []) {
    if (p.affiliate_url) existingUrls.set(p.affiliate_url, { id: p.id, status: p.sync_status });
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
    await launchBrowser();
    try {
      for (const { url, id } of approvedUrls) {
        const scraped = await scrapeProductData(url);
        const isAvailable = scraped.success ? scraped.isAvailable : true;
        await supabase
          .from("products")
          .update({ is_available: isAvailable, last_synced_at: new Date().toISOString() })
          .eq("id", id);
        stats.availabilityUpdated++;
        await new Promise((r) => setTimeout(r, 2000));
      }
    } finally {
      await closeBrowser();
    }
  }

  if (newUrls.length === 0) {
    console.log(`  All products already synced`);
    return stats;
  }

  console.log(`  Scraping ${newUrls.length} new product pages...`);

  // 3. Scrape each product page
  await launchBrowser();
  try {
    for (let i = 0; i < newUrls.length; i++) {
      const url = newUrls[i];

      if ((i + 1) % 25 === 0 || i === 0) {
        console.log(`  Progress: ${i + 1}/${newUrls.length}`);
      }

      const scraped = await scrapeProductData(url);
      stats.scraped++;

      if (!scraped.success || !scraped.name) {
        stats.errors++;
        continue;
      }

      // Clean up name: strip trailing " | Brand Name" suffixes (common in og:title)
      // Require spaces around separator to avoid stripping hyphenated words like "Ultra-Soft"
      const cleanName = scraped.name.replace(/\s+[|–—-]\s+[^|–—-]+$/, "").trim();

      // 4. Skip non-clothing products
      const rejection = shouldRejectProduct(cleanName, brand.slug);
      if (rejection.rejected) {
        stats.skippedNonClothing++;
        if (options.dryRun) {
          console.log(`  SKIP (${rejection.reason}): ${cleanName}`);
        }
        continue;
      }

      // 5. Extract materials
      const extraction = scraped.text
        ? extractMaterialsFromText(scraped.text)
        : null;
      const hasMaterials =
        extraction !== null && Object.keys(extraction.materials).length > 0;

      // Check banned
      if (extraction && isExtractionBanned(extraction)) {
        stats.skippedBanned++;
        if (options.dryRun) {
          console.log(`  SKIP (banned): ${cleanName}`);
        }
        continue;
      }

      // Track missing data
      if (!scraped.price) stats.missingPrice++;
      if (!scraped.imageUrl) stats.missingImage++;

      // 6. Classify
      const syncStatus = hasMaterials
        ? determineSyncStatus(extraction!, scraped.price, scraped.imageUrl)
        : "review";
      const confidence = hasMaterials ? extraction!.confidence : 0;
      const category = guessCategory(cleanName);
      const productType = classifyProductType(cleanName);
      const audience = classifyAudience(cleanName, undefined, productType, brand.audience);
      const productSlug = `${brand.slug}-${slugify(cleanName)}`;

      if (syncStatus === "approved") stats.autoApproved++;
      if (syncStatus === "review") stats.flaggedReview++;

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
        continue;
      }

      // 7. Optimize images then insert into Supabase
      try {
        // Optimize images: download, resize to WebP, upload to Supabase Storage
        const optimizedImages = await optimizeProductImages(
          supabase,
          productSlug,
          scraped.imageUrl,
          scraped.additionalImages || []
        );

        // Check if product already exists (e.g. from a previous partial run)
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("brand_id", brand.id)
          .eq("affiliate_url", url)
          .maybeSingle();

        let productId: string;

        if (existing) {
          // Update existing product
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
            })
            .eq("id", existing.id);

          if (updateError) throw updateError;
          productId = existing.id;
        } else {
          // Insert new product
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
      } catch (err) {
        console.error(
          `  ERROR: ${cleanName}: ${(err as Error).message}`
        );
        stats.errors++;
      }

      // Polite delay between requests
      if (i < newUrls.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  } finally {
    await closeBrowser();
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

// ─── LLM pass for review products ───────────────────────────────────

async function llmPass(
  supabase: SupabaseClient,
  brandSlug: string | null,
  materialCache: Map<string, string>
): Promise<void> {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("LLM PASS — Re-extracting materials for review products");
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
      "id, name, slug, website_url, is_fully_natural, scrape_fallback, shopify_domain, audience"
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
      { dryRun, discoverOnly },
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
    totalAvailabilityUpdated = 0,
    totalReview = 0,
    totalMissingPrice = 0,
    totalMissingImage = 0,
    totalErrors = 0;

  for (const s of allStats) {
    const missingPart = (s.missingPrice > 0 || s.missingImage > 0)
      ? `, ${s.missingPrice} no-price, ${s.missingImage} no-image`
      : "";
    console.log(
      `  ${s.brand}: ${s.discovered} discovered, ${s.scraped} scraped, ${s.inserted} synced, ${s.autoApproved} approved, ${s.skippedBanned} banned, ${s.skippedNonClothing} non-clothing, ${s.skippedDuplicate} dupes, ${s.flaggedReview} review${missingPart}`
    );
    totalDiscovered += s.discovered;
    totalScraped += s.scraped;
    totalInserted += s.inserted;
    totalApproved += s.autoApproved;
    totalNonClothing += s.skippedNonClothing;
    totalBanned += s.skippedBanned;
    totalDuplicate += s.skippedDuplicate;
    totalAvailabilityUpdated += s.availabilityUpdated;
    totalReview += s.flaggedReview;
    totalMissingPrice += s.missingPrice;
    totalMissingImage += s.missingImage;
    totalErrors += s.errors;
  }

  const missingTotalPart = (totalMissingPrice > 0 || totalMissingImage > 0)
    ? `, ${totalMissingPrice} no-price, ${totalMissingImage} no-image`
    : "";
  const availPart = totalAvailabilityUpdated > 0 ? `, ${totalAvailabilityUpdated} availability-updated` : "";
  console.log(
    `\nTotal: ${totalDiscovered} discovered, ${totalScraped} scraped, ${totalInserted} synced, ${totalApproved} approved, ${totalBanned} banned, ${totalNonClothing} non-clothing, ${totalDuplicate} dupes, ${totalReview} review${availPart}${missingTotalPart}, ${totalErrors} errors`
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
