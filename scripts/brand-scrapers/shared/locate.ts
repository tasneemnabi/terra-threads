/**
 * Generic fiber-chunk scanner.
 *
 * Ported from Strategy 2/3 of scripts/fix-unbound-materials.ts::extractFabric:
 *   1. Find inline element text containing % + a fiber keyword
 *   2. Score candidates by fiber-keyword hits * 2 + percentage-sign hits
 *   3. Try the integer parser (extractMaterialsFromText) on each candidate
 *   4. Fall through to the decimal parser (parseDecimalComposition)
 */

import type { LocatedComposition } from "../locators/types.js";
import {
  extractMaterialsFromText,
  parseDecimalComposition,
  stripHtml,
} from "./parsers.js";

// Matches any inline text chunk between tags. Used as a fallback when a
// canonical fabric element isn't present. Matches generic >...< so it catches
// text inside <strong>, <b>, <span>, etc.
const INLINE_TEXT_RE = />([^<]{5,500})</g;

const FIBER_KEYWORDS =
  /merino|wool|nylon|spandex|elastane|lycra|cotton|lyocell|tencel|linen|silk|cashmere|hemp|rayon|modal|viscose|polyester|acrylic|polyamide|cupro/i;

export function scanForFiberChunk(
  html: string,
  source: "product_page" | "fallback_scan"
): LocatedComposition | null {
  // Collect candidate inline chunks with a score
  const re = new RegExp(INLINE_TEXT_RE.source, "g");
  const candidates: Array<{ text: string; score: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
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

  // Strategy 2: integer parser (most accurate when it hits)
  for (const c of candidates) {
    const ex = extractMaterialsFromText(c.text);
    if (ex && Object.keys(ex.materials).length > 0) {
      return { materials: ex.materials, confidence: 0.95, source };
    }
  }

  // Strategy 3: decimal-aware parser for "53.5% Merino Wool, …"
  for (const c of candidates) {
    const mats = parseDecimalComposition(c.text);
    if (mats) {
      return { materials: mats, confidence: 0.9, source };
    }
  }

  return null;
}
