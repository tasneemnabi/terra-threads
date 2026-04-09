/**
 * Product type classifier.
 * Derives a normalized product_type from product name + optional Shopify metadata.
 */

export const CANONICAL_PRODUCT_TYPES = [
  "tops",
  "leggings",
  "pants",
  "shorts",
  "bras",
  "dresses",
  "skirts",
  "sweaters",
  "jackets",
  "bodysuits",
  "jumpsuits",
  "underwear",
  "socks",
  "loungewear",
  "swimwear",
] as const;

export type ProductType = (typeof CANONICAL_PRODUCT_TYPES)[number];

// Non-clothing keywords → should be rejected entirely
// Blacklist for non-lifestyle brands. Lifestyle brands use whitelist mode instead.
// Avoid ambiguous words here — if a word commonly appears in clothing names, don't add it.
const NON_CLOTHING_KEYWORDS =
  /\b(yoga mat|yoga strap|yoga block|yoga bolster|palo santo|incense|candle|wick\b|mug|tote bag|gift card|e-gift|stickers?|pouch|wallet|mat strap|loose leaf tea|loofah|sponge|soap|twine|string light|braided cord|eyeshade|eye ?mask|sleep ?mask|eye ?pillow|seat cover|car seat|cushion cover|pillow ?case|pillow\b|duvet|blanket|comforter|sheet set|fitted sheet|flat sheet|bed ?sheet|towel|washcloth|bath ?mat|shower ?curtain|napkin|tablecloth|placemats?|dish ?cloth|mattress|produce bag|laundry bag|shopping bag|duffel|backpack|doormat|pet bed|dog bed|cat bed|shipping protection|package assurance|carbon offset|postcards?|lip ?balm|swatch ?book|shoelaces?|gift ?wrapping|drawer liner|sachet|potpourri|donation|bamboo straw|greeting card|wall hanging|baby(?!\s*rib\b|\s*alpaca\b|doll\b)'?s?\b|infant|newborn|toddler|\bkids?\b|\bonesie|sanitiser|sanitizer|lotion|shampoo|conditioner|deodorant|face cream|body cream|hand cream|aftershave|enamelware|medallion|pendant|necklace|bracelet|earrings?|jewelry|jewellery|keychain|key ?ring|nail polish|perfume|fragrance|reed diffuser|toothbrush|ayurvedic|essential oils?|oil blend|card deck|affirmation|planter|coffee cups?|tea ?cups?|back scrub|body scrub|shoes?\b|sneakers?|high tops?\b|boots?\b|sandals?|flip ?flops?|slippers?|footwear|oxford\s+shoe|menstrual|pantyliner|sanitary\s*pads?|hemp\s+yarn|beading|craft\s*kit|face\s*wash|body\s*wash)\b/i;

// Accessories — not rejected but not classified as clothing types
const ACCESSORY_KEYWORDS =
  /\b(belt\b|headband|scrunchie|scarf|glove|mittens?|beanie|hat\b|cap\b(?!\s*sleeve)|bandana|wristband|hair tie|apron)\b/i;

// Order matters — more specific patterns first to avoid false matches
// Use (?:s\b|\b) at end to handle plurals (e.g., "shorts" and "short")
const TYPE_PATTERNS: [ProductType, RegExp][] = [
  // Underwear before shorts/tops (so "boxer shorts" matches underwear)
  ["underwear", /\b(underwear|briefs?|boxers?\b|boxer\s*briefs?|knickers?|panties?|panty|thongs?|bikini(?!\s*top)|long\s*johns?|undershirts?|trunks?)\b/i],
  // Socks
  ["socks", /\b(socks?|stockings?|tights?)\b/i],
  // Swimwear
  ["swimwear", /\b(swimsuit|swimwear|bikini\s*top|one[- ]?piece|swim\s*trunks?)\b/i],
  // Loungewear / sleepwear
  ["loungewear", /\b(pajamas?|pyjamas?|pjs?\b|sleepwear|nightgown|nightshirt|nightdress|lounge\s*set|lounge\s*pants?|sleep\s*set|bathrobes?)\b/i],
  // Bras before tops (so "sports bra" doesn't match "top")
  ["bras", /\b(sports?\s*bras?|bralettes?|scoop\s*bras?|v-?neck\s*bras?|yoga\s*bras?|built-?in\s*bras?|\bbras?\b)/i],
  // Dresses before tops (so "t-shirt dress" matches dress)
  // Negative lookahead excludes "dress shoes" and "dress shirt"
  ["dresses", /\b(dress(?:es)?(?!\s+(?:shoes?|shirts?))|gowns?|tunics?|kaftans?|caftans?|muumuus?|sarongs?)\b/i],
  // Jumpsuits before tops/pants
  ["jumpsuits", /\b(jumpsuits?|rompers?|playsuits?|overalls?|dungarees?)\b/i],
  // Bodysuits before tops
  ["bodysuits", /\b(bodysuits?|unitards?|onesies?|catsuits?)\b/i],
  // Leggings before pants (includes flares)
  ["leggings", /\b(leggings?|capris?|7\/8\s*(?:pants?|leggings?)|flares?)\b/i],
  // Skirts
  ["skirts", /\b(skirts?|skorts?)\b/i],
  // Shorts before pants
  ["shorts", /\b((?<!sleeve\s)shorts?|biker\s*shorts?)\b/i],
  // Sweaters/knitwear
  ["sweaters", /\b(sweaters?|cardigans?|cardi\b|pullovers?|crewnecks?|turtlenecks?|jumpers?|wraps?)\b/i],
  // Jackets/outerwear
  ["jackets", /\b(jackets?|hoodies?|sweatshirts?|half-?zips?|zip\s+jackets?|(?<!top\s|nail\s)coats?|ponchos?|anoraks?|parkas?|robes?|gilets?|blazers?|waistcoats?|overshirts?|anoraks?|windbreakers?)\b/i],
  // Pants
  ["pants", /\b(pants?|trousers?|joggers?|sweatpants?|bootcuts?|cargos?|chinos?|jeans?|denims?)\b/i],
  // Tops (broadest — last)
  // Negative lookbehind excludes "high tops" and "high-top" (shoes)
  ["tops", /\b(tanks?|tees?\b|t-?shirts?|(?<!high[\s-])tops?\b|camis?|camisoles?|blouses?|longsleeves?|long\s+sleeves?|crops?\b|henleys?|polos?|singlets?|shirts?|vests?|tube\b|v-?necks?)\b/i],
];

// Shopify product_type normalization map
const SHOPIFY_TYPE_MAP: Record<string, ProductType> = {
  // Direct matches
  "legging": "leggings",
  "leggings": "leggings",
  "capri": "leggings",
  "top": "tops",
  "tops": "tops",
  "tee": "tops",
  "tees": "tops",
  "t-shirt": "tops",
  "tank top": "tops",
  "tank": "tops",
  "ss tees": "tops",
  "short sleeve": "tops",
  "short sleeve tee": "tops",
  "long sleeve": "tops",
  "shirts": "tops",
  "shirts & blouses": "tops",
  "vests": "tops",
  "blouse": "tops",
  "bra": "bras",
  "sports bra": "bras",
  "bralette": "bras",
  "shorts": "shorts",
  "short": "shorts",
  "pant": "pants",
  "pants": "pants",
  "trousers": "pants",
  "joggers": "pants",
  "sweatpants": "pants",
  "cargos": "pants",
  "bottoms": "pants",
  "jeans": "pants",
  "sweater": "sweaters",
  "sweaters": "sweaters",
  "cardigan": "sweaters",
  "cardigans": "sweaters",
  "knitwear": "sweaters",
  "crew neck sweaters": "sweaters",
  "v neck sweaters": "sweaters",
  "open neck sweaters": "sweaters",
  "turtleneck sweaters": "sweaters",
  "pullover": "sweaters",
  "jacket": "jackets",
  "jackets": "jackets",
  "hoodie": "jackets",
  "hoodies": "jackets",
  "sweatshirt": "jackets",
  "sweatshirts": "jackets",
  "shirt jacket": "jackets",
  "dress": "dresses",
  "dresses": "dresses",
  "dress/skirt": "dresses",
  "skirt": "skirts",
  "skirts": "skirts",
  "jumpsuit": "jumpsuits",
  "jumpsuits": "jumpsuits",
  "romper": "jumpsuits",
  "bodysuit": "bodysuits",
  "underwear": "underwear",
  "briefs": "underwear",
  "boxers": "underwear",
  "socks": "socks",
  "sock": "socks",
  "tights": "socks",
  "pajamas": "loungewear",
  "pajama": "loungewear",
  "sleepwear": "loungewear",
  "robe": "loungewear",
  "swimwear": "swimwear",
  "bikini": "swimwear",
  "one-piece": "swimwear",
  "blazer": "jackets",
  "waistcoat": "jackets",
  "activewear": undefined!, // too broad — fall through to name-based
  "active": undefined!,
};

/**
 * Brands that sell mostly non-clothing (home goods, ceramics, etc.).
 * For these brands we flip to whitelist mode: only products whose name
 * matches a known clothing type are allowed through.
 */
export const CLOTHING_ONLY_BRANDS = new Set([
  "magic-linen",
  "beaumont-organic",
  "aya",
  "rawganique",
  "allwear-organic-clothing",
  "indigo-luna",
  "nads",
  "gil-rodriguez",
  "industry-of-all-nations",
]);

export function isNonClothing(title: string): boolean {
  return NON_CLOTHING_KEYWORDS.test(title);
}

export function isAccessory(title: string): boolean {
  return ACCESSORY_KEYWORDS.test(title);
}

/**
 * Check if a product should be rejected based on brand + name.
 * - Clothing-only brands: reject unless name matches a known clothing type.
 * - Other brands: reject if name matches non-clothing or accessory keywords.
 */
export function shouldRejectProduct(
  title: string,
  brandSlug: string,
  shopifyProductType?: string,
  tags?: string[],
): { rejected: boolean; reason?: string } {
  // Non-clothing items (shoes, yoga mats, etc.) are always rejected,
  // regardless of brand mode — prevents "denim shoes" matching as pants
  if (isNonClothing(title)) {
    return { rejected: true, reason: "non-clothing" };
  }

  const clothingType = classifyProductType(title, shopifyProductType, tags);

  // Whitelist mode for lifestyle brands
  if (CLOTHING_ONLY_BRANDS.has(brandSlug)) {
    if (!clothingType) {
      return { rejected: true, reason: "unrecognized (clothing-only brand)" };
    }
    return { rejected: false };
  }

  // Blacklist mode for other brands
  // If the product has a valid clothing type, trust it over keyword matches
  if (!clothingType) {
    if (isAccessory(title)) {
      return { rejected: true, reason: "accessory" };
    }
  }
  return { rejected: false };
}

// For activewear, map granular types to 4 broad subcategories
const ACTIVEWEAR_TYPE_MAP: Record<string, string> = {
  tops: "tops",
  bras: "sports-bras",
  leggings: "bottoms",
  pants: "bottoms",
  shorts: "bottoms",
  skirts: "bottoms",
  jackets: "outerwear",
  sweaters: "outerwear",
  bodysuits: "tops",
  jumpsuits: "bottoms",
  underwear: "tops", // fallback
  socks: "tops",
  loungewear: "tops",
  swimwear: "tops",
};

export function mapActivewearType(productType: ProductType): string {
  return ACTIVEWEAR_TYPE_MAP[productType] || "tops";
}

// ─── Audience Classification ────────────────────────────────────────

export type Audience = "Women" | "Men" | "Unisex";

// Tier 1: Shopify tag patterns (highest confidence)
const AUDIENCE_TAG_PATTERNS: [Audience, RegExp][] = [
  ["Women", /\b(shop[- ]?women|womens?|female|ladies)\b/i],
  ["Men", /\b(shop[- ]?men|mens?\b|male|gentlemen)\b/i],
  ["Unisex", /\b(unisex|gender[- ]?neutral|all[- ]?gender)\b/i],
];

// Tier 2: Title prefix patterns
const AUDIENCE_TITLE_PATTERNS: [Audience, RegExp][] = [
  ["Women", /^women'?s?\b/i],
  ["Men", /^men'?s?\b/i],
  ["Unisex", /^unisex\b/i],
];

// Tier 2b: Gendered keywords anywhere in title
const AUDIENCE_TITLE_ANYWHERE: [Audience, RegExp][] = [
  ["Unisex", /\bunisex\b/i],
  ["Women", /\b(women'?s?|ladies'?|lady'?s)\b/i],
  ["Men", /\b(men'?s)\b/i],
];

// Tier 2c: Gendered product-name patterns (unambiguous)
const WOMEN_NAME_PATTERNS = /\b(panty|panties|bralette|off[- ]?shoulder|nightgown|nightdress)\b/i;
const MEN_NAME_PATTERNS = /\b(boxers?\s*(?:briefs?|shorts?)?)\b/i;

// Tier 3: Unambiguously gendered product types (Shopify or classified)
const WOMEN_ONLY_TYPES = new Set(["sports bra", "bralette", "bikini", "bras", "skirts", "dresses"]);
const MEN_ONLY_TYPES = new Set(["boxer briefs", "boxers"]);

export function classifyAudience(
  title: string,
  tags?: string[],
  productType?: string | null,
  brandAudience?: string[]
): Audience {
  // Tier 1: Shopify tags
  if (tags?.length) {
    const tagText = tags.join(" ");
    for (const [audience, pattern] of AUDIENCE_TAG_PATTERNS) {
      if (pattern.test(tagText)) return audience;
    }
  }

  // Tier 2: Title prefix
  for (const [audience, pattern] of AUDIENCE_TITLE_PATTERNS) {
    if (pattern.test(title)) return audience;
  }

  // Tier 2b: Gendered keywords anywhere in title
  for (const [audience, pattern] of AUDIENCE_TITLE_ANYWHERE) {
    if (pattern.test(title)) return audience;
  }

  // Tier 2c: Gendered product-name patterns
  if (WOMEN_NAME_PATTERNS.test(title)) return "Women";
  if (MEN_NAME_PATTERNS.test(title)) return "Men";

  // Tier 3: Product type (conservative)
  if (productType) {
    const ptLower = productType.toLowerCase();
    if (WOMEN_ONLY_TYPES.has(ptLower)) return "Women";
    if (MEN_ONLY_TYPES.has(ptLower)) return "Men";
  }

  // Tier 4: Brand audience fallback (single-gender brands)
  if (brandAudience?.length === 1) {
    const sole = brandAudience[0];
    if (sole === "Women" || sole === "Men") return sole;
  }

  // Default: multi-gender brand with no signal → Unisex
  return "Unisex";
}

// ─── Category Classification ─────────────────────────────────────────

/**
 * Guess a broad product category from text (title, product_type, tags combined).
 * Used by both Shopify and catalog sync pipelines.
 */
export function guessCategory(text: string): string {
  const lower = text.toLowerCase();

  if (/legging|sports?\s*bra|athletic|activewear|yoga|workout|running/i.test(lower)) return "activewear";
  if (/dress/i.test(lower)) return "dresses";
  if (/sock/i.test(lower)) return "socks";
  if (/underwear|brief|boxer|panty|panties|bra(?!celet)|lingerie|bralette/i.test(lower)) return "underwear";
  if (/swim|bikini|one.?piece/i.test(lower)) return "swimwear";
  if (/knit|sweater|cardigan|pullover/i.test(lower)) return "knitwear";
  if (/denim|jean/i.test(lower)) return "denim";
  if (/lounge|pajama|pj|sleep|robe/i.test(lower)) return "loungewear";
  if (/t-?shirt|tee|top|tank|blouse|shirt|henley|polo/i.test(lower)) return "tops";
  if (/pant|trouser|short|skirt/i.test(lower)) return "bottoms";
  if (/jacket|coat|hoodie|sweatshirt/i.test(lower)) return "outerwear";
  return "basics";
}

// ─── Product Type Classification ────────────────────────────────────

export function classifyProductType(
  title: string,
  shopifyProductType?: string,
  tags?: string[]
): ProductType | null {
  const titleLower = title.toLowerCase();

  // 1. Name-based classification (most reliable)
  for (const [type, pattern] of TYPE_PATTERNS) {
    if (pattern.test(titleLower)) {
      return type;
    }
  }

  // 2. Shopify product_type normalization
  if (shopifyProductType) {
    const normalized = SHOPIFY_TYPE_MAP[shopifyProductType.toLowerCase()];
    if (normalized) return normalized;
  }

  // 3. Tags-based (last resort)
  if (tags?.length) {
    const tagText = tags.join(" ").toLowerCase();
    for (const [type, pattern] of TYPE_PATTERNS) {
      if (pattern.test(tagText)) {
        return type;
      }
    }
  }

  return null;
}
