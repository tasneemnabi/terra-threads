/**
 * Material extraction from Shopify product data.
 * Two-stage approach: regex first, Gemini API fallback.
 *
 * Gemini calls are batched (up to 10 products per request) to stay
 * well within free-tier rate limits (~15 RPM for Flash).
 */

import { GoogleGenAI } from "@google/genai";
import type { ShopifyProduct } from "./shopify-fetcher.js";

// ─── Types ──────────────────────────────────────────────────────────

export interface ExtractedMaterials {
  materials: Record<string, number>; // material name → percentage
  confidence: number; // 0.00–1.00
  hasBanned: boolean;
  method: "regex" | "llm" | "none";
}

// ─── Banned check ───────────────────────────────────────────────────

const BANNED_PATTERNS = /polyester|nylon|acrylic|polypropylene/i;

// ─── HTML stripping ─────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|ul|ol|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Stage 1: Regex extraction ──────────────────────────────────────

/**
 * Regex patterns for common material composition formats:
 * - "95% Organic Cotton, 5% Elastane"
 * - "95% organic cotton / 5% spandex"
 * - "Cotton 95%, Elastane 5%"
 */
// Material pattern note: split into PCT_THEN_NAME and NAME_THEN_PCT
// (defined near extractFromText) to avoid alternation cursor issues.

// Fabric construction suffixes to strip before alias lookup
const CONSTRUCTION_SUFFIXES = new RegExp(
  "\\b(" +
    [
      "fleece", "jersey", "poplin", "twill", "sateen", "voile", "chambray",
      "gauze", "knit", "woven", "fabric", "blend", "terry", "flannel", "rib",
      "interlock", "broadcloth", "muslin", "canvas", "crepe", "satin",
      "velvet", "cord", "corduroy", "oxford", "mesh", "pique", "piqué",
      "dobby", "jacquard", "lace", "tulle", "chiffon", "suede", "waffle",
      "ponte", "French", "ribbed", "brushed", "double", "single", "stretch",
      "tweed", "herringbone", "bouclé", "boucle", "sherpa", "minky",
      "pointelle", "slub", "supima",
    ].join("|") +
    ")\\b",
  "gi"
);

// Non-material words that the regex might capture as material names
const IGNORE_WORDS = new Set([
  "fabric", "material", "composition", "content", "blend", "made", "with", "from", "of",
  "certified", "recycled", "our", "the", "this", "these", "that", "is", "are", "was",
  "weight", "ounce", "oz", "soft", "lightweight", "heavyweight", "quality", "dyed",
  "crafted", "woven", "knit", "knitted", "sewn", "constructed", "portugal", "india",
  "peru", "china", "turkey", "italy", "lithuania", "performance", "comfortable",
  "sustainable", "premium", "natural", "organic", "s", "and", "on", "in", "a", "an",
  "satisfaction", "guaranteed", "guarantee", "tex", "oeko", "gots",
  "save", "off", "discount", "rating", "review", "star",
]);

