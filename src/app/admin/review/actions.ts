"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function updateProductStatus(
  productId: string,
  status: "approved" | "rejected"
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("products")
    .update({ sync_status: status })
    .eq("id", productId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/review");
}

export async function batchUpdateStatus(
  productIds: string[],
  status: "approved" | "rejected"
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("products")
    .update({ sync_status: status })
    .in("id", productIds);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/review");
}

export async function approveAllPendingForBrand(brandId: string) {
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("products")
    .update({ sync_status: "approved" })
    .eq("brand_id", brandId)
    .eq("sync_status", "pending");

  if (error) throw new Error(error.message);
  revalidatePath("/admin/review");
  return count || 0;
}

export async function updateProductMaterials(
  productId: string,
  materials: Array<{ materialId: string; percentage: number }>
) {
  const supabase = createAdminClient();

  // Wipe existing rows, then re-insert
  const { error: delError } = await supabase
    .from("product_materials")
    .delete()
    .eq("product_id", productId);
  if (delError) throw new Error(delError.message);

  if (materials.length > 0) {
    const rows = materials
      .filter((m) => m.materialId && m.percentage > 0)
      .map((m) => ({
        product_id: productId,
        material_id: m.materialId,
        percentage: m.percentage,
      }));
    if (rows.length > 0) {
      const { error } = await supabase.from("product_materials").insert(rows);
      if (error) throw new Error(error.message);
    }
  }

  // Bump confidence since a human curated it
  await supabase
    .from("products")
    .update({ material_confidence: 1.0 })
    .eq("id", productId);

  revalidatePath("/admin/review");
}
