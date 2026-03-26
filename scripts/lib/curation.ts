/**
 * Shared curation policy logic for FIBER.
 * Used by both add-brand.ts and the Shopify sync pipeline.
 */

// ─── Constants ──────────────────────────────────────────────────────

export const BANNED_MATERIALS = ["polyester", "nylon", "acrylic", "polypropylene"];
export const SYNTHETIC_STRETCH = ["elastane", "spandex", "lycra"];
export const MAX_SYNTHETIC_PERCENT = 10;

/** Materials already in the database (from seed.sql) */
export const KNOWN_MATERIALS: Record<string, { is_natural: boolean; id: string }> = {
  "Merino Wool": { is_natural: true, id: "a1000000-0000-0000-0000-000000000001" },
  "Organic Cotton": { is_natural: true, id: "a1000000-0000-0000-0000-000000000002" },
  "Cashmere": { is_natural: true, id: "a1000000-0000-0000-0000-000000000003" },
  "Hemp": { is_natural: true, id: "a1000000-0000-0000-0000-000000000004" },
  "Tencel Lyocell": { is_natural: true, id: "a1000000-0000-0000-0000-000000000005" },
  "Silk": { is_natural: true, id: "a1000000-0000-0000-0000-000000000006" },
  "Elastane": { is_natural: false, id: "a1000000-0000-0000-0000-000000000007" },
};

/**
 * Trusted canonical material names — the only names we allow in the DB.
 * If a material name isn't in this set, it's either garbage from regex or needs normalization.
 */
export const TRUSTED_MATERIALS = new Set([
  // Natural fibers
  "Organic Cotton", "Cotton", "Merino Wool", "Wool", "Cashmere", "Silk", "Hemp",
  "Linen", "Alpaca", "Mohair", "Yak", "Lambswool",
  // Plant-derived / regenerated cellulose
  "Tencel Lyocell", "Modal", "Viscose", "Rayon", "Cupro", "Bamboo Lyocell",
  // Cotton variants
  "Pima Cotton", "Organic Pima Cotton", "Egyptian Cotton",
  // Wool variants
  "Organic Merino Wool",
  // Synthetics (tracked for curation)
  "Elastane", "Nylon", "Polyester", "Acrylic",
]);

/** Additional materials we recognize (not yet in DB — will be inserted if used) */
export const EXTRA_NATURAL_FIBERS: Record<string, string> = {
  "Linen": "Flax-based fiber, breathable and durable.",
  "Alpaca": "Soft, warm fiber from alpaca fleece.",
  "Wool": "Natural animal fiber, warm and moisture-wicking.",
  "Cotton": "Conventional cotton fiber.",
  "Pima Cotton": "Extra-long staple cotton, exceptionally soft.",
  "Egyptian Cotton": "Premium long-staple cotton from Egypt.",
  "Bamboo Lyocell": "Regenerated cellulose fiber from bamboo pulp.",
  "Modal": "Semi-synthetic fiber from beech tree pulp.",
  "Viscose": "Regenerated cellulose fiber from wood pulp.",
  "Rayon": "Regenerated cellulose fiber.",
  "Cupro": "Regenerated cellulose from cotton linter.",
  "Yak": "Soft, warm fiber from yak undercoat.",
  "Mohair": "Lustrous fiber from Angora goats.",
  "Organic Pima Cotton": "Organically grown extra-long staple cotton.",
  "Organic Merino Wool": "Merino wool from organically raised sheep.",
  "Spandex": "Synthetic stretch fiber (alias for Elastane).",
};

// ─── Helpers ────────────────────────────────────────────────────────

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''"]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isSyntheticStretch(name: string): boolean {
  return SYNTHETIC_STRETCH.includes(name.toLowerCase());
}

export function isBannedMaterial(name: string): boolean {
  return BANNED_MATERIALS.some((b) => name.toLowerCase().includes(b));
}

