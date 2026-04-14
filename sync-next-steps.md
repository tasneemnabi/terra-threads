# Sync Pipeline — Next Steps

Context for a fresh session picking up Phase 6 locator work. See also
`sync-reliability-plan.md` for the timeout / concurrency / telemetry layer.

## Current state (2026-04-13 late night — post-Beaumont locator + residual sweep)

### Infrastructure
- Migration 015 is applied: `products.body_hash`, `products.source_updated_at`, `brands.availability_cadence_days`.
- Migration 016 is applied: `sync_runs`, `sync_run_brands`, `sync_run_failures` telemetry tables + `brands.last_availability_sweep_at`.
- `scripts/brand-scrapers/` holds the plugin infra:
  - `locators/types.ts` — `Locator`, `LocatorInput`, `LocatedComposition` contract
  - `locators/default.ts` — body_html → product_page → fallback_scan
  - `shared/parsers.ts` — `parseDecimalComposition`, `stripHtml`, re-exports `extractMaterialsFromText`
  - `shared/locate.ts` — `scanForFiberChunk`
  - `registry.ts` — `getLocator(slug)` lookup
- `scripts/lib/sync-reliability.ts` holds the new reliability primitives: `withTimeout`, `runWithConcurrency`, `SyncRunRecorder`, `BrandRunContext`, plus all timeout constants in one place.
- `sync-shopify.ts` and `sync-catalog.ts` route through the locator, gate re-processing on `body_hash`, and log locator source distribution. Per-product work is wrapped in a 60 s timeout and each brand has a 15 min wall-time ceiling.
- `sync-catalog.ts` uses a bounded concurrency pool (default 3 workers sharing one browser) replacing the previous strictly-serial loop.
- `sync-shopify.ts` has a new review cadence gate: pending/review products skip re-extraction when Shopify's `updated_at` is unchanged AND `last_synced_at` is within `DEFAULT_REVIEW_CADENCE_DAYS` (default 3).
- `daily-sync.ts` creates a `sync_runs` row on startup, passes `BrandRunContext` into each brand call, and prints a diagnostic summary (slowest brands by total time, slowest by scrape time, brands with failures, brands aborted by wall-time, skip ratio).
- `daily-sync.ts` runs Phase 3 `onlyLocatorMissed: true` LLM pass after both sync phases.
- Gemini `generateContent` is wrapped in a 30 s timeout with a single retry + graceful empty-batch fallback.
- `material-extractor.ts` has a 20 KB stripped-text input cap before the regex passes — the defensive layer that contains the old catastrophic-backtracking bug at source.
- `material-extractor.ts` normalizer strips ethical-sourcing prefixes (`fair trade`, `ethically sourced`, `responsibly sourced/grown`, `traceable`) before the alias lookup, plus pre-collapses hyphenated variants (`fair-trade`, `fairtrade`). Fixes the Kowtow "100% Fair Trade Organic Cotton" case where 52 clothing items had been wrongly classified as rejected.
- Banned-product locator churn is fixed — banned branches in both sync scripts write `body_hash` + `sync_status: 'rejected'` so the next run short-circuits via the settled-status skip.
- URL discovery regex anchored to reject locale-prefixed paths (`/en-au/products/…`, `/en-ca/products/…`, etc.) — cut Gil Rodriguez discovery 500 → 255 URLs, halving scrape time.
- Product classifier now rejects by Shopify `product_type` in addition to title keywords — `NON_CLOTHING_PRODUCT_TYPES` regex matches `Sneaker`, `Sandal`, `Shoe`, `Boot`, `Slipper`, `Pump`, `Heel`, `Loafer`, etc. Motivating case: Kowtow's leather-footwear collabs (Artisanal Pump, Etna Leather, V-90 O.T. Leather, Campo Chromefree Leather, Volley O.T. Leather) named without any shoe keyword in the title but reliably tagged `Sneaker`/`Sandal`/`Shoe` in Shopify. Classifier reason: `non-clothing-type`.
- Non-clothing skip in `sync-shopify.ts` now flips existing pending/review rows to `rejected` (previously the skip was pure `continue` with no DB write, leaving stale review entries whenever the classifier learned a new rejection category). New products without a DB row still just fall through.

