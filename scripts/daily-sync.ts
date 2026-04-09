/**
 * daily-sync.ts — Orchestration script that runs both Shopify and catalog
 * sync pipelines in sequence. Designed for scheduled automation (e.g.
 * Claude Code Cloud Scheduled Tasks).
 *
 * Usage:
 *   npx tsx scripts/daily-sync.ts
 */

import { syncBrand, type BrandRow } from "./sync-shopify.js";
import { syncCatalogBrand, type CatalogBrandRow } from "./sync-catalog.js";
import { loadEnv, getSupabaseAdmin } from "./lib/env.js";

async function main() {
  const env = loadEnv();
  if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }

  const supabase = getSupabaseAdmin();
  const materialCache = new Map<string, string>();
  let hasErrors = false;

  console.log("═══════════════════════════════════════════════════════");
  console.log("DAILY SYNC — Starting automated product sync");
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // ─── 1. Shopify sync ──────────────────────────────────────────────

  console.log("▶ Phase 1: Shopify brands\n");

  const { data: shopifyBrands, error: shopifyError } = await supabase
    .from("brands")
    .select("id, name, slug, shopify_domain, is_fully_natural, scrape_fallback, audience")
    .not("shopify_domain", "is", null)
    .eq("sync_enabled", true);

  if (shopifyError) {
    console.error("Failed to fetch Shopify brands:", shopifyError.message);
    hasErrors = true;
  }

  const shopifyResults: Array<{ brand: string; status: string; detail: string }> = [];

  for (const brand of (shopifyBrands || []) as BrandRow[]) {
    try {
      const stats = await syncBrand(supabase, brand, { dryRun: false }, materialCache);
      const detail = `${stats.fetched} fetched, ${stats.inserted} synced, ${stats.availabilityUpdated} avail-updated`;
      shopifyResults.push({ brand: brand.name, status: stats.errors > 0 ? "WARN" : "OK", detail });
      if (stats.errors > 0) hasErrors = true;
    } catch (err) {
      shopifyResults.push({ brand: brand.name, status: "FAIL", detail: (err as Error).message });
      hasErrors = true;
    }
  }

  // ─── 2. Catalog sync ──────────────────────────────────────────────

  console.log("\n▶ Phase 2: Catalog brands\n");

  const { data: catalogBrands, error: catalogError } = await supabase
    .from("brands")
    .select("id, name, slug, website_url, is_fully_natural, scrape_fallback, shopify_domain, audience")
    .eq("sync_enabled", true)
    .not("website_url", "is", null)
    .or("shopify_domain.is.null,scrape_fallback.eq.true");

  if (catalogError) {
    console.error("Failed to fetch catalog brands:", catalogError.message);
    hasErrors = true;
  }

  const catalogResults: Array<{ brand: string; status: string; detail: string }> = [];

  for (const brand of (catalogBrands || []) as CatalogBrandRow[]) {
    try {
      const stats = await syncCatalogBrand(
        supabase,
        brand,
        { dryRun: false, discoverOnly: false },
        materialCache
      );
      const detail = `${stats.discovered} discovered, ${stats.inserted} synced, ${stats.availabilityUpdated} avail-updated`;
      catalogResults.push({ brand: brand.name, status: stats.errors > 0 ? "WARN" : "OK", detail });
      if (stats.errors > 0) hasErrors = true;
    } catch (err) {
      catalogResults.push({ brand: brand.name, status: "FAIL", detail: (err as Error).message });
      hasErrors = true;
    }
  }

  // ─── 3. Summary ───────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("DAILY SYNC SUMMARY");
  console.log("═══════════════════════════════════════════════════════\n");

  if (shopifyResults.length > 0) {
    console.log("Shopify brands:");
    for (const r of shopifyResults) {
      console.log(`  [${r.status}] ${r.brand}: ${r.detail}`);
    }
  }

  if (catalogResults.length > 0) {
    console.log("\nCatalog brands:");
    for (const r of catalogResults) {
      console.log(`  [${r.status}] ${r.brand}: ${r.detail}`);
    }
  }

  console.log(`\nFinished at: ${new Date().toISOString()}`);
  console.log(`Overall status: ${hasErrors ? "COMPLETED WITH ERRORS" : "SUCCESS"}`);

  if (hasErrors) process.exit(1);
}

main();
