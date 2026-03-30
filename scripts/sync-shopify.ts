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

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllProducts, type ShopifyProduct } from "./lib/shopify-fetcher.js";
import { extractMaterialsRegex, extractMaterialsBatch, type ExtractedMaterials } from "./lib/material-extractor.js";
import { slugify, isExtractionBanned, TRUSTED_MATERIALS } from "./lib/curation.js";
import { loadEnv, getSupabaseAdmin } from "./lib/env.js";
import { ensureMaterialExists, syncProductMaterials } from "./lib/db-helpers.js";

// ─── Types ──────────────────────────────────────────────────────────

interface BrandRow {
  id: string;
  name: string;
  slug: string;
  shopify_domain: string;
  is_fully_natural: boolean;
}

interface SyncStats {
  brand: string;
  fetched: number;
  inserted: number;
  updated: number;
  autoApproved: number;
  skippedBanned: number;
  flaggedReview: number;
  removed: number;
  errors: number;
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Determine sync status based on extraction quality.
 * Two statuses: "approved" (live on site) or "review" (needs work).
 * Auto-approve when: confidence >= 0.80, all materials are trusted canonical
 * names, percentages sum to 100, no banned materials.
 */
function determineSyncStatus(extraction: ExtractedMaterials): string {
  if (extraction.hasBanned) return "rejected";

  const materialNames = Object.keys(extraction.materials);
  const allTrusted = materialNames.every((m) => TRUSTED_MATERIALS.has(m));
  const total = Object.values(extraction.materials).reduce((a, b) => a + b, 0);

  if (allTrusted && total === 100 && extraction.confidence >= 0.80) {
    return "approved";
  }
  return "review";
}

function getFirstVariantPrice(product: ShopifyProduct): number {
  const variant = product.variants?.[0];
  if (!variant) return 0;
  return parseFloat(variant.price) || 0;
}

function getImages(product: ShopifyProduct): { primary: string | null; additional: string[] } {
  const images = (product.images || []).map((img) => img.src);
  return {
    primary: images[0] || null,
    additional: images.slice(1),
  };
}

import { classifyProductType, mapActivewearType } from "./lib/product-classifier";

function guessCategory(product: ShopifyProduct): string {
  const text = `${product.title} ${product.product_type} ${(product.tags || []).join(" ")}`.toLowerCase();

  if (/legging|sports?\s*bra|athletic|activewear|yoga|workout|running/i.test(text)) return "activewear";
  if (/dress/i.test(text)) return "dresses";
  if (/sock/i.test(text)) return "socks";
  if (/underwear|brief|boxer|panty|panties|bra(?!celet)|lingerie|bralette/i.test(text)) return "underwear";
  if (/swim|bikini|one.?piece/i.test(text)) return "swimwear";
  if (/knit|sweater|cardigan|pullover/i.test(text)) return "knitwear";
  if (/denim|jean/i.test(text)) return "denim";
  if (/lounge|pajama|pj|sleep|robe/i.test(text)) return "loungewear";
  if (/t-?shirt|tee|top|tank|blouse|shirt|henley|polo/i.test(text)) return "tops";
  if (/pant|trouser|short|skirt/i.test(text)) return "bottoms";
  if (/jacket|coat|hoodie|sweatshirt/i.test(text)) return "outerwear";
  return "basics";
}

// ─── Pass 1: Sync from Shopify (regex only) ─────────────────────────

async function syncBrand(
  supabase: SupabaseClient,
  brand: BrandRow,
  options: { dryRun: boolean },
  materialCache: Map<string, string>
): Promise<SyncStats> {
  const stats: SyncStats = {
    brand: brand.name,
    fetched: 0,
    inserted: 0,
    updated: 0,
    autoApproved: 0,
    skippedBanned: 0,
    flaggedReview: 0,
    removed: 0,
    errors: 0,
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

  // Fetch already-rejected Shopify product IDs so we don't overwrite them
  const rejectedShopifyIds = new Set<number>();
  if (!options.dryRun) {
    const { data: rejected } = await supabase
      .from("products")
      .select("shopify_product_id")
      .eq("brand_id", brand.id)
      .eq("sync_status", "rejected")
      .not("shopify_product_id", "is", null);
    for (const r of rejected || []) {
      rejectedShopifyIds.add(r.shopify_product_id);
    }
    if (rejectedShopifyIds.size > 0) {
      console.log(`  Skipping ${rejectedShopifyIds.size} previously rejected products`);
    }
  }

  // Regex-only extraction for all products
  let regexHits = 0;
  for (const shopifyProduct of shopifyProducts) {
    seenShopifyIds.add(shopifyProduct.id);

    // Skip products that were previously rejected (non-clothing, banned, manual reject)
    if (rejectedShopifyIds.has(shopifyProduct.id)) {
      continue;
    }

    const extraction = extractMaterialsRegex(shopifyProduct);
    const hasMaterials = extraction !== null && Object.keys(extraction.materials).length > 0;

    if (hasMaterials) regexHits++;

    // If regex found banned materials, skip
    if (extraction && isExtractionBanned(extraction)) {
      stats.skippedBanned++;
      if (options.dryRun) {
        console.log(`  SKIP (banned): ${shopifyProduct.title}`);
      }
      continue;
    }

    // Determine sync status: auto-approve if trusted materials + high confidence
    const syncStatus = hasMaterials ? determineSyncStatus(extraction!) : "review";
    if (syncStatus === "review") stats.flaggedReview++;
    const confidence = hasMaterials ? extraction!.confidence : 0;

    const variant = shopifyProduct.variants?.[0];
    const images = getImages(shopifyProduct);
    const price = getFirstVariantPrice(shopifyProduct);
    const category = guessCategory(shopifyProduct);
    const rawProductType = classifyProductType(shopifyProduct.title, shopifyProduct.product_type, shopifyProduct.tags);
    const productType = rawProductType && category === "activewear" ? mapActivewearType(rawProductType) : rawProductType;
    const productSlug = `${brand.slug}-${slugify(shopifyProduct.title)}`;

    if (syncStatus === "approved") stats.autoApproved++;

    if (options.dryRun) {
      const mats = hasMaterials
        ? Object.entries(extraction!.materials).map(([m, p]) => `${p}% ${m}`).join(", ")
        : "(none)";
      const icon = syncStatus === "approved" ? "✓" : syncStatus === "review" ? "?" : "+";
      console.log(`  ${icon} ${shopifyProduct.title} [${syncStatus}]`);
      console.log(`    Materials: ${mats} [regex, conf=${confidence.toFixed(2)}]`);
      console.log(`    Price: $${price.toFixed(2)} | Category: ${category}`);
      continue;
    }

    try {
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
        image_url: images.primary,
        additional_images: images.additional,
        affiliate_url: `https://${brand.shopify_domain}/products/${shopifyProduct.handle}`,
        product_type: productType,
        shopify_product_type: shopifyProduct.product_type || null,
        shopify_product_id: shopifyProduct.id,
        shopify_variant_id: variant?.id || null,
        last_synced_at: new Date().toISOString(),
        sync_status: syncStatus,
        material_confidence: confidence,
        raw_body_html: shopifyProduct.body_html,
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
          }
        } else {
          throw upsertError;
        }
      } else if (upserted) {
        if (hasMaterials) {
          await syncProductMaterials(supabase, upserted.id, extraction!.materials, materialCache);
        }
      }

      stats.inserted++;
    } catch (err) {
      console.error(`  ERROR: ${shopifyProduct.title}: ${(err as Error).message}`);
      stats.errors++;
    }
  }

  console.log(`  Regex extracted: ${regexHits}/${shopifyProducts.length}, review: ${stats.flaggedReview}`);

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