### Locators shipped (9)
| Brand | Strategy | Review impact |
|---|---|---|
| `unbound-merino` | `<div class="product-fabric">` | baseline |
| `pact` | `api2.wearpact.io/product/search` JSON API (skips HTML) | 10 → 0 |
| `naadam` | `<a href="#section-material">` anchor, strip lining segment, fix "Alapca" typo | 20 → 0 |
| `gil-rodriguez` | "Composition is …" prose sentence, strip "mulesing-free" | 2 → 0 |
| `jungmaven` | Accentuate `product_option` div after Blend-v*.svg icon, normalize bare-integer blend | 2 → 0 |
| `pyne-and-smith` | `#details` tab-pane `Fabric:` sentence, strip "pre-shrunk"/"european flax" noise | 2 → 0 |
| `magic-linen` | "Made from N% European flax" sentence (end-of-line captured so OEKO-TEX cert number is excluded); UA-stamped fetch to avoid reduced CDN templates | 5 → 0 |
| `kowtow` | `details_and_care__fabric_highlighted-description` div — inner `<p>` captured via HTML class-attribute anchor (not a CSS selector); extractor normalizer handles the "plastic free / 100% Fair Trade Organic Cotton" prefix and alias on its own | 21 → 1 (combined with classifier fix: 5 locator hits + 15 classifier-fix rejections; Tissue Wrap remains as no-price) |
| `beaumont-organic` | Iterates every `Made from …` bullet (first match is often prose, fall through to the `- Made from N% …` explicit bullet); strips parentheticals like `(80% Recycled Denim)`; dual-panel `100% X front and 100% Y back` → 50/50 flatten; single-fiber prose inference (`crafted from lambswool` → `{Lambswool: 100}`) with a `\b<canonical>\b` check to reject dictionary substring bleed (`wool` inside `lambswool`); mojibake nbsp fixup (`\u00ac\u2020` → space) for Finley/Geraldine; optional "drop Other ≤5% and rebalance into largest trusted" post-processor gated on `namedSum ≥ 90%` + all-trusted named materials, for recycled denim blends with undisclosed sliver fibers | 15 → 0 (all 15 review products expected to auto-approve on next sync; dry-run confirmed) |

### Residual review queue (6 products after this session's sweep)

Post-locator, after every sync-enabled brand's residuals have been triaged. All deterministic locator work is done — the remaining 6 are either no-data upstream, disabled-brand orphans, or pending a production sync run with `--force-rescan`.

| Brand | Count | Disposition |
|---|---|---|
| `pact` | 1 | `Women's Airplane Arrivals Set` — bundle URL uses the `bdl-` SKU prefix which doesn't resolve in Pact's per-item `api2.wearpact.io` response. The locator returns null (verified). Leave in review or reject manually. A bundle-aware code path would need to enumerate the bundle's component SKUs — not worth it for one SKU. |
| `unbound-merino` | 3 | `Men's Merino Cashmere Quarter Zip`, `Women's 3 Pack // Merino Socks`, `Men's 3 Pack // Merino Socks`. The brand deliberately hides `.product-fabric { display: none; }` on these via CSS and doesn't render composition anywhere else in the DOM. Body_html is pure prose ("Made from a Merino wool blend") with no percentages. No locator can extract what the brand doesn't disclose. These are **legitimate no-data residuals**. |
| `kowtow` | 1 | `Tissue Wrap` — locator extracts `100% Organic Cotton` cleanly, but the product has no price and hits the auto-approve gate. Will resolve if Kowtow sets a price, or can be force-approved manually. |
| `fair-indigo` | 1 | `Meet the Joobles Bilingual Picture Book` — non-clothing children's book in a `sync_enabled: false` brand. No sync will touch this row. Needs a manual `DELETE` or `UPDATE sync_status = 'rejected'` in SQL. Not worth a classifier change for one orphan. |

#### Resolved on next `sync-shopify` / `sync-catalog --force-rescan` run (no new code required)

