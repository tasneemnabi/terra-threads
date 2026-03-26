/**
 * Shopify product fetcher.
 * Fetches all products from a Shopify store's public /products.json endpoint.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  src: string;
  width: number;
  height: number;
  alt: string | null;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  compare_at_price: string | null;
  sku: string;
  available: boolean;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  created_at: string;
  updated_at: string;
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

// ─── Fetcher ────────────────────────────────────────────────────────

const RATE_LIMIT_MS = 1000;
const MAX_RETRIES = 3;
const PAGE_SIZE = 250;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`  Rate limited, waiting ${delay}ms (attempt ${attempt}/${retries})`);
        await sleep(delay);
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`  Fetch failed, retrying in ${delay}ms (attempt ${attempt}/${retries}):`, (err as Error).message);
      await sleep(delay);
    }
  }
  throw new Error("Unreachable");
}

/**
 * Fetch all products from a Shopify store.
 * Uses page-based pagination (Shopify's public /products.json supports ?page=N).
 */
export async function fetchAllProducts(domain: string): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = [];
  let page = 1;

  while (true) {
    const url = `https://${domain}/products.json?limit=${PAGE_SIZE}&page=${page}`;
    console.log(`  Fetching page ${page}: ${url}`);

    const res = await fetchWithRetry(url);
    const data: ShopifyProductsResponse = await res.json();

    if (!data.products || data.products.length === 0) break;

    allProducts.push(...data.products);
    console.log(`  Got ${data.products.length} products (total: ${allProducts.length})`);

    // If we got fewer than PAGE_SIZE, we've reached the last page
    if (data.products.length < PAGE_SIZE) break;

    page++;
    await sleep(RATE_LIMIT_MS);
  }

  return allProducts;
}
