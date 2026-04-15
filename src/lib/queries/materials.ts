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
    throw new Error("Failed to load materials.");
  }

  return data as Material[];
}

