/**
 * backfill-broken-images.ts — Re-scrape and re-optimize products whose
 * stored image_url is NOT a Supabase Storage URL. These are rows where
 * the original sync's first image candidate 404'd and the optimizer
 * stranded the broken source URL in the DB. With the candidate-list
 * optimizer now in place, a re-scrape will surface a working URL.
 *
 * Scope: approved products, optionally filtered to a single brand.
 *
 * Usage:
 *   npx tsx scripts/backfill-broken-images.ts --brand pact --dry-run
 *   npx tsx scripts/backfill-broken-images.ts --brand pact
 *   npx tsx scripts/backfill-broken-images.ts               # all brands
 */

import { loadEnv, getSupabaseAdmin } from "./lib/env.js";
import {
  launchBrowser,
  closeBrowser,
  scrapeProductData,
} from "./lib/page-scraper.js";
import {
  optimizeProductImages,
  isAlreadyOptimized,
  initStorageBucket,
} from "./lib/image-optimizer.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const brandIdx = args.indexOf("--brand");
const brandSlug = brandIdx !== -1 ? args[brandIdx + 1] : null;

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  affiliate_url: string;
  brands: { slug: string };
}

async function main() {
  loadEnv();
  const supabase = getSupabaseAdmin();

  console.log(`\nbackfill-broken-images${dryRun ? " (DRY RUN)" : ""}`);
  if (brandSlug) console.log(`  brand=${brandSlug}`);

  if (!dryRun) await initStorageBucket(supabase);

  // Approved products whose image isn't on Supabase Storage. Includes both
  // broken-external URLs and NULL image_url.
  let query = supabase
    .from("products")
    .select("id, slug, name, image_url, affiliate_url, brands!inner(slug)")
    .eq("sync_status", "approved")
    .not("affiliate_url", "is", null);
  if (brandSlug) query = query.eq("brands.slug", brandSlug);

  const { data: raw, error } = await query;
  if (error) {
    console.error("fetch error:", error.message);
    process.exit(1);
  }

  const rows = (raw || []) as unknown as ProductRow[];
  const broken = rows.filter(
    (p) => !p.image_url || !isAlreadyOptimized(p.image_url)
  );

  console.log(`  ${rows.length} approved products, ${broken.length} need backfill\n`);
  if (broken.length === 0) {
    console.log("nothing to do");
    return;
  }

  const stats = { ok: 0, failed: 0, stillBroken: 0 };

  await launchBrowser();
  try {
    for (const product of broken) {
      const label = `${product.brands.slug}/${product.slug}`;
      try {
        const scraped = await scrapeProductData(product.affiliate_url);
        if (!scraped.success || scraped.imageCandidates.length === 0) {
          console.log(`  ✗ ${label}: no candidates`);
          stats.stillBroken++;
          continue;
        }

        if (dryRun) {
          console.log(
            `  WOULD FIX ${label}: ${scraped.imageCandidates.length} candidates, first=${scraped.imageCandidates[0]}`
          );
          stats.ok++;
          continue;
        }

        const result = await optimizeProductImages(
          supabase,
          product.slug,
          scraped.imageCandidates
        );

        if (!result.imageUrl) {
          console.log(`  ✗ ${label}: all candidates failed to download`);
          stats.stillBroken++;
          continue;
        }

        const { error: updErr } = await supabase
          .from("products")
          .update({
            image_url: result.imageUrl,
            additional_images: result.additionalImages,
          })
          .eq("id", product.id);
        if (updErr) {
          console.log(`  ! ${label}: db update failed: ${updErr.message}`);
          stats.failed++;
          continue;
        }

        console.log(`  ✓ ${label}`);
        stats.ok++;
      } catch (err) {
        console.log(`  ! ${label}: ${(err as Error).message}`);
        stats.failed++;
      }

      // Be gentle on source sites
      await new Promise((r) => setTimeout(r, 1500));
    }
  } finally {
    await closeBrowser();
  }

  console.log(
    `\ndone — ok=${stats.ok} stillBroken=${stats.stillBroken} failed=${stats.failed}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
