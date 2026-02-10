import { createClient } from "@/lib/supabase/server";
import type { ProductWithBrand, ProductWithBrandAndCount, FilterState } from "@/types/database";

const PAGE_SIZE = 12;

export async function getFilteredProducts(
  filters: FilterState
): Promise<{ products: ProductWithBrand[]; totalCount: number }> {
  const supabase = await createClient();
  const offset = ((filters.page || 1) - 1) * PAGE_SIZE;

  const { data, error } = await supabase.rpc("filter_products", {
    p_category: filters.category || null,
    p_brand_slugs: filters.brands?.length ? filters.brands : null,
    p_material_names: filters.materials?.length ? filters.materials : null,
    p_min_price: filters.minPrice || null,
    p_max_price: filters.maxPrice || null,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  if (error) {
    console.error("Error fetching filtered products:", error);
    return { products: [], totalCount: 0 };
  }

  const rows = data as ProductWithBrandAndCount[];
  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

  return {
    products: rows.map(({ total_count: _, ...product }) => product),
    totalCount,
  };
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
    return null;
  }

  return data as ProductWithBrand;
}

export async function getFeaturedProducts(): Promise<ProductWithBrand[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products_with_materials")
    .select("*")
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error("Error fetching featured products:", error);
    return [];
  }

  return data as ProductWithBrand[];
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
    .limit(limit);

  if (error) {
    console.error("Error fetching related products:", error);
    return [];
  }

  return data as ProductWithBrand[];
}

export async function getProductsByBrand(brandId: string): Promise<ProductWithBrand[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products_with_materials")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching brand products:", error);
    return [];
  }

  return data as ProductWithBrand[];
}
