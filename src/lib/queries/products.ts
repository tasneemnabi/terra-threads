import { createClient } from "@/lib/supabase/server";
import type { ProductWithBrand, ProductWithBrandAndCount, FilterState, MaterialInfo } from "@/types/database";

const PAGE_SIZE = 12;

export async function getFilteredProducts(
  filters: FilterState,
  limitOverride?: number
): Promise<{ products: ProductWithBrand[]; totalCount: number }> {
  const supabase = await createClient();
  const limit = limitOverride || PAGE_SIZE;
  const offset = limitOverride ? 0 : ((filters.page || 1) - 1) * PAGE_SIZE;

  const { data, error } = await supabase.rpc("filter_products", {
    p_category: filters.categories?.length ? filters.categories : null,
    p_brand_slugs: filters.brands?.length ? filters.brands : null,
    p_material_names: filters.materials?.length ? filters.materials : null,
    p_min_price: filters.minPrice ?? null,
    p_max_price: filters.maxPrice ?? null,
    p_limit: limit,
    p_offset: offset,
    p_sort: filters.sort || "newest",
    p_tier: filters.tier && filters.tier !== "all" ? filters.tier : null,
    p_audience: filters.audience || null,
    p_product_type: filters.productTypes?.length ? filters.productTypes : null,
  });

  if (error) {
    console.error("Error fetching filtered products:", error);
    throw new Error("Failed to load products. Please try again.");
  }

  const rows = data as ProductWithBrandAndCount[];
  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

  return {
    products: rows.map(({ total_count: _, ...product }) => product),
    totalCount,
  };
}

