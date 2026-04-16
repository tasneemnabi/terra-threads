/**
 * Playwright-based page scraper for extracting rendered text from product pages.
 * Handles JS-rendered content, accordions, and tabs that static fetches miss.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

// ─── Helpers ─────────────────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&apos;": "'", "&#39;": "'", "&#x27;": "'", "&nbsp;": " ",
};
const ENTITY_RE = /&(?:amp|lt|gt|quot|apos|nbsp|#39|#x27);/gi;

function decodeHtmlEntities(str: string): string {
  return str.replace(ENTITY_RE, (match) => HTML_ENTITIES[match.toLowerCase()] || match);
}

// ─── Types ──────────────────────────────────────────────────────────

interface ScrapedPage {
  url: string;
  text: string;
  success: boolean;
  error?: string;
}

export interface ScrapedProduct {
  url: string;
  name: string | null;
  price: number | null;
  currency: string | null;
  description: string | null;
  // Ranked candidate list of image URLs (JSON-LD → og:image → DOM), deduped
  // and normalized. The optimizer walks this list and uses the first one that
  // actually downloads successfully, so bad sources fall through automatically.
  imageCandidates: string[];
  // Convenience: imageCandidates[0] / slice(1). These are unverified — prefer
  // imageCandidates for anything that needs a working URL.
  imageUrl: string | null;
  additionalImages: string[];
  isAvailable: boolean;
  text: string;
  html: string;  // raw rendered HTML from page.content() — used by locators
  success: boolean;
  error?: string;
}

// ─── Browser management ─────────────────────────────────────────────

let browser: Browser | null = null;
let context: BrowserContext | null = null;

export async function launchBrowser(): Promise<void> {
  if (browser) return;
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// ─── Page scraping ──────────────────────────────────────────────────

/**
 * Common selectors where material/composition info lives on product pages.
 * Tried in order — click each to expand accordions/tabs before extracting text.
 */
const EXPAND_SELECTORS = [
  // Accordion triggers with material keywords
  'button:has-text("Material")',
  'button:has-text("Fabric")',
  'button:has-text("Composition")',
  'button:has-text("Details")',
  'button:has-text("Specifications")',
  'button:has-text("Description")',
  '[data-toggle]:has-text("Material")',
  '[data-toggle]:has-text("Details")',
  // Shopify-specific patterns
  '.product__accordion button',
  '.accordion__trigger',
  '.collapsible-trigger',
  // Tab triggers
  '[role="tab"]:has-text("Material")',
  '[role="tab"]:has-text("Details")',
  '[role="tab"]:has-text("Fabric")',
];


async function expandAccordions(page: Page): Promise<void> {
  for (const selector of EXPAND_SELECTORS) {
    try {
      const elements = await page.$$(selector);
      for (const el of elements) {
        // Per-click timeout: Playwright's default actionability wait is 30s,
        // which on pages with many matching elements (e.g. site-wide
        // accordions in nav/footer) compounds into multi-minute hangs.
        await el.click({ timeout: 1500 }).catch(() => {});
      }
    } catch {
      // Selector not found — fine, move on
    }
  }
}

/**
 * Wait for the product page to be ready for extraction. Most e-commerce sites
 * emit JSON-LD product data synchronously in the initial HTML, in which case
 * waitForSelector resolves immediately. Sites that hydrate it asynchronously
 * get up to 1.5s; if neither path matches, fall back to a short fixed sleep
 * so JS-only sites still have a chance to render before extraction.
 *
 * Replaces a previous unconditional `waitForTimeout(3000)` that imposed a
 * 3s floor on every product page across both pipelines.
 */
async function waitForProductReady(page: Page): Promise<void> {
  try {
    await page.waitForSelector('script[type="application/ld+json"]', { timeout: 1500 });
    return;
  } catch {
    // No JSON-LD within 1.5s — fall through to brief defensive wait.
  }
  await page.waitForTimeout(500);
}