// Alias map: all recognized names → canonical name (longest keys first for prefix matching)
const MATERIAL_ALIASES: [string, string][] = [
  // Multi-word (longest first)
  ["gots certified organic cotton", "Organic Cotton"],
  ["gots organic cotton", "Organic Cotton"],
  ["organic pima cotton", "Organic Pima Cotton"],
  ["organic merino wool", "Organic Merino Wool"],
  ["organic merino", "Organic Merino Wool"],
  ["organic cotton", "Organic Cotton"],
  ["organic linen", "Linen"],
  ["organic hemp", "Hemp"],
  ["regenerative hemp", "Hemp"],
  ["turkish hemp", "Hemp"],
  ["recycled merino wool", "Merino Wool"],
  ["recycled merino", "Merino Wool"],
  ["recycled cashmere", "Cashmere"],
  ["recycled polyester", "Polyester"],
  ["recycled cotton", "Cotton"],
  ["recycled nylon", "Nylon"],
  ["recycled wool", "Wool"],
  ["tencel lyocell", "Tencel Lyocell"],
  ["bamboo lyocell", "Bamboo Lyocell"],
  ["lenzing tencel", "Tencel Lyocell"],
  ["lenzing lyocell", "Tencel Lyocell"],
  ["lenzing modal", "Modal"],
  ["lenzing ecovero", "Viscose"],
  ["ecovero viscose", "Viscose"],
  ["tencel modal", "Modal"],
  ["cotton modal", "Modal"],
  ["micro modal", "Modal"],
  ["supima cotton", "Pima Cotton"],
  ["baby alpaca", "Alpaca"],
  ["royal alpaca", "Alpaca"],
  ["undyed alpaca", "Alpaca"],
  ["alpaca wool", "Alpaca"],
  ["alpaca fiber", "Alpaca"],
  ["merino wool", "Merino Wool"],
  ["merino lambs wool", "Merino Wool"],
  ["pima cotton", "Pima Cotton"],
  ["egyptian cotton", "Egyptian Cotton"],
  ["european flax", "Linen"],
  ["flax linen", "Linen"],
  // Single-word
  ["cotton", "Cotton"],
  ["merino", "Merino Wool"],
  ["elastane", "Spandex"],
  ["spandex", "Spandex"],
  ["lycra", "Spandex"],
  ["tencel", "Tencel Lyocell"],
  ["lyocell", "Tencel Lyocell"],
  ["hemp", "Hemp"],
  ["silk", "Silk"],
  ["cashmere", "Cashmere"],
  ["linen", "Linen"],
  ["flax", "Linen"],
  ["modal", "Modal"],
  ["viscose", "Viscose"],
  ["rayon", "Rayon"],
  ["cupro", "Cupro"],
  ["alpaca", "Alpaca"],
  ["mohair", "Mohair"],
  ["lambswool", "Lambswool"],
  ["wool", "Wool"],
  ["yak", "Yak"],
  ["bamboo", "Bamboo Lyocell"],
  ["nylon", "Nylon"],
  ["polyamide", "Nylon"],
  ["polyester", "Polyester"],
  ["acrylic", "Acrylic"],
];

// Trailing words that are never part of a material name
const TRAILING_JUNK = /\s+(?:and|or|that|is|are|was|which|for|not|do|the|a|an|in|on|of|by|to|as|at)(?:\s+.*)?$/i;

function normalizeMaterialName(raw: string): string {
  let name = raw.trim().replace(/\s+/g, " ");

  // Strip fabric construction suffixes: "organic cotton fleece" → "organic cotton"
  name = name.replace(CONSTRUCTION_SUFFIXES, "").trim().replace(/\s+/g, " ");

  // Strip trailing connectors/junk: "Regenerative Hemp and" → "Regenerative Hemp"
  name = name.replace(TRAILING_JUNK, "").trim();

  const lower = name.toLowerCase();

  // Exact match first
  for (const [alias, canonical] of MATERIAL_ALIASES) {
    if (lower === alias) return canonical;
  }

  // Prefix match: "alpaca wool midweight leggings will" → matches "alpaca wool" → "Alpaca"
  // Try longest alias first (already sorted longest-first in the array)
  for (const [alias, canonical] of MATERIAL_ALIASES) {
    if (lower.startsWith(alias + " ") || lower.startsWith(alias)) {
      // Make sure the alias matches at a word boundary
      if (lower === alias || lower[alias.length] === " " || lower[alias.length] === undefined) {
        return canonical;
      }
    }
  }

  if (IGNORE_WORDS.has(lower)) return "";
  // Reject multi-word names where ANY word is a known non-material word
  // (Safe because valid multi-word materials are caught by alias lookup above)
  const words = lower.split(" ");
  if (words.length > 1 && words.some((w) => IGNORE_WORDS.has(w))) return "";

  // Single unknown word — could be a valid material we don't know yet
  if (words.length === 1) return name.replace(/\b\w/g, (c) => c.toUpperCase());

  // Multi-word unknown — reject (likely garbage from over-greedy regex)
  return "";
}

/**
 * Section markers that indicate a composition context (Body, Shell, Lining, etc.).
 * Used to split multi-section descriptions and extract each independently.
 */
