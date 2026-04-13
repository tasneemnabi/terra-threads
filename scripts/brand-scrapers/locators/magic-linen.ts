/**
 * Magic Linen locator.
 *
 * Magic Linen is a linen-only Shopify brand. Product body_html is prose
 * only ("Elegant halter linen dress…") with zero composition data, and
 * the default locator's Strategy 2 (raw product-page scan) occasionally
 * whiffs on this shop — the extractor bumps into `{Color: …}` or
 * `{A: …}` false positives near a percentage sign before reaching the
 * real composition block, or the anonymous CDN fetch returns a reduced
 * template without the accordion section on intermittent runs.
 *
 * The real composition on every product page lives inside a "Composition"
 * accordion (`<details>` row) with this exact shape:
 *
 *   <p>…
 *      • Midweight linen (approx. 190 gsm)<br />
 *      • Made from 100% European flax<br />
 *      • OEKO-TEX certified (2019OK0776)
 *    </p>
 *
 * The `Made from <n>% European flax` (or `Made from <n>% Linen`) sentence
 * is a uniform signature across all 995+ Magic Linen products we've seen,
 * including the rare hemp/linen blends they occasionally release (which
 * still use the same "Made from <n>% …" prefix).
 *
 * Strategy: regex that sentence directly out of the raw HTML, feed to the
 * shared extractor — "European flax" is already aliased to "Linen" in
 * lib/material-extractor. If the pinpoint regex misses, fall back to the
 * generic fiber-chunk scanner on the same HTML.
 */

import type { Locator } from "./types.js";
import {
  extractMaterialsFromText,
  stripHtml,
} from "../shared/parsers.js";
import { scanForFiberChunk } from "../shared/locate.js";

// Pinpoint the "Made from <n>%" sentence. We capture up to the end of
// the line (HTML `<br>`, `<` or `\n`) so we never drag in the adjacent
// "OEKO-TEX certified (2019OK0776)" bullet which contains a bare number
// the extractor could misread.
const MADE_FROM_RE =
  /Made from\s+(\d{1,3}\s*%\s*[A-Za-z][A-Za-z\s]{2,40}?)(?=<|\n|\.|$)/i;

// Fetch with a realistic User-Agent. Magic Linen's CDN is lenient but
// anonymous node fetches have returned reduced templates in the wild,
// which is likely why the default locator missed these 5 products in
// the 2026-04-12 re-sync. Keeping our own fetch path isolates the
// locator from future default-locator changes.
const UA =
  "Mozilla/5.0 (compatible; FiberBot/1.0; +https://getfiber.co)";

async function fetchWithUA(url: string): Promise<string> {
  const resp = await fetch(url, { headers: { "User-Agent": UA } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

export const magicLinen: Locator = async (input) => {
  let html: string;
  try {
    // Prefer our own UA-stamped fetch for reliability; fall back to the
    // harness-provided fetcher if the direct call errors (DNS, timeout).
    html = await fetchWithUA(input.productUrl);
  } catch {
    try {
      html = await input.fetchHtml();
    } catch {
      return null;
    }
  }

  // Strategy 1: pinpoint the "Made from <n>% …" composition sentence
  const m = html.match(MADE_FROM_RE);
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

  // Strategy 2: generic fiber-chunk scanner fallback on the rendered HTML
  return scanForFiberChunk(html, "fallback_scan");
};