async function extractProductText(page: Page): Promise<string> {
  // Always get the full main/body text — after accordions are expanded,
  // this captures everything including dynamically revealed content.
  const mainText = await page.$eval("main", (el) => el.innerText).catch(() => "");
  if (mainText.trim()) return mainText.trim();

  return await page.$eval("body", (el) => el.innerText).catch(() => "");
}

export async function scrapePage(url: string, timeoutMs = 30000): Promise<ScrapedPage> {
  if (!context) throw new Error("Browser not launched — call launchBrowser() first");

  let page: Page | null = null;
  try {
    page = await context.newPage();

    // Block images, fonts, and media to speed things up
    // (keep stylesheets — some sites need CSS for JS-rendered content)
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "font", "media"].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await waitForProductReady(page);

    // Try to expand accordions/tabs that might contain material info
    await expandAccordions(page);

    // Extract text
    const text = await extractProductText(page);

    return { url, text, success: true };
  } catch (err) {
    return { url, text: "", success: false, error: (err as Error).message };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ─── JSON-LD structured data extraction ────────────────────────────

interface JsonLdProduct {
  name: string | null;
  price: number | null;
  currency: string | null;
  description: string | null;
  images: string[];
  isAvailable: boolean | null;
}

/**
 * Extract product data from JSON-LD structured data on the page.
 * This is the most reliable extraction method — structured data is
 * machine-readable and used by Google/SEO, so sites keep it accurate.
 */
async function extractJsonLd(page: Page): Promise<JsonLdProduct | null> {
  const jsonLdBlocks: string[] = await page.$$eval(
    'script[type="application/ld+json"]',
    (scripts) => scripts.map((s) => s.textContent || "")
  ).catch(() => []);

  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block);
      const product = findProductInJsonLd(parsed);
      if (product) return product;
    } catch {
      // Malformed JSON — skip
    }
  }
  return null;
}

function findProductInJsonLd(obj: unknown): JsonLdProduct | null {
  if (!obj || typeof obj !== "object") return null;

  // Handle arrays (e.g. @graph)
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findProductInJsonLd(item);
      if (found) return found;
    }
    return null;
  }

  const record = obj as Record<string, unknown>;

  // Check @graph array
  if (Array.isArray(record["@graph"])) {
    for (const item of record["@graph"]) {
      const found = findProductInJsonLd(item);
      if (found) return found;
    }
  }

  // Check if this object is a Product
  const type = record["@type"];
  if (type !== "Product" && type !== "product") return null;

  // Extract price and availability from offers
  let price: number | null = null;
  let currency: string | null = null;
  let isAvailable: boolean | null = null;
  const offers = record.offers;
  if (offers) {
    const offerList = Array.isArray(offers) ? offers : [offers];
    const firstOffer = offerList[0];
    if (firstOffer && typeof firstOffer === "object") {
      const o = firstOffer as Record<string, unknown>;
      const rawPrice = o.price ?? o.lowPrice;
      if (rawPrice !== undefined && rawPrice !== null) {
        price = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice));
        if (isNaN(price)) price = null;
      }
      if (typeof o.priceCurrency === "string") currency = o.priceCurrency;
    }
    // Check availability across all offers — available if ANY offer is in stock
    for (const offer of offerList) {
      if (offer && typeof offer === "object") {
        const avail = (offer as Record<string, unknown>).availability;
        if (typeof avail === "string") {
          const lower = avail.toLowerCase();
          if (lower.includes("instock") || lower.includes("preorder")) {
            isAvailable = true;
            break; // At least one variant in stock — that's enough
          }
          if (lower.includes("outofstock") || lower.includes("soldout")) {
            isAvailable = false;
          }
        }
      }
    }
  }

  // Extract images
  const images: string[] = [];
  const rawImage = record.image;
  if (typeof rawImage === "string") {
    images.push(rawImage);
  } else if (Array.isArray(rawImage)) {
    for (const img of rawImage) {
      if (typeof img === "string") images.push(img);
      else if (img && typeof img === "object" && typeof (img as Record<string, unknown>).url === "string") {
        images.push((img as Record<string, unknown>).url as string);
      }
    }
  } else if (rawImage && typeof rawImage === "object" && typeof (rawImage as Record<string, unknown>).url === "string") {
    images.push((rawImage as Record<string, unknown>).url as string);
  }

  return {
    name: typeof record.name === "string" ? record.name : null,
    price,
    currency,
    description: typeof record.description === "string" ? record.description : null,
    images,
    isAvailable,
  };
}

