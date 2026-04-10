/**
 * fix-unbound-materials.ts — Short-term fix for Unbound Merino.
 *
 * Unbound's Shopify body_html doesn't contain material composition; it lives
 * in a <div class="product-fabric"> rendered from a theme metafield. This
 * script fetches each product page, extracts the fabric div, parses the
 * composition, re-classifies the product, and writes the correct materials.
 *
 * Usage:
 *   npx tsx scripts/fix-unbound-materials.ts --dry-run
 *   npx tsx scripts/fix-unbound-materials.ts
 */

import { loadEnv, getSupabaseAdmin } from "./lib/env.js";
import { syncProductMaterials } from "./lib/db-helpers.js";
import { extractMaterialsFromText } from "./lib/material-extractor.js";
import { determineSyncStatus, isExtractionBanned } from "./lib/curation.js";

const BRAND_SLUG = "unbound-merino";
const FABRIC_DIV_RE = /<div class="product-fabric">([\s\S]*?)<\/div>/;

// Matches any inline text chunk between tags that contains a % symbol and a
// known fiber keyword. Used as a fallback when the fabric div is missing.
// Matches generic >...< so it catches text inside <strong>, <b>, etc.
const INLINE_TEXT_RE = />([^<]{5,500})</g;
const FIBER_KEYWORDS =
  /merino|wool|nylon|spandex|elastane|lycra|cotton|lyocell|tencel|linen|silk|cashmere|hemp|rayon|modal|viscose|polyester|acrylic|polyamide|cupro/i;