async function llmPass(
  supabase: SupabaseClient,
  brandSlug: string | null,
  materialCache: Map<string, string>,
  limit: number = 500
): Promise<void> {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("LLM PASS — Extracting materials for products missing them");
  console.log("══════════════════════════════════════════════════════\n");

  // Query products (pending or review) that have raw_body_html
  let query = supabase
    .from("products")
    .select("id, name, raw_body_html, sync_status, brands!inner(slug)")
    .in("sync_status", ["pending", "review"])
    .not("raw_body_html", "is", null);

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
    const newStatus = determineSyncStatus(extraction);
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
    .select("id, name, slug, shopify_domain, is_fully_natural")
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

  const allStats: SyncStats[] = [];

  for (const brand of brands) {
    const stats = await syncBrand(supabase, brand, { dryRun }, materialCache);
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
    totalReview = 0,
    totalRemoved = 0,
    totalErrors = 0;

  for (const s of allStats) {
    console.log(
      `  ${s.brand}: ${s.fetched} fetched, ${s.inserted} synced, ${s.autoApproved} auto-approved, ${s.skippedBanned} banned, ${s.flaggedReview} review, ${s.removed} removed`
    );
    totalFetched += s.fetched;
    totalInserted += s.inserted;
    totalApproved += s.autoApproved;
    totalSkipped += s.skippedBanned;
    totalReview += s.flaggedReview;
    totalRemoved += s.removed;
    totalErrors += s.errors;
  }

  console.log(`\nTotal: ${totalFetched} fetched, ${totalInserted} synced, ${totalApproved} auto-approved, ${totalSkipped} banned, ${totalReview} review, ${totalRemoved} removed, ${totalErrors} errors`);

  if (totalReview > 0) {
    console.log(`\nRun 'npx tsx scripts/sync-shopify.ts --llm' to extract materials for review products`);
  }

  if (totalErrors > 0) process.exit(1);
}

main();
