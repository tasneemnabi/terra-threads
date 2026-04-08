import { createClient } from "@/lib/supabase/server";
import type { ProductWithBrand, ProductWithBrandAndCount, FilterState } from "@/types/database";

const PAGE_SIZE = 12;

export async function getFilteredProducts(
  filters: FilterState,
  limitOverride?: number
): Promise<{ products: ProductWithBrand[]; totalCount: number }> {
  const supabase = await createClient();
  const limit = limitOverride || PAGE_SIZE;
  const offset = limitOverride ? 0 : ((filters.page || 1) - 1) * PAGE_SIZE;

  const { data, error } = await supabase.rpc("filter_products", {
    p_category: filters.category || null,
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

  const { data, error } = await supabase
    .from("products_with_materials")
    .select("*")
    .or(`name.ilike.%${query}%,brand_name.ilike.%${query}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error searching products:", error);
    return [];
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

export async function getFeaturedProducts(): Promise<ProductWithBrand[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products_with_materials")
    .select("*")
    .eq("is_featured", true)
    .not("image_url", "is", null)
    .gt("price", 0)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error("Error fetching featured products:", error);
    throw new Error("Failed to load featured products.");
  }

  return data as ProductWithBrand[];
}

export async function getHomepageProducts(limit = 6): Promise<ProductWithBrand[]> {
  const supabase = await createClient();

  // Fetch extra products so we can diversify by brand
  const { data, error } = await supabase
    .from("products_with_materials")
    .select("*")
    .not("image_url", "is", null)
    .gt("price", 0)
    .order("created_at", { ascending: false })
    .limit(limit * 8);

  if (error) {
    console.error("Error fetching homepage products:", error);
    throw new Error("Failed to load homepage products.");
  }

  // Pick at most 2 products per brand to create variety
  const result: ProductWithBrand[] = [];
  const brandCount = new Map<string, number>();
  for (const product of data as ProductWithBrand[]) {
    const count = brandCount.get(product.brand_slug) ?? 0;
    if (count < 2) {
      result.push(product);
      brandCount.set(product.brand_slug, count + 1);
      if (result.length >= limit) break;
    }
  }

  return result;
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

  const { data, error } = await supabase
    .from("products_with_materials")
    .select("*")
    .eq("category", category)
    .neq("id", productId)
    .not("image_url", "is", null)
    .gt("price", 0)
    .limit(limit);

  if (error) {
    console.error("Error fetching related products:", error);
    throw new Error("Failed to load related products.");
  }

  return data as ProductWithBrand[];
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
    p_category: filters.category || null,
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
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching brand products:", error);
    throw new Error("Failed to load brand products.");
  }

  return data as ProductWithBrand[];
}
