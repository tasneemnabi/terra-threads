/**
 * Gil Rodriguez locator.
 *
 * Gil Rodriguez product descriptions write composition as prose with a
 * leading "Composition is" marker, e.g.:
 *
 *   "Composition is 50% recycled cashmere and 50% mulesing-free wool."
 *
 * The default extractor parses "50% recycled cashmere" fine (alias hits
 * Cashmere) but chokes on "50% mulesing-free wool" — the hyphen breaks
 * the multi-word capture and "mulesing free wool" normalizes to a
 * rejected unknown multi-word name. We pull out just the "Composition is
 * …" sentence, strip the "mulesing-free" marketing modifier, and feed
 * the cleaned text through the normal extractor.
 */

import type { Locator } from "./types.js";
import { extractMaterialsFromText } from "../shared/parsers.js";
import { scanForFiberChunk } from "../shared/locate.js";

const COMPOSITION_RE = /Composition\s+is\s+([^.<]{5,300})/i;

function clean(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/\bmulesing[\s-]?free\s+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const gilRodriguez: Locator = async (input) => {
  let html: string;
  try {
    html = await input.fetchHtml();
  } catch {
    return null;
  }

  const m = html.match(COMPOSITION_RE);
  if (m) {
    const text = clean(m[1]);
    const ex = extractMaterialsFromText(text);
    if (ex && Object.keys(ex.materials).length > 0) {
      return {
        materials: ex.materials,
        confidence: 0.95,
        source: "fabric_div",
      };
    }
  }

  return scanForFiberChunk(html, "fallback_scan");
};
