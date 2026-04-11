/**
 * Shared parsers for brand-scraper locators.
 *
 * Ported verbatim from scripts/fix-unbound-materials.ts:
 *   - stripHtml
 *   - ALIAS table + parseDecimalComposition (decimal % rebalanced to int 100)
 *
 * Also re-exports extractMaterialsFromText from the shared material extractor
 * so locators have a single import surface for parsing.
 */

export { extractMaterialsFromText } from "../../lib/material-extractor.js";

export function stripHtml(s: string): string {
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
export function parseDecimalComposition(text: string): Record<string, number> | null {
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