/**
 * Scrape a product page and extract structured data (name, price, images, etc.)
 * in addition to full rendered text for material extraction.
 */
export async function scrapeProductData(
  url: string,
  timeoutMs = 30000
): Promise<ScrapedProduct> {
  if (!context) throw new Error("Browser not launched — call launchBrowser() first");

  let page: Page | null = null;
  try {
    page = await context.newPage();

    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["font", "media"].includes(type)) return route.abort();
      return route.continue();
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await waitForProductReady(page);
    await expandAccordions(page);

    // Capture raw HTML after accordions have been expanded so
    // dynamically revealed content is available for locator plugins.
    const html = await page.content();

    const jsonLd = await extractJsonLd(page!);

    const metaContent = async (prop: string): Promise<string | null> => {
      return page!.$eval(
        `meta[property="${prop}"], meta[name="${prop}"]`,
        (el) => el.getAttribute("content")
      ).catch(() => null);
    };

    const rawName =
      jsonLd?.name ||
      (await metaContent("og:title")) ||
      (await page!.$eval("h1", (el) => el.textContent?.trim() || null).catch(() => null)) ||
      (await page!.title()) ||
      null;
    const name = rawName ? decodeHtmlEntities(rawName) : null;

    // Price: JSON-LD → meta tags → DOM selectors
    let price: number | null = jsonLd?.price ?? null;
    if (price === null) {
      const priceStr =
        (await metaContent("product:price:amount")) ||
        (await metaContent("og:price:amount")) ||
        (await page!.$eval(
          '[data-product-price], .product-price, .price--regular, .price .amount, .product__price',
          (el) => el.textContent?.replace(/[^0-9.]/g, "") || null
        ).catch(() => null));
      if (priceStr) {
        const parsed = parseFloat(priceStr);
        if (!isNaN(parsed)) price = parsed;
      }
    }
    // Sanity check: clothing shouldn't cost more than $2000
    if (price && price > 2000) price = null;

    const currency =
      jsonLd?.currency ||
      (await metaContent("product:price:currency")) ||
      (await metaContent("og:price:currency")) ||
      null;

    const rawDescription =
      jsonLd?.description ||
      (await metaContent("og:description")) ||
      (await metaContent("description")) ||
      null;
    const description = rawDescription ? decodeHtmlEntities(rawDescription) : null;

    // Images: merge JSON-LD, og:image, and DOM selectors into a ranked
    // candidate list. JSON-LD path-relative strings are dropped because
    // schema.org requires absolute URLs in Product.image; sites that ship
    // relative paths (e.g. "img/product/foo.jpg") are almost always CMS
    // internals that don't resolve against the product page URL.
    const jsonLdImages = (jsonLd?.images || []).filter((u) =>
      /^https?:\/\//i.test(u) || u.startsWith("//") || u.startsWith("/")
    );
    const ogImage = await metaContent("og:image");
    // DOM scan: narrow product-gallery selectors first (high-signal on
    // Shopify-ish themes), then a broad `main img` fallback ranked by
    // natural size so we surface real product shots before icons/logos
    // on sites that don't use standard classnames.
    const narrowDomImages: string[] = await page!.$$eval(
      '.product-gallery img, .product__media img, .product-images img, [data-product-image] img',
      (imgs) => imgs.map((img) => (img as HTMLImageElement).src).filter((s) => s && !s.includes("placeholder"))
    ).catch(() => []);

    const broadDomImages: string[] = await page!.$$eval(
      "main img, article img",
      (imgs) =>
        (imgs as HTMLImageElement[])
          .filter((img) => {
            const src = img.src || "";
            if (!src || src.startsWith("data:")) return false;
            if (/placeholder|sprite|logo|icon|favicon/i.test(src)) return false;
            // Reject tiny images when dimensions are known — skips thumbs/UI chrome
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            if (w && h && (w < 200 || h < 200)) return false;
            return true;
          })
          .sort((a, b) => {
            const areaA = (a.naturalWidth || 0) * (a.naturalHeight || 0);
            const areaB = (b.naturalWidth || 0) * (b.naturalHeight || 0);
            return areaB - areaA;
          })
          .map((img) => img.src)
    ).catch(() => []);

    const domImages = [...narrowDomImages, ...broadDomImages];

    // Ranking: JSON-LD first (usually variant-specific CDN URLs), then DOM
    // scan (reflects the rendered page — the user's actual product image,
    // including selected color variant), then og:image as last resort.
    // og:image is deprioritized because sites commonly ship the default
    // variant there regardless of which color the URL targets.
    const imageCandidates = buildImageCandidates(
      [...jsonLdImages, ...domImages, ...(ogImage ? [ogImage] : [])],
      url
    );

    const text = await extractProductText(page!);

    // Availability: JSON-LD first, then DOM fallback
    let isAvailable: boolean = jsonLd?.isAvailable ?? true; // default to available if unknown
    if (jsonLd?.isAvailable === null) {
      // JSON-LD didn't have availability info — check DOM
      const soldOutText = await page!.$$eval(
        'button, [class*="sold-out"], [class*="soldout"], [class*="out-of-stock"], [data-availability]',
        (els) => els.map((el) => el.textContent?.trim().toLowerCase() || "")
      ).catch(() => []);
      if (soldOutText.some((t) => /sold\s*out|out\s*of\s*stock|unavailable/i.test(t))) {
        isAvailable = false;
      }
    }

    // Log warnings for missing data
    if (!price) console.warn(`  WARN: No price extracted for ${url}`);
    if (imageCandidates.length === 0) console.warn(`  WARN: No image extracted for ${url}`);
    if (!name) console.warn(`  WARN: No product name extracted for ${url}`);

    return {
      url,
      name,
      price: price && !isNaN(price) ? price : null,
      currency,
      description: description?.slice(0, 500) || null,
      imageCandidates,
      imageUrl: imageCandidates[0] || null,
      additionalImages: imageCandidates.slice(1),
      isAvailable,
      text,
      html,
      success: true,
    };
  } catch (err) {
    return {
      url,
      name: null,
      price: null,
      currency: null,
      description: null,
      imageCandidates: [],
      imageUrl: null,
      additionalImages: [],
      isAvailable: true,
      text: "",
      html: "",
      success: false,
      error: (err as Error).message,
    };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

/**
 * Normalize and dedupe a raw list of image URL strings into a ranked
 * candidate list. Drops empties, resolves protocol- and path-relative
 * URLs against the page URL, and caps the result at MAX_CANDIDATES to
 * bound retry cost downstream in the optimizer.
 */
const MAX_IMAGE_CANDIDATES = 10;
function buildImageCandidates(raw: string[], pageUrl: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of raw) {
    const normalized = normalizeImageUrl(u, pageUrl);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= MAX_IMAGE_CANDIDATES) break;
  }
  return out;
}

function normalizeImageUrl(raw: string, pageUrl: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Resolve site-absolute (/foo.jpg) and path-relative (foo.jpg) forms.
  // This is only reached for DOM img[src] values; JSON-LD path-relative
  // strings were already filtered upstream as non-conformant.
  try {
    return new URL(trimmed, pageUrl).href;
  } catch {
    return null;
  }
}

