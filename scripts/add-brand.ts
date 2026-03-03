/**
 * add-brand.ts — Validate a brand + products against FIBER curation policy
 *                and insert into Supabase (or generate SQL).
 *
 * Usage:
 *   npx tsx scripts/add-brand.ts --insert <input.json>   (validate + insert into DB)
 *   npx tsx scripts/add-brand.ts <input.json>             (validate + generate SQL file)
 *   npx tsx scripts/add-brand.ts --dry-run <input.json>   (validate only)
 *
 * See scripts/brand-template.json for the expected input format.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Curation Policy ────────────────────────────────────────────────

const BANNED_MATERIALS = ["polyester", "nylon", "acrylic", "polypropylene"];
const SYNTHETIC_STRETCH = ["elastane", "spandex", "lycra"];
const MAX_SYNTHETIC_PERCENT = 10;

// Materials already in the database (from seed.sql)
const KNOWN_MATERIALS: Record<string, { is_natural: boolean; id: string }> = {
  "Merino Wool": { is_natural: true, id: "a1000000-0000-0000-0000-000000000001" },
  "Organic Cotton": { is_natural: true, id: "a1000000-0000-0000-0000-000000000002" },
  "Cashmere": { is_natural: true, id: "a1000000-0000-0000-0000-000000000003" },
  "Hemp": { is_natural: true, id: "a1000000-0000-0000-0000-000000000004" },
  "Tencel Lyocell": { is_natural: true, id: "a1000000-0000-0000-0000-000000000005" },
  "Silk": { is_natural: true, id: "a1000000-0000-0000-0000-000000000006" },
  "Elastane": { is_natural: false, id: "a1000000-0000-0000-0000-000000000007" },
};

// Additional materials we recognize (not yet in DB — will be inserted if used)
const EXTRA_NATURAL_FIBERS: Record<string, string> = {
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

// ─── Types ──────────────────────────────────────────────────────────

interface ProductInput {
  name: string;
  description: string;
  category: string;
  price: number;
  affiliate_url?: string;
  image_url?: string;
  is_featured?: boolean;
  materials: Record<string, number>; // material name → percentage
}

interface BrandInput {
  name: string;
  website_url: string;
  description: string;
  audience: string[];       // e.g. ["Women", "Men", "Kids"]
  fiber_types: string[];    // e.g. ["Organic Cotton", "Merino Wool"]
  categories: string[];     // e.g. ["Activewear", "Basics"]
  products?: ProductInput[];
}

interface ValidationResult {
  valid: boolean;
  tier: "100% Natural" | "Nearly Natural" | null;
  errors: string[];
  warnings: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''"]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

function uuid(): string {
  return crypto.randomUUID();
}

function isSyntheticStretch(name: string): boolean {
  return SYNTHETIC_STRETCH.includes(name.toLowerCase());
}

function isBannedMaterial(name: string): boolean {
  return BANNED_MATERIALS.some((b) => name.toLowerCase().includes(b));
}

function isKnownNatural(name: string): boolean {
  const known = KNOWN_MATERIALS[name];
  if (known) return known.is_natural;
  return name in EXTRA_NATURAL_FIBERS && !isSyntheticStretch(name);
}

// ─── Validation ─────────────────────────────────────────────────────

function validateProduct(product: ProductInput, index: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = `Product #${index + 1} "${product.name}"`;

  // Check required fields
  if (!product.name) errors.push(`${prefix}: missing name`);
  if (!product.category) errors.push(`${prefix}: missing category`);
  if (!product.price || product.price <= 0) errors.push(`${prefix}: invalid price`);
  if (!product.materials || Object.keys(product.materials).length === 0) {
    errors.push(`${prefix}: no materials specified`);
    return { valid: false, tier: null, errors, warnings };
  }

  // Check percentages sum to 100
  const total = Object.values(product.materials).reduce((a, b) => a + b, 0);
  if (total !== 100) {
    errors.push(`${prefix}: material percentages sum to ${total}%, must be 100%`);
  }

  // Check each material
  let syntheticPercent = 0;
  for (const [material, pct] of Object.entries(product.materials)) {
    if (pct <= 0 || pct > 100) {
      errors.push(`${prefix}: "${material}" has invalid percentage ${pct}%`);
    }

    // Banned material check
    if (isBannedMaterial(material)) {
      errors.push(
        `${prefix}: "${material}" is BANNED — polyester, nylon, and acrylic are never allowed`
      );
      continue;
    }

    // Synthetic stretch check
    if (isSyntheticStretch(material)) {
      syntheticPercent += pct;
    }

    // Unknown material warning
    if (!KNOWN_MATERIALS[material] && !(material in EXTRA_NATURAL_FIBERS)) {
      warnings.push(
        `${prefix}: "${material}" is not in the recognized materials list — verify manually`
      );
    }
  }

  // Synthetic limit
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

// ─── SQL Generation ─────────────────────────────────────────────────

function generateSQL(brand: BrandInput): string {
  const products = brand.products || [];
  const brandId = uuid();
  const brandSlug = slugify(brand.name);

  // Validate all products first
  const results = products.map((p, i) => ({ product: p, ...validateProduct(p, i) }));
  const allErrors = results.flatMap((r) => r.errors);

  printReport(brand, results);

  if (allErrors.length > 0) {
    process.exit(1);
  }

  // Collect new materials that need INSERT
  const newMaterials: Map<string, { id: string; description: string; is_natural: boolean }> = new Map();
  for (const p of products) {
    for (const material of Object.keys(p.materials)) {
      if (!KNOWN_MATERIALS[material] && !newMaterials.has(material)) {
        const desc = EXTRA_NATURAL_FIBERS[material] || `${material} fiber.`;
        const isNat = !isSyntheticStretch(material);
        newMaterials.set(material, { id: uuid(), description: desc, is_natural: isNat });
      }
    }
  }

  // Build material ID lookup (known + new)
  const materialIds: Record<string, string> = {};
  for (const [name, info] of Object.entries(KNOWN_MATERIALS)) {
    materialIds[name] = info.id;
  }
  for (const [name, info] of newMaterials) {
    materialIds[name] = info.id;
  }

  // Determine is_fully_natural
  const isFullyNatural =
    products.length === 0
      ? true // default for brand-only entries, can be overridden
      : results.every((r) => r.tier === "100% Natural");

  // ─── Generate SQL ───
  const lines: string[] = [];
  lines.push(`-- =============================================`);
  lines.push(`-- Add Brand: ${brand.name}`);
  lines.push(`-- Generated by scripts/add-brand.ts`);
  lines.push(`-- =============================================\n`);

  // New materials
  if (newMaterials.size > 0) {
    lines.push(`-- New materials`);
    for (const [name, info] of newMaterials) {
      lines.push(
        `INSERT INTO materials (id, name, description, is_natural) VALUES` +
          `\n  ('${info.id}', '${escapeSQL(name)}', '${escapeSQL(info.description)}', ${info.is_natural})` +
          `\nON CONFLICT (name) DO NOTHING;\n`
      );
    }
  }

  // Brand
  const audienceArr = `'{${brand.audience.join(",")}}'`;
  const fiberArr = `'{${brand.fiber_types.map(escapeSQL).join(",")}}'`;
  const catArr = `'{${brand.categories.join(",")}}'`;

  lines.push(`-- Brand`);
  lines.push(
    `INSERT INTO brands (id, name, slug, description, website_url, is_fully_natural, audience, fiber_types, categories) VALUES` +
      `\n  ('${brandId}', '${escapeSQL(brand.name)}', '${brandSlug}', '${escapeSQL(brand.description)}', '${escapeSQL(brand.website_url)}', ${isFullyNatural}, ${audienceArr}, ${fiberArr}, ${catArr})` +
      `\nON CONFLICT (slug) DO NOTHING;\n`
  );

  // Products
  if (products.length > 0) {
    lines.push(`-- Products`);
    for (const product of products) {
      const productId = uuid();
      const productSlug = `${brandSlug}-${slugify(product.name)}`;
      const imageUrl = product.image_url || `/products/${productSlug}.jpg`;
      const affiliateUrl = product.affiliate_url || "";
      const isFeatured = product.is_featured ?? false;

      lines.push(
        `INSERT INTO products (id, brand_id, name, slug, description, category, price, image_url, affiliate_url, is_featured) VALUES` +
          `\n  ('${productId}', '${brandId}', '${escapeSQL(product.name)}', '${productSlug}',` +
          `\n   '${escapeSQL(product.description)}',` +
          `\n   '${escapeSQL(product.category)}', ${product.price.toFixed(2)}, '${escapeSQL(imageUrl)}',` +
          `\n   '${escapeSQL(affiliateUrl)}', ${isFeatured});\n`
      );

      // Product-material mappings
      const materialEntries = Object.entries(product.materials);
      if (materialEntries.length > 0) {
        const values = materialEntries
          .map(([mat, pct]) => `  ('${productId}', '${materialIds[mat]}', ${pct})`)
          .join(",\n");
        lines.push(
          `INSERT INTO product_materials (product_id, material_id, percentage) VALUES\n${values};\n`
        );
      }
    }
  }

  return lines.join("\n");
}

// ─── Env Loading ────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function getSupabaseAdmin(): SupabaseClient {
  const env = loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
    process.exit(1);
  }

  return createClient(url, key);
}

// ─── DB Insertion ───────────────────────────────────────────────────

async function insertBrand(brand: BrandInput): Promise<void> {
  const products = brand.products || [];
  const brandSlug = slugify(brand.name);

  // Validate first
  const results = products.map((p, i) => ({ product: p, ...validateProduct(p, i) }));
  const allErrors = results.flatMap((r) => r.errors);
  printReport(brand, results);

  if (allErrors.length > 0) {
    process.exit(1);
  }

  const supabase = getSupabaseAdmin();

  // Determine is_fully_natural
  const isFullyNatural =
    products.length === 0 ? true : results.every((r) => r.tier === "100% Natural");

  // 1. Insert new materials
  const materialIds: Record<string, string> = {};
  for (const [name, info] of Object.entries(KNOWN_MATERIALS)) {
    materialIds[name] = info.id;
  }

  for (const product of products) {
    for (const material of Object.keys(product.materials)) {
      if (materialIds[material]) continue;

      const desc = EXTRA_NATURAL_FIBERS[material] || `${material} fiber.`;
      const isNat = !isSyntheticStretch(material);

      // Check if material already exists in DB
      const { data: existing } = await supabase
        .from("materials")
        .select("id")
        .eq("name", material)
        .single();

      if (existing) {
        materialIds[material] = existing.id;
        console.log(`  Material "${material}" already in DB (${existing.id})`);
      } else {
        const { data: inserted, error } = await supabase
          .from("materials")
          .insert({ name: material, description: desc, is_natural: isNat })
          .select("id")
          .single();

        if (error) {
          console.error(`Failed to insert material "${material}":`, error.message);
          process.exit(1);
        }
        materialIds[material] = inserted!.id;
        console.log(`  ✓ Inserted material: ${material} (${inserted!.id})`);
      }
    }
  }

  // 2. Insert brand
  const { data: brandData, error: brandError } = await supabase
    .from("brands")
    .insert({
      name: brand.name,
      slug: brandSlug,
      description: brand.description,
      website_url: brand.website_url,
      is_fully_natural: isFullyNatural,
      audience: brand.audience,
      fiber_types: brand.fiber_types,
      categories: brand.categories,
    })
    .select("id")
    .single();

  if (brandError) {
    if (brandError.code === "23505") {
      console.error(`Brand "${brand.name}" (slug: ${brandSlug}) already exists.`);
    } else {
      console.error("Failed to insert brand:", brandError.message);
    }
    process.exit(1);
  }

  const brandId = brandData!.id;
  console.log(`\n✓ Inserted brand: ${brand.name} (${brandId})`);

  // 3. Insert products + product_materials
  for (const product of products) {
    const productSlug = `${brandSlug}-${slugify(product.name)}`;
    const imageUrl = product.image_url || `/products/${productSlug}.jpg`;

    const { data: prodData, error: prodError } = await supabase
      .from("products")
      .insert({
        brand_id: brandId,
        name: product.name,
        slug: productSlug,
        description: product.description,
        category: product.category,
        price: product.price,
        image_url: imageUrl,
        affiliate_url: product.affiliate_url || "",
        is_featured: product.is_featured ?? false,
      })
      .select("id")
      .single();

    if (prodError) {
      console.error(`Failed to insert product "${product.name}":`, prodError.message);
      process.exit(1);
    }

    const productId = prodData!.id;

    // Insert product_materials
    const pmRows = Object.entries(product.materials).map(([mat, pct]) => ({
      product_id: productId,
      material_id: materialIds[mat],
      percentage: pct,
    }));

    const { error: pmError } = await supabase.from("product_materials").insert(pmRows);

    if (pmError) {
      console.error(`Failed to insert materials for "${product.name}":`, pmError.message);
      process.exit(1);
    }

    console.log(`  ✓ ${product.name} (${Object.entries(product.materials).map(([m, p]) => `${p}% ${m}`).join(", ")})`);
  }

  console.log(`\nDone! Inserted ${brand.name} with ${products.length} product(s).`);
}

// ─── Report Printing ────────────────────────────────────────────────

function printReport(
  brand: BrandInput,
  results: Array<{ product: ProductInput } & ValidationResult>
) {
  const products = brand.products || [];
  const brandSlug = slugify(brand.name);
  const allErrors = results.flatMap((r) => r.errors);
  const allWarnings = results.flatMap((r) => r.warnings);

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║           FIBER — Brand Validation Report        ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`Brand:      ${brand.name}`);
  console.log(`Slug:       ${brandSlug}`);
  console.log(`Website:    ${brand.website_url}`);
  console.log(`Audience:   ${(brand.audience || []).join(", ") || "(none)"}`);
  console.log(`Fibers:     ${(brand.fiber_types || []).join(", ") || "(none)"}`);
  console.log(`Categories: ${(brand.categories || []).join(", ") || "(none)"}`);
  console.log(`Products:   ${products.length}`);

  if (products.length > 0) {
    const allNatural = results.every((r) => r.tier === "100% Natural");
    console.log(
      `Tier:     ${allNatural ? "Fully Natural (all products 100% natural)" : "Mixed / Nearly Natural"}`
    );
    console.log("");

    for (const r of results) {
      const icon = r.valid ? "✓" : "✗";
      console.log(`  ${icon} ${r.product.name} → ${r.tier || "INVALID"}`);
      for (const [mat, pct] of Object.entries(r.product.materials)) {
        console.log(`      ${pct}% ${mat}`);
      }
    }
  } else {
    console.log(`Tier:     Brand-only (no products yet)`);
  }

  if (allWarnings.length > 0) {
    console.log("\n⚠ Warnings:");
    for (const w of allWarnings) console.log(`  ${w}`);
  }

  if (allErrors.length > 0) {
    console.log("\n✗ Errors:");
    for (const e of allErrors) console.log(`  ${e}`);
    console.log("\nFix errors above before inserting.");
  } else {
    console.log("\n✓ All validations passed.");
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const insert = args.includes("--insert");
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.error("Usage: npx tsx scripts/add-brand.ts [--insert | --dry-run] <input.json>");
    console.error("\n  --insert   Validate and insert directly into Supabase");
    console.error("  --dry-run  Validate only, no SQL or insertion");
    console.error("  (default)  Validate and generate SQL file\n");
    console.error("See scripts/brand-template.json for the expected format.");
    process.exit(1);
  }

  let input: BrandInput;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    input = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err);
    process.exit(1);
  }

  if (!input.name || !input.website_url) {
    console.error("Input must have at least 'name' and 'website_url'.");
    process.exit(1);
  }

  // Validate brand metadata
  const missing: string[] = [];
  if (!input.audience || input.audience.length === 0) missing.push("audience");
  if (!input.fiber_types || input.fiber_types.length === 0) missing.push("fiber_types");
  if (!input.categories || input.categories.length === 0) missing.push("categories");
  if (missing.length > 0) {
    console.error(`Missing required brand metadata: ${missing.join(", ")}`);
    console.error("Each must be a non-empty array. See brand-template.json.");
    process.exit(1);
  }

  if (dryRun) {
    const products = input.products || [];
    console.log(`\nDry run — validating ${products.length} product(s)...\n`);
    let hasErrors = false;
    for (let i = 0; i < products.length; i++) {
      const result = validateProduct(products[i], i);
      const icon = result.valid ? "✓" : "✗";
      console.log(`${icon} ${products[i].name} → ${result.tier || "INVALID"}`);
      for (const e of result.errors) console.log(`    ERROR: ${e}`);
      for (const w of result.warnings) console.log(`    WARN: ${w}`);
      if (!result.valid) hasErrors = true;
    }
    process.exit(hasErrors ? 1 : 0);
  }

  if (insert) {
    await insertBrand(input);
    return;
  }

  // Default: generate SQL
  const sql = generateSQL(input);
  const outPath = `scripts/output/${slugify(input.name)}.sql`;
  fs.mkdirSync("scripts/output", { recursive: true });
  fs.writeFileSync(outPath, sql);
  console.log(`SQL written to: ${outPath}`);
  console.log("\n--- SQL Preview ---\n");
  console.log(sql);
}

main();
