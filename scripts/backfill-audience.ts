/**
 * Backfill audience for existing products.
 * Uses title + product_type + brand.audience (no tags — not stored in DB).
 * For tag-dependent brands, re-sync with sync-shopify.ts after this.
 *
 * Usage:
 *   npx tsx scripts/backfill-audience.ts           # dry run
 *   npx tsx scripts/backfill-audience.ts --apply    # apply changes
 */

import { classifyAudience } from "./lib/product-classifier";
import { getSupabaseAdmin } from "./lib/env";

const supabase = getSupabaseAdmin();
const dryRun = !process.argv.includes("--apply");

async function main() {
  console.log(`\n${dryRun ? "DRY RUN" : "APPLYING"} — backfill audience\n`);

  // Fetch all approved products with brand audience (paginate past 1000-row limit)
  const products: any[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, product_type, brands!inner(audience)")
      .eq("sync_status", "approved")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("Error fetching products:", error);
      process.exit(1);
    }
    products.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`Found ${products.length} approved products to classify\n`);

  const stats = {
    total: products.length,
    byAudience: {} as Record<string, number>,
  };

  const updates: { id: string; audience: string }[] = [];

  for (const product of products) {
    const brandAudience = (product.brands as any)?.audience as string[] | undefined;
    const audience = classifyAudience(
      product.name,
      undefined, // no tags in DB
      product.product_type,
      brandAudience
    );

    stats.byAudience[audience] = (stats.byAudience[audience] || 0) + 1;
    updates.push({ id: product.id, audience });
  }

  // Print stats
  console.log("=== Audience Breakdown ===");
  for (const [audience, count] of Object.entries(stats.byAudience).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(5)}  ${audience}`);
  }
  console.log(`  ${("-").repeat(12)}`);
  console.log(`  ${stats.total.toString().padStart(5)}  total`);

  if (dryRun) {
    console.log("\nDry run complete. Run with --apply to save changes.");
    return;
  }

  // Apply updates in batches
  console.log(`\nApplying ${updates.length} audience updates...`);
  const BATCH = 100;
  let errors = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    for (const update of batch) {
      const { error } = await supabase
        .from("products")
        .update({ audience: update.audience })
        .eq("id", update.id);
      if (error) {
        console.error(`  Error updating ${update.id}:`, error.message);
        errors++;
      }
    }
    process.stdout.write(`  ${Math.min(i + BATCH, updates.length)}/${updates.length}\r`);
  }
  console.log(`\nUpdated ${updates.length - errors} products (${errors} errors).`);
  console.log("\nDone!");
}

main().catch(console.error);
