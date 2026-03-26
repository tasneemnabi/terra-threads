/**
 * scrape-products.ts — Playwright scraper for Shopify product pages.
 *
 * Targets products in sync_status="review" (no materials from body_html).
 * Navigates to the product page, waits for JS to render, extracts text,
 * then runs the regex/dictionary extraction pipeline on the rendered content.
 *
 * Usage:
 *   npx tsx scripts/scrape-products.ts                     # All review products (Shopify brands)
 *   npx tsx scripts/scrape-products.ts --brand allwear      # Single brand
 *   npx tsx scripts/scrape-products.ts --limit 50           # Limit number of products
 *   npx tsx scripts/scrape-products.ts --dry-run            # Scrape + extract, no DB writes
 *   npx tsx scripts/scrape-products.ts --dry-run --brand X  # Preview single brand
 */

import { launchBrowser, closeBrowser, scrapePages } from "./lib/page-scraper.js";
import { extractMaterialsFromText } from "./lib/material-extractor.js";
import { isExtractionBanned } from "./lib/curation.js";
import { getSupabaseAdmin } from "./lib/env.js";
import { syncProductMaterials } from "./lib/db-helpers.js";

// ─── Types ──────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  name: string;
  affiliate_url: string;
  sync_status: string;
  material_confidence: number;
  brands: { slug: string; shopify_domain: string } | { slug: string; shopify_domain: string }[];
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const brandFlag = args.indexOf("--brand");
  const brandSlug = brandFlag !== -1 ? args[brandFlag + 1] : null;
  const limitFlag = args.indexOf("--limit");
  const limit = limitFlag !== -1 ? parseInt(args[limitFlag + 1], 10) : 500;

  const supabase = getSupabaseAdmin();
  const materialCache = new Map<string, string>();

  console.log("═".repeat(60));
  console.log("PLAYWRIGHT SCRAPER — Extracting materials from rendered pages");
  console.log("═".repeat(60));
  if (dryRun) console.log("DRY RUN — no database writes\n");

  // Fetch products that need scraping: review status, have a Shopify URL
  let query = supabase
    .from("products")
    .select("id, name, affiliate_url, sync_status, material_confidence, brands!inner(slug, shopify_domain)")
    .eq("sync_status", "review")
    .not("affiliate_url", "is", null);

  if (brandSlug) {
    query = query.eq("brands.slug", brandSlug);
  }

  const { data: products, error } = await query.limit(limit);

  if (error) {
    console.error("Failed to fetch products:", error.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log("No review products found to scrape.");
    return;
  }

  // Filter to products that have no materials yet
  const productIds = products.map((p) => p.id);
  const { data: existingMats } = await supabase
    .from("product_materials")
    .select("product_id")
    .in("product_id", productIds);

  const hasMatSet = new Set((existingMats || []).map((m) => m.product_id));
  const needsScraping = (products as unknown as ProductRow[]).filter((p) => !hasMatSet.has(p.id));

  console.log(`Found ${products.length} review products, ${needsScraping.length} missing materials`);

  if (needsScraping.length === 0) {
    console.log("All review products already have materials.");
    return;
  }

  // Group by brand for progress reporting
  const brandGroups = new Map<string, ProductRow[]>();
  for (const p of needsScraping) {
    const brands = Array.isArray(p.brands) ? p.brands[0] : p.brands;
    const slug = brands.slug;
    if (!brandGroups.has(slug)) brandGroups.set(slug, []);
    brandGroups.get(slug)!.push(p);
  }

  console.log(`\nBrands to scrape:`);
  for (const [slug, prods] of Array.from(brandGroups.entries())) {
    console.log(`  ${slug}: ${prods.length} products`);
  }

  // Launch browser
  console.log("\nLaunching browser...");
  await launchBrowser();

  let totalScraped = 0;
  let totalExtracted = 0;
  let totalBanned = 0;
  let totalFailed = 0;

  try {
    for (const [slug, brandProducts] of Array.from(brandGroups.entries())) {
      console.log(`\n${"─".repeat(50)}`);
      console.log(`Scraping: ${slug} (${brandProducts.length} products)`);
      console.log("─".repeat(50));

      const urls = brandProducts.map((p) => p.affiliate_url);

      const scraped = await scrapePages(urls, {
        concurrency: 2,
        delayMs: 1000,
        onProgress: (done, total) => {
          process.stdout.write(`\r  Progress: ${done}/${total} pages scraped`);
        },
      });
      console.log(""); // newline after progress

      for (let i = 0; i < brandProducts.length; i++) {
        const product = brandProducts[i];
        const page = scraped[i];
        totalScraped++;

        if (!page.success || !page.text) {
          totalFailed++;
          if (dryRun) {
            console.log(`  FAIL: ${product.name} — ${page.error || "no text"}`);
          }
          continue;
        }

        const extraction = extractMaterialsFromText(page.text);

        if (!extraction || Object.keys(extraction.materials).length === 0) {
          if (dryRun) {
            console.log(`  MISS: ${product.name} — no materials found in rendered page`);
          }
          continue;
        }

        if (isExtractionBanned(extraction)) {
          totalBanned++;
          if (dryRun) {
            const mats = Object.entries(extraction.materials).map(([m, p]) => `${p}% ${m}`).join(", ");
            console.log(`  BANNED: ${product.name} — ${mats}`);
          } else {
            await supabase
              .from("products")
              .update({ sync_status: "rejected", material_confidence: extraction.confidence })
              .eq("id", product.id);
          }
          continue;
        }

        totalExtracted++;
        const mats = Object.entries(extraction.materials).map(([m, p]) => `${p}% ${m}`).join(", ");
        const newStatus = extraction.confidence >= 0.8 ? "pending" : "review";

        if (dryRun) {
          console.log(`  ${newStatus === "pending" ? "+" : "?"} ${product.name}: ${mats} [conf=${extraction.confidence.toFixed(2)}]`);
        } else {
          await supabase
            .from("products")
            .update({
              sync_status: newStatus,
              material_confidence: extraction.confidence,
            })
            .eq("id", product.id);

          await syncProductMaterials(supabase, product.id, extraction.materials, materialCache);
          console.log(`  + ${product.name}: ${mats}`);
        }
      }
    }
  } finally {
    await closeBrowser();
  }

  // Summary
  console.log(`\n${"═".repeat(60)}`);
  console.log("SCRAPE SUMMARY");
  console.log("═".repeat(60));
  console.log(`  Pages scraped:    ${totalScraped}`);
  console.log(`  Materials found:  ${totalExtracted}`);
  console.log(`  Banned/rejected:  ${totalBanned}`);
  console.log(`  Failed to scrape: ${totalFailed}`);
  console.log(`  Still missing:    ${totalScraped - totalExtracted - totalBanned - totalFailed}`);

  if (totalExtracted > 0 && dryRun) {
    console.log(`\nRun without --dry-run to write ${totalExtracted} products to the database.`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  closeBrowser().finally(() => process.exit(1));
});
