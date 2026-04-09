/**
 * Discover product URLs from a brand's website.
 *
 * Strategy 1 — Sitemap (preferred, fast, no browser):
 *   Fetch /sitemap.xml, parse <loc> URLs, filter for product paths.
 *   Shopify stores almost always have sitemap_products_1.xml.
 *
 * Strategy 2 — Collection crawl (fallback, uses Playwright):
 *   Navigate to /collections/all, extract product links, handle pagination.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

// ─── Types ──────────────────────────────────────────────────────────

export interface DiscoveryResult {
  urls: string[];
  method: "sitemap" | "crawl" | "hybrid";
}

interface DiscoverOptions {
  maxProducts?: number;
  brandSlug?: string;
}

// ─── Per-brand overrides ────────────────────────────────────────────

/** Product URL patterns that differ from the standard /products/<slug> */
const BRAND_PRODUCT_PATTERNS: Record<string, RegExp[]> = {
  // Maggie's Organics (BigCommerce): product URLs are top-level slugs like /organic-cotton-socks-diabetic/
  "maggies-organics": [/^\/[a-z0-9][a-z0-9\-]*\/?$/],
  // Vivid Linen: products under /missy/product/<id>_<slug> or /plus/product/<id>_<slug>
  "vivid-linen": [/^\/(missy|plus|men)\/product\//],
  // Pact: hierarchical /women/apparel/<subcategory>/<product-name> (spaces URL-encoded)
  pact: [/^\/(women|men)\/apparel\/.+\/.+$/],
};

/** Sitemap URL overrides — non-standard sitemap paths */
const BRAND_SITEMAP_URLS: Record<string, string[]> = {
  "maggies-organics": ["/xmlsitemap.php?type=products&page=1"],
};

/** Brands that skip sitemap — use crawl only (for scoping to specific collections) */
const BRAND_CRAWL_ONLY = new Set<string>();

/**
 * Hostname aliases for brands that redirect to a different domain.
 * Links on the target domain are accepted as same-origin during crawl.
 */
const BRAND_HOSTNAME_ALIASES: Record<string, string[]> = {};

/** URL exclusion patterns for sitemap (non-product pages that slip through) */
const BRAND_SITEMAP_EXCLUDES: Record<string, RegExp[]> = {
  "maggies-organics": [
    /^\/$/, // homepage
    /eco-friendly-shipping/, /return-policy/, /about/, /contact/,
    /gift-certificate/, /faq/, /care-instructions/, /bulk-orders/,
    /sateen-sheet/, /duvet/, /pillow/, // home goods
  ],
  // Rawganique sells home goods, fabrics, accessories — exclude non-clothing
  rawganique: [
    /sheet|pillow|towel|blanket|curtain|napkin|duvet|mattress/,
    /fabric|yardage|bolt/,
    /soap|candle|bag|backpack|wallet|belt|hat|scarf|glove/,
    /mask|apron|pet-|dog-|cat-/,
  ],
};

/** Collection page paths to try when crawling */
const DEFAULT_COLLECTION_PATHS = [
  "/collections/all",
  "/collections",
  "/shop",
  "/products",
  "/shop/all",
];

/** Brand-specific collection paths (crawled in addition to defaults) */
const BRAND_COLLECTION_PATHS: Record<string, string[]> = {
  kotn: ["/collections/womens", "/collections/mens"],
  "maggies-organics": ["/collections/socks", "/collections/apparel", "/collections/leggings"],
  "vivid-linen": [
    "/missy/tops-blouses", "/missy/tunics", "/missy/jackets", "/missy/pants",
    "/missy/shirts", "/missy/cardigans-sweaters", "/missy/dresses-skirts", "/missy/tanks-camis",
    "/plus/tops-blouses", "/plus/tunics", "/plus/jackets", "/plus/pants",
    "/plus/shirts", "/plus/cardigans-sweaters", "/plus/dresses-skirts", "/plus/tanks-camis",
  ],
  // Pact: women's clothing categories
  pact: ["/women/apparel"],
  // Fair Indigo: all women's organic clothing
  "fair-indigo": ["/collections/shop-all-fair-indigo"],
  // Rawganique: women's clothing (hemp/organic cotton/linen)
  rawganique: ["/collections/women"],
  // Gil Rodriguez: all products (small catalog, cotton basics)
  "gil-rodriguez": ["/collections/all"],
};

// ─── Sitemap discovery ──────────────────────────────────────────────

const SITEMAP_URLS = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sitemap_products_1.xml",
];

