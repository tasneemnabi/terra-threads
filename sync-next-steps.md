# Sync Pipeline — Next Steps

Context for a fresh session picking up Phase 6 locator work.

## Current state (2026-04-13)

### Infrastructure
- Migration 015 is applied to the live DB (adds `products.body_hash`, `products.source_updated_at`, `brands.availability_cadence_days`).
- `scripts/brand-scrapers/` holds the plugin infra:
  - `locators/types.ts` — `Locator`, `LocatorInput`, `LocatedComposition` contract
  - `locators/default.ts` — body_html → product_page → fallback_scan
  - `shared/parsers.ts` — `parseDecimalComposition`, `stripHtml`, re-exports `extractMaterialsFromText`
  - `shared/locate.ts` — `scanForFiberChunk`
  - `registry.ts` — `getLocator(slug)` lookup
- `sync-shopify.ts` and `sync-catalog.ts` route through the locator, gate re-processing on `body_hash`, and log locator source distribution.
- `daily-sync.ts` runs Phase 3 `onlyLocatorMissed: true` LLM pass after both sync phases.
- Banned-product locator churn is fixed — banned branches in both sync scripts write `body_hash` + `sync_status: 'rejected'` so the next run short-circuits via the settled-status skip.
- URL discovery regex anchored to reject locale-prefixed paths (`/en-au/products/…`, `/en-ca/products/…`, etc.) — cut Gil Rodriguez discovery 500 → 255 URLs, halving scrape time.

### Locators shipped (7)
| Brand | Strategy | Review impact |
|---|---|---|
| `unbound-merino` | `<div class="product-fabric">` | baseline |
| `pact` | `api2.wearpact.io/product/search` JSON API (skips HTML) | 10 → 0 |
| `naadam` | `<a href="#section-material">` anchor, strip lining segment, fix "Alapca" typo | 20 → 0 |
| `gil-rodriguez` | "Composition is …" prose sentence, strip "mulesing-free" | 2 → 0 |
| `jungmaven` | Accentuate `product_option` div after Blend-v*.svg icon, normalize bare-integer blend | 2 → 0 |
| `pyne-and-smith` | `#details` tab-pane `Fabric:` sentence, strip "pre-shrunk"/"european flax" noise | 2 → 0 |
| `magic-linen` | "Made from N% European flax" sentence (end-of-line captured so OEKO-TEX cert number is excluded); UA-stamped fetch to avoid reduced CDN templates | 5 → 0 |

### Residual review queue (28 products as of 2026-04-13 evening)
| Brand | Count | Notes |
|---|---|---|
| `beaumont-organic` | 15 | **High-value locator target — still needs to be written.** An earlier attempt was deleted because (a) it was never verified against a real sync run and (b) its `MADE_FROM_RE` / `COMPOSITION_CELL_RE` regexes used a nested-lazy-quantifier pattern (`[^<"']*?(?:<[^>]+>[^<"']*?)*?`) that is the classic catastrophic-backtracking shape — risky given we just got bitten by the same family of bug in `material-extractor.ts`. Rewrite using anchored, non-nested patterns (sentence-boundary matching, à la `locators/magic-linen.ts`). |
| `magic-linen` | 5 | Re-introduced after kowtow-triggered kill killed magic-linen mid-sync. Previously resolved 5→0 by the shipped locator; likely resolves again once extractor hang bug is fixed and sync completes. |
| `unbound-merino` | 3 | Edge cases not caught by existing locator |
| `pact` | 2 | Bundles (e.g. "Airplane Arrivals Set") — SKU prefix doesn't map to per-item API |
| `gil-rodriguez` | 2 | New additions |
| `fair-indigo` | 1 | Orphan, `sync_enabled: false` — not worth a locator |

### Brand sync status (as of 2026-04-13 17:30)

**33 total brands. 25 sync-enabled, 8 disabled.**

#### Sync-enabled, ran successfully this session (19)

Shopify (17):
| Slug | Approved | Review | Rejected | Notes |
|---|---|---|---|---|
| `allwear` | 289 | 0 | 84 | |
| `aya` | 101 | 0 | 78 | |
| `beaumont-organic` | 1086 | 15 | 400 | Partial: fetch + auto-approve + availability done. 15 new reviews waiting for a (yet-to-be-written) locator. |
| `harvest-and-mill` | 134 | 0 | 1 | **Not re-run this session (5.1d stale)** — queued but never started |
| `happy-earth-apparel` | 162 | 0 | 1 | **Not re-run this session (3.6d stale)** |
| `indigo-luna` | 211 | 0 | 42 | |
| `industry-of-all-nations` | 108 | 0 | 32 | **Not re-run this session (4.0d stale)** |
| `jungmaven` | 287 | 0 | 22 | |
| `layere` | 52 | 0 | 5 | Availability-only pass |
| `losano` | 92 | 0 | 1 | |
| `mate-the-label` | 346 | 0 | 15 | |
| `nads` | 12 | 0 | 12 | |
| `naadam` | 423 | 0 | 24 | |
| `plainandsimple` | 37 | 0 | 1 | |
| `pyne-and-smith` | 75 | 0 | 11 | |
| `ryker` | 30 | 0 | 2 | |
| `sold-out-nyc` | 116 | 0 | 3 | |
| `unbound-merino` | 83 | 3 | 55 | 3 residual reviews |

