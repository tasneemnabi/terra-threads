/**
 * review-products.ts — CLI tool to review synced products.
 *
 * Usage:
 *   npx tsx scripts/review-products.ts                          (interactive review of 'review' products)
 *   npx tsx scripts/review-products.ts --status pending         (review 'pending' products)
 *   npx tsx scripts/review-products.ts --brand layere           (filter by brand)
 *   npx tsx scripts/review-products.ts approve-all --brand X    (batch approve all 'pending' for a brand)
 *   npx tsx scripts/review-products.ts reject-all --brand X     (batch reject all 'review' for a brand)
 */

import * as readline from "readline";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./lib/env.js";

// ─── Helpers ────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const supabase = getSupabaseAdmin();

  const brandFlag = args.indexOf("--brand");
  const brandSlug = brandFlag !== -1 ? args[brandFlag + 1] : null;
  const statusFlag = args.indexOf("--status");
  const statusFilter = statusFlag !== -1 ? args[statusFlag + 1] : null;

  // Batch commands
  if (args[0] === "approve-all") {
    if (!brandSlug) {
      console.error("approve-all requires --brand <slug>");
      process.exit(1);
    }
    await batchUpdate(supabase, brandSlug, "pending", "approved");
    return;
  }

  if (args[0] === "reject-all") {
    if (!brandSlug) {
      console.error("reject-all requires --brand <slug>");
      process.exit(1);
    }
    await batchUpdate(supabase, brandSlug, "review", "rejected");
    return;
  }

  // Interactive review
  let query = supabase
    .from("products")
    .select("*, brands!inner(name, slug)")
    .order("material_confidence", { ascending: true });

  // Default to 'review' status unless specified
  const status = statusFilter || "review";
  query = query.eq("sync_status", status);

  if (brandSlug) {
    query = query.eq("brands.slug", brandSlug);
  }

  const { data: products, error } = await query.limit(50);

  if (error) {
    console.error("Failed to fetch products:", error.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log(`No products with status '${status}'${brandSlug ? ` for brand '${brandSlug}'` : ""}`);
    return;
  }

  console.log(`\nFound ${products.length} product(s) with status '${status}'\n`);

  // Fetch materials for these products
  const productIds = products.map((p) => p.id);
  const { data: allMaterials } = await supabase
    .from("product_materials")
    .select("product_id, percentage, materials(name, is_natural)")
    .in("product_id", productIds);

  const materialsByProduct = new Map<string, Array<{ name: string; percentage: number; is_natural: boolean }>>();
  for (const pm of allMaterials || []) {
    const list = materialsByProduct.get(pm.product_id) || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mat = pm.materials as any;
    if (mat) {
      list.push({ name: mat.name, percentage: pm.percentage, is_natural: mat.is_natural });
    }
    materialsByProduct.set(pm.product_id, list);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brand = (product as any).brands;
    const materials = materialsByProduct.get(product.id) || [];

    console.log(`\n${"─".repeat(60)}`);
    console.log(`[${i + 1}/${products.length}] ${product.name}`);
    console.log(`Brand:      ${brand?.name || "Unknown"}`);
    console.log(`Price:      $${product.price}`);
    console.log(`Category:   ${product.category}`);
    console.log(`Confidence: ${product.material_confidence?.toFixed(2) || "N/A"}`);
    console.log(`Status:     ${product.sync_status}`);
    console.log(`URL:        ${product.affiliate_url || "N/A"}`);

    if (materials.length > 0) {
      console.log("Materials:");
      for (const m of materials) {
        const nat = m.is_natural ? "" : " (synthetic)";
        console.log(`  ${m.percentage}% ${m.name}${nat}`);
      }
    } else {
      console.log("Materials:  (none extracted)");
    }

    if (product.raw_body_html) {
      const excerpt = stripHtml(product.raw_body_html).slice(0, 200);
      console.log(`\nDescription excerpt:\n  ${excerpt}...`);
    }

    const answer = await ask(rl, "\n[a]pprove / [r]eject / [s]kip / [q]uit: ");

    switch (answer.toLowerCase().trim()) {
      case "a":
      case "approve": {
        const { error: updateErr } = await supabase
          .from("products")
          .update({ sync_status: "approved" })
          .eq("id", product.id);
        if (updateErr) {
          console.error(`  Failed to approve: ${updateErr.message}`);
        } else {
          console.log("  Approved.");
        }
        break;
      }
      case "r":
      case "reject": {
        const { error: updateErr } = await supabase
          .from("products")
          .update({ sync_status: "rejected" })
          .eq("id", product.id);
        if (updateErr) {
          console.error(`  Failed to reject: ${updateErr.message}`);
        } else {
          console.log("  Rejected.");
        }
        break;
      }
      case "q":
      case "quit":
        console.log("\nExiting review.");
        rl.close();
        return;
      default:
        console.log("  Skipped.");
    }
  }

  rl.close();
  console.log("\nReview complete.");
}

async function batchUpdate(
  supabase: SupabaseClient,
  brandSlug: string,
  fromStatus: string,
  toStatus: string
): Promise<void> {
  // Get brand ID
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id, name")
    .eq("slug", brandSlug)
    .single();

  if (brandError || !brand) {
    console.error(`Brand "${brandSlug}" not found`);
    process.exit(1);
  }

  // Count products to update
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brand.id)
    .eq("sync_status", fromStatus);

  if (!count || count === 0) {
    console.log(`No '${fromStatus}' products found for ${brand.name}`);
    return;
  }

  console.log(`Updating ${count} products for ${brand.name}: ${fromStatus} → ${toStatus}`);

  const { error } = await supabase
    .from("products")
    .update({ sync_status: toStatus })
    .eq("brand_id", brand.id)
    .eq("sync_status", fromStatus);

  if (error) {
    console.error(`Failed: ${error.message}`);
    process.exit(1);
  }

  console.log(`Done. ${count} products set to '${toStatus}'.`);
}

main();
