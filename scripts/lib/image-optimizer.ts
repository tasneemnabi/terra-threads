/**
 * image-optimizer.ts — Download product images, resize/convert to WebP via sharp,
 *                      and upload to Supabase Storage.
 *
 * Exports:
 *   initStorageBucket(supabase)        — ensures `product-images` public bucket exists
 *   optimizeAndUploadImage(...)        — single image: fetch -> sharp -> upload -> public URL
 *   optimizeProductImages(...)         — orchestrate all images for one product
 *   isAlreadyOptimized(url)            — check if URL is already on Supabase Storage
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET_NAME = "product-images";
const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 80;

/**
 * Ensure the `product-images` public bucket exists in Supabase Storage.
 * Safe to call multiple times — silently succeeds if bucket already exists.
 */
export async function initStorageBucket(supabase: SupabaseClient): Promise<void> {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.warn(`[image-optimizer] Failed to list buckets: ${listError.message}`);
    return;
  }

  const exists = buckets?.some((b) => b.name === BUCKET_NAME);
  if (exists) return;

  const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
    allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
  });

  if (createError) {
    // "already exists" is fine (race condition between check and create)
    if (!createError.message.includes("already exists")) {
      console.warn(`[image-optimizer] Failed to create bucket: ${createError.message}`);
    }
    return;
  }

  console.log(`[image-optimizer] Created public bucket: ${BUCKET_NAME}`);
}

/**
 * Returns true if the URL already points to Supabase Storage (no need to re-process).
 */
export function isAlreadyOptimized(url: string): boolean {
  if (!url) return false;
  return url.includes("/storage/v1/object/public/product-images/");
}

/**
 * Download an image, resize with sharp (max 1200px longest edge, WebP quality 80),
 * and upload to Supabase Storage. Returns the public URL on success, or the
 * original URL on any error.
 */
export async function optimizeAndUploadImage(
  supabase: SupabaseClient,
  imageUrl: string,
  productSlug: string,
  index: number
): Promise<string> {
  if (!imageUrl) return imageUrl;
  if (isAlreadyOptimized(imageUrl)) return imageUrl;

  try {
    // 1. Download image
    const response = await fetch(imageUrl, {
      headers: { "User-Agent": "FiberBot/1.0 (image-optimizer)" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`[image-optimizer] Failed to fetch ${imageUrl}: HTTP ${response.status}`);
      return imageUrl;
    }

    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // 2. Resize and convert to WebP
    const optimized = await sharp(inputBuffer)
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    // 3. Upload to Supabase Storage
    const storagePath = `${productSlug}/${index}.webp`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, optimized, {
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadError) {
      console.warn(`[image-optimizer] Upload failed for ${storagePath}: ${uploadError.message}`);
      return imageUrl;
    }

    // 4. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn(`[image-optimizer] Error processing ${imageUrl}: ${(err as Error).message}`);
    return imageUrl;
  }
}

/**
 * Optimize all images for a single product: primary image + additional images.
 * Returns Supabase Storage URLs (or original URLs on failure).
 */
export async function optimizeProductImages(
  supabase: SupabaseClient,
  slug: string,
  primaryUrl: string | null,
  additionalUrls: string[]
): Promise<{ imageUrl: string | null; additionalImages: string[] }> {
  // Optimize primary image (index 0)
  const imageUrl = primaryUrl
    ? await optimizeAndUploadImage(supabase, primaryUrl, slug, 0)
    : null;

  // Optimize additional images (index 1, 2, 3, ...)
  const additionalImages: string[] = [];
  for (let i = 0; i < additionalUrls.length; i++) {
    const optimized = await optimizeAndUploadImage(
      supabase,
      additionalUrls[i],
      slug,
      i + 1
    );
    additionalImages.push(optimized);
  }

  return { imageUrl, additionalImages };
}
