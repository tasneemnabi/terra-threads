/**
 * Shared Supabase database helpers for CLI scripts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  KNOWN_MATERIALS,
  EXTRA_NATURAL_FIBERS,
  TRUSTED_MATERIALS,
  isMaterialNatural,
} from "./curation.js";

// Lookup or insert a material. materialCache scopes memoization to a single run.
async function ensureMaterialExists(
  supabase: SupabaseClient,
  materialName: string,
  materialCache: Map<string, string>
): Promise<string | null> {
  // Reject untrusted material names — prevents junk from polluting the DB
  if (!TRUSTED_MATERIALS.has(materialName)) {
    console.warn(`    ⚠ Skipping untrusted material: "${materialName}"`);
    return null;
  }

  const cached = materialCache.get(materialName);
  if (cached) return cached;

  if (KNOWN_MATERIALS[materialName]) {
    const id = KNOWN_MATERIALS[materialName].id;
    materialCache.set(materialName, id);
    return id;
  }

  const { data: existing } = await supabase
    .from("materials")
    .select("id")
    .eq("name", materialName)
    .single();

  if (existing) {
    materialCache.set(materialName, existing.id);
    return existing.id;
  }

  const desc = EXTRA_NATURAL_FIBERS[materialName] || `${materialName} fiber.`;
  const isNat = isMaterialNatural(materialName);

  const { data: inserted, error } = await supabase
    .from("materials")
    .insert({ name: materialName, description: desc, is_natural: isNat })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to insert material "${materialName}": ${error.message}`);

  materialCache.set(materialName, inserted!.id);
  console.log(`    + New material: ${materialName}`);
  return inserted!.id;
}

export async function syncProductMaterials(
  supabase: SupabaseClient,
  productId: string,
  materials: Record<string, number>,
  materialCache: Map<string, string>
): Promise<void> {
  await supabase.from("product_materials").delete().eq("product_id", productId);

  if (Object.keys(materials).length === 0) return;

  const rows = [];
  for (const [name, pct] of Object.entries(materials)) {
    const materialId = await ensureMaterialExists(supabase, name, materialCache);
    if (!materialId) continue; // Skip untrusted materials
    rows.push({
      product_id: productId,
      material_id: materialId,
      percentage: pct,
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("product_materials").insert(rows);
    if (error) {
      console.error(`    Failed to insert materials for product ${productId}: ${error.message}`);
    }
  }
}