export function isKnownNatural(name: string): boolean {
  const known = KNOWN_MATERIALS[name];
  if (known) return known.is_natural;
  return name in EXTRA_NATURAL_FIBERS && !isSyntheticStretch(name);
}

// ─── Validation ─────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  tier: "100% Natural" | "Nearly Natural" | null;
  errors: string[];
  warnings: string[];
}

export interface ProductMaterials {
  name: string;
  materials: Record<string, number>;
  category?: string;
  price?: number;
}

export function validateProduct(product: ProductMaterials, index: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = `Product #${index + 1} "${product.name}"`;

  if (!product.name) errors.push(`${prefix}: missing name`);
  if (product.category !== undefined && !product.category) errors.push(`${prefix}: missing category`);
  if (product.price !== undefined && (!product.price || product.price <= 0)) errors.push(`${prefix}: invalid price`);
  if (!product.materials || Object.keys(product.materials).length === 0) {
    errors.push(`${prefix}: no materials specified`);
    return { valid: false, tier: null, errors, warnings };
  }

  const total = Object.values(product.materials).reduce((a, b) => a + b, 0);
  if (total !== 100) {
    errors.push(`${prefix}: material percentages sum to ${total}%, must be 100%`);
  }

  let syntheticPercent = 0;
  for (const [material, pct] of Object.entries(product.materials)) {
    if (pct <= 0 || pct > 100) {
      errors.push(`${prefix}: "${material}" has invalid percentage ${pct}%`);
    }

    if (isBannedMaterial(material)) {
      errors.push(
        `${prefix}: "${material}" is BANNED — polyester, nylon, and acrylic are never allowed`
      );
      continue;
    }

    if (isSyntheticStretch(material)) {
      syntheticPercent += pct;
    }

    if (!KNOWN_MATERIALS[material] && !(material in EXTRA_NATURAL_FIBERS)) {
      warnings.push(
        `${prefix}: "${material}" is not in the recognized materials list — verify manually`
      );
    }
  }

  if (syntheticPercent > MAX_SYNTHETIC_PERCENT) {
    errors.push(
      `${prefix}: synthetic content is ${syntheticPercent}% (max ${MAX_SYNTHETIC_PERCENT}%)`
    );
  }

  if (errors.length > 0) {
    return { valid: false, tier: null, errors, warnings };
  }

  const tier: "100% Natural" | "Nearly Natural" =
    syntheticPercent === 0 ? "100% Natural" : "Nearly Natural";

  if (syntheticPercent > 0) {
    warnings.push(`${prefix}: ${syntheticPercent}% synthetic → classified as "Nearly Natural"`);
  }

  return { valid: true, tier, errors, warnings };
}

/**
 * Determine the material description for a given name.
 * Returns null if the material is completely unknown.
 */
export function getMaterialDescription(name: string): string | null {
  if (KNOWN_MATERIALS[name]) return null; // already in DB
  if (name in EXTRA_NATURAL_FIBERS) return EXTRA_NATURAL_FIBERS[name];
  return `${name} fiber.`;
}

/**
 * Check if a material is natural (not synthetic stretch or banned).
 */
export function isMaterialNatural(name: string): boolean {
  if (KNOWN_MATERIALS[name]) return KNOWN_MATERIALS[name].is_natural;
  return !isSyntheticStretch(name) && !isBannedMaterial(name);
}

/**
 * Check if an extraction result contains banned materials or exceeds synthetic limits.
 */
export function isExtractionBanned(extraction: { hasBanned: boolean; materials: Record<string, number> }): boolean {
  if (extraction.hasBanned) return true;
  let syntheticPct = 0;
  for (const [name, pct] of Object.entries(extraction.materials)) {
    if (isBannedMaterial(name)) return true;
    if (isSyntheticStretch(name)) syntheticPct += pct;
  }
  return syntheticPct > MAX_SYNTHETIC_PERCENT;
}