const SECTION_SPLIT =
  /(?:^|\n)\s*(?:body|shell|outer|main|self|fabric|lining|trim|contrast|rib|ribbing|binding|fill|filling|insulation|lace|mesh|panel)[:\s]/gi;

// Split into two separate patterns to avoid alternation cursor issues.
// When alt 2 (name pct%) matches but normalizes to empty, the global regex
// skips past the %, preventing alt 1 (pct% name) from matching at the same position.
// Use [^\S\n] (whitespace except newline) for word separators so patterns
// don't span across lines (e.g. "100% Cashmere\nImported" should stop at newline).
const PCT_THEN_NAME =
  /(\d{1,3})%[^\S\n]*([A-Za-z]+(?:[^\S\n]+[A-Za-z]+){0,4})(?=[^A-Za-z%]|$)/gm;
const NAME_THEN_PCT =
  /(?:^|[,/|•·;\n])[^\S\n]*([A-Za-z]+(?:[^\S\n]+[A-Za-z]+){0,4})[^\S\n]+(\d{1,3})%/gm;

function extractFromText(text: string): Record<string, number> | null {
  const materials: Record<string, number> = {};

  // Pass 1: "95% Organic Cotton" format (most common)
  PCT_THEN_NAME.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PCT_THEN_NAME.exec(text)) !== null) {
    const pct = parseInt(match[1], 10);
    if (pct <= 0 || pct > 100) continue;
    const name = normalizeMaterialName(match[2]);
    if (!name) continue;
    materials[name] = (materials[name] || 0) + pct;
  }

  // Pass 2: "Organic Cotton 95%" format (only if pass 1 found nothing)
  if (Object.keys(materials).length === 0) {
    NAME_THEN_PCT.lastIndex = 0;
    while ((match = NAME_THEN_PCT.exec(text)) !== null) {
      const pct = parseInt(match[2], 10);
      if (pct <= 0 || pct > 100) continue;
      const name = normalizeMaterialName(match[1]);
      if (!name) continue;
      materials[name] = (materials[name] || 0) + pct;
    }
  }

  if (Object.keys(materials).length === 0) return null;

  const total = Object.values(materials).reduce((a, b) => a + b, 0);
  if (total === 100) return materials;

  return null;
}

function extractWithRegex(text: string): ExtractedMaterials | null {
  // First, try extracting from the full text
  const fullResult = extractFromText(text);
  if (fullResult) {
    const hasBanned = Object.keys(fullResult).some((m) => BANNED_PATTERNS.test(m));
    return { materials: fullResult, confidence: 0.95, hasBanned, method: "regex" };
  }

  // If full text fails (e.g. "Body: 95% Cotton, 5% Elastane. Trim: 100% Polyester" = 200%),
  // try splitting by section markers and extracting from the main body section
  const sections = text.split(SECTION_SPLIT).filter((s) => s.trim().length > 0);
  if (sections.length > 1) {
    // Try each section; prefer the first one that sums to 100%
    // (first section is typically "Body" / "Shell" / "Self")
    for (const section of sections) {
      const sectionResult = extractFromText(section);
      if (sectionResult) {
        const hasBanned = Object.keys(sectionResult).some((m) => BANNED_PATTERNS.test(m));
        return { materials: sectionResult, confidence: 0.90, hasBanned, method: "regex" };
      }
    }
  }

  // Also try extracting from just the first line/sentence that contains a percentage
  // (handles cases where material data is followed by irrelevant percentages)
  const lines = text.split(/\n/).filter((l) => /\d{1,3}%/.test(l));
  for (const line of lines) {
    const lineResult = extractFromText(line);
    if (lineResult) {
      const hasBanned = Object.keys(lineResult).some((m) => BANNED_PATTERNS.test(m));
      return { materials: lineResult, confidence: 0.90, hasBanned, method: "regex" };
    }
  }

  // Multi-component products: "100% Organic Cotton + 100% Merino Wool Liner"
  // Split on " + " or ". With a " and treat each part as a section, take the first
  const multiParts = text.split(/\s*(?:\+|\.?\s*[Ww]ith (?:a |an )?)\s*/).filter((s) => /\d{1,3}%/.test(s));
  if (multiParts.length > 1) {
    const firstPart = extractFromText(multiParts[0]);
    if (firstPart) {
      const hasBanned = Object.keys(firstPart).some((m) => BANNED_PATTERNS.test(m));
      return { materials: firstPart, confidence: 0.85, hasBanned, method: "regex" };
    }
  }

  return null;
}