Catalog (2):
| Slug | Approved | Review | Rejected | Notes |
|---|---|---|---|---|
| `gil-rodriguez` | 57 | 2 | 10 | Locator + locale-regex fix cut crawl ~90min → ~40min |
| `pact` | 80 | 2 | 27 | 2 bundles leaked through (SKU prefix doesn't hit per-item API) |

#### Sync-enabled, stuck on regex hang (2) — DANGER

| Slug | Approved | Review | Rejected | Notes |
|---|---|---|---|---|
| `kowtow` | 275 | 0 | 55 | **Killed after 62min CPU** — fetch + availability succeeded, hung during `extractMaterialsFromText` on one of 5 new products. One body_html triggers catastrophic regex backtracking. |
| `magic-linen` | 314 | 5 | 827 | Same symptom. Killed. |

#### Sync-enabled, never run this session (3)

| Slug | Type | Days since last product sync | Notes |
|---|---|---|---|
| `kotn` | catalog | 13.1d | Never run this session. Known-good on prior runs. |
| `branwyn` | catalog | 11.0d | Only 3 approved products historically. |
| `wayve-wear` | catalog | 5.0d | Only 9 approved products. |

#### Disabled (`sync_enabled: false`, 8)

`maggies-organics`, `vivid-linen`, `quince`, `icebreaker`, `prana`, `rawganique`, `everlane`, `fair-indigo` — keep brand records, no new syncs. (Everlane & prAna were dropped for diminishing returns; others are legacy.)

### 🐛 Open bug — `material-extractor.ts` catastrophic regex backtracking

**Symptom:** one product in `kowtow` and one in `magic-linen` caused `scripts/sync-shopify.ts` to hang at 99% CPU for 60+ minutes with no progress after fetch and availability steps completed. Both brands show the same pattern: `Fetched N products`, `Availability batch: ... `, then silence while the regex extractor tries to parse a pathological `body_html`. Process survives SIGTERM, requires SIGKILL.

**Scope:** affects the 3-stage extractor at `scripts/lib/material-extractor.ts`, specifically the `PCT_THEN_NAME` / `NAME_THEN_PCT` globals at lines ~213–216. Both use bounded repetition `(?:[^\S\n]+[A-Za-z]+){0,4}` which is safe in isolation, but likely interacts badly with a specific `body_html` input (probably long paragraphs with many near-matches).

**Severity:** blocks any sync-enabled brand whose catalog contains even one pathological product. Without a fix, daily-sync will hang indefinitely on that brand and take down the rest of the batch.

**Plan:**
1. **Short-term mitigation** — wrap the per-product extraction call in a 5-second `Promise.race` timeout in `sync-shopify.ts` and `sync-catalog.ts`. On timeout, mark the product as `review` and continue. Keeps the sync moving even if one product is poisonous.
2. **Root cause** — isolate the hanging kowtow/magic-linen product. Steps:
   - `npx tsx scripts/sync-shopify.ts --brand kowtow --dry-run` with logging added around the extractor call to print the product ID before each extraction attempt.
   - When it hangs, SIGKILL, note the ID, fetch that product's `body_html`, and reproduce in isolation.
   - Fix the regex (likely: anchor to line boundaries, use possessive quantifiers, or cap the input length before passing to regex).
3. **Regression test** — add the captured pathological input to a unit test in `scripts/lib/material-extractor.test.ts` with a timeout assertion.

## Task — Add per-brand locators

One brand per session. The pattern:

### Brand candidates (ordered by review-count impact)

Check current review counts before picking:

```
npx tsx -e 'import { loadEnv, getSupabaseAdmin } from "./scripts/lib/env.js"; loadEnv(); const sb = getSupabaseAdmin(); const { data } = await sb.from("products").select("brands!inner(slug), sync_status").eq("sync_status", "review"); const counts: Record<string, number> = {}; for (const p of data || []) { const s = (p as any).brands.slug; counts[s] = (counts[s] || 0) + 1; } console.log(counts);'
```

Next priority: **beaumont-organic (15)** — needs a new locator (prior attempt had unsafe regex, was deleted). Use the magic-linen locator as the template since Beaumont's composition data also lives in prose sentences.

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
- **Extractor catastrophic regex backtracking** — see "🐛 Open bug" above. This is the top priority. Daily sync is unsafe until fixed or mitigated with a per-product timeout.

### Non-blockers
- **Approved/rejected products never get body_hash.** By design — they skip via the settled-status path before the body_hash gate. The gate's savings come entirely from review/pending churn. Not worth "fixing" unless you want body_hash populated for telemetry.
- **Banned products DO get body_hash.** The banned branch writes a minimal rejected row, and the next run skips them via the settled-status path (same as approved/rejected).
- **Catalog sync doesn't update `brands.last_synced_at`.** Gil Rodriguez shows "never" on that column despite successful runs. The product-level timestamps still update correctly. Minor bug — just affects the stalest-brand sort order in ops scripts.
- **`fetch failed` from Supabase during long sync runs.** When the laptop suspends or loses network mid-sync, catalog brands fail early with `TypeError: fetch failed`. Add retry logic to the brand-fetch step in `sync-catalog.ts` and `sync-shopify.ts` if this keeps happening.
- **Availability cadence gate can hide stale products.** `availability_cadence_days` (default 7) skips the availability sweep if the last sweep is within the window. Products marked sold-out after the last sweep stay flagged "available" until the next one.
- **Bash `tail -10` pipe silences progress.** The `for brand in ...; do ... | tail -10; done` pattern only emits output after each brand completes, so you can't tell if a brand is live vs stuck without inspecting `ps aux` directly. Prefer unpiped output or per-line teed logs for long-running batches.

## Daily sync orchestration

- `npx tsx scripts/daily-sync.ts` runs all sync-enabled brands: Shopify first, then catalog, then LLM fallback for locator-missed products.
- Designed to run in Claude Code scheduled tasks or similar cloud-side orchestration. Setup: `npm install && npx playwright install chromium`.
- Daily sync is NOT idempotent for in-flight runs — if a run is killed mid-sync (laptop suspend, network flake), some brands will have partial state and need a targeted re-run via `--brand <slug>`.
