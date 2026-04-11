# Sync Pipeline — Next Steps

Context for a fresh session picking up Phase 6 locator work.

## Current state

- Migration 015 is applied to the live DB (adds `products.body_hash`, `products.source_updated_at`, `brands.availability_cadence_days`).
- `scripts/brand-scrapers/` holds the plugin infra:
  - `locators/types.ts` — `Locator`, `LocatorInput`, `LocatedComposition` contract
  - `locators/default.ts` — body_html → product_page → fallback_scan
  - `locators/unbound-merino.ts` — only per-brand plugin so far
  - `shared/parsers.ts` — `parseDecimalComposition`, `stripHtml`, re-exports `extractMaterialsFromText`
  - `shared/locate.ts` — `scanForFiberChunk`
  - `registry.ts` — `getLocator(slug)` lookup
- `sync-shopify.ts` and `sync-catalog.ts` route through the locator, gate re-processing on `body_hash`, and log locator source distribution.
- `daily-sync.ts` runs Phase 3 `onlyLocatorMissed: true` LLM pass after both sync phases.
- Banned-product locator churn is fixed — banned branches in both sync scripts now write `body_hash` + `sync_status: 'rejected'` so the next run short-circuits via the settled-status skip.
- `scripts/fix-unbound-materials.ts` has been deleted; its logic lives in `shared/parsers.ts` + `locators/unbound-merino.ts`.

## Task — Add per-brand locators

One brand per session. The pattern:

### Brand candidates (ordered by review-count impact)

Check current review counts before picking:

```
npx tsx -e 'import { loadEnv, getSupabaseAdmin } from "./scripts/lib/env.js"; loadEnv(); const sb = getSupabaseAdmin(); const { data } = await sb.from("products").select("brands!inner(slug), sync_status").eq("sync_status", "review"); const counts: Record<string, number> = {}; for (const p of data || []) { const s = (p as any).brands.slug; counts[s] = (counts[s] || 0) + 1; } console.log(counts);'
```

Known high-review brands from the plan: Pact (catalog), Naadam, Magic Linen, Kowtow, Beaumont.

### Investigation loop

1. Pick ONE brand.
2. Grab 3-5 review products from the DB and open them in a browser.
3. Use DevTools to find where material composition lives on each page. Look for:
   - Custom accordion/tab sections: "Fabric", "Composition", "Material", "Details", "Specifications"
   - Data attributes: `data-product-fabric`, `data-composition`, `data-material`
   - Classes: `.product-fabric`, `.material-content`, `.composition`, `.product__specs`
   - Structured blocks the default regex misses: tables, definition lists, `<dt>/<dd>` pairs
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

### Registry update

```ts
// scripts/brand-scrapers/registry.ts
import { brandLocator } from "./locators/<brand-slug>.js";

export const locators: Record<string, Locator> = {
  "unbound-merino": unboundMerino,
  "<brand-slug>": brandLocator,
};
```

### Hard rules

- Locators are pure: no DB writes, no banned checks, no `determineSyncStatus`, no `isExtractionBanned`.
- Return integer materials summing to exactly 100. Use `parseDecimalComposition` for decimal inputs — it handles rounding.
- Use `.js` extensions in all relative imports (ESM style).
- Don't touch shared/, other locators, sync-shopify.ts, sync-catalog.ts, or registry structure.
- Reference implementation: `scripts/brand-scrapers/locators/unbound-merino.ts`.

### Verification

1. Typecheck: `npx tsc --noEmit -p tsconfig.json`. Ignore the pre-existing `.next/types/validator.ts` error. Zero new errors.
2. Dry-run: `npx tsx scripts/sync-shopify.ts --dry-run --brand <slug>` (or `sync-catalog.ts` for catalog brands with `--force-rescan` to bypass the hash gate).
3. Confirm:
   - Review count drops vs pre-locator baseline
   - Approved/banned counts rise correspondingly
   - Source distribution shows the new brand routing through `fabric_div` (or whichever source key you chose) instead of `fallback_scan`/`body_html` fallback
4. If approved count rises but the materials look wrong, spot-check 3 products manually against the live site before merging.
5. If the brand is catalog-based (Playwright), test that `scraped.html` contains the expected selector — Playwright renders JS, so the HTML may look different from a raw fetch.

### Commit pattern

One brand per commit:

```
feat(scrapers): <brand> locator — <one-line "where composition lives">
```

Example: `feat(scrapers): pact locator — composition in .pdp-fabric-composition div`

## Known issues (non-blockers)

- **Approved/rejected products never get body_hash.** By design — they skip via the settled-status path before the body_hash gate. The gate's savings come entirely from review/pending churn. Not worth "fixing" unless you want body_hash populated for telemetry.
- **Banned products DO get body_hash.** The banned branch writes a minimal rejected row, and the next run skips them via the settled-status path (same as approved/rejected).
