# Scraping & Sync Pipeline

## What It Does

FIBER aggregates natural-fiber clothing from independent brands. The sync pipeline discovers products on brand websites, extracts material compositions, applies curation rules, and loads approved products into Supabase.

## Curation Rules

- **100% Natural**: zero synthetic fibers — listed as top tier
- **Nearly Natural**: up to 10% elastane/spandex allowed, rest must be natural or plant-derived
- **Banned**: polyester, nylon, acrylic, polypropylene in any amount → product rejected
- Semi-synthetics (Tencel, lyocell, modal, viscose) are treated as natural
- Non-clothing items (home goods, accessories, gift cards) are filtered out automatically

## Two Sync Pipelines

### Shopify (`scripts/sync-shopify.ts`)

For brands with a working Shopify `/products.json` API.

```
npx tsx scripts/sync-shopify.ts --brand <slug>         # regex pass
npx tsx scripts/sync-shopify.ts --llm --brand <slug>   # Gemini fallback for review products
```

- Fetches all products via Shopify API
- Extracts materials from `body_html` using regex + dictionary
- Auto-approves when: confidence >= 0.80, all trusted materials, percentages sum to 100%, price + image present
- Optional `scrape_fallback` flag: if body_html has no materials, scrapes the product page with Playwright
- Approved products: fast-path availability update only (`is_available` + `last_synced_at`), no re-extraction
- Rejected products: skipped entirely
- Removes products no longer in Shopify
- Sets `is_available` based on `variants.some(v => v.available)`

### Catalog (`scripts/sync-catalog.ts`)

For non-Shopify brands or brands that block their API.

```
npx tsx scripts/sync-catalog.ts --brand <slug>         # discover + scrape
npx tsx scripts/sync-catalog.ts --llm --brand <slug>   # re-scrape review products
npx tsx scripts/sync-catalog.ts --discover-only        # just list URLs
```

- Discovers product URLs via sitemap (preferred) or Playwright collection crawl (fallback)
- Scrapes each page with Playwright, extracts JSON-LD + meta tags + rendered text
- Same material extraction and curation logic as Shopify pipeline
- Approved products: fast-path availability update via scrape, no re-extraction
- Extracts `is_available` from JSON-LD `offers.availability` + DOM fallback ("Sold Out" button text)
- Brand-specific configs in `catalog-discoverer.ts` for URL patterns, collection paths, exclusions

## Material Extraction (`scripts/lib/material-extractor.ts`)

Three-stage pipeline:

1. **Regex** — pattern-matches "95% Organic Cotton, 5% Elastane" formats. Handles section splits (Body/Shell/Lining). Confidence: 0.85–0.95.
2. **Dictionary** — finds percentage + known material name in proximity. Catches formats regex misses. Confidence: 0.90.
3. **Gemini LLM** — batch fallback (up to 10 products per API call) for products where regex/dictionary fail. Only runs with `--llm` flag.

~150 alias mappings normalize variations ("organic merino wool" → "Organic Merino Wool", "elastane" → "Spandex", etc.) to canonical names. Only names in `TRUSTED_MATERIALS` (defined in `curation.ts`) are allowed in the database.

## Product Classification (`scripts/lib/product-classifier.ts`)

- **Product type**: regex patterns classify into tops, leggings, pants, bras, dresses, etc.
- **Category**: broad grouping (activewear, tops, bottoms, knitwear, outerwear, etc.)
- **Audience**: Women / Men / Unisex — inferred from tags, title, product type, or brand default
- **Non-clothing filter**: rejects home goods, accessories, gift cards. Lifestyle brands (e.g. Magic Linen, Rawganique) use whitelist mode — only recognized clothing types pass.

## Adding a Brand

```bash
# 1. Create input JSON
scripts/input/<slug>.json   # name, website_url, description, audience, fiber_types, categories

# 2. Validate and insert
npx tsx scripts/add-brand.ts --dry-run scripts/input/<slug>.json
npx tsx scripts/add-brand.ts --insert scripts/input/<slug>.json

# 3. Sync products
npx tsx scripts/sync-shopify.ts --brand <slug>    # if Shopify
npx tsx scripts/sync-catalog.ts --brand <slug>    # if non-Shopify
```

When user says "add brand X", use the agent prompt in `scripts/add-brand-agent.md`.

## Sync Statuses

| Status | Meaning |
|--------|---------|
| `approved` | Live on site. Auto-set when extraction is confident + data complete. |
| `review` | Needs manual review or LLM re-extraction. Missing materials, price, or image. |
| `rejected` | Contains banned materials or is non-clothing. Hidden from site. |

## Product Availability

Products have an `is_available` boolean column (defaults to `true`). Each sync run updates availability:

- **Shopify**: `variants.some(v => v.available)` — if any variant is in stock, it's available
- **Catalog**: JSON-LD `offers.availability` (InStock/OutOfStock/SoldOut), with DOM fallback checking button text
- **Shop page**: `filtered_product_ids` excludes sold-out products
- **Brand page**: shows all products (including sold-out) with "Sold Out" badge, available sorted first
- **Homepage/featured/related**: only shows available products

## Daily Sync (`scripts/daily-sync.ts`)

Orchestration script that runs both pipelines in sequence:

```
npx tsx scripts/daily-sync.ts
```

- Runs Shopify sync for all enabled brands, then catalog sync
- Per-brand try/catch — one failure doesn't stop others
- Prints summary table at the end
- Designed for Claude Code Cloud Scheduled Tasks (daily at 6:00 AM)
- Setup script: `npm install && npx playwright install chromium`

## Current Brand Status (2026-04-06)

**Synced** — Shopify brands + non-Shopify brands (Pact, Fair Indigo, Rawganique, Gil Rodriguez, Maggie's Organics, Vivid Linen, Kotn, Layere, Wayve Wear, Sold Out NYC, and others).

**Dropped** (not syncing): Everlane, Quince, prAna, Icebreaker. Brand records kept in DB but no products.

## Key Files

```
scripts/
├── sync-shopify.ts              # Shopify API sync
├── sync-catalog.ts              # Non-Shopify website scraper
├── daily-sync.ts                # Orchestrator — runs both pipelines
├── add-brand.ts                 # Brand registration + logo download
├── add-brand-agent.md           # Agent prompt for brand onboarding
├── delete-brand.ts              # Brand deletion
├── review-products.ts           # Interactive CLI product review
├── backfill-product-type.ts     # Batch product type update
├── backfill-audience.ts         # Batch audience classification
├── input/                       # Brand JSON files
└── lib/
    ├── material-extractor.ts    # Regex + dictionary + Gemini extraction
    ├── catalog-discoverer.ts    # Sitemap/crawl product URL discovery
    ├── page-scraper.ts          # Playwright page scraping + JSON-LD
    ├── product-classifier.ts    # Type, category, audience, non-clothing filter
    ├── shopify-fetcher.ts       # Shopify API client with retry
    ├── curation.ts              # Policy constants, validation, determineSyncStatus()
    ├── db-helpers.ts            # Material upsert + product-material sync
    └── env.ts                   # Shared env loading + Supabase client
```
