/**
 * add-brand.ts — Validate and insert a brand into Supabase.
 * Products are handled separately by sync-shopify.ts (Shopify) or sync-catalog.ts (non-Shopify).
 *
 * Usage:
 *   npx tsx scripts/add-brand.ts --insert <input.json>   (validate + insert into DB)
 *   npx tsx scripts/add-brand.ts --dry-run <input.json>   (validate only)
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "./lib/curation.js";

// ─── Types ──────────────────────────────────────────────────────────

interface BrandInput {
  name: string;
  website_url: string;
  description: string;
  audience: string[];       // e.g. ["Women", "Men", "Kids"]
  fiber_types: string[];    // e.g. ["Organic Cotton", "Merino Wool"]
  categories: string[];     // e.g. ["Activewear", "Basics"]
  products?: unknown[];     // deprecated — ignored with warning
}

// ─── Logo Download ──────────────────────────────────────────────────

function downloadLogo(websiteUrl: string): Promise<boolean> {
  const domain = new URL(websiteUrl).hostname.replace(/^www\./, "");
  const outPath = path.resolve(__dirname, "..", "public", "logos", `${domain}.png`);

  if (fs.existsSync(outPath)) {
    console.log(`  Logo already exists: public/logos/${domain}.png`);
    return Promise.resolve(true);
  }

  const env = loadEnv();
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  if (!token) {
    console.log(`  ⚠ No LOGO_DEV_TOKEN — manually add logo to public/logos/${domain}.png`);
    return Promise.resolve(false);
  }

  const url = `https://img.logo.dev/${domain}?token=${token}&size=128&format=png`;
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        fs.unlinkSync(outPath);
        console.log(`  ⚠ Logo download failed (${res.statusCode}) — manually add public/logos/${domain}.png`);
        resolve(false);
        return;
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        console.log(`  ✓ Downloaded logo: public/logos/${domain}.png`);
        resolve(true);
      });
    }).on("error", () => {
      fs.unlinkSync(outPath);
      console.log(`  ⚠ Logo download failed — manually add public/logos/${domain}.png`);
      resolve(false);
    });
  });
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
  const brandSlug = slugify(brand.name);
  const supabase = getSupabaseAdmin();

  const brandFields = {
    name: brand.name,
    slug: brandSlug,
    description: brand.description,
    website_url: brand.website_url,
    is_fully_natural: true, // default, updated after catalog sync
    sync_enabled: true,
    audience: brand.audience,
    fiber_types: brand.fiber_types,
    categories: brand.categories,
  };

  const { data: brandData, error: brandError } = await supabase
    .from("brands")
    .upsert(brandFields, { onConflict: "slug", ignoreDuplicates: false })
    .select("id")
    .single();

  if (brandError) {
    console.error("Failed to upsert brand:", brandError.message);
    process.exit(1);
  }

  console.log(`\n✓ Brand ready: ${brand.name} (${brandData!.id})`)

  // Download logo
  await downloadLogo(brand.website_url);

  console.log(`\nNext: run 'npx tsx scripts/sync-catalog.ts --brand ${brandSlug}' to ingest products.`);
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const insert = args.includes("--insert");
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.error("Usage: npx tsx scripts/add-brand.ts [--insert | --dry-run] <input.json>");
    console.error("\n  --insert   Validate and insert into Supabase");
    console.error("  --dry-run  Validate only\n");
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
    process.exit(1);
  }

  // Warn if products array is present (deprecated)
  if (input.products && (input.products as unknown[]).length > 0) {
    console.warn(`\n⚠ Products array ignored — use 'npx tsx scripts/sync-catalog.ts --brand ${slugify(input.name)}' to ingest products.\n`);
  }

  const brandSlug = slugify(input.name);

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║           FIBER — Brand Validation               ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`Brand:      ${input.name}`);
  console.log(`Slug:       ${brandSlug}`);
  console.log(`Website:    ${input.website_url}`);
  console.log(`Audience:   ${input.audience.join(", ")}`);
  console.log(`Fibers:     ${input.fiber_types.join(", ")}`);
  console.log(`Categories: ${input.categories.join(", ")}`);
  console.log("\n✓ Brand metadata valid.");

  if (dryRun) {
    console.log("\nDry run — no changes made.");
    return;
  }

  if (insert) {
    await insertBrand(input);
    return;
  }

  // Default: just validate
  console.log(`\nRun with --insert to add to database.`);
}

main();