| Brand | Count | Why they clear |
|---|---|---|
| `beaumont-organic` | 15 | New `beaumont-organic` locator shipped. Dry-run `sync-shopify --force-rescan --brand beaumont-organic` confirms 0 review (down from 15). Expected production result: 7 bamboo lingerie (Nyra/Yoka/Zaria × colorways) auto-approve via the default extractor hitting body_html; Phoebe-Paige/Maria/Lily-Ella auto-approve via single-fiber prose inference; Dominique/Fleur/Cecily-May auto-approve via parenthetical strip + dual-panel flatten; Finley/Geraldine auto-approve via the `Other ≤5%` drop-and-rebalance post-processor. |
| `magic-linen` | 5 | Body-hash-gated stale rows. Verified: `sync-shopify --force-rescan --brand magic-linen` dry-run shows 0 review. Next production `--force-rescan` clears them. |
| `pact` | 1 (of 2) | `PACT Women's Black On the Go-To Pocket Legging M` — existing `pact` locator returns `{Organic Cotton: 90, Spandex: 10}` (conf 0.98) when fed the product URL directly. Will auto-approve on `sync-catalog --force-rescan --brand pact`. |
| `gil-rodriguez` | 2 | Both `Tricot x Gil Rodriguez Cashmere Cardigan` (marmotta + rosa) — existing `gil-rodriguez` locator returns `{Cashmere: 50, Wool: 50}` (conf 0.95) when tested directly. Will auto-approve on `sync-catalog --force-rescan --brand gil-rodriguez`. |

### Known bug (pre-existing, surfaced during Beaumont dry-run)

The `--force-rescan` dry-run of `beaumont-organic` shows 3 sock products (`Anna Wool, Cotton and Hemp mix Socks in Grey`, `Camelia …`, `Viola Organic Cotton and Hemp Socks in Ecru`) going through the per-product extraction loop even though all three are `sync_status: 'approved'` in the DB with valid `shopify_product_id` values that match the current Shopify API response. They should short-circuit at `sync-shopify.ts:271` (`if (existingStatus === "approved") continue`), but somehow they slip past the `existingStatusMap.get(shopifyProduct.id)` lookup for ~93 products out of ~1086 expected approved rows (993 skipped correctly + 93 re-extracted = ~1086). Most of the 93 happen to re-extract cleanly; these 3 socks don't (prose-only multi-fiber body_html with no percentages) so they land in review. **Not caused by the new beaumont locator** — it's a pre-existing lookup bug in the settled-status skip. In production (without `--force-rescan`), the body_hash gate catches them so they stay approved; the issue only surfaces with force-rescan. Worth investigating separately — suspects include `shopify_product_id` type coercion in the Supabase client return type, or stale rows from brand re-adds.

### Brand sync status (as of 2026-04-13 late evening)

**33 total brands. 25 sync-enabled, 8 disabled. Every sync-enabled brand has now been run successfully through the new reliability machinery.**

#### Sync-enabled, ran successfully this session (25)

Shopify (20):
| Slug | Approved | Review | Rejected | Notes |
|---|---|---|---|---|
| `allwear` | 289 | 0 | 84 | |
| `aya` | 101 | 0 | 78 | |
| `beaumont-organic` | 1086 (→ ~1101 post-rescan) | 15 → 0 | 400 → 427 | **Locator shipped (commit pending).** Dry-run `sync-shopify --force-rescan --brand beaumont-organic` with the new locator reports `1455 fetched, 993 settled, 11 non-clothing, 421 auto-approved, 27 banned, 3 review [fabric_div: 425, fallback_scan: 23], 0 errors`. The 3 "review" are the pre-existing settled-skip bug on Anna/Camelia/Viola wool-hemp socks (see Known bug below) — every one of the 15 original review rows now auto-approves. |
| `happy-earth-apparel` | 162 | 0 | 1 | Availability-only pass (2026-04-13 evening) — 0 errors, 0 timeouts. |
| `harvest-and-mill` | 134 | 0 | 1 | Availability-only pass (2026-04-13 evening) — 0 errors, 0 timeouts. |
| `indigo-luna` | 211 | 0 | 42 | |
| `industry-of-all-nations` | 108 | 0 | 32 | Availability-only pass (2026-04-13 evening) — 0 errors, 0 timeouts. |
| `jungmaven` | 287 | 0 | 22 | |
| `kowtow` | 299 | 1 | 16 | **Locator + classifier fix shipped.** 333 fetched, 295 settled, 32 non-clothing (15 leather-footwear review items flipped to rejected via the new `non-clothing-type` path), 6 synced (new locator routed through `fabric_div`), 5 auto-approved, 1 review (Tissue Wrap — no price), 0 errors, 0 timeouts. Review queue dropped 21 → 1. |
| `layere` | 52 | 0 | 5 | Availability-only pass |
| `losano` | 92 | 0 | 1 | |
| `magic-linen` | 315 → 320 | 5 → 0 | 744 | **Residuals verified clearable.** `sync-shopify --dry-run --force-rescan --brand magic-linen` reports `1128 fetched, 994 settled, 77 non-clothing, 57 auto-approved, 0 banned, 0 review, 0 errors`. All 5 body-hash-gated residuals auto-approve. Needs a production `--force-rescan` to land. |
| `mate-the-label` | 346 | 0 | 15 | |
| `nads` | 12 | 0 | 12 | |
| `naadam` | 423 | 0 | 24 | |
| `plainandsimple` | 37 | 0 | 1 | |
| `pyne-and-smith` | 75 | 0 | 11 | |
| `ryker` | 30 | 0 | 2 | |
| `sold-out-nyc` | 116 | 0 | 3 | |
| `unbound-merino` | 83 | 3 | 55 | 3 residual reviews — **legitimate no-data** (see Residual review queue above). Brand hides `.product-fabric { display: none; }` on the cashmere zip + sock packs and doesn't disclose composition in body_html, tags, variants, or metafields. No locator can fix what isn't published. |

