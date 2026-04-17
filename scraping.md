# Scraping & Sync Pipeline

## What It Does

FIBER aggregates natural-fiber clothing from independent brands. The sync pipeline discovers products on brand websites, extracts material compositions, applies curation rules, and loads approved products into Supabase.

Companion docs — keep them in sync when changing the pipeline:
- **`sync-next-steps.md`** — locator work, residual review queue, per-brand extraction notes.
- **`sync-reliability-plan.md`** — timeout/concurrency/telemetry policy, SQL playbook for post-mortems.
- **`scripts/add-brand-agent.md`** — prompt template the `add brand X` agent uses.

## Curation Rules

- **100% Natural**: literally only natural fibers — cotton, linen, hemp, wool, silk, cashmere, alpaca, and the like. No semi-synthetics, no synthetics, no blends.
- **Nearly Natural**: anything that isn't 100% natural but still passes curation — contains semi-synthetics (Tencel, lyocell, modal, viscose, rayon, cupro) and/or up to 10% elastane/spandex. Banned synthetics still disqualify.
- **Banned**: polyester, nylon, acrylic, polypropylene in any amount → product rejected outright.
- Semi-synthetics (Tencel, lyocell, modal, viscose) count as **non-natural** for tiering — products containing them land in Nearly Natural, not 100% Natural. Materials table: `is_natural = false` for these.
- Non-clothing items (home goods, accessories, gift cards) are filtered out automatically.

## Two Sync Pipelines

### Shopify (`scripts/sync-shopify.ts`)

For brands with a working Shopify `/products.json` API.

```
npx tsx scripts/sync-shopify.ts --brand <slug>                      # regex pass
npx tsx scripts/sync-shopify.ts --llm --brand <slug>                # Gemini fallback for review products
npx tsx scripts/sync-shopify.ts --dry-run --brand <slug>            # no writes, just print what would happen
npx tsx scripts/sync-shopify.ts --force-rescan --brand <slug>       # bypass body_hash + review cadence gates
```

- Fetches all products via Shopify API
- Routes each product through the locator registry (`scripts/brand-scrapers/registry.ts`) — brand-specific locator if one exists, otherwise `defaultLocator` (body_html → product_page → fallback scan)
- Auto-approves when: confidence >= 0.80, all trusted materials, percentages sum to 100%, price + image present
- Optional `scrape_fallback` flag: if body_html has no materials, scrapes the product page with Playwright
- Approved products: fast-path availability update only (`is_available` + `last_synced_at`), no re-extraction
- Rejected products: skipped entirely
- Body-hash skip gate: settled products whose `sha256(body_html)` matches the stored `products.body_hash` skip re-extraction
- Review cadence gate: pending/review products skip re-extraction when Shopify `updated_at` is unchanged AND `last_synced_at` is within `DEFAULT_REVIEW_CADENCE_DAYS` (3). `--force-rescan` bypasses this
- Non-clothing skip: when the classifier catches an item that's already in DB as pending/review, the row is flipped to `rejected` — stale review rows don't linger after the classifier learns a new category
- Removes products no longer in Shopify
- Sets `is_available` based on `variants.some(v => v.available)`
- Per-product work wrapped in a 60 s timeout; each brand has a 15 min wall-time ceiling — see `sync-reliability-plan.md`

### Catalog (`scripts/sync-catalog.ts`)

For non-Shopify brands or brands that block their API.

```
npx tsx scripts/sync-catalog.ts --brand <slug>              # discover + scrape
npx tsx scripts/sync-catalog.ts --llm --brand <slug>        # re-scrape review products
npx tsx scripts/sync-catalog.ts --dry-run --brand <slug>    # no writes
npx tsx scripts/sync-catalog.ts --force-rescan --brand <slug> # bypass body_hash gate
npx tsx scripts/sync-catalog.ts --discover-only --brand <slug> # just list URLs
```