interface Outcome {
  name: string;
  status: "approved" | "rejected" | "review";
  materials: Record<string, number>;
  source: string;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Alias map from lowercase fiber name → canonical TRUSTED_MATERIALS name.
 * Covers the fiber names actually seen on Unbound pages.
 */
const ALIAS: Record<string, string> = {
  "merino wool": "Merino Wool",
  "merino": "Merino Wool",
  "wool": "Wool",
  "nylon": "Nylon",
  "polyamide": "Nylon",
  "spandex": "Spandex",
  "elastane": "Spandex",
  "lycra": "Spandex",
  "lycra spandex": "Spandex",
  "polyester": "Polyester",
  "tencel": "Tencel Lyocell",
  "tencel lyocell": "Tencel Lyocell",
  "lyocell": "Tencel Lyocell",
  "modal": "Modal",
  "cotton": "Cotton",
  "cupro": "Cupro",
  "silk": "Silk",
  "cashmere": "Cashmere",
  "linen": "Linen",
};

// Sort by length desc so longer aliases match first
const ALIAS_ENTRIES = Object.entries(ALIAS).sort((a, b) => b[0].length - a[0].length);

/**
 * Parse a composition string with optional decimal percentages.
 * Handles patterns like "53.5% Merino Wool, 20.5% Polyester, ...".
 * Rounds to integers and rebalances to sum to exactly 100.
 */
function parseDecimalComposition(text: string): Record<string, number> | null {
  // Match "<number>% <fiber-name>" where name is 1-4 alphabetic words
  const pattern = /(\d{1,3}(?:\.\d+)?)\s*%\s*([A-Za-z][A-Za-z\s]{1,40}?)(?=[,.;/\n]|\s+(?:\d|and|rib|jersey|knit|\Z)|$)/gi;
  const raw: Array<{ name: string; pct: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const pctFloat = parseFloat(m[1]);
    if (pctFloat <= 0 || pctFloat > 100) continue;
    const rawName = m[2].trim().toLowerCase();
    // Find longest matching alias at the start of the name
    let canonical: string | null = null;
    for (const [alias, c] of ALIAS_ENTRIES) {
      if (rawName === alias || rawName.startsWith(alias + " ") || rawName.startsWith(alias)) {
        canonical = c;
        break;
      }
    }
    if (!canonical) continue;
    raw.push({ name: canonical, pct: pctFloat });
  }

  if (raw.length === 0) return null;

  // Merge duplicates
  const merged: Record<string, number> = {};
  for (const r of raw) merged[r.name] = (merged[r.name] || 0) + r.pct;

  const floatTotal = Object.values(merged).reduce((a, b) => a + b, 0);
  // Tolerance: totals must be close to 100 (±5 for brand rounding gaps).
  // Unbound's Rib Socks e.g. list "83.5% / 12% / 1.5%" = 97% — assume
  // the missing 3% belongs to the largest component (Merino).
  if (Math.abs(floatTotal - 100) > 5) return null;

  // Round to integers
  const rounded: Record<string, number> = {};
  for (const [n, p] of Object.entries(merged)) rounded[n] = Math.round(p);
  let total = Object.values(rounded).reduce((a, b) => a + b, 0);

  // Rebalance to exactly 100 by adjusting the largest component
  if (total !== 100) {
    const delta = 100 - total;
    const sorted = Object.entries(rounded).sort((a, b) => b[1] - a[1]);
    rounded[sorted[0][0]] += delta;
  }

  return rounded;
}

/**
 * Extract the fabric composition from a product page HTML.
 * Tries (in order):
 *   1. <div class="product-fabric"> integer-percent parser
 *   2. Any inline element text with % + fiber keyword via integer parser
 *   3. Any inline element text via decimal-aware parser (handles 53.5%, etc.)
 */
function extractFabric(html: string): { text: string; extraction: ReturnType<typeof extractMaterialsFromText> } | null {
  // Strategy 1: canonical fabric div
  const m = html.match(FABRIC_DIV_RE);
  if (m) {
    const text = stripHtml(m[1]);
    const ex = extractMaterialsFromText(text);
    if (ex && Object.keys(ex.materials).length > 0) return { text, extraction: ex };
  }

  // Strategy 2: any small inline element containing % + a fiber keyword.
  // Prefer chunks with more fiber keywords (a real composition string has
  // more fiber mentions than marketing copy like "100% Merino wool can…").
  INLINE_TEXT_RE.lastIndex = 0;
  const candidates: Array<{ text: string; score: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = INLINE_TEXT_RE.exec(html)) !== null) {
    const raw = match[1];
    if (!raw.includes("%")) continue;
    if (!FIBER_KEYWORDS.test(raw)) continue;
    const text = stripHtml(raw);
    // Count fiber keyword hits — real compositions have multiple
    const fiberHits = (text.match(new RegExp(FIBER_KEYWORDS, "gi")) || []).length;
    // Count percentage signs — real compositions usually have 1-5
    const pctHits = (text.match(/\d{1,3}\s*%/g) || []).length;
    candidates.push({ text, score: fiberHits * 2 + pctHits });
  }

  // Sort by score descending — try highest-signal chunks first
  candidates.sort((a, b) => b.score - a.score);

  for (const c of candidates) {
    const ex = extractMaterialsFromText(c.text);
    if (ex && Object.keys(ex.materials).length > 0) return { text: c.text, extraction: ex };
  }

  // Strategy 3: decimal-aware parser for texts like "53.5% Merino Wool, …"
  for (const c of candidates) {
    const mats = parseDecimalComposition(c.text);
    if (mats) {
      return {
        text: c.text,
        extraction: {
          materials: mats,
          confidence: 0.9,
          hasBanned: Object.keys(mats).some((m) => /Nylon|Polyester|Acrylic|Polyamide|Polypropylene/i.test(m)),
          method: "regex",
        },
      };
    }
  }

  return null;
}