Catalog (5):
| Slug | Approved | Review | Rejected | Notes |
|---|---|---|---|---|
| `branwyn` | 3 | 0 | 15 | First run this session. 15 scraped items flagged as banned (synthetic performance wear dominates the catalog). 0 errors, concurrency pool ran clean. |
| `gil-rodriguez` | 57 → 59 | 2 → 0 | 10 | 2 residual reviews (both Cashmere Cardigan marmotta/rosa colorways) are stale — locator tested directly returns `{Cashmere: 50, Wool: 50}` cleanly. Will auto-approve on next `sync-catalog --force-rescan --brand gil-rodriguez`. Locator + locale-regex fix cut crawl ~90min → ~40min. |
| `kotn` | 16+ | 1 | 5+ | First run this session. 89 discovered, 16 synced via concurrency pool. 0 errors. |
| `pact` | 80 → 81 | 2 → 1 | 27 | 1 residual: the `Airplane Arrivals Set` bundle — `bdl-` SKU prefix doesn't resolve in the per-item API (verified). The other review, `PACT Women's Black On the Go-To Pocket Legging M`, is stale — locator tested directly returns `{Organic Cotton: 90, Spandex: 10}` (conf 0.98). Will auto-approve on next `sync-catalog --force-rescan --brand pact`. |
| `wayve-wear` | 9 | 0 | 4 | First run this session. 13 discovered, 4 non-clothing (site catalog is mostly non-clothing). 0 errors. |

#### Disabled (`sync_enabled: false`, 8)

`maggies-organics`, `vivid-linen`, `quince`, `icebreaker`, `prana`, `rawganique`, `everlane`, `fair-indigo` — keep brand records, no new syncs. (Everlane & prAna were dropped for diminishing returns; others are legacy.)

### ✅ Resolved — `material-extractor.ts` catastrophic regex backtracking

**Fixed in commits `a3eb902` (reliability plan) and `94459e3` (normalizer).** Two-layer defense now prevents the hang:

1. **Root-cause containment.** `extractFromCombinedText` caps stripped-text input at 20 KB before the regex passes run (`EXTRACTOR_INPUT_CAP_BYTES` in `scripts/lib/sync-reliability.ts`). Pathological multi-KB paragraphs can no longer trigger catastrophic backtracking because the regex never sees them.
2. **Defensive timeout.** Every per-product unit of work in `sync-shopify.ts` and `sync-catalog.ts` is wrapped in `withTimeout(60s)`. If anything — regex, locator fetch, image optimization, DB write — blows the budget, the product is recorded in `sync_run_failures` with stage + duration, the brand's `timeouts` counter bumps, and the loop continues to the next product.

**Verification:** `magic-linen` (1129 products, previously killed after 62 min CPU) and `kowtow` (334 products, same fate) both completed end-to-end in this session with 0 timeouts, 0 errors. See `sync-reliability-plan.md` for the full policy + post-mortem playbook.

## Task — Add per-brand locators

One brand per session. The pattern:

### Brand candidates (ordered by review-count impact)

Check current review counts before picking:

```
npx tsx -e 'import { loadEnv, getSupabaseAdmin } from "./scripts/lib/env.js"; loadEnv(); const sb = getSupabaseAdmin(); const { data } = await sb.from("products").select("brands!inner(slug), sync_status").eq("sync_status", "review"); const counts: Record<string, number> = {}; for (const p of data || []) { const s = (p as any).brands.slug; counts[s] = (counts[s] || 0) + 1; } console.log(counts);'
```

Next priority: **no high-impact locator targets remain.** All brands with ≥2 residuals are either resolved, verified-clearable-on-force-rescan, or blocked by no-data-at-source. Future locator work happens only when a new brand is added or a new review pattern emerges. The remaining 6 residuals (pact bundle, 3 unbound-merino no-data, kowtow Tissue Wrap, fair-indigo orphan) are listed above in the "Residual review queue" table with dispositions.

### Investigation loop

1. Pick ONE brand.
2. Grab 3-5 review products from the DB and open them in a browser.
3. Use DevTools to find where material composition lives on each page. Look for:
   - Custom accordion/tab sections: "Fabric", "Composition", "Material", "Details", "Specifications"
   - Data attributes: `data-product-fabric`, `data-composition`, `data-material`
   - Classes: `.product-fabric`, `.material-content`, `.composition`, `.product__specs`
   - Structured blocks the default regex misses: tables, definition lists, `<dt>/<dd>` pairs
   - **JSON APIs** — check Network tab for XHR/fetch to `api.*`, `/products.json`, `/metafields`, etc. (see Pact for the exemplar)
4. Identify the most reliable selector/regex.
5. Write the locator.
6. Register in `scripts/brand-scrapers/registry.ts`.
7. Dry-run and compare before/after.

### Locator skeleton

`scripts/brand-scrapers/locators/<brand-slug>.ts`:

```ts
import type { Locator } from "./types.js";
import {
  parseDecimalComposition,
  stripHtml,
  extractMaterialsFromText,
} from "../shared/parsers.js";
import { scanForFiberChunk } from "../shared/locate.js";

