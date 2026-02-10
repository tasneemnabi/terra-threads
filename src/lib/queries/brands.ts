import { createClient } from "@/lib/supabase/server";
import type { Brand } from "@/types/database";

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
