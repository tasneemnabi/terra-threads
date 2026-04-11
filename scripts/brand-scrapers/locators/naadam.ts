/**
 * Naadam locator.
 *
 * Naadam's Shopify body_html is prose-only — review products say things
 * like "a blend of merino wool and silk" with no percentages. The real
 * composition lives on the rendered product page inside an anchor that
 * scrolls to the Material section:
 *
 *   <a href="#section-material" @click="handleAnchor($event)">
 *     [optional <img ...accentuate.io... />]
 *     75% Merino Wool, 25% Silk
 *   </a>
 *
 * The inner text sometimes includes an Accentuate.io metafield icon,
 * sometimes is plain text, and occasionally carries a multi-section
 * composition with body + lining split by a semicolon or "Lining:" label.
 * We keep only the body portion for curation — the lining is a secondary
 * component that would double-count materials against the extraction.
 */

import type { Locator } from "./types.js";
import {
  extractMaterialsFromText,
  stripHtml,
} from "../shared/parsers.js";
import { scanForFiberChunk } from "../shared/locate.js";

const SECTION_MATERIAL_RE =
  /<a\b[^>]*#section-material[^>]*>([\s\S]{0,600}?)<\/a>/gi;

// Naadam's source has a consistent "Alapca" typo for "Alpaca"
const SOURCE_TYPOS: Array<[RegExp, string]> = [[/alapca/gi, "Alpaca"]];

function fixTypos(text: string): string {
  let out = text;
  for (const [re, replacement] of SOURCE_TYPOS) out = out.replace(re, replacement);
  return out;
}

// Keep only the primary body segment — drop everything after ";" (section
// separator) or a "Lining:/Shell:/Trim:" style label. The extractor's
// alias table doesn't know Naia/EcoVero, so compound compositions would
// leak non-trusted names downstream.
function primaryBody(text: string): string {
  const semi = text.indexOf(";");
  if (semi >= 0) text = text.slice(0, semi);
  const lining = text.search(/\b(?:lining|shell|trim|contrast|lace|mesh)\s*:/i);
  if (lining >= 0) text = text.slice(0, lining);
  return text.trim();
}

export const naadam: Locator = async (input) => {
  let html: string;
  try {
    html = await input.fetchHtml();
  } catch {
    return null;
  }

  const re = new RegExp(SECTION_MATERIAL_RE.source, SECTION_MATERIAL_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const inner = fixTypos(primaryBody(stripHtml(m[1])));
    if (!/\d{1,3}\s*%/.test(inner)) continue;
    const ex = extractMaterialsFromText(inner);
    if (ex && Object.keys(ex.materials).length > 0) {
      return {
        materials: ex.materials,
        confidence: 0.95,
        source: "fabric_div",
      };
    }
  }

  // Fallback: generic scanner on the rendered HTML
  return scanForFiberChunk(html, "fallback_scan");
};