async function main() {
  loadEnv();
  const dryRun = process.argv.includes("--dry-run");
  const supabase = getSupabaseAdmin();

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name")
    .eq("slug", BRAND_SLUG)
    .single();
  if (!brand) throw new Error(`brand ${BRAND_SLUG} not found`);

  const { data: products } = await supabase
    .from("products")
    .select("id, name, affiliate_url, price, image_url, sync_status")
    .eq("brand_id", brand.id);
  if (!products) return;

  console.log(`Fixing ${products.length} products for ${brand.name}${dryRun ? " (dry-run)" : ""}`);
  console.log("═".repeat(60));

  const materialCache = new Map<string, string>();
  const dead: string[] = [];
  const noFabric: Array<{ id: string; name: string }> = [];
  const approved: Outcome[] = [];
  const rejected: Outcome[] = [];
  const review: Outcome[] = [];

  for (const p of products) {
    try {
      const resp = await fetch(p.affiliate_url!);
      if (resp.status === 404) {
        dead.push(p.name);
        if (!dryRun) {
          await supabase.from("product_materials").delete().eq("product_id", p.id);
          await supabase.from("products").delete().eq("id", p.id);
        }
        console.log(`  DEAD  ${p.name} (404, removed)`);
        continue;
      }
      if (!resp.ok) {
        console.log(`  ERR   ${p.name} (HTTP ${resp.status})`);
        continue;
      }
      const html = await resp.text();
      const found = extractFabric(html);
      if (!found) {
        // Quality bar: can't verify → wipe hallucinated materials and
        // force to review so nothing wrong ever ships.
        noFabric.push({ id: p.id, name: p.name });
        console.log(`  SKIP  ${p.name} (no composition text found — wiping materials, forcing review)`);
        if (!dryRun) {
          await supabase.from("product_materials").delete().eq("product_id", p.id);
          await supabase
            .from("products")
            .update({ sync_status: "review", material_confidence: 0 })
            .eq("id", p.id);
        }
        continue;
      }

      const { text: fabricText, extraction } = found;
      if (!extraction) {
        noFabric.push({ id: p.id, name: p.name });
        console.log(`  SKIP  ${p.name} (couldn't parse: "${fabricText}")`);
        continue;
      }

      // Bump confidence — scraped from a structured element
      extraction.confidence = 0.95;

      const banned = isExtractionBanned(extraction);
      const status = banned
        ? "rejected"
        : (determineSyncStatus(extraction, p.price, p.image_url) as "approved" | "review");

      const matsStr = Object.entries(extraction.materials)
        .map(([n, pct]) => `${pct}% ${n}`)
        .join(", ");

      const outcome: Outcome = {
        name: p.name,
        status: status as "approved" | "rejected" | "review",
        materials: extraction.materials,
        source: fabricText,
      };

      if (banned) rejected.push(outcome);
      else if (status === "approved") approved.push(outcome);
      else review.push(outcome);

      const tag = banned ? "REJECT" : status === "approved" ? "OK    " : "REVIEW";
      console.log(`  ${tag}  ${p.name}  →  ${matsStr}`);

      if (!dryRun) {
        await syncProductMaterials(supabase, p.id, extraction.materials, materialCache);
        await supabase
          .from("products")
          .update({ sync_status: status, material_confidence: extraction.confidence })
          .eq("id", p.id);
      }
    } catch (e) {
      console.log(`  ERR   ${p.name}: ${(e as Error).message}`);
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log(`Summary for ${brand.name}:`);
  console.log(`  approved: ${approved.length}`);
  console.log(`  rejected (banned nylon/etc): ${rejected.length}`);
  console.log(`  review:   ${review.length}`);
  console.log(`  no fabric div (left alone): ${noFabric.length}`);
  console.log(`  dead / removed: ${dead.length}`);

  if (rejected.length > 0) {
    console.log("\nRejected (banned material):");
    rejected.forEach((r) => {
      const mats = Object.entries(r.materials).map(([n, p]) => `${p}% ${n}`).join(", ");
      console.log(`  • ${r.name}  →  ${mats}`);
    });
  }
  if (noFabric.length > 0) {
    console.log(`\nNo fabric div — ${noFabric.length} products still need manual review:`);
    noFabric.forEach((p) => console.log(`  • ${p.name}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
