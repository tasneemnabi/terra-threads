/**
 * cleanup-llm-pass.ts — One-time cleanup after evaluating the LLM pass results.
 *
 * Fixes:
 * 1. Bulk-reject all Everlane products (dropped brand)
 * 2. Reject Fair Indigo nested-collection URLs (category pages, not products)
 * 3. Reject Pact bundle URLs (no individual price)
 * 4. Reject non-clothing items (stuffed animals, belts, leather goods)
 * 5. Reject products from non-roster brands (e.g. Dior)
 * 6. Fix Gil Rodriguez "Mulesing" hallucination
 *
 * Usage:
 *   npx tsx scripts/cleanup-llm-pass.ts --dry-run   # Preview changes
 *   npx tsx scripts/cleanup-llm-pass.ts              # Execute changes
 */

import { loadEnv, getSupabaseAdmin } from "./lib/env.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  loadEnv();
  const supabase = getSupabaseAdmin();

  if (dryRun) console.log("DRY RUN — no changes will be made\n");

  let totalRejected = 0;
  let totalFixed = 0;

  // ─── 1. Bulk-reject Everlane products ─────────────────────────────
  console.log("1. Rejecting all Everlane products (dropped brand)...");
  {
    const { data: everlane } = await supabase
      .from("brands")
      .select("id, name")
      .ilike("slug", "everlane")
      .maybeSingle();

    if (everlane) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name, sync_status")
        .eq("brand_id", everlane.id)
        .neq("sync_status", "rejected");

      const count = products?.length ?? 0;
      console.log(`   Found ${count} non-rejected Everlane products`);

      if (count > 0 && !dryRun) {
        const ids = products!.map((p) => p.id);
        const { error } = await supabase
          .from("products")
          .update({ sync_status: "rejected" })
          .in("id", ids);
        if (error) console.error("   ERROR:", error.message);
        else console.log(`   ✓ Rejected ${count} products`);
      }
      totalRejected += count;
    } else {
      console.log("   Everlane brand not found — skipping");
    }
  }

  // ─── 2. Reject Fair Indigo nested-collection URLs ─────────────────
  console.log("\n2. Rejecting nested-collection URLs (category pages)...");
  {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, affiliate_url")
      .neq("sync_status", "rejected")
      .like("affiliate_url", "%nested-collection%");

    const count = products?.length ?? 0;
    console.log(`   Found ${count} nested-collection URLs`);

    if (count > 0) {
      for (const p of products!) {
        console.log(`   - ${p.name} (${p.affiliate_url})`);
      }
      if (!dryRun) {
        const ids = products!.map((p) => p.id);
        const { error } = await supabase
          .from("products")
          .update({ sync_status: "rejected" })
          .in("id", ids);
        if (error) console.error("   ERROR:", error.message);
        else console.log(`   ✓ Rejected ${count} products`);
      }
      totalRejected += count;
    }
  }

  // ─── 3. Reject Pact bundle URLs ───────────────────────────────────
  console.log("\n3. Rejecting Pact bundle URLs (no individual price)...");
  {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, affiliate_url")
      .neq("sync_status", "rejected")
      .like("affiliate_url", "%/bdl-%");

    const count = products?.length ?? 0;
    console.log(`   Found ${count} bundle URLs`);

    if (count > 0) {
      for (const p of products!) {
        console.log(`   - ${p.name} (${p.affiliate_url})`);
      }
      if (!dryRun) {
        const ids = products!.map((p) => p.id);
        const { error } = await supabase
          .from("products")
          .update({ sync_status: "rejected" })
          .in("id", ids);
        if (error) console.error("   ERROR:", error.message);
        else console.log(`   ✓ Rejected ${count} products`);
      }
      totalRejected += count;
    }
  }

  // ─── 4. Reject non-clothing items (stuffed animals, etc.) ─────────
  console.log("\n4. Rejecting non-clothing items (stuffed animals, belts, leather)...");
  {
    const NON_CLOTHING_PATTERNS = [
      "stuffed animal",
      "soft toy",
      "leather belt",
      "dress belt",
    ];

    for (const pattern of NON_CLOTHING_PATTERNS) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .neq("sync_status", "rejected")
        .ilike("name", `%${pattern}%`);

      if (products && products.length > 0) {
        for (const p of products) {
          console.log(`   - ${p.name} (matched: "${pattern}")`);
        }
        if (!dryRun) {
          const ids = products.map((p) => p.id);
          const { error } = await supabase
            .from("products")
            .update({ sync_status: "rejected" })
            .in("id", ids);
          if (error) console.error("   ERROR:", error.message);
        }
        totalRejected += products.length;
      }
    }
    console.log(`   ✓ Found ${totalRejected > 0 ? "matches above" : "no matches"}`);
  }

  // ─── 5. Reject products from dropped brands ────────────────────────
  console.log("\n5. Rejecting products from dropped brands...");
  {
    const DROPPED_BRAND_SLUGS = ["everlane", "quince", "prana", "icebreaker"];

    for (const slug of DROPPED_BRAND_SLUGS) {
      const { data: brand } = await supabase
        .from("brands")
        .select("id, name")
        .eq("slug", slug)
        .maybeSingle();

      if (!brand) continue;

      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .eq("brand_id", brand.id)
        .neq("sync_status", "rejected");

      const count = products?.length ?? 0;
      if (count > 0) {
        console.log(`   ${brand.name}: ${count} non-rejected products`);
        if (!dryRun) {
          const ids = products!.map((p) => p.id);
          const { error } = await supabase
            .from("products")
            .update({ sync_status: "rejected" })
            .in("id", ids);
          if (error) console.error("   ERROR:", error.message);
          else console.log(`   ✓ Rejected ${count} products from ${brand.name}`);
        }
        totalRejected += count;
      }
    }
  }

  // ─── 6. Fix Gil Rodriguez "Mulesing" hallucination ────────────────
  console.log("\n6. Fixing Gil Rodriguez 'Mulesing' material hallucination...");
  {
    // Find the affected products
    const { data: products } = await supabase
      .from("products")
      .select("id, name, sync_status")
      .ilike("name", "%Tricot x Gil Rodriguez Cashmere Cardigan%");

    if (products && products.length > 0) {
      console.log(`   Found ${products.length} affected product(s)`);
      for (const p of products) {
        console.log(`   - ${p.name} [${p.sync_status}]`);
      }

      if (!dryRun) {
        for (const p of products) {
          // Delete incorrect material associations
          const { error: delError } = await supabase
            .from("product_materials")
            .delete()
            .eq("product_id", p.id);
          if (delError) {
            console.error(`   ERROR deleting materials for ${p.name}:`, delError.message);
            continue;
          }

          // Set back to review so it gets re-evaluated
          const { error: updateError } = await supabase
            .from("products")
            .update({ sync_status: "review", material_confidence: 0 })
            .eq("id", p.id);
          if (updateError) {
            console.error(`   ERROR updating ${p.name}:`, updateError.message);
            continue;
          }

          console.log(`   ✓ Cleared materials and reset to review: ${p.name}`);
          totalFixed++;
        }
      }
    } else {
      console.log("   No Mulesing-affected products found");
    }

    // Also check if "Mulesing" ended up in the materials table
    const { data: mulesing } = await supabase
      .from("materials")
      .select("id, name")
      .ilike("name", "%mulesing%");

    if (mulesing && mulesing.length > 0) {
      console.log(`   Found 'Mulesing' in materials table — cleaning up`);
      if (!dryRun) {
        // Delete product_materials references first
        for (const m of mulesing) {
          await supabase.from("product_materials").delete().eq("material_id", m.id);
          await supabase.from("materials").delete().eq("id", m.id);
        }
        console.log(`   ✓ Removed 'Mulesing' from materials table`);
      }
    }

    // Same for "Leather"
    const { data: leather } = await supabase
      .from("materials")
      .select("id, name")
      .ilike("name", "leather");

    if (leather && leather.length > 0) {
      console.log(`   Found 'Leather' in materials table — cleaning up`);
      if (!dryRun) {
        for (const m of leather) {
          await supabase.from("product_materials").delete().eq("material_id", m.id);
          await supabase.from("materials").delete().eq("id", m.id);
        }
        console.log(`   ✓ Removed 'Leather' from materials table`);
      }
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(50)}`);
  console.log(`CLEANUP SUMMARY${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`${"═".repeat(50)}`);
  console.log(`  Rejected: ${totalRejected}`);
  console.log(`  Fixed:    ${totalFixed}`);

  if (dryRun) {
    console.log("\nRe-run without --dry-run to apply changes.");
  }
}

main().catch(console.error);
