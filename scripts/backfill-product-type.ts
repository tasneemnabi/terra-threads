/**
 * Backfill product_type for existing products.
 * Usage:
 *   npx tsx scripts/backfill-product-type.ts           # dry run
 *   npx tsx scripts/backfill-product-type.ts --apply    # apply changes
 */

import { createClient } from "@supabase/supabase-js";
import { classifyProductType, mapActivewearType, shouldRejectProduct } from "./lib/product-classifier";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dryRun = !process.argv.includes("--apply");

async function main() {
  console.log(`\n${dryRun ? "DRY RUN" : "APPLYING"} — backfill product_type\n`);

  // Fetch all visible products with brand slug (paginated to avoid 1000-row limit)
  const products: { id: string; name: string; category: string; brands: { slug: string } }[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data, error: fetchErr } = await supabase
      .from("products")
      .select("id, name, category, brands!inner(slug)")
      .or("sync_status.is.null,sync_status.eq.approved")
      .range(offset, offset + PAGE - 1);
    if (fetchErr) {
      console.error("Error fetching products:", fetchErr);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    products.push(...(data as typeof products));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  const error = null;

  if (error) {
    console.error("Error fetching products:", error);
    process.exit(1);
  }

  console.log(`Found ${products.length} products to classify\n`);

  const stats = {
    classified: 0,
    unclassified: 0,
    rejected: 0,
    byType: {} as Record<string, number>,
  };

  const updates: { id: string; product_type: string }[] = [];
  const rejects: { id: string; name: string }[] = [];
  const unclassified: string[] = [];

  for (const product of products) {
    const brandSlug = (product as any).brands?.slug ?? "";

    // Check for non-clothing (brand-aware: uses whitelist mode for lifestyle brands)
    const rejection = shouldRejectProduct(product.name, brandSlug);
    if (rejection.rejected) {
      stats.rejected++;
      rejects.push({ id: product.id, name: product.name });
      continue;
    }

    const rawType = classifyProductType(product.name);
    const productType = rawType && product.category === "activewear" ? mapActivewearType(rawType) : rawType;

    if (productType) {
      stats.classified++;
      stats.byType[productType] = (stats.byType[productType] || 0) + 1;
      updates.push({ id: product.id, product_type: productType });
    } else {
      stats.unclassified++;
      unclassified.push(product.name);
    }
  }

  // Print stats
  console.log("=== Classification Stats ===");
  console.log(`  Classified:   ${stats.classified}`);
  console.log(`  Unclassified: ${stats.unclassified}`);
  console.log(`  Non-clothing: ${stats.rejected}`);
  console.log();

  console.log("=== By Type ===");
  for (const [type, count] of Object.entries(stats.byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(5)}  ${type}`);
  }

  if (rejects.length > 0) {
    console.log("\n=== Non-Clothing (will reject) ===");
    for (const r of rejects) {
      console.log(`  ${r.name}`);
    }
  }

  if (unclassified.length > 0) {
    console.log(`\n=== Unclassified (${unclassified.length}) ===`);
    for (const name of unclassified.slice(0, 30)) {
      console.log(`  ${name}`);
    }
    if (unclassified.length > 30) {
      console.log(`  ... and ${unclassified.length - 30} more`);
    }
  }

  if (dryRun) {
    console.log("\nDry run complete. Run with --apply to save changes.");
    return;
  }

  // Apply updates in batches
  console.log(`\nApplying ${updates.length} product_type updates...`);
  const BATCH = 100;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    for (const update of batch) {
      const { error } = await supabase
        .from("products")
        .update({ product_type: update.product_type })
        .eq("id", update.id);
      if (error) {
        console.error(`  Error updating ${update.id}:`, error.message);
      }
    }
    process.stdout.write(`  ${Math.min(i + BATCH, updates.length)}/${updates.length}\r`);
  }
  console.log(`\nUpdated ${updates.length} products.`);

  // Reject non-clothing
  if (rejects.length > 0) {
    console.log(`\nRejecting ${rejects.length} non-clothing items...`);
    for (const r of rejects) {
      const { error } = await supabase
        .from("products")
        .update({ sync_status: "rejected" })
        .eq("id", r.id);
      if (error) {
        console.error(`  Error rejecting ${r.name}:`, error.message);
      }
    }
    console.log(`Rejected ${rejects.length} items.`);
  }

  console.log("\nDone!");
}

main().catch(console.error);
