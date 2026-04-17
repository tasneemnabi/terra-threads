import { createClient } from "@/lib/supabase/server";
import type { Brand, BrandWithDetails } from "@/types/database";

interface BrandProductMaterialRow {
  percentage: number | null;
  materials: { name: string; is_natural: boolean } | null;
}

interface BrandProductRow {
  id: string;
  category: string;
  sync_status: "pending" | "review" | "approved" | "rejected" | null;
  product_materials: BrandProductMaterialRow[] | null;
}

interface BrandWithProductsRow extends Brand {
  products: BrandProductRow[] | null;
}

export async function getAllBrands(): Promise<Brand[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching brands:", error);
    throw new Error("Failed to load brands.");
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
        sync_status,
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
    .eq("sync_enabled", true)
    .order("name")
    .returns<BrandWithProductsRow[]>();

  if (error) {
    console.error("Error fetching brands with details:", error);
    throw new Error("Failed to load brand details.");
  }

  const rows = data || [];
  const result = rows.map((brand) => {
    // Only count live products. Per curation policy, sync statuses are
    // approved (live) / review (needs work) / rejected (hidden).
    const products = (brand.products || []).filter(
      (p) => p.sync_status === "approved"
    );

    // Prefer brand-level metadata; fall back to product-derived if empty
    let fiberTypes: string[] = brand.fiber_types || [];
    let categories: string[] = brand.categories || [];
    const audience: string[] = brand.audience || [];

    if (fiberTypes.length === 0 || categories.length === 0) {
      const fiberSet = new Set<string>(fiberTypes);
      const categorySet = new Set<string>(categories);

      for (const product of products) {
        if (categories.length === 0) categorySet.add(product.category);
        if (fiberTypes.length === 0) {
          for (const pm of product.product_materials || []) {
            if (pm.materials?.is_natural) {
              fiberSet.add(pm.materials.name);
            }
          }
        }
      }

      if (fiberTypes.length === 0) fiberTypes = Array.from(fiberSet).sort();
      if (categories.length === 0) categories = Array.from(categorySet).sort();
    }

    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      website_url: brand.website_url,
      product_count: products.length,
      fiber_types: fiberTypes,
      is_fully_natural: brand.is_fully_natural,
      categories,
      audience,
    };
  });

  // Sort: 100% Natural first, then Nearly Natural, alphabetical within each
  return result.sort((a, b) => {
    if (a.is_fully_natural !== b.is_fully_natural) {
      return a.is_fully_natural ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
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
    throw new Error("Failed to load brand.");
  }

  return data as Brand;
}

