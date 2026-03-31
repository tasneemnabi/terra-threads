/**
 * Playwright-based page scraper for extracting rendered text from product pages.
 * Handles JS-rendered content, accordions, and tabs that static fetches miss.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

// ─── Types ──────────────────────────────────────────────────────────

export interface ScrapedPage {
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
  imageUrl: string | null;
  additionalImages: string[];
  text: string;
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
  'details summary',
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
        if (await el.isVisible()) {
          await el.click().catch(() => {}); // Ignore click errors
          await page.waitForTimeout(200);
        }
      }
    } catch {
      // Selector not found — fine, move on
    }
  }
}

async function extractProductText(page: Page): Promise<string> {
  // Always get the full main/body text — after accordions are expanded,
  // this captures everything including dynamically revealed content.
  const mainText = await page.$eval("main", (el) => el.innerText).catch(() => "");
  if (mainText.trim()) return mainText.trim();

  return await page.$eval("body", (el) => el.innerText).catch(() => "");
}

/**
 * Scrape a single product page and return its rendered text content.
 */
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

    // Wait for dynamic content to render
    await page.waitForTimeout(3000);

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
    await page.waitForTimeout(3000);
    await expandAccordions(page);

    // Extract structured data using individual $eval calls to avoid
    // TypeScript/esbuild __name() injection issues in page.evaluate().
    const metaContent = async (prop: string): Promise<string | null> => {
      return page.$eval(
        `meta[property="${prop}"], meta[name="${prop}"]`,
        (el) => el.getAttribute("content")
      ).catch(() => null);
    };

    const name =
      (await metaContent("og:title")) ||
      (await page.$eval("h1", (el) => el.textContent?.trim() || null).catch(() => null)) ||
      (await page.title()) ||
      null;

    let priceStr =
      (await metaContent("product:price:amount")) ||
      (await metaContent("og:price:amount"));
    if (!priceStr) {
      priceStr = await page.$eval(
        '[data-product-price], .product-price, .price--regular, .price .amount, .product__price',
        (el) => el.textContent?.replace(/[^0-9.]/g, "") || null
      ).catch(() => null);
    }
    const price = priceStr ? parseFloat(priceStr) : null;

    const currency =
      (await metaContent("product:price:currency")) ||
      (await metaContent("og:price:currency")) ||
      null;

    const description =
      (await metaContent("og:description")) ||
      (await metaContent("description")) ||
      null;

    const ogImage = await metaContent("og:image");
    const productImages: string[] = await page.$$eval(
      '.product-gallery img, .product__media img, .product-images img, [data-product-image] img',
      (imgs) => imgs.map((img) => (img as HTMLImageElement).src).filter((s) => s && !s.includes("placeholder"))
    ).catch(() => []);

    const allImages = ogImage
      ? [ogImage, ...productImages.filter((i) => i !== ogImage)]
      : productImages;

    const data = { name, price, currency, description, images: allImages };

    const text = await extractProductText(page);

    return {
      url,
      name: data.name,
      price: data.price && !isNaN(data.price) ? data.price : null,
      currency: data.currency,
      description: data.description?.slice(0, 500) || null,
      imageUrl: data.images[0] || null,
      additionalImages: data.images.slice(1),
      text,
      success: true,
    };
  } catch (err) {
    return {
      url,
      name: null,
      price: null,
      currency: null,
      description: null,
      imageUrl: null,
      additionalImages: [],
      text: "",
      success: false,
      error: (err as Error).message,
    };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

/**
 * Scrape multiple pages with concurrency control.
 */
export async function scrapePages(
  urls: string[],
  options: { concurrency?: number; delayMs?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<ScrapedPage[]> {
  const { concurrency = 3, delayMs = 500, onProgress } = options;
  const results: ScrapedPage[] = new Array(urls.length);
  let done = 0;

  async function worker(startIdx: number): Promise<void> {
    for (let i = startIdx; i < urls.length; i += concurrency) {
      results[i] = await scrapePage(urls[i]);
      done++;
      if (onProgress) onProgress(done, urls.length);
      if (delayMs > 0 && i + concurrency < urls.length) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(concurrency, urls.length); w++) {
    workers.push(worker(w));
  }

  await Promise.all(workers);
  return results;
}
