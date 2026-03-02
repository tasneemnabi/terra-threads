import { createClient } from "@/lib/supabase/server";
import type { Brand, BrandWithDetails } from "@/types/database";

export async function getAllBrands(): Promise<Brand[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching brands:", error);
    return [];
  }

  return data as Brand[];
}

export async function getBrandsWithDetails(): Promise<BrandWithDetails[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brands")
    .select(
      `
      *,
      products (
        id,
        category,
        product_materials (
          percentage,
          materials (
            name,
            is_natural
          )
        )
      )
    `
    )
    .order("name");

  if (error) {
    console.error("Error fetching brands with details:", error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((brand: any) => {
    const products = brand.products || [];
    const fiberSet = new Set<string>();
    const categorySet = new Set<string>();

    for (const product of products) {
      categorySet.add(product.category);
      for (const pm of product.product_materials || []) {
        if (pm.materials?.is_natural) {
          fiberSet.add(pm.materials.name);
        }
      }
    }

    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      website_url: brand.website_url,
      product_count: products.length,
      fiber_types: Array.from(fiberSet).sort(),
      is_fully_natural: brand.is_fully_natural,
      categories: Array.from(categorySet).sort(),
    };
  });
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("Error fetching brand:", error);
    return null;
  }

  return data as Brand;
}

export async function getBrandsByCategory(category: string): Promise<Brand[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brands")
    .select("*, products!inner(category)")
    .eq("products.category", category);

  if (error) {
    console.error("Error fetching brands by category:", error);
    return [];
  }

  return data as Brand[];
}
