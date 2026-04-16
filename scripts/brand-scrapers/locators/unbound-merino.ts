/**
 * Unbound Merino locator.
 *
 * Unbound renders the fabric composition inside a <div class="product-fabric">
 * element on every product page. We try the integer parser first, then fall
 * back to the decimal parser, then the generic fiber-chunk scanner.
 */

import type { Locator } from "./types.js";
import {
  extractMaterialsFromText,
  parseDecimalComposition,
  stripHtml,
} from "../shared/parsers.js";
import { scanForFiberChunk } from "../shared/locate.js";

const FABRIC_DIV_RE = /<div class="product-fabric">([\s\S]*?)<\/div>/;

export const unboundMerino: Locator = async (input) => {
  const html = await input.fetchHtml();

  // Strategy 1: canonical fabric div
  const m = html.match(FABRIC_DIV_RE);
  if (m) {
    const text = stripHtml(m[1]);
    // Try integer parser first
    const ex = extractMaterialsFromText(text);
    if (ex && Object.keys(ex.materials).length > 0) {
      return { materials: ex.materials, confidence: 0.95, source: "fabric_div" };
    }
    // Fall back to decimal parser
    const dec = parseDecimalComposition(text);
    if (dec) {
      return { materials: dec, confidence: 0.9, source: "fabric_div" };
    }
  }

  // Strategy 2/3: fall back to generic scanner
  return scanForFiberChunk(html, "fallback_scan");
};