/** Standard product URL pattern — matches /products/<slug> */
const PRODUCT_URL_RE = /\/products\/[a-z0-9][a-z0-9\-]*/i;

function isProductUrl(urlOrPath: string, brandSlug?: string): boolean {
  // Extract pathname if full URL
  let pathname: string;
  try {
    pathname = new URL(urlOrPath).pathname;
  } catch {
    pathname = urlOrPath;
  }

  // Check brand-specific patterns first
  if (brandSlug && BRAND_PRODUCT_PATTERNS[brandSlug]) {
    return BRAND_PRODUCT_PATTERNS[brandSlug].some((re) => re.test(pathname));
  }
  return PRODUCT_URL_RE.test(pathname);
}

function isSitemapExcluded(url: string, brandSlug?: string): boolean {
  if (!brandSlug || !BRAND_SITEMAP_EXCLUDES[brandSlug]) return false;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }
  return BRAND_SITEMAP_EXCLUDES[brandSlug].some((re) => re.test(pathname));
}

async function fetchText(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FiberBot/1.0; +https://fiber.eco)",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractLocsFromXml(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1]);
  }
  return locs;
}

async function discoverFromSitemap(
  baseUrl: string,
  brandSlug?: string,
  maxProducts = 1000
): Promise<string[] | null> {
  const origin = new URL(baseUrl).origin;

  // Build sitemap URL list: brand-specific first, then defaults
  const sitemapPaths = [
    ...(brandSlug && BRAND_SITEMAP_URLS[brandSlug]
      ? BRAND_SITEMAP_URLS[brandSlug]
      : []),
    ...SITEMAP_URLS,
  ];

  for (const path of sitemapPaths) {
    const sitemapUrl = path.startsWith("http") ? path : `${origin}${path}`;
    const xml = await fetchText(sitemapUrl);
    if (!xml || xml.includes("<!DOCTYPE html")) continue;

    const locs = extractLocsFromXml(xml);

    // Check if this is a sitemap index (contains other sitemaps)
    const childSitemaps = locs.filter(
      (u) => u.endsWith(".xml") || u.includes("sitemap")
    );

    if (childSitemaps.length > 0) {
      // Find product sitemap(s)
      const productSitemaps = childSitemaps.filter(
        (u) => /product/i.test(u)
      );
      const toFetch =
        productSitemaps.length > 0 ? productSitemaps : childSitemaps;

      const allProductUrls: string[] = [];
      for (const childUrl of toFetch) {
        const childXml = await fetchText(childUrl);
        if (!childXml) continue;
        const childLocs = extractLocsFromXml(childXml);
        const productUrls = childLocs.filter(
          (u) => isProductUrl(u, brandSlug) && !isSitemapExcluded(u, brandSlug)
        );
        allProductUrls.push(...productUrls);
        if (allProductUrls.length >= maxProducts) break;
      }

      if (allProductUrls.length > 0) {
        return [...new Set(allProductUrls)].slice(0, maxProducts);
      }
    }

    // Direct sitemap with product URLs
    const productUrls = locs.filter(
      (u) => isProductUrl(u, brandSlug) && !isSitemapExcluded(u, brandSlug)
    );
    if (productUrls.length > 0) {
      return [...new Set(productUrls)].slice(0, maxProducts);
    }
  }

  return null;
}

// ─── Collection crawl discovery ─────────────────────────────────────

