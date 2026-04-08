# Test Coverage Analysis

## Current State

**Before this PR**: Zero automated tests. No test framework, no test scripts, no CI test pipeline. The only test-related file was `scripts/test-llm-extract.ts` — a manual CLI script requiring live API credentials.

**After this PR**: Vitest installed with 198 unit tests covering 4 core modules.

## What's Now Covered

| Module | Tests | What's Tested |
|--------|-------|---------------|
| `scripts/lib/material-extractor.ts` | 36 | Regex extraction (pct-then-name, name-then-pct), alias normalization, banned material detection, HTML stripping, multi-section products, edge cases |
| `scripts/lib/curation.ts` | 50 | slugify, isSyntheticStretch, isBannedMaterial, isKnownNatural, isMaterialNatural, validateProduct (tiers, bans, percentages, warnings), isExtractionBanned, getMaterialDescription |
| `scripts/lib/product-classifier.ts` | 82 | classifyProductType (34 product names), priority ordering, Shopify fallback, tag fallback, isNonClothing, isAccessory, shouldRejectProduct (whitelist/blacklist mode), classifyAudience (all 4 tiers), mapActivewearType |
| `src/lib/utils.ts` | 30 | formatPrice, slugify, materialSummary, isAllNatural, brandLogoUrl, brandDomain, naturalPercentage, formatCategory, affiliateUrl |

## Areas That Still Need Tests (Prioritized)

### Priority 1: High-Value Gaps in Tested Modules

These are edge cases and scenarios within the modules we already test that would catch real bugs:

1. **material-extractor.ts — Dictionary-based extraction path**
   - `extractWithDictionary()` is a fallback when regex fails. It uses proximity-based matching between percentage signs and material names. No tests exercise this path directly.
   - Test ideas: products where material name and percentage are separated by other text, false-positive rejection (e.g., "Save 20%" near "cotton").

2. **material-extractor.ts — LLM batch extraction**
   - `extractBatchWithLLM()` and `extractMaterialsBatch()` handle Gemini API calls. These should be tested with mocked API responses to verify JSON parsing, error handling, and batch splitting.
   - Test ideas: malformed JSON response, empty response, partial batch results, rate limiting.

3. **product-classifier.ts — `isAccessory` regex gap**
   - The regex pattern `glove` doesn't match "gloves" (plural). The `\b` boundary fails because `gloves` has no boundary after `glove`. Same issue potentially exists for other accessory keywords. This is a real bug discovered during test writing.

4. **curation.ts — `isSyntheticStretch` accepts canonical names**
   - The function does `SYNTHETIC_STRETCH.includes(name.toLowerCase())`, but `SYNTHETIC_STRETCH` contains `["elastane", "spandex", "lycra"]`. However, the canonical name used throughout the codebase is `"Spandex"` (title case). Since `toLowerCase()` is applied, this works — but the code never checks for the canonical name directly. If a product has `{ "Spandex": 8 }`, the validation catches it via `isSyntheticStretch("Spandex")` which lowercases to `"spandex"`. This is correct but fragile.

### Priority 2: Untested Modules with Complex Logic

5. **`scripts/lib/shopify-fetcher.ts`** (~80 LOC of logic)
   - `fetchWithRetry()` — retry logic with exponential backoff, rate limit handling (429 responses)
   - `fetchAllProducts()` — pagination through Shopify API, link header parsing
   - Requires mocking `fetch`. Would catch bugs in retry timing and pagination edge cases.

6. **`scripts/lib/db-helpers.ts`** (~95 LOC)
   - `ensureMaterialExists()` — cache lookup, DB lookup, insert logic, trusted-material gating
   - `syncProductMaterials()` — delete-then-insert pattern, error handling
   - Requires mocking Supabase client. Would catch bugs in cache invalidation and race conditions.

7. **`scripts/lib/catalog-discoverer.ts`** (not read, likely 200+ LOC)
   - Product discovery pipeline logic
   - Requires mocking external APIs.

### Priority 3: Frontend Logic

8. **React Component behavior** (no component tests exist)
   - `FilterSidebar.tsx` / filter components — state management, URL parameter sync
   - `PaginatedProductGrid.tsx` — pagination logic, loading states
   - `ProductCard.tsx` — conditional rendering (missing images, missing prices, badges)
   - `ShopContent.tsx` — filter application, sort ordering
   - Would require `@testing-library/react` and likely `vitest` with `jsdom` environment.

9. **Server Actions** (`src/app/shop/actions.ts`, `src/app/admin/review/actions.ts`)
   - Input validation, Supabase query construction, error handling
   - Would require mocking Supabase and Next.js server context.

### Priority 4: Integration & E2E

10. **Database query functions** (`src/lib/queries/products.ts`, `brands.ts`, `materials.ts`)
    - `getFilteredProducts()` — RPC parameter mapping, pagination math, response shaping
    - `getHomepageProducts()` — brand diversity algorithm (max 2 per brand)
    - `searchProducts()` — SQL injection safety (`.or()` with user input)
    - Could use a test Supabase instance or mock the client.

11. **E2E tests with Playwright** (already a dependency)
    - Critical user flows: browse homepage, filter shop, view product, navigate to affiliate link
    - SEO: verify meta tags, sitemap generation, structured data
    - Responsive: mobile nav, filter sidebar collapse
    - Playwright is already installed but has no test configuration (`playwright.config.ts` is missing).

## Specific Bugs & Risks Discovered

| Finding | Location | Severity |
|---------|----------|----------|
| `isAccessory` regex doesn't match plurals ("gloves", "mittens" works but "glove" is the base pattern — plurals like "scarves" may fail) | `product-classifier.ts:34` | Medium |
| `searchProducts` uses string interpolation in `.or()` query — potential SQL injection if `query` contains special chars | `products.ts:49` | High |
| No input sanitization on `slug` parameter in `getProductBySlug` | `products.ts:63` | Low (Supabase parameterizes) |
| `getHomepageProducts` fetches `limit * 8` rows to diversify — no upper bound | `products.ts:110` | Low |

## Recommended Next Steps

1. **Add `npm test` to CI** — Any CI pipeline (Vercel, GitHub Actions) should run tests on every push.
2. **Fix the `isAccessory` plural bug** — Add `s?` suffix to `glove` in the regex.
3. **Audit `searchProducts` SQL injection risk** — Verify Supabase client parameterizes `.or()` inputs.
4. **Add component tests** — Install `@testing-library/react` and test filter/pagination components.
5. **Set up Playwright E2E** — Create `playwright.config.ts` and write smoke tests for critical flows.
