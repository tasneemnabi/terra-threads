/**
 * Jungmaven locator.
 *
 * Jungmaven is a hemp-heavy Shopify brand whose body_html is prose-only
 * ("Mid-weight 6 oz hemp baby rib blend") and whose rendered product page
 * puts the real composition into a bulleted fabric-spec strip of
 * `<div class="product_option">` elements, each preceded by an Accentuate.io
 * icon. The composition row is the one following the "Blend" icon:
 *
 *   <div class="product_icon">
 *     <img src="https://cdn.accentuate.io/.../Blend-v<hash>.svg?25x23" .../>
 *   </div>
 *   <div class="product_option">29 Hemp/66 Organic Cotton/5 Spandex - Baby Rib</div>
 *
 * The default extractor whiffs because the blend uses BARE INTEGERS with
 * slash separators and NO `%` signs at all — e.g. "29 Hemp/66 Organic
 * Cotton/5 Spandex - Baby Rib". `extractMaterialsFromText`'s
 * PCT_THEN_NAME regex requires `\d+%`, so the three components never
 * register. Single-fiber items like "100% Hemp - Plain Weave" DO carry a
 * `%` and would be caught by the default, but they typically aren't in
 * the review bucket anyway.
 *
 * Strategy: pinpoint the `product_option` div that sits immediately after
 * a `Blend-v*.svg` Accentuate icon, inject `%` after each bare integer so
 * the shared extractor can parse it, and strip the trailing "- Baby Rib"
 * / "- Jersey" / "- Plain Weave" knit-type suffix which is pure noise.
 *
 * Observed blend patterns (as of 2026-04):
 *   "29 Hemp/66 Organic Cotton/5 Spandex - Baby Rib"      (3-component)
 *   "27 Hemp/61 Organic Cotton/12 Spandex - Jersey"       (3-component)
 *   "45 Hemp/35 Organic Cotton/15 Polyamide/5 Spandex - Jersey"  (4-component)
 *   "100% Hemp - Plain Weave"                             (1-component, has %)
 *   "55 Hemp/45 Organic Cotton - Jersey"                  (2-component, hypothetical)
 */

import type { Locator } from "./types.js";
import {
  extractMaterialsFromText,
  parseDecimalComposition,
  stripHtml,
} from "../shared/parsers.js";
import { scanForFiberChunk } from "../shared/locate.js";

// Pinpoint the product_option div that follows a Blend-v*.svg Accentuate
// icon. The `.svg` path is unique to the fabric-blend row — other
// product_option divs follow Fit/Weight/Dye icons that don't concern us.
// Allow up to ~400 chars of whitespace/tags between the icon <img> and
// the `product_option` div so Shopify's Liquid blank lines don't break us.
const BLEND_OPTION_RE =
  /Blend-v[^"']*\.svg[\s\S]{0,400}?<div[^>]*class="product_option"[^>]*>([\s\S]{0,300}?)<\/div>/i;

// Strip trailing knit-type qualifiers that aren't part of the composition.
// e.g. " - Baby Rib", " - Jersey", " - Plain Weave", " - Pique".
function stripKnitSuffix(text: string): string {
  return text.replace(/\s*-\s*[A-Za-z][A-Za-z\s]*$/, "").trim();
}

// Convert Jungmaven's bare-integer blend strings into a `%`-delimited
// form the shared extractor understands. Examples:
//   "29 Hemp/66 Organic Cotton/5 Spandex" →
//   "29% Hemp, 66% Organic Cotton, 5% Spandex"
// Leaves already-percentaged text ("100% Hemp") unchanged modulo the
// slash→comma swap.
function normalizeBlendString(text: string): string {
  // Slash separators → comma separators so each component is a clean
  // comma-delimited "<pct>% <name>" pair.
  let out = text.replace(/\s*\/\s*/g, ", ");
  // Inject `%` after any leading bare integer in each component that
  // isn't already followed by a `%` sign.
  out = out.replace(/(^|,\s*)(\d{1,3})(?!\s*%)(\s+)/g, "$1$2%$3");
  return out;
}

export const jungmaven: Locator = async (input) => {
  let html: string;
  try {
    html = await input.fetchHtml();
  } catch {
    return null;
  }

  const m = html.match(BLEND_OPTION_RE);
  if (m) {
    const raw = stripKnitSuffix(stripHtml(m[1]));
    if (raw) {
      const normalized = normalizeBlendString(raw);

      // Primary path: integer extractor — handles the standard
      // "29% Hemp, 66% Organic Cotton, 5% Spandex" shape.
      const ex = extractMaterialsFromText(normalized);
      if (ex && Object.keys(ex.materials).length > 0) {
        return {
          materials: ex.materials,
          confidence: 0.95,
          source: "fabric_div",
        };
      }

      // Secondary path: decimal-aware parser, in case Jungmaven ever
      // publishes a row that sums to 99/101 from rounding. Rebalances
      // to exactly 100 internally.
      const dec = parseDecimalComposition(normalized);
      if (dec) {
        return {
          materials: dec,
          confidence: 0.9,
          source: "fabric_div",
        };
      }
    }
  }

  // Fallback: generic scanner on the rendered HTML. Unlikely to help
  // for Jungmaven (the blend string has no `%` signs for the scanner to
  // latch onto) but kept so the locator always returns something rather
  // than null when the pinpoint regex whiffs on a new layout.
  return scanForFiberChunk(html, "fallback_scan");
};