async function discoverFromCrawl(
  baseUrl: string,
  brandSlug?: string,
  maxProducts = 500
): Promise<string[] | null> {
  const origin = new URL(baseUrl).origin;
  let browser: Browser | null = null;

  // Build path list: brand-specific paths, plus defaults (unless crawl-only)
  const brandPaths = brandSlug && BRAND_COLLECTION_PATHS[brandSlug]
    ? BRAND_COLLECTION_PATHS[brandSlug]
    : [];
  const isCrawlOnly = brandSlug && BRAND_CRAWL_ONLY.has(brandSlug);
  const paths = isCrawlOnly
    ? brandPaths  // Crawl-only brands: ONLY visit their specific collection paths
    : [...brandPaths, ...DEFAULT_COLLECTION_PATHS];
  // Deduplicate
  const uniquePaths = [...new Set(paths)];

  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });

    const allUrls = new Set<string>();
    const triedPaths = new Set<string>();

    for (const collPath of uniquePaths) {
      if (allUrls.size >= maxProducts) break;
      if (triedPaths.has(collPath)) continue;
      triedPaths.add(collPath);

      const page = await ctx.newPage();
      // Block fonts/media but keep images (some sites need them for layout)
      await page.route("**/*", (route) => {
        const type = route.request().resourceType();
        if (["font", "media"].includes(type)) return route.abort();
        return route.continue();
      });

      try {
        // Use domcontentloaded — networkidle often times out on SPA/analytics-heavy sites
        const res = await page.goto(`${origin}${collPath}`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        if (!res || res.status() >= 400) {
          await page.close();
          continue;
        }

        // Wait for product grid to render (SPAs need time after domcontentloaded)
        await page.waitForTimeout(5000);

        // Scroll to load lazy content / infinite scroll (up to 15 scrolls)
        for (let scroll = 0; scroll < 15; scroll++) {
          const prevHeight = await page.evaluate(() => document.body.scrollHeight);
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(1500);
          const newHeight = await page.evaluate(() => document.body.scrollHeight);
          if (newHeight === prevHeight) break;
        }

        // Extract all links (use broad selector — filtering happens via isProductUrl)
        const links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("a[href]"))
            .map((a) => (a as HTMLAnchorElement).href)
            .filter(Boolean);
        });

        const baseHostname = new URL(baseUrl).hostname.replace(/^www\./, "");
        // Accept aliased hostnames (e.g. icebreaker.com → na.icebreaker.com)
        const acceptedHosts = new Set([baseHostname]);
        if (brandSlug && BRAND_HOSTNAME_ALIASES[brandSlug]) {
          for (const alias of BRAND_HOSTNAME_ALIASES[brandSlug]) {
            acceptedHosts.add(alias.replace(/^www\./, ""));
          }
        }

        for (const link of links) {
          try {
            const url = new URL(link, origin);
            const linkHost = url.hostname.replace(/^www\./, "");
            if (acceptedHosts.has(linkHost) && isProductUrl(url.pathname, brandSlug)) {
              // Normalize: strip query params and hash to deduplicate color variants
              allUrls.add(`${url.origin}${url.pathname}`);
            }
          } catch {
            // Invalid URL — skip
          }
        }

        console.log(`    ${collPath}: ${links.length} links → ${allUrls.size} unique products`);
      } catch {
        // Page failed to load — try next collection path
      } finally {
        await page.close();
      }
    }

    await ctx.close();

    if (allUrls.size === 0) return null;
    return [...allUrls].slice(0, maxProducts);
  } finally {
    if (browser) await browser.close();
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export async function discoverProducts(
  websiteUrl: string,
  options: DiscoverOptions = {}
): Promise<DiscoveryResult> {
  const { maxProducts = 500, brandSlug } = options;

  // Some brands skip sitemap to scope discovery to specific collections
  const crawlOnly = brandSlug && BRAND_CRAWL_ONLY.has(brandSlug);

  if (!crawlOnly) {
    // Try sitemap first (fast, no browser)
    console.log(`  Trying sitemap discovery for ${websiteUrl}...`);
    const sitemapUrls = await discoverFromSitemap(websiteUrl, brandSlug, maxProducts);

    if (sitemapUrls && sitemapUrls.length > 0) {
      console.log(`  Sitemap: found ${sitemapUrls.length} product URLs`);
      return { urls: sitemapUrls, method: "sitemap" };
    }
  } else {
    console.log(`  Crawl-only mode for ${brandSlug} (scoped to specific collections)`);
  }

  // Fallback (or crawl-only): crawl collection pages
  console.log(`  ${crawlOnly ? "Crawling" : "Sitemap failed, trying"} collection pages...`);
  const crawlUrls = await discoverFromCrawl(websiteUrl, brandSlug, maxProducts);

  if (crawlUrls && crawlUrls.length > 0) {
    console.log(`  Crawl: found ${crawlUrls.length} product URLs`);
    return { urls: crawlUrls, method: "crawl" };
  }

  console.log(`  No product URLs discovered`);
  return { urls: [], method: "sitemap" };
}
