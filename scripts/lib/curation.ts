/**
 * Shared curation policy logic for FIBER.
 * Used by both add-brand.ts and the Shopify sync pipeline.
 */

// ─── Constants ──────────────────────────────────────────────────────

export const BANNED_MATERIALS = ["polyester", "nylon", "acrylic", "polypropylene"];
const SYNTHETIC_STRETCH = ["elastane", "spandex", "lycra"];
const MAX_SYNTHETIC_PERCENT = 10;

/** Materials already in the database (from seed.sql) */
export const KNOWN_MATERIALS: Record<string, { is_natural: boolean; id: string }> = {
  "Merino Wool": { is_natural: true, id: "a1000000-0000-0000-0000-000000000001" },
  "Organic Cotton": { is_natural: true, id: "a1000000-0000-0000-0000-000000000002" },
  "Cashmere": { is_natural: true, id: "a1000000-0000-0000-0000-000000000003" },
  "Hemp": { is_natural: true, id: "a1000000-0000-0000-0000-000000000004" },
  "Tencel Lyocell": { is_natural: true, id: "a1000000-0000-0000-0000-000000000005" },
  "Silk": { is_natural: true, id: "a1000000-0000-0000-0000-000000000006" },
  "Spandex": { is_natural: false, id: "a1000000-0000-0000-0000-000000000007" },
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
  "Spandex", "Nylon", "Polyester", "Acrylic",
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

function isSyntheticStretch(name: string): boolean {
  return SYNTHETIC_STRETCH.includes(name.toLowerCase());
}

function isBannedMaterial(name: string): boolean {
  return BANNED_MATERIALS.some((b) => name.toLowerCase().includes(b));
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

/**
 * Determine sync status based on extraction quality.
 * "approved" (live on site), "review" (needs work), or "rejected" (banned).
 * Auto-approve when: confidence >= 0.80, all materials are trusted canonical
 * names, percentages sum to 100, no banned materials, price and image present.
 */
export function determineSyncStatus(
  extraction: { hasBanned: boolean; materials: Record<string, number>; confidence: number },
  price: number | null,
  imageUrl: string | null
): string {
  if (extraction.hasBanned) return "rejected";

  const materialNames = Object.keys(extraction.materials);
  const allTrusted = materialNames.every((m) => TRUSTED_MATERIALS.has(m));
  const total = Object.values(extraction.materials).reduce((a, b) => a + b, 0);

  if (allTrusted && total === 100 && extraction.confidence >= 0.80) {
    if (!price || price <= 0 || !imageUrl) return "review";
    return "approved";
  }
  return "review";
}
