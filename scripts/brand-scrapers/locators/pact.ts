/**
 * Pact locator.
 *
 * Pact product pages don't render fiber composition in HTML — the
 * composition is fetched client-side from a JSON API and lazy-rendered
 * into an accordion (note `pact.product.fabricRendered: false` on initial
 * page load). We skip the HTML path entirely and query the API directly:
 *
 *   https://api2.wearpact.io/product/search?sku=<base-sku>&country=US
 *
 * The base SKU is the product URL slug with the trailing color segment
 * dropped, e.g. `.../wa1-w63-blk` → `WA1-W63`. The API returns one record
 * per variant, each with a `fabricContent` string (e.g. "90% Organic
 * Cotton/10% Elastane") and a pre-split `fiberContentDetailList` array.
 */

import type { Locator } from "./types.js";
import { extractMaterialsFromText } from "../shared/parsers.js";
import { scanForFiberChunk } from "../shared/locate.js";

const API_BASE = "https://api2.wearpact.io/product/search";

interface PactRecord {
  externalId?: string;
  fabricContent?: string | null;
  fiberContentDetailList?: string[] | null;
}

interface PactResponse {
  records?: PactRecord[];
}

function extractSkuFromUrl(
  url: string
): { querySku: string; colorSku: string } | null {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/").filter(Boolean);
    const last = segs[segs.length - 1];
    if (!last) return null;
    const decoded = decodeURIComponent(last).toLowerCase();
    // "wa1-w63-blk" → query sku = "wa1-w63" (no color), color sku = "wa1-w63-blk"
    const parts = decoded.split("-");
    if (parts.length < 2) return null;
    return {
      querySku: parts.slice(0, -1).join("-").toUpperCase(),
      colorSku: decoded.toUpperCase(),
    };
  } catch {
    return null;
  }
}

export const pact: Locator = async (input) => {
  const sku = extractSkuFromUrl(input.productUrl);
  if (sku) {
    try {
      const res = await fetch(
        `${API_BASE}?sku=${encodeURIComponent(sku.querySku)}&country=US`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; FiberBot/1.0; +https://getfiber.co)",
          },
        }
      );
      if (res.ok) {
        const data = (await res.json()) as PactResponse;
        const records = data.records || [];
        // Prefer a record matching the exact color variant from the URL
        const match =
          records.find((r) =>
            (r.externalId || "").toUpperCase().startsWith(sku.colorSku)
          ) || records[0];

        const raw =
          (match?.fiberContentDetailList || []).join(", ") ||
          match?.fabricContent ||
          "";
        if (raw) {
          const ex = extractMaterialsFromText(raw);
          if (ex && Object.keys(ex.materials).length > 0) {
            return {
              materials: ex.materials,
              confidence: 0.98,
              source: "fabric_div",
            };
          }
        }
      }
    } catch {
      // Fall through to generic scanner
    }
  }

  // Last-resort fallback: scan the rendered HTML (rarely useful for Pact
  // since the composition isn't in the DOM, but kept so the locator always
  // returns something if the API path breaks).
  return scanForFiberChunk(await input.fetchHtml(), "fallback_scan");
};