export async function searchProducts(
  query: string,
  limit = 48
): Promise<ProductWithBrand[]> {
  const supabase = await createClient();

  // Sanitize input: escape SQL LIKE wildcards, then strip PostgREST filter metacharacters
  const escaped = query.replace(/[%_\\]/g, "\\$&");
  const safe = escaped.replace(/[,.()]/g, "");

  const { data, error } = await supabase
    .from("products_with_materials")
    .select("*")
    .or(`name.ilike.%${safe}%,brand_name.ilike.%${safe}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error searching products:", error);
    throw new Error("Failed to search products.");
  }

  return data as ProductWithBrand[];
}

export async function getProductBySlug(slug: string): Promise<ProductWithBrand | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products_with_materials")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("Error fetching product:", error);
    throw new Error("Failed to load product details.");
  }

  return data as ProductWithBrand;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Dedup key that collapses DB-level product duplicates (same brand re-ingesting
// a product under a fresh slug) into a single visual card. Keep this in sync
// wherever we surface cards to the user.
function productDedupeKey(p: Pick<ProductWithBrand, "brand_slug" | "name">): string {
  return `${p.brand_slug}::${p.name.trim().toLowerCase()}`;
}

function dedupeProducts(products: ProductWithBrand[]): ProductWithBrand[] {
  const seen = new Set<string>();
  const out: ProductWithBrand[] = [];
  for (const p of products) {
    const key = productDedupeKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export async function getHeroProducts(limit = 8): Promise<ProductWithBrand[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products_with_materials")
    .select("*")
    .eq("is_available", true)
    .eq("category", "activewear")
    .eq("audience", "Women")
    .not("image_url", "is", null)
    .gt("price", 0);

  if (error) {
    console.error("Error fetching hero products:", error);
    throw new Error("Failed to load hero products.");
  }

  const rows = data as ProductWithBrand[];
  const preferredSlugs = ["layere", "happy-earth-apparel"];

  // Group by preferred brand, shuffle within each, then interleave so both brands appear early
  const byBrand = new Map<string, ProductWithBrand[]>();
  for (const slug of preferredSlugs) {
    byBrand.set(slug, shuffle(rows.filter((p) => p.brand_slug === slug)));
  }

  const interleaved: ProductWithBrand[] = [];
  const brandOrder = shuffle(preferredSlugs);
  let added = true;
  while (added) {
    added = false;
    for (const slug of brandOrder) {
      const pool = byBrand.get(slug);
      if (pool && pool.length > 0) {
        interleaved.push(pool.shift()!);
        added = true;
      }
    }
  }

  // Fallback: if preferred brands have nothing, use any shuffled women's activewear
  const result = interleaved.length > 0
    ? interleaved
    : shuffle(rows);

  return dedupeProducts(result).slice(0, limit);
}

export async function getHomepageProducts(limit = 6): Promise<ProductWithBrand[]> {
  const supabase = await createClient();

  // Fetch extra products so we can diversify by brand
  const { data, error } = await supabase
    .from("products_with_materials")
    .select("*")
    .eq("is_available", true)
    .not("image_url", "is", null)
    .gt("price", 0)
    .not("product_type", "in", '("underwear","bras","socks")')
    .not("category", "eq", "underwear")
    .order("created_at", { ascending: false })
    .limit(limit * 50);

  if (error) {
    console.error("Error fetching homepage products:", error);
    throw new Error("Failed to load homepage products.");
  }

  // De-dupe by (brand_slug, name) to hide DB-level duplicates that render as
  // visibly repeated cards (e.g. same product re-ingested under a new slug).
  const seen = new Set<string>();

  // Pick at most 2 products per brand to create variety
  const result: ProductWithBrand[] = [];
  const brandCount = new Map<string, number>();
  for (const product of data as ProductWithBrand[]) {
    const dedupeKey = productDedupeKey(product);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const count = brandCount.get(product.brand_slug) ?? 0;
    if (count < 2) {
      result.push(product);
      brandCount.set(product.brand_slug, count + 1);
      if (result.length >= limit) break;
    }
  }

  return result;
}

// Image URLs for the homepage "Shop by audience" tiles that don't have
// editorially chosen artwork. We pick from the live catalogue so the tiles
// refresh as new products land. Pass `excludeImageUrls` to avoid repeating
// whatever is already on the page (e.g., the "Just landed" grid).
export async function getAudienceTileImages(
  excludeImageUrls: string[] = []
): Promise<{
  newArrivalImage: string | null;
  naturalImage: string | null;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products_with_materials")
    .select("image_url,materials")
    .eq("is_available", true)
    .not("image_url", "is", null)
    .gt("price", 0)
    .not("product_type", "in", '("underwear","bras","socks")')
    .not("category", "eq", "underwear")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("Error fetching audience tile images:", error);
    return { newArrivalImage: null, naturalImage: null };
  }

  type Row = { image_url: string | null; materials: MaterialInfo[] };
  const excluded = new Set(excludeImageUrls.filter(Boolean));
  const rows = ((data ?? []) as Row[]).filter(
    (r) => r.image_url && !excluded.has(r.image_url)
  );

  const newArrivalImage = rows[0]?.image_url ?? null;
  const naturalRow = rows
    .slice(1)
    .find(
      (r) =>
        r.materials &&
        r.materials.length > 0 &&
        r.materials.every((m) => m.is_natural) &&
        r.image_url !== newArrivalImage
    );
  const naturalImage = naturalRow?.image_url ?? null;

  return { newArrivalImage, naturalImage };
}

export async function getCategoryImages(
  categories: string[]
): Promise<{ category: string; image_url: string }[]> {
  const supabase = await createClient();

  const settled = await Promise.all(
    categories.map(async (category) => {
      const { data } = await supabase
        .from("products_with_materials")
        .select("image_url")
        .eq("category", category)
        .not("image_url", "is", null)
        .ilike("image_url", "%shopify%")
        .gt("price", 0)
        .limit(1)
        .single();

      if (data?.image_url) {
        return { category, image_url: data.image_url as string };
      }
      return null;
    })
  );

  // Preserve input order, filter out categories with no image
  return settled.filter((r): r is { category: string; image_url: string } => r !== null);
}

export async function getRelatedProducts(
  productId: string,
  category: string,
  limit = 4
): Promise<ProductWithBrand[]> {
  const supabase = await createClient();

  // Over-fetch so dedup can still return `limit` results after collapsing
  // same-product duplicates.
  const { data, error } = await supabase
    .from("products_with_materials")
    .select("*")
    .eq("category", category)
    .eq("is_available", true)
    .neq("id", productId)
    .not("image_url", "is", null)
    .gt("price", 0)
    .limit(limit * 5);

  if (error) {
    console.error("Error fetching related products:", error);
    throw new Error("Failed to load related products.");
  }

  return dedupeProducts(data as ProductWithBrand[]).slice(0, limit);
}

export async function getDistinctCategories(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products_with_materials")
    .select("category")
    .not("category", "is", null);

  if (error) {
    console.error("Error fetching categories:", error);
    throw new Error("Failed to load categories.");
  }

  const categories = [...new Set((data as { category: string }[]).map((r) => r.category))];
  return categories.sort();
}

export async function getProductTypesForCategory(category: string): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products_with_materials")
    .select("product_type")
    .eq("category", category)
    .not("product_type", "is", null);

  if (error) {
    console.error("Error fetching product types:", error);
    throw new Error("Failed to load product types.");
  }

  const types = [...new Set((data as { product_type: string }[]).map((r) => r.product_type))];
  return types.sort();
}

export async function getAvailableBrandSlugs(
  filters: Omit<FilterState, "page" | "brands" | "sort">
): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_available_brands", {
    p_category: filters.categories?.length ? filters.categories : null,
    p_material_names: filters.materials?.length ? filters.materials : null,
    p_min_price: filters.minPrice ?? null,
    p_max_price: filters.maxPrice ?? null,
    p_tier: filters.tier && filters.tier !== "all" ? filters.tier : null,
    p_audience: filters.audience || null,
    p_product_type: filters.productTypes?.length ? filters.productTypes : null,
  });

  if (error) {
    console.error("Error fetching available brands:", error);
    throw new Error("Failed to load available brands.");
  }

  return (data as { brand_slug: string }[]).map((r) => r.brand_slug);
}

export async function getProductsByBrand(brandId: string): Promise<ProductWithBrand[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products_with_materials")
    .select("*")
    .eq("brand_id", brandId)
    .not("image_url", "is", null)
    .gt("price", 0)
    .order("is_available", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching brand products:", error);
    throw new Error("Failed to load brand products.");
  }

  return data as ProductWithBrand[];
}
