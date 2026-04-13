/**
 * Kowtow locator.
 *
 * Kowtow product body_html is pure marketing prose with no fiber data at
 * all — the default locator's regex/dictionary/fallback passes have nothing
 * numeric to latch onto. The Kowtow resync (2026-04-13) landed 21 products
 * in review for exactly this reason.
 *
 * The composition on every product page lives inside the "Fabric" detail
 * drawer with this uniform shape:
 *
 *   <div class="details_and_care__fabric_details-wrapper">
 *     <p class="... details_and_care__title-description-combo-title">Fabric</p>
 *     <div>
 *       <div class="B2-Medium-UC details_and_care__fabric_highlighted-description">
 *         <p>plastic free / 100% Fair Trade Organic Cotton</p>
 *       </div>
 *       <p>Organic, Fairtrade, certified cotton forms the base…</p>
 *     </div>
 *   </div>
 *
 * We pinpoint the `details_and_care__fabric_highlighted-description` div
 * and capture its single <p>. The "plastic free /" prefix and "Fair Trade"
 * alias are both handled by `material-extractor.ts` already (the
 * normalizer fix in commit 94459e3 strips ethical-sourcing prefixes
 * before alias lookup), so we can feed the raw sentence to the extractor.
 *
 * Note: `kowtowclothing.com` 301s to `nz.kowtowclothing.com`. Node's
 * `fetch` follows redirects by default, no special handling required.
 *
 * Leather footwear (Artisanal Pump, V-90 O.T., Campo Chromefree, Volley)
 * also renders this block, but with prose like "Made from sustainable
 * vegetable tanned leather" — no percentage, no trusted material, so the
 * extractor returns null and we fall through. Those items are a
 * non-clothing-classifier concern, not a locator concern.
 */

import type { Locator } from "./types.js";
import {
  extractMaterialsFromText,
  stripHtml,
} from "../shared/parsers.js";
import { scanForFiberChunk } from "../shared/locate.js";

// Anchor on the HTML `class="` attribute (not a CSS `.class` selector) so
// we never match a stylesheet rule earlier in the document. All quantifiers
// are character-class-negated (`[^"]`, `[^>]`, `[^<]`) — bounded, no
// nesting, no catastrophic-backtracking shape.
const FABRIC_DIV_RE =
  /class="[^"]*details_and_care__fabric_highlighted-description[^"]*"[^>]*>\s*<p[^>]*>([^<]+)<\/p>/i;

export const kowtow: Locator = async (input) => {
  let html: string;
  try {
    html = await input.fetchHtml();
  } catch {
    return null;
  }

  // Strategy 1: pinpoint the fabric-highlighted-description block
  const m = html.match(FABRIC_DIV_RE);
  if (m) {
    const text = stripHtml(m[1]);
    const ex = extractMaterialsFromText(text);
    if (ex && Object.keys(ex.materials).length > 0) {
      return {
        materials: ex.materials,
        confidence: 0.95,
        source: "fabric_div",
      };
    }
  }

  // Strategy 2: generic fiber-chunk scanner fallback on the same HTML
  return scanForFiberChunk(html, "fallback_scan");
};