// ─── Stage 1b: Dictionary-based extraction ──────────────────────────

// Build dictionary from the same aliases used in normalizeMaterialName
const MATERIAL_DICTIONARY: string[] = [
  // Multi-word first (longest match wins)
  "gots certified organic cotton", "gots organic cotton", "organic pima cotton",
  "organic merino wool", "organic merino", "organic cotton",
  "tencel lyocell", "bamboo lyocell", "merino wool", "pima cotton",
  "egyptian cotton", "recycled cotton", "recycled wool", "recycled merino wool",
  "recycled merino", "recycled cashmere", "supima cotton", "micro modal",
  "cotton modal", "tencel modal", "lenzing modal", "lenzing tencel",
  "lenzing lyocell", "ecovero viscose", "lenzing ecovero",
  "recycled polyester", "recycled nylon",
  // Single-word
  "cotton", "merino", "elastane", "spandex", "lycra", "tencel", "lyocell",
  "hemp", "silk", "cashmere", "linen", "flax", "modal", "viscose", "rayon",
  "cupro", "alpaca", "mohair", "wool", "yak", "bamboo", "nylon", "polyamide",
  "polyester", "acrylic",
].sort((a, b) => b.length - a.length); // longest first

const FALSE_POSITIVE_WORDS = /\b(save|off|discount|satisfaction|guarantee|rating|review|star|shrink|shade|opacity|up to|code|coupon|cashback)\b/i;
// Broader pattern to catch non-material percentage contexts
const FALSE_POSITIVE_CONTEXT = /(?:save|off|discount|up to|coupon|code|cashback|shrink|opacity|width|height)\s*\d{1,3}%|\d{1,3}%\s*(?:off|discount|shrink|opacity)/i;

function extractWithDictionary(text: string): ExtractedMaterials | null {
  // Find all percentage occurrences
  const pctPattern = /(\d{1,3})%/g;
  let pctMatch: RegExpExecArray | null;
  const candidates: Array<{ pct: number; pos: number }> = [];

  while ((pctMatch = pctPattern.exec(text)) !== null) {
    const pct = parseInt(pctMatch[1], 10);
    if (pct > 0 && pct <= 100) {
      candidates.push({ pct, pos: pctMatch.index });
    }
  }

  if (candidates.length === 0) return null;

  const materials: Record<string, number> = {};

  for (const { pct, pos } of candidates) {
    // False-positive check — 30 chars before/after the percentage
    const fpStart = Math.max(0, pos - 30);
    const fpEnd = Math.min(text.length, pos + 10);
    const fpContext = text.slice(fpStart, fpEnd).toLowerCase();
    if (FALSE_POSITIVE_WORDS.test(fpContext)) continue;
    if (FALSE_POSITIVE_CONTEXT.test(fpContext)) continue;

    // Tighter window for material name lookup (50 before, 40 after)
    // Reduced from 80/60 to prevent cross-boundary matches
    const start = Math.max(0, pos - 50);
    const end = Math.min(text.length, pos + 40);
    const context = text.slice(start, end).toLowerCase();

    // Ensure no intervening percentage between material name and this percentage
    // (prevents matching "cotton" from a nearby line with an unrelated %)
    let bestMatch: { name: string; distance: number } | null = null;

    for (const dictEntry of MATERIAL_DICTIONARY) {
      const idx = context.indexOf(dictEntry);
      if (idx === -1) continue;

      // Calculate distance between the material name and the percentage position in the window
      const pctInWindow = pos - start;
      const matEndInWindow = idx + dictEntry.length;
      const distance = Math.abs(pctInWindow - matEndInWindow);

      // Check no other % sign sits between the material and our target percentage
      const between = idx < pctInWindow
        ? context.slice(matEndInWindow, pctInWindow)
        : context.slice(pctInWindow + 4, idx);
      if (/\d{1,3}%/.test(between)) continue;

      if (!bestMatch || distance < bestMatch.distance) {
        const name = normalizeMaterialName(dictEntry);
        if (!name) continue;
        bestMatch = { name, distance };
      }
    }

    if (bestMatch) {
      materials[bestMatch.name] = (materials[bestMatch.name] || 0) + pct;
    }
  }

  if (Object.keys(materials).length === 0) return null;

  const total = Object.values(materials).reduce((a, b) => a + b, 0);
  if (total !== 100) return null;

  const hasBanned = Object.keys(materials).some((m) => BANNED_PATTERNS.test(m));

  return {
    materials,
    confidence: 0.90,
    hasBanned,
    method: "regex", // Still "regex" stage — no LLM involved
  };
}