- Discovers product URLs via sitemap (preferred) or Playwright collection crawl (fallback)
- Bounded concurrency pool (default 3 workers) shares a single Playwright browser — replaces the old strictly-serial loop
- Scrapes each page with Playwright, extracts JSON-LD + meta tags + rendered text
- Routes through the same locator registry as Shopify
- Same material extraction and curation logic as Shopify pipeline
- Approved products: fast-path availability update via scrape, no re-extraction
- Availability cadence gate keyed on `brands.last_availability_sweep_at` (only advanced on fully successful sweeps — partial sweeps don't fool the gate)
- Extracts `is_available` from JSON-LD `offers.availability` + DOM fallback ("Sold Out" button text)
- Brand-specific configs in `catalog-discoverer.ts` for URL patterns, collection paths, exclusions

### Locator registry (`scripts/brand-scrapers/`)

Both sync pipelines route per-product material extraction through a plugin registry so brand-specific quirks stay isolated from the shared pipeline code.

- `locators/types.ts` — `Locator`, `LocatorInput`, `LocatedComposition` contract
- `locators/default.ts` — body_html → product_page → fallback_scan (used when a brand has no entry)
- `locators/<brand>.ts` — one file per brand with custom extraction logic (8 shipped: `unbound-merino`, `pact`, `naadam`, `gil-rodriguez`, `jungmaven`, `pyne-and-smith`, `magic-linen`, `kowtow`)
- `shared/parsers.ts` — `stripHtml`, `parseDecimalComposition`, re-exports `extractMaterialsFromText`
- `shared/locate.ts` — `scanForFiberChunk` generic fallback scanner
- `registry.ts` — `getLocator(slug)` lookup returning the brand locator or `defaultLocator`

Locators are pure — they return raw composition data and never touch the DB or run curation. See `sync-next-steps.md` for the locator-writing pattern and residual-review queue status.

## Material Extraction (`scripts/lib/material-extractor.ts`)

Three-stage pipeline:

1. **Regex** — pattern-matches "95% Organic Cotton, 5% Elastane" formats. Handles section splits (Body/Shell/Lining). Confidence: 0.85–0.95.
2. **Dictionary** — finds percentage + known material name in proximity. Catches formats regex misses. Confidence: 0.90.
3. **Gemini LLM** — batch fallback (up to 10 products per API call) for products where regex/dictionary fail. Only runs with `--llm` flag. Wrapped in a 30 s timeout with a single retry and graceful empty-batch fallback.

~150 alias mappings normalize variations ("organic merino wool" → "Organic Merino Wool", "elastane" → "Spandex", etc.) to canonical names. Only names in `TRUSTED_MATERIALS` (defined in `curation.ts`) are allowed in the database.

The normalizer also strips ethical-sourcing prefixes (`fair trade`, `fair-trade`, `fairtrade`, `ethically sourced`, `responsibly sourced/grown`, `traceable`) before the alias lookup, so `"100% Fair Trade Organic Cotton"` normalizes to `{Organic Cotton: 100}`.

### Defensive guardrails

- **20 KB stripped-text input cap** (`EXTRACTOR_INPUT_CAP_BYTES` in `scripts/lib/sync-reliability.ts`). `extractFromCombinedText` slices long inputs before the regex passes — contains the catastrophic-backtracking class of bugs at source.
- **60 s per-product timeout** wraps the full locator → extract → image → DB path. Timeouts are recorded in `sync_run_failures` with stage + duration; the product is left in `review`.

See `sync-reliability-plan.md` for the full timeout/concurrency/telemetry policy.

## Product Classification (`scripts/lib/product-classifier.ts`)

- **Product type**: regex patterns classify into tops, leggings, pants, bras, dresses, etc.
- **Category**: broad grouping (activewear, tops, bottoms, knitwear, outerwear, etc.)
- **Audience**: Women / Men / Unisex — inferred from tags, title, product type, or brand default
- **Non-clothing filter** has two paths:
  - **Title keywords** (`NON_CLOTHING_KEYWORDS`) — rejects home goods, accessories, gift cards, footwear-by-name (shoes, sneakers, sandals, boots, etc.) via title matching.
  - **Shopify `product_type`** (`NON_CLOTHING_PRODUCT_TYPES`) — rejects items whose title doesn't name the category but whose Shopify type does. Covers footwear categories (`Sneaker`, `Sandal`, `Shoe`, `Boot`, `Slipper`, `Pump`, `Heel`, `Loafer`, `Moccasin`, `Flip Flop`). Motivating case: Kowtow's "Artisanal Pump"/"V-90 O.T. Leather"/"Campo Chromefree Leather" style leather collabs tagged `Sneaker`/`Sandal`/`Shoe` in Shopify.
- **Lifestyle brands** (e.g. Magic Linen, Rawganique) use whitelist mode — only recognized clothing types pass.

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

## Current Brand Status (2026-04-13)

**33 total brands. 25 sync-enabled, 8 disabled.** Every sync-enabled brand runs successfully through the reliability machinery (0 timeouts, 0 wall-time aborts across the latest run).

**Sync-enabled (25)** — 20 Shopify: `allwear`, `aya`, `beaumont-organic`, `happy-earth-apparel`, `harvest-and-mill`, `indigo-luna`, `industry-of-all-nations`, `jungmaven`, `kowtow`, `layere`, `losano`, `magic-linen`, `mate-the-label`, `nads`, `naadam`, `plainandsimple`, `pyne-and-smith`, `ryker`, `sold-out-nyc`, `unbound-merino`. 5 Catalog: `branwyn`, `gil-rodriguez`, `kotn`, `pact`, `wayve-wear`.

**Disabled** (`sync_enabled: false`, 8): `maggies-organics`, `vivid-linen`, `quince`, `icebreaker`, `prana`, `rawganique`, `everlane`, `fair-indigo`. Brand records kept in DB but no products. Everlane & prAna were dropped for diminishing returns; the rest are legacy.

Per-brand approved/review/rejected counts and session notes live in `sync-next-steps.md`.

## Key Files

```
scripts/
├── sync-shopify.ts              # Shopify API sync
├── sync-catalog.ts              # Non-Shopify website scraper
├── daily-sync.ts                # Orchestrator — runs both pipelines + LLM pass
├── add-brand.ts                 # Brand registration + logo download
├── add-brand-agent.md           # Agent prompt for brand onboarding
├── delete-brand.ts              # Brand deletion
├── review-products.ts           # Interactive CLI product review
├── backfill-product-type.ts     # Batch product type update
├── backfill-audience.ts         # Batch audience classification
├── input/                       # Brand JSON files
├── brand-scrapers/              # Per-brand locator plugins
│   ├── registry.ts              # getLocator(slug) lookup
│   ├── locators/
│   │   ├── types.ts             # Locator / LocatorInput / LocatedComposition contract
│   │   ├── default.ts           # body_html → product_page → fallback_scan
│   │   └── <brand>.ts           # One file per brand (8 shipped)
│   └── shared/
│       ├── parsers.ts           # stripHtml, parseDecimalComposition
│       └── locate.ts            # scanForFiberChunk generic fallback
└── lib/
    ├── material-extractor.ts    # Regex + dictionary + Gemini extraction
    ├── sync-reliability.ts      # withTimeout, runWithConcurrency, SyncRunRecorder, timeout constants
    ├── catalog-discoverer.ts    # Sitemap/crawl product URL discovery
    ├── page-scraper.ts          # Playwright page scraping + JSON-LD
    ├── product-classifier.ts    # Type, category, audience, non-clothing filter
    ├── shopify-fetcher.ts       # Shopify API client with retry
    ├── curation.ts              # Policy constants, validation, determineSyncStatus()
    ├── db-helpers.ts            # Material upsert + product-material sync
    └── env.ts                   # Shared env loading + Supabase client
```