const COMPOSITION_RE = /<REGEX HERE>/; // brand-specific

export const brandLocator: Locator = async (input) => {
  const html = await input.fetchHtml();

  // Strategy 1: brand-specific pinpoint
  const m = html.match(COMPOSITION_RE);
  if (m) {
    const text = stripHtml(m[1]);
    const ex = extractMaterialsFromText(text);
    if (ex && Object.keys(ex.materials).length > 0) {
      return { materials: ex.materials, confidence: 0.95, source: "fabric_div" };
    }
    const dec = parseDecimalComposition(text);
    if (dec) {
      return { materials: dec, confidence: 0.9, source: "fabric_div" };
    }
  }

  // Strategy 2: generic scanner fallback
  return scanForFiberChunk(html, "fallback_scan");
};
```

For brands that don't render composition in HTML at all, hit a JSON API instead — see `locators/pact.ts` for the pattern.

### Registry update

```ts
// scripts/brand-scrapers/registry.ts
import { brandLocator } from "./locators/<brand-slug>.js";

export const locators: Record<string, Locator> = {
  "gil-rodriguez": gilRodriguez,
  "jungmaven": jungmaven,
  "naadam": naadam,
  "pact": pact,
  "pyne-and-smith": pyneAndSmith,
  "unbound-merino": unboundMerino,
  "<brand-slug>": brandLocator,
};
```

### Hard rules

- Locators are pure: no DB writes, no banned checks, no `determineSyncStatus`, no `isExtractionBanned`.
- Return integer materials summing to exactly 100. Use `parseDecimalComposition` for decimal inputs — it handles rounding.
- Use `.js` extensions in all relative imports (ESM style).
- Don't touch shared/, other locators, sync-shopify.ts, sync-catalog.ts, or registry structure.
- Reference implementations:
  - `locators/unbound-merino.ts` — simple class-based regex
  - `locators/naadam.ts` — anchor-based with multi-section trim + typo fix
  - `locators/pact.ts` — JSON API bypass for sites that don't render composition in HTML
  - `locators/jungmaven.ts` — bare-integer normalization (no `%` signs in source)
  - `locators/pyne-and-smith.ts` — tab-pane isolation + marketing-adjective stripping
  - `locators/magic-linen.ts` — sentence-shaped regex with explicit end-of-line anchor to avoid dragging in adjacent noise (OEKO-TEX cert number)
  - `locators/kowtow.ts` — HTML `class="..."` attribute anchor (not CSS selector) so it can't match a stylesheet rule earlier in the document; character-class-negation quantifiers end-to-end
  - `locators/beaumont-organic.ts` — iterates multiple `Made from …` matches (prose sentence first, explicit bullet second), parenthetical stripping for nested qualifiers, dual-panel 50/50 flatten, single-fiber prose inference with `\b<canonical>\b` bleed check against the extractor's dictionary substring bug (`wool` inside `lambswool`), mojibake nbsp fixup, optional "drop Other ≤5% and rebalance" post-processor for recycled blends with undisclosed slivers

### Verification

1. Typecheck: `npx tsc --noEmit -p tsconfig.json`. Ignore the pre-existing `.next/types/validator.ts` error. Zero new errors.
2. Unit-test against current review products with a temp script that fetches live URLs (add User-Agent header + 3x retry for rate-limited brands like Naadam).
3. Dry-run: `npx tsx scripts/sync-shopify.ts --dry-run --brand <slug>` (or `sync-catalog.ts` for catalog brands with `--force-rescan` to bypass the hash gate).
4. Confirm:
   - Review count drops vs pre-locator baseline
   - Approved/banned counts rise correspondingly
   - Source distribution shows the new brand routing through `fabric_div` (or whichever source key you chose) instead of `fallback_scan`/`body_html` fallback
5. If approved count rises but the materials look wrong, spot-check 3 products manually against the live site before merging.
6. If the brand is catalog-based (Playwright), test that `scraped.html` contains the expected selector — Playwright renders JS, so the HTML may look different from a raw fetch.

### Commit pattern

One brand per commit:

```
feat(scrapers): <brand> locator — <one-line "where composition lives">
```

Example: `feat(scrapers): pact locator — composition via api2.wearpact.io product/search endpoint`

## Known issues

### Blockers
_None._ The extractor hang was the blocker and it is resolved (see "Resolved" section above).

### Non-blockers
- **`--force-rescan` does not bypass the settled-status skip.** The rejected/approved short-circuit at the top of the per-product loop runs unconditionally. To re-process an already-settled product, you have to either (a) flip its `sync_status` back to `pending` via SQL, (b) delete the row and let the next sync re-ingest it, or (c) add a new `--reprocess-rejected` flag. Came up when recovering Kowtow's 52 wrongly-rejected products — chose option (b) for a clean slate.
- **Approved/rejected products never get body_hash.** By design — they skip via the settled-status path before the body_hash gate. The gate's savings come entirely from review/pending churn. Not worth "fixing" unless you want body_hash populated for telemetry.
- **Banned products DO get body_hash.** The banned branch writes a minimal rejected row, and the next run skips them via the settled-status path (same as approved/rejected).
- **Catalog sync doesn't update `brands.last_synced_at`.** Gil Rodriguez shows "never" on that column despite successful runs. The product-level timestamps still update correctly. Minor bug — just affects the stalest-brand sort order in ops scripts. Note: `brands.last_availability_sweep_at` IS updated correctly (new column added in migration 016, only advances on fully successful catalog sweeps).
- **`fetch failed` from Supabase during long sync runs.** When the laptop suspends or loses network mid-sync, catalog brands fail early with `TypeError: fetch failed`. Add retry logic to the brand-fetch step in `sync-catalog.ts` and `sync-shopify.ts` if this keeps happening.
- **Discovery stage is unbounded.** `discoverProducts()` (sitemap fetch + fallback Playwright crawl) is not wrapped in `withTimeout`. A brand whose `/collections/all` hangs during discovery would not be contained by the current timeout policy. Observed in this session: Kotn took 50 s in `crawl` mode (not hung, just slow). Worth wrapping for parity.
- **Bash `tail -10` pipe silences progress.** The `for brand in ...; do ... | tail -10; done` pattern only emits output after each brand completes, so you can't tell if a brand is live vs stuck without inspecting `ps aux` directly. Prefer unpiped output or per-line teed logs for long-running batches.

## Daily sync orchestration

- `npx tsx scripts/daily-sync.ts` runs all sync-enabled brands: Shopify first, then catalog, then LLM fallback for locator-missed products.
- Designed to run in Claude Code scheduled tasks or similar cloud-side orchestration. Setup: `npm install && npx playwright install chromium`.
- Daily sync is NOT idempotent for in-flight runs — if a run is killed mid-sync (laptop suspend, network flake), some brands will have partial state and need a targeted re-run via `--brand <slug>`.