// ─── Stage 2: Gemini batch extraction ───────────────────────────────

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

interface LLMProductInput {
  index: number;
  name: string;
  bodyText: string;
  tags: string[];
}

/**
 * Extract materials for a batch of products in a single Gemini call.
 * Up to 10 products per request to minimize API usage on free tier.
 */
async function extractBatchWithLLM(
  products: LLMProductInput[]
): Promise<Map<number, ExtractedMaterials>> {
  const client = getGeminiClient();
  const results = new Map<number, ExtractedMaterials>();

  // Build batch prompt — each product gets a numbered entry
  const productEntries = products.map((p) => {
    const desc = p.bodyText.slice(0, 800); // Trim per product to keep total size reasonable
    return `[${p.index}] Product: ${p.name}\nTags: ${p.tags.join(", ")}\nDescription: ${desc}`;
  }).join("\n\n---\n\n");

  const prompt = `Extract material/fabric compositions from these product listings. Return ONLY a JSON array.

${productEntries}

Return a JSON array with one object per product, in order:
[
  {
    "index": 0,
    "materials": { "Material Name": percentage_number },
    "confidence": 0.0_to_1.0,
    "has_banned": true_or_false
  }
]

Rules:
- Material percentages must sum to 100 for each product
- Use standard names: "Organic Cotton", "Merino Wool", "Spandex", "Hemp", "Tencel Lyocell", "Silk", "Linen", "Wool", "Cotton", "Modal", "Viscose", etc.
- "Elastane", "Spandex", and "Lycra" should all be normalized to "Spandex"
- Set has_banned=true if polyester, nylon, acrylic, or polypropylene is present
- If you cannot determine a product's composition, use empty materials and confidence 0.0
- confidence: 0.9+ if explicitly stated, 0.6-0.8 if inferred, below 0.5 if guessing`;

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text ?? "";

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      // Set all to empty
      for (const p of products) {
        results.set(p.index, { materials: {}, confidence: 0, hasBanned: false, method: "llm" });
      }
      return results;
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      materials: Record<string, number>;
      confidence: number;
      has_banned: boolean;
    }>;

    for (const entry of parsed) {
      const materials: Record<string, number> = {};
      for (const [name, pct] of Object.entries(entry.materials || {})) {
        materials[normalizeMaterialName(name)] = pct as number;
      }

      results.set(entry.index, {
        materials,
        confidence: Math.min(1, Math.max(0, entry.confidence || 0)),
        hasBanned: entry.has_banned || Object.keys(materials).some((m) => BANNED_PATTERNS.test(m)),
        method: "llm",
      });
    }
  } catch (err) {
    console.error(`  Gemini batch extraction failed:`, (err as Error).message);
  }

  // Fill in any missing results
  for (const p of products) {
    if (!results.has(p.index)) {
      results.set(p.index, { materials: {}, confidence: 0, hasBanned: false, method: "llm" });
    }
  }

  return results;
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Core extraction: run regex then dictionary on plain text.
 * Used by both extractMaterialsRegex (ShopifyProduct) and extractMaterialsFromText (raw text).
 */
