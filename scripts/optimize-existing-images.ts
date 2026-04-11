/**
 * optimize-existing-images.ts — One-time migration to download, optimize,
 * and re-host product images in Supabase Storage.
 *
 * For each approved product whose image_url does not already point to
 * Supabase Storage, this script:
 *   1. Downloads the original image
 *   2. Resizes (1200px max on longest edge) and converts to WebP (quality 80)
 *   3. Uploads to Supabase Storage: product-images/{slug}/{index}.webp
 *   4. Updates the product row with the new public URL
 *
 * Prerequisites:
 *   npm install sharp          (if not already installed)
 *
 * Usage:
 *   npx tsx scripts/optimize-existing-images.ts --dry-run              # Preview only
 *   npx tsx scripts/optimize-existing-images.ts                        # Run for all brands
 *   npx tsx scripts/optimize-existing-images.ts --brand kotn           # Single brand
 *   npx tsx scripts/optimize-existing-images.ts --brand kotn --dry-run # Single brand preview
 */

import sharp from "sharp";
import { loadEnv, getSupabaseAdmin } from "./lib/env.js";

// ─── Config ──────────────────────────────────────────────────────────

const BUCKET_NAME = "product-images";
const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 80;
const CONCURRENCY = 10;

// ─── CLI Flags ───────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const brandFlagIdx = args.indexOf("--brand");
const brandSlug = brandFlagIdx !== -1 ? args[brandFlagIdx + 1] : null;

// ─── Helpers ─────────────────────────────────────────────────────────

function isAlreadyOptimized(url: string | null): boolean {
  if (!url) return false;
  return url.includes("/storage/v1/object/public/product-images/");
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/webp,image/avif,image/apng,image/*,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function optimizeImage(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  loadEnv();
  const supabase = getSupabaseAdmin();

  console.log(`\n${"═".repeat(55)}`);
  console.log(`IMAGE OPTIMIZATION MIGRATION${dryRun ? " (DRY RUN)" : ""}`);
  if (brandSlug) console.log(`Brand filter: ${brandSlug}`);
  console.log(`${"═".repeat(55)}\n`);

  // ─── 1. Ensure storage bucket exists ──────────────────────────────

  if (!dryRun) {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: bucketError } = await supabase.storage.createBucket(
        BUCKET_NAME,
        {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024,
          allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
        }
      );

      if (bucketError && !bucketError.message.includes("already exists")) {
        console.error("Failed to create storage bucket:", bucketError.message);
        process.exit(1);
      }

      console.log(`Created public bucket: ${BUCKET_NAME}`);
    }
    console.log(`Storage bucket '${BUCKET_NAME}' ready.\n`);
  }

  // ─── 2. Fetch products to process ─────────────────────────────────

  const products: any[] = [];
  const PAGE = 1000;
  let from = 0;

  while (true) {
    let query = supabase
      .from("products")
      .select("id, name, slug, image_url, additional_images, brands!inner(slug)")
      .eq("sync_status", "approved")
      .range(from, from + PAGE - 1);

    if (brandSlug) {
      query = query.eq("brands.slug", brandSlug);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching products:", error.message);
      process.exit(1);
    }

    products.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`Found ${products.length} approved product(s) to check.\n`);

  // ─── 3. Process each product ──────────────────────────────────────

  const stats = { total: products.length, optimized: 0, skipped: 0, failed: 0 };
  let completed = 0;

  async function processProduct(product: any) {
    const prefix = `[${++completed}/${products.length}]`;

    // Collect all image URLs: primary + additional
    const allUrls: { url: string; isPrimary: boolean; index: number }[] = [];

    if (product.image_url) {
      allUrls.push({ url: product.image_url, isPrimary: true, index: 0 });
    }

    const additionalImages: string[] = product.additional_images || [];
    for (let j = 0; j < additionalImages.length; j++) {
      allUrls.push({ url: additionalImages[j], isPrimary: false, index: j + 1 });
    }

    // Skip products with no images at all
    if (allUrls.length === 0) {
      console.log(`${prefix} SKIP ${product.name} (no images)`);
      stats.skipped++;
      return;
    }

    // Check if ALL images are already optimized
    const allOptimized = allUrls.every((img) => isAlreadyOptimized(img.url));
    if (allOptimized) {
      stats.skipped++;
      return;
    }

    // In dry run, just log what we'd do
    if (dryRun) {
      const unoptimized = allUrls.filter((img) => !isAlreadyOptimized(img.url));
      console.log(`${prefix} WOULD OPTIMIZE ${product.name} (${unoptimized.length} images)`);
      stats.optimized++;
      return;
    }

    // Process images
    let newPrimaryUrl: string | null = null;
    const newAdditionalUrls: string[] = [...additionalImages];
    let hadError = false;

    for (const img of allUrls) {
      if (isAlreadyOptimized(img.url)) continue;

      try {
        const raw = await downloadImage(img.url);
        const optimized = await optimizeImage(raw);

        const storagePath = `${product.slug}/${img.index}.webp`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, optimized, {
            contentType: "image/webp",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(storagePath);

        if (img.isPrimary) {
          newPrimaryUrl = publicUrlData.publicUrl;
        } else {
          newAdditionalUrls[img.index - 1] = publicUrlData.publicUrl;
        }
      } catch (err: any) {
        console.error(`${prefix} ERROR ${product.name} image ${img.index}: ${err.message}`);
        hadError = true;
      }
    }

    // Update DB if we got at least the primary image or some additional images changed
    const additionalChanged = newAdditionalUrls.some(
      (url, idx) => url !== additionalImages[idx]
    );

    if (newPrimaryUrl || additionalChanged) {
      const updateFields: Record<string, any> = {};
      if (newPrimaryUrl) updateFields.image_url = newPrimaryUrl;
      if (additionalChanged) updateFields.additional_images = newAdditionalUrls;

      const { error: updateError } = await supabase
        .from("products")
        .update(updateFields)
        .eq("id", product.id);

      if (updateError) {
        console.error(`${prefix} DB ERROR ${product.name}: ${updateError.message}`);
        stats.failed++;
      } else {
        console.log(`${prefix} OK ${product.name}${hadError ? " (partial)" : ""}`);
        stats.optimized++;
      }
    } else if (hadError) {
      stats.failed++;
    }
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const batch = products.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processProduct));
  }

  // ─── 4. Summary ───────────────────────────────────────────────────

  console.log(`\n${"═".repeat(55)}`);
  console.log(`SUMMARY${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`${"═".repeat(55)}`);
  console.log(`  Total products:  ${stats.total}`);
  console.log(`  Optimized:       ${stats.optimized}`);
  console.log(`  Skipped:         ${stats.skipped}`);
  console.log(`  Failed:          ${stats.failed}`);

  if (dryRun) {
    console.log("\nDry run complete. Re-run without --dry-run to apply changes.");
  }

  console.log("");
}

main().catch(console.error);
