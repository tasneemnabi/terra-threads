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
