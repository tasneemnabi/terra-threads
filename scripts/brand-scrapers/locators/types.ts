import type { ShopifyProduct } from "../../lib/shopify-fetcher.js";

export interface LocatorInput {
  brandSlug: string;
  shopifyProduct?: ShopifyProduct;
  productUrl: string;
  fetchHtml: () => Promise<string>;
}

export interface LocatedComposition {
  materials: Record<string, number>; // integer % summing to exactly 100
  confidence: number; // 0..1
  source: "body_html" | "product_page" | "fabric_div" | "fallback_scan";
}

export type Locator = (input: LocatorInput) => Promise<LocatedComposition | null>;
