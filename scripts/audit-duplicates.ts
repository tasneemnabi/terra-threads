/**
 * One-off investigation: find duplicate products (same brand_slug + name, different slug)
 * and surface sync_status of dropped brands. Read-only — prints a report.
 */

import { getSupabaseAdmin } from "./lib/env";

const DROPPED_BRAND_SLUGS = ["everlane", "quince", "prana", "icebreaker"];

async function main() {
  const supabase = getSupabaseAdmin();

  // --- Duplicate products report -------------------------------------------
  const { data: products, error: prodErr } = await supabase
    .from("products_with_materials")
    .select("id, slug, name, brand_slug, brand_name, sync_status, is_available, created_at")
    .eq("is_available", true)
    .not("image_url", "is", null)
    .gt("price", 0);

  if (prodErr) {
    console.error("Error fetching products:", prodErr);
    process.exit(1);
  }

  const groups = new Map<string, typeof products>();
  for (const p of products!) {
    const key = `${p.brand_slug}::${(p.name as string).trim().toLowerCase()}`;
    const arr = groups.get(key) || [];
    arr.push(p);
    groups.set(key, arr);
  }

  const dupes = Array.from(groups.entries()).filter(([, arr]) => arr!.length > 1);

  console.log(`\n=== Duplicate products (same brand_slug + name) ===`);
  console.log(`Found ${dupes.length} duplicate groups across ${products!.length} live products.\n`);
  for (const [key, arr] of dupes) {
    console.log(`• ${key} (${arr!.length} rows)`);
    for (const p of arr!) {
      console.log(`    slug=${p.slug}  id=${p.id}  created=${p.created_at}`);
    }
  }

  // --- Dropped brands report -----------------------------------------------
  const { data: brands, error: brErr } = await supabase
    .from("brands")
    .select("id, slug, name, sync_enabled")
    .in("slug", DROPPED_BRAND_SLUGS);

  if (brErr) {
    console.error("Error fetching brands:", brErr);
    process.exit(1);
  }

  console.log(`\n=== Dropped-brand status ===`);
  for (const b of brands || []) {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", b.id)
      .eq("sync_status", "approved");
    console.log(
      `• ${b.slug} — sync_enabled=${b.sync_enabled} approved_products=${count ?? 0}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