function extractFromCombinedText(combinedText: string): ExtractedMaterials | null {
  const regexResult = extractWithRegex(combinedText);
  if (regexResult) return regexResult;

  const dictResult = extractWithDictionary(combinedText);
  if (dictResult) return dictResult;

  return null;
}

/**
 * Extract materials from a ShopifyProduct using regex only.
 * Checks title first (some brands put compositions there), then body + tags.
 * Returns null if regex fails (caller should batch for LLM).
 */
export function extractMaterialsRegex(product: ShopifyProduct): ExtractedMaterials | null {
  // Try title first — some brands embed compositions there
  // e.g., "Vitality Gym Tee (60% Organic Cotton / 40% TENCEL Lyocell)"
  if (product.title && /\d{1,3}%/.test(product.title)) {
    const titleResult = extractFromCombinedText(product.title);
    if (titleResult) return titleResult;
  }

  const bodyText = product.body_html ? stripHtml(product.body_html) : "";
  const tags = product.tags || [];
  const combinedText = `${bodyText}\n${tags.join(", ")}`;
  return extractFromCombinedText(combinedText);
}

/**
 * Extract materials from arbitrary text (e.g. scraped page content).
 * Does not require a ShopifyProduct — accepts raw text directly.
 */
export function extractMaterialsFromText(text: string): ExtractedMaterials | null {
  return extractFromCombinedText(text);
}

/**
 * Extract materials for a single product (regex → LLM fallback).
 * Prefer extractMaterialsBatch for multiple products.
 */
export async function extractMaterials(product: ShopifyProduct): Promise<ExtractedMaterials> {
  const regexResult = extractMaterialsRegex(product);
  if (regexResult) return regexResult;

  if (!process.env.GEMINI_API_KEY) {
    console.warn(`  No GEMINI_API_KEY — skipping LLM extraction for "${product.title}"`);
    return { materials: {}, confidence: 0, hasBanned: false, method: "none" };
  }

  const bodyText = product.body_html ? stripHtml(product.body_html) : "";
  const tags = product.tags || [];
  const batch = [{ index: 0, name: product.title, bodyText, tags }];
  const results = await extractBatchWithLLM(batch);
  return results.get(0)!;
}

const LLM_BATCH_SIZE = 10;
const LLM_DELAY_MS = 4500; // ~13 RPM, well under free tier limits

/**
 * Extract materials for many products via Gemini LLM.
 * Returns a Map keyed by the product's index in the input array.
 * All products are sent to the LLM (callers should pre-filter with regex).
 */
export async function extractMaterialsBatch(
  products: ShopifyProduct[]
): Promise<Map<number, ExtractedMaterials>> {
  const results = new Map<number, ExtractedMaterials>();

  // Send all products to LLM (caller handles regex pre-filtering)
  const allProducts: LLMProductInput[] = products.map((p, i) => ({
    index: i,
    name: p.title,
    bodyText: p.body_html ? stripHtml(p.body_html) : "",
    tags: p.tags || [],
  }));

  console.log(`  Sending ${allProducts.length} products to Gemini...`);

  if (!process.env.GEMINI_API_KEY) {
    console.warn(`  No GEMINI_API_KEY — ${allProducts.length} products skipped`);
    for (const p of allProducts) {
      results.set(p.index, { materials: {}, confidence: 0, hasBanned: false, method: "none" });
    }
    return results;
  }

  for (let i = 0; i < allProducts.length; i += LLM_BATCH_SIZE) {
    const batch = allProducts.slice(i, i + LLM_BATCH_SIZE);
    const batchNum = Math.floor(i / LLM_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allProducts.length / LLM_BATCH_SIZE);
    console.log(`  Gemini batch ${batchNum}/${totalBatches} (${batch.length} products)...`);

    const batchResults = await extractBatchWithLLM(batch);
    for (const [idx, result] of batchResults) {
      results.set(idx, result);
    }

    // Rate limit: wait between batches
    if (i + LLM_BATCH_SIZE < allProducts.length) {
      await new Promise((r) => setTimeout(r, LLM_DELAY_MS));
    }
  }

  return results;
}
