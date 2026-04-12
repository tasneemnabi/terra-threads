/**
 * Pyne & Smith locator.
 *
 * Pyne & Smith is a linen-only brand — every product is 100% European flax
 * linen. Composition lives inline in the Shopify `body_html`, rendered on
 * the page inside a Bootstrap tab-pane keyed by `id="details"`:
 *
 *   <div class="tab-pane ... " id="details">
 *     <p>Dress Features: ...
 *        Fabric: 100% pre-shrunk Linen.
 *        Made from OEKO-TEX Standard 100 certified, sustainably grown
 *        European flax linen in Lithuania ...</p>
 *   </div>
 *
 * The default extractor fails because the `Fabric:` sentence says
 * "100% pre-shrunk Linen" — the hyphenated "pre-shrunk" terminates the
 * material-name regex after "pre", yielding `{ Pre: 100 }`. That sums to
 * 100 and short-circuits the extractor, so the genuine "Linen" tokens
 * later in the paragraph never get a chance to match, and the product
 * lands in review because "Pre" isn't a trusted canonical material.
 *
 * Fix: isolate the `#details` tab-pane, strip the "pre-shrunk" /
 * "laundered" / "pre-washed" prefix noise so "100% pre-shrunk Linen"
 * normalizes to "100% Linen", then run the shared extractor. Linen is a
 * trusted canonical, so the sync gate promotes it to approved.
 */

import type { Locator } from "./types.js";
import {
  extractMaterialsFromText,
  stripHtml,
} from "../shared/parsers.js";
import { scanForFiberChunk } from "../shared/locate.js";

// Anchored on the DETAILS tab-pane that Pyne & Smith uses in both the
// rendered page HTML and the Shopify body_html (they inline the same
// markup). We grep a bounded window (2KB) after the `id="details"`
// attribute so trailing tab-panes (SIZE & FIT, WHERE I'M MADE) don't
// poison the extraction.
const DETAILS_PANE_RE =
  /id=["']details["'][^>]*>([\s\S]{0,2000}?)<\/div>/i;

// Fallback: grab the "Fabric: ..." sentence directly if the pane markup
// ever changes. Bounded to the end of the sentence so we don't drag in
// care instructions.
const FABRIC_SENTENCE_RE = /Fabric\s*:\s*([^<.]{3,200})/i;

// Fabric-construction adjectives that sit between the percentage and
// the fiber noun on Pyne & Smith pages. Dropping them collapses
// "100% pre-shrunk Linen" to "100% Linen" so the shared extractor's
// PCT_THEN_NAME regex can see the real material name.
const LINEN_PREFIX_NOISE =
  /\b(?:pre[-\s]?shrunk|pre[-\s]?washed|laundered|stonewashed|stone[-\s]?washed|washed|european|flax)\s+/gi;

function normalizeLinenPhrase(text: string): string {
  return text.replace(LINEN_PREFIX_NOISE, "").replace(/\s+/g, " ").trim();
}

export const pyneAndSmith: Locator = async (input) => {
  let html: string;
  try {
    html = await input.fetchHtml();
  } catch {
    return null;
  }

  // Strategy 1: isolate the DETAILS tab-pane and extract the "Fabric:" line
  const paneMatch = html.match(DETAILS_PANE_RE);
  if (paneMatch) {
    const paneText = stripHtml(paneMatch[1]);
    const sentenceMatch = paneText.match(FABRIC_SENTENCE_RE);
    if (sentenceMatch) {
      const cleaned = normalizeLinenPhrase(sentenceMatch[1]);
      const ex = extractMaterialsFromText(cleaned);
      if (ex && Object.keys(ex.materials).length > 0) {
        return {
          materials: ex.materials,
          confidence: 0.95,
          source: "fabric_div",
        };
      }
    }

    // Pane was found but the "Fabric:" sentence wasn't extractable —
    // try the whole pane text with prefix noise stripped.
    const cleanedPane = normalizeLinenPhrase(paneText);
    const exPane = extractMaterialsFromText(cleanedPane);
    if (exPane && Object.keys(exPane.materials).length > 0) {
      return {
        materials: exPane.materials,
        confidence: 0.9,
        source: "fabric_div",
      };
    }
  }

  // Strategy 2: raw "Fabric:" sentence anywhere in the HTML (covers any
  // future template reshuffle where the #details id is renamed).
  const stripped = stripHtml(html);
  const looseMatch = stripped.match(FABRIC_SENTENCE_RE);
  if (looseMatch) {
    const cleaned = normalizeLinenPhrase(looseMatch[1]);
    const ex = extractMaterialsFromText(cleaned);
    if (ex && Object.keys(ex.materials).length > 0) {
      return {
        materials: ex.materials,
        confidence: 0.9,
        source: "fabric_div",
      };
    }
  }

  // Last-resort fallback: generic fiber-chunk scanner on the rendered HTML
  return scanForFiberChunk(html, "fallback_scan");
};
