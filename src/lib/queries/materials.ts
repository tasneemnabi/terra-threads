import { createClient } from "@/lib/supabase/server";
import type { Material } from "@/types/database";

export async function getAllMaterials(): Promise<Material[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching materials:", error);
    return [];
  }

  return data as Material[];
}

export async function getMaterialsByCategory(category: string): Promise<Material[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("materials")
    .select("*, product_materials!inner(products!inner(category))")
    .eq("product_materials.products.category", category);

  if (error) {
    console.error("Error fetching materials by category:", error);
    return [];
  }

  return data as Material[];
}
