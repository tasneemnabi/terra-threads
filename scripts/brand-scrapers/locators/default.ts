/**
 * Default locator — used when a brand has no brand-specific entry in the
 * locator registry. Tries the cheap Shopify body_html first, then fetches
 * the product page and scans it.
 */

import type { Locator } from "./types.js";
import { extractMaterialsFromText } from "../shared/parsers.js";
import { scanForFiberChunk } from "../shared/locate.js";

export const defaultLocator: Locator = async (input) => {
  // Strategy 1: Shopify body_html (cheap, no fetch)
  if (input.shopifyProduct?.body_html) {
    const ex = extractMaterialsFromText(input.shopifyProduct.body_html);
    if (ex && Object.keys(ex.materials).length > 0) {
      return { materials: ex.materials, confidence: 0.95, source: "body_html" };
    }
  }

  // Strategy 2: fetch product page and scan
  try {
    const html = await input.fetchHtml();
    const ex = extractMaterialsFromText(html);
    if (ex && Object.keys(ex.materials).length > 0) {
      return { materials: ex.materials, confidence: 0.9, source: "product_page" };
    }
    return scanForFiberChunk(html, "fallback_scan");
  } catch {
    return null;
  }
};
