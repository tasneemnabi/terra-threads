/**
 * apply-curation-flip.ts — flip `materials.is_natural` to match the revised
 * FIBER curation policy:
 *
 *   - Pure naturals (Cotton, Linen, Wool, Hemp, Silk, Cashmere, Alpaca, etc.)
 *     stay `is_natural = true`.
 *   - Semi-synthetics / regenerated cellulose (Tencel, Lyocell, Modal,
 *     Viscose, Rayon, Cupro, Bamboo rayon/viscose, Acetate, etc.) flip to
 *     `is_natural = false`. They still land products in the "Nearly Natural"
 *     tier, but only because they're not banned — they're no longer counted
 *     as natural fibers for tier classification.
 *   - Pure synthetics (Spandex/Elastane/Lycra, Polyester, Nylon, Acrylic)
 *     remain `is_natural = false`.
 *
 * Idempotent — safe to re-run. Dry-run by default; pass `--apply` to write.
 *
 * Usage:
 *   npx tsx scripts/apply-curation-flip.ts            # dry run
 *   npx tsx scripts/apply-curation-flip.ts --apply    # write changes
 */

import { getSupabaseAdmin } from "./lib/env";

const dryRun = !process.argv.includes("--apply");

/**
 * Canonical names (or name fragments) for semi-synthetic / regenerated
 * cellulose fibers. Match is case-insensitive substring: e.g. a DB row
 * named "Tencel Lyocell" or "Bamboo Lyocell" will match "lyocell".
 */
const SEMI_SYNTHETIC_TOKENS = [
  "tencel",
  "lyocell",
  "modal",
  "viscose",
  "rayon",
  "cupro",
  "acetate",
  // Bamboo is almost always sold as bamboo rayon/viscose — treat the bare
  // "bamboo" material as semi-synthetic unless a curator explicitly renames
  // it (we don't carry "bamboo linen" in the canonical set).
  "bamboo",
];

/**
 * Pure synthetic tokens — these must stay `is_natural = false` regardless.
 * Listed here so the script can sanity-check and refuse to flip them.
 */
const PURE_SYNTHETIC_TOKENS = [
  "spandex",
  "elastane",
  "lycra",
  "polyester",
  "nylon",
  "acrylic",
  "polypropylene",
  "polyamide",
];

function isSemiSynthetic(name: string): boolean {
  const n = name.toLowerCase();
  return SEMI_SYNTHETIC_TOKENS.some((t) => n.includes(t));
}

function isPureSynthetic(name: string): boolean {
  const n = name.toLowerCase();
  return PURE_SYNTHETIC_TOKENS.some((t) => n.includes(t));
}

interface MaterialRow {
  id: string;
  name: string;
  is_natural: boolean;
}

async function main() {
  const supabase = getSupabaseAdmin();

  console.log(`\n${dryRun ? "DRY RUN" : "APPLYING"} — curation is_natural flip\n`);

  const { data, error } = await supabase
    .from("materials")
    .select("id, name, is_natural")
    .order("name");

  if (error) {
    console.error("Failed to fetch materials:", error);
    process.exit(1);
  }

  const rows = (data ?? []) as MaterialRow[];

  console.log("=== Current materials table ===");
  console.log("name".padEnd(28) + "is_natural  classification");
  console.log("-".repeat(70));
  for (const r of rows) {
    let cls = "natural";
    if (isPureSynthetic(r.name)) cls = "synthetic";
    else if (isSemiSynthetic(r.name)) cls = "semi-synthetic";
    console.log(
      r.name.padEnd(28) +
        String(r.is_natural).padEnd(12) +
        cls
    );
  }
  console.log(`(${rows.length} rows)\n`);

  // Compute target state
  const toFlip: { row: MaterialRow; target: boolean }[] = [];
  for (const r of rows) {
    let target = r.is_natural;
    if (isPureSynthetic(r.name)) {
      target = false;
    } else if (isSemiSynthetic(r.name)) {
      target = false;
    } else {
      // Pure natural — keep true
      target = true;
    }
    if (target !== r.is_natural) {
      toFlip.push({ row: r, target });
    }
  }

  if (toFlip.length === 0) {
    console.log("No changes needed — materials.is_natural already matches the new policy.");
    return;
  }

  console.log("=== Rows that will change ===");
  for (const { row, target } of toFlip) {
    console.log(
      `  ${row.name.padEnd(28)} ${row.is_natural}  ->  ${target}`
    );
  }
  console.log(`(${toFlip.length} row(s) to flip)\n`);

  if (dryRun) {
    console.log("Dry run — re-run with --apply to write.");
    return;
  }

  let errors = 0;
  for (const { row, target } of toFlip) {
    const { error: updErr } = await supabase
      .from("materials")
      .update({ is_natural: target })
      .eq("id", row.id);
    if (updErr) {
      console.error(`  FAILED ${row.name}:`, updErr.message);
      errors++;
    } else {
      console.log(`  ok  ${row.name.padEnd(28)} -> ${target}`);
    }
  }

  console.log(`\nDone. ${toFlip.length - errors} updated, ${errors} error(s).`);

  // Verify by re-reading.
  const { data: after } = await supabase
    .from("materials")
    .select("name, is_natural")
    .order("name");
  console.log("\n=== After ===");
  for (const r of (after ?? []) as Pick<MaterialRow, "name" | "is_natural">[]) {
    console.log(`  ${r.name.padEnd(28)} ${r.is_natural}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
