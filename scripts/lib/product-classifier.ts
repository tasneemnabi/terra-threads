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
] as const;

export type ProductType = (typeof CANONICAL_PRODUCT_TYPES)[number];

// Non-clothing keywords → should be rejected entirely
const NON_CLOTHING_KEYWORDS =
  /\b(yoga mat|palo santo|incense|candle|mug|tote bag|gift card|e-gift|sticker|bottle|pouch|wallet|mat strap|loose leaf tea|loofah|sponge|soap)\b/i;

// Accessories — not rejected but not classified as clothing types
const ACCESSORY_KEYWORDS =
  /\b(belt\b|headband|scrunchie|scarf|glove|beanie|hat\b)\b/i;

// Order matters — more specific patterns first to avoid false matches
// Use (?:s\b|\b) at end to handle plurals (e.g., "shorts" and "short")
const TYPE_PATTERNS: [ProductType, RegExp][] = [
  // Bras before tops (so "sports bra" doesn't match "top")
  ["bras", /\b(sports?\s*bras?|bralettes?|scoop\s*bras?|v-?neck\s*bras?|yoga\s*bras?|built-?in\s*bras?|\bbras?\b)/i],
  // Dresses before tops (so "t-shirt dress" matches dress)
  ["dresses", /\b(dress(?:es)?|gowns?)\b/i],
  // Jumpsuits before tops/pants
  ["jumpsuits", /\b(jumpsuits?|rompers?|playsuits?)\b/i],
  // Bodysuits before tops
  ["bodysuits", /\b(bodysuits?|unitards?|onesies?|catsuits?)\b/i],
  // Leggings before pants (includes flares)
  ["leggings", /\b(leggings?|capris?|7\/8\s*(?:pants?|leggings?)|flares?)\b/i],
  // Skirts
  ["skirts", /\b(skirts?|skorts?)\b/i],
  // Shorts before pants
  ["shorts", /\b((?<!sleeve\s)shorts?|biker\s*shorts?)\b/i],
  // Sweaters/knitwear
  ["sweaters", /\b(sweaters?|cardigans?|pullovers?|crewnecks?|turtlenecks?|jumpers?)\b/i],
  // Jackets/outerwear
  ["jackets", /\b(jackets?|hoodies?|sweatshirts?|half-?zips?|zip\s+jackets?|coats?|ponchos?|anoraks?|parkas?|robes?)\b/i],
  // Pants
  ["pants", /\b(pants?|trousers?|joggers?|sweatpants?|bootcuts?|cargos?|chinos?|jeans?|denims?)\b/i],
  // Tops (broadest — last)
  ["tops", /\b(tanks?|tees?\b|t-?shirts?|tops?\b|camis?|blouses?|longsleeves?|long\s+sleeves?|crops?\b|henleys?|polos?|singlets?|shirts?|vests?)\b/i],
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
  "activewear": undefined!, // too broad — fall through to name-based
  "active": undefined!,
  "loungewear": undefined!,
  "sleep apparel": undefined!,
};

export function isNonClothing(title: string): boolean {
  return NON_CLOTHING_KEYWORDS.test(title);
}

export function isAccessory(title: string): boolean {
  return ACCESSORY_KEYWORDS.test(title);
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
};

export function mapActivewearType(productType: ProductType): string {
  return ACTIVEWEAR_TYPE_MAP[productType] || "tops";
}

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
