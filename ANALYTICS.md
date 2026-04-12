# PostHog Analytics Integration for FIBER

## Context

FIBER is an affiliate-revenue site. Users browse natural fiber clothing and click through to buy on brand sites. Today the only analytics is `@vercel/analytics`, which gives pageviews but does not explain which products, filters, homepage modules, or brand pages actually drive outbound affiliate intent.

PostHog is a good fit here because the important signals are all client-side:
- outbound affiliate clicks
- product discovery clicks
- filter and browse behavior
- homepage and brand-directory engagement

The plan below keeps the implementation simple, keeps revenue events first, and avoids building an event schema that becomes noisy or ambiguous after launch.

---

## Goals

1. Measure revenue-critical outbound click intent reliably.
2. Understand which pages, modules, and products drive those clicks.
3. Capture browse/filter behavior with stable properties that are easy to analyze later.
4. Keep local/dev environments safe when PostHog is not configured.
5. Keep the schema small enough that dashboards stay trustworthy.

## Non-Goals

- No user identity work
- No server-side event ingestion
- No consent UI in this phase
- No feature flag rollout in this phase
- No attempt to model every UI interaction

---

## New Files to Create

| File | Purpose |
|---|---|
| `src/lib/posthog/provider.tsx` | `"use client"` provider that initializes PostHog only when env vars are present |
| `src/lib/posthog/pageview.tsx` | `"use client"` SPA pageview tracker using `usePathname` + `useSearchParams` |
| `src/lib/posthog/events.ts` | Event name constants, typed payload builders, and thin tracking helpers |
| `src/components/ui/TrackedLink.tsx` | `"use client"` `next/link` wrapper for explicit tracked internal navigation |
| `src/components/brand/BrandAffiliateLink.tsx` | `"use client"` outbound affiliate link wrapper for brand page CTAs |

## Files to Modify

| File | Change |
|---|---|
| `src/app/layout.tsx` | Wrap app in `PHProvider`, add `<PostHogPageview />` in `<Suspense>` |
| `src/components/product/AffiliateButton.tsx` | Add product and brand context props, fire `affiliate_click` |
| `src/app/product/[slug]/page.tsx` | Pass tracking context into `AffiliateButton` |
| `src/app/brand/[slug]/page.tsx` | Replace inline affiliate `<a>` tags with `BrandAffiliateLink` |
| `src/components/product/ProductCard.tsx` | Add `source` prop, fire `product_card_click` |
| `src/components/shop/ShopContent.tsx` | Track sort, filters, load more, and search results |
| `src/components/brand/BrandProducts.tsx` | Track local brand-page filters and sort changes |
| `src/components/brand/BrandsContent.tsx` | Track brands-directory filters |
| `src/components/brand/BrandCard.tsx` | Fire `brand_card_click` |
| `src/components/home/Hero.tsx` | Replace CTA links with `TrackedLink` |
| `src/components/home/ShopByCategory.tsx` | Replace links with `TrackedLink` |
| `src/components/home/EditorialPicks.tsx` | Track "See all" and product clicks |
| `src/components/home/BrowseByFiber.tsx` | Replace links with `TrackedLink` |
| `src/components/home/FeaturedBrands.tsx` | Replace links with `TrackedLink` |
| `src/components/home/FinalCTA.tsx` | Replace links with `TrackedLink` |
| `.env.example` | Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` |

---

## Event Design Principles

### Keep custom events opinionated

Custom events should be the source of truth for product, filter, and affiliate analysis. Avoid creating parallel dashboards from a mix of custom events and generic autocapture events.

### Prefer stable keys over UI-specific one-offs

For filters, track:
- what changed
- whether it was added or removed
- what query value changed
- what page it happened on

Do not overload a single `filter_value` field to represent slugs, labels, and ranges.

### Track intent, not every keystroke

The shop search currently runs automatically on debounced input. That means it does not represent an explicit "submit search" intent. The event name and semantics should match that reality.

### Safe by default

If PostHog env vars are missing, analytics helpers should no-op cleanly.

---

## Event Schema

### Tier 1: Revenue-Critical

**`affiliate_click`**  
Fired on every outbound affiliate click.

| Property | Type | Notes |
|---|---|---|
| `brand_name` | string | |
| `brand_slug` | string | |
| `product_slug` | string \| null | `null` on brand page CTA |
| `product_name` | string \| null | |
| `category` | string \| null | |
| `price` | number \| null | |
| `currency` | string \| null | Add this because price without currency is incomplete |
| `is_available` | boolean | |
| `domain` | string | Parsed from target URL |
| `source` | string | `"product-page"` / `"brand-detail"` / `"brand-detail-empty"` |
| `destination_url` | string | Helpful for QA and affiliate-link debugging |

Implementation points:
- `src/components/product/AffiliateButton.tsx`
- `src/components/brand/BrandAffiliateLink.tsx`

### Tier 2: Product Discovery

**`product_card_click`**  
Fired when a product card navigation is clicked.

| Property | Type |
|---|---|
| `product_slug` | string |
| `product_name` | string |
| `brand_name` | string |
| `brand_slug` | string |
| `category` | string \| null |
| `price` | number \| null |
| `currency` | string \| null |
| `is_available` | boolean |
| `source` | string |
| `destination` | string |

Allowed `source` values:
- `shop`
- `search`
- `brand-page`
- `related`
- `editorial-picks`

### Tier 3: Browse and Filter Behavior

#### `filter_changed`

Fired for each semantic filter change.

| Property | Type | Notes |
|---|---|---|
| `page` | string | `"shop"` / `"brand-page"` / `"brands-directory"` |
| `filter_key` | string | `"category"` / `"audience"` / `"brand"` / `"fiber_family"` / `"product_type"` / `"tier"` / `"price"` |
| `action` | string | `"add"` / `"remove"` / `"replace"` |
| `ui_value` | string \| null | Human-readable label such as `"Cotton"` or `"$50-$150"` |
| `query_value` | string \| null | Actual query-param value or serialized range |
| `result_count` | number \| null | Optional; include only if cheap and reliable |
| `active_filter_count` | number | Count after the change |

Notes:
- Use `fiber_family`, not raw material names, because the UI toggles grouped families in [ShopContent.tsx](/Users/zain/Coding/shopping/src/components/shop/ShopContent.tsx:491).
- For price, use `action: "replace"` and set `query_value` to a normalized string like `"50:150"`.
- For category changes that also clear product type, track only the primary user action unless you explicitly want a second event for the implicit reset.

#### `sort_changed`

| Property | Type |
|---|---|
| `page` | string |
| `sort_value` | string |
| `previous_sort` | string |
| `result_count` | number \| null |

#### `search_results_loaded`

This replaces the earlier `search_executed` name. The current shop code fetches on debounced input in [ShopContent.tsx](/Users/zain/Coding/shopping/src/components/shop/ShopContent.tsx:306), so this event represents results loading, not explicit user submission.

| Property | Type |
|---|---|
| `query` | string |
| `query_length` | number |
| `result_count` | number |
| `page` | string |

Rules:
- Fire only after results resolve successfully.
- Do not fire for empty queries.
- Consider suppressing duplicate consecutive payloads for the same query/result count pair if volume becomes noisy.

#### `load_more`

| Property | Type |
|---|---|
| `page` | string |
| `next_page` | number |
| `products_loaded` | number |
| `total_visible` | number |
| `total_available` | number |

#### `filters_cleared`

| Property | Type |
|---|---|
| `page` | string |
| `cleared_filter_count` | number |

### Tier 4: Homepage Engagement

**`homepage_cta_click`**

| Property | Type |
|---|---|
| `section` | string |
| `cta_text` | string |
| `destination` | string |
| `item_name` | string \| null |

Allowed `section` values:
- `hero`
- `shop-by-category`
- `editorial-picks`
- `browse-by-fiber`
- `featured-brands`
- `final-cta`

### Tier 5: Brand Engagement

**`brand_card_click`**

| Property | Type |
|---|---|
| `brand_name` | string |
| `brand_slug` | string |
| `is_fully_natural` | boolean |
| `source` | string |
| `destination` | string |

---

## Implementation Notes

### 1. Provider and Init

Install:
- `npm install posthog-js`

Add env vars:
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

Provider requirements:
- Do not initialize PostHog when the key is missing.
- Export a small `isPostHogEnabled()` utility or equivalent guard.
- All tracking helpers should no-op if PostHog is unavailable.

Recommended init config:
- `capture_pageview: false`
- `capture_pageleave: true`
- `person_profiles: "anonymous"`
- `respect_dnt: true`
- `session_recording: { maskAllInputs: true }`

Recommendation on autocapture:
- Default to `autocapture: false` for launch.
- If you want it temporarily for discovery/debugging, keep it on only with clear documentation that dashboards should use custom events, not `$autocapture`.

### 2. Pageviews

Create `src/lib/posthog/pageview.tsx` and capture `$pageview` on `pathname` and `searchParams` changes.

Requirements:
- Wrap it in `<Suspense>` in `src/app/layout.tsx`
- Include the full path with query string
- Ensure initial page load and client-side navigation both register

### 3. Event Helpers

Create `src/lib/posthog/events.ts` with:
- event name constants
- typed payload shapes
- small helper functions like `trackAffiliateClick(payload)`

Rules:
- Keep payload builders centralized
- Avoid inline string literals for event names across components
- Normalize nullable fields consistently

### 4. Revenue Tracking First

Implement `affiliate_click` first.

Reason:
- It is the highest-value signal
- It validates PostHog wiring before touching many UI surfaces

### 5. Product Discovery Tracking

Update `ProductCard` to accept a `source` prop and emit `product_card_click`.

Current source threading targets:
- `ShopContent` → `shop` or `search`
- `BrandProducts` → `brand-page`
- `RelatedProducts` → `related`
- `EditorialPicks` → `editorial-picks`

Note:
- `src/components/home/EditorialPicks.tsx` currently has its own local `ProductCard` implementation, so this file needs separate instrumentation rather than relying only on the shared product card component.

### 6. Homepage Tracking

Create `TrackedLink` for internal navigations where explicit event metadata matters.

Use it in:
- `Hero.tsx`
- `ShopByCategory.tsx`
- `EditorialPicks.tsx`
- `BrowseByFiber.tsx`
- `FeaturedBrands.tsx`
- `FinalCTA.tsx`

### 7. Filter and Browse Tracking

Instrument only semantic handlers, not low-level button elements.

Shop page handlers currently live in:
- [ShopContent.tsx](/Users/zain/Coding/shopping/src/components/shop/ShopContent.tsx:451)

Brand page handlers currently live in:
- [BrandProducts.tsx](/Users/zain/Coding/shopping/src/components/brand/BrandProducts.tsx:228)

Brands directory handlers currently live in:
- [BrandsContent.tsx](/Users/zain/Coding/shopping/src/components/brand/BrandsContent.tsx:82)

Guidance:
- `setSort()` → `sort_changed`
- `setCategory()`, `setAudience()`, `toggleBrand()`, `toggleFiberFamily()`, `toggleProductType()`, tier change handlers, and price apply handlers → `filter_changed`
- `clearAllFilters()` → `filters_cleared`
- `loadMore()` → `load_more`
- search result resolution → `search_results_loaded`

### 8. Verification and QA

Manual verification:
1. Start local dev with PostHog configured.
2. Open PostHog live events/debug view.
3. Walk the core flows:
   - homepage CTA click
   - shop product card click
   - shop search typing until results load
   - shop filter add/remove
   - shop load more
   - product affiliate click
   - brand page affiliate click
   - brand card click
4. Confirm payload shapes match the schema exactly.
5. Confirm SPA pageviews fire on client-side navigation.
6. Confirm no events fire when env vars are absent.

Recommended code-level verification:
- Add unit tests for payload builders in `events.ts`
- Add one light render/click test for `TrackedLink` or another representative tracked component
- Keep an event matrix in the doc or test fixtures so naming drift is visible in review

---

## Privacy and Data Hygiene

- No PII is intentionally collected
- Catalog metadata is acceptable event context
- `respect_dnt: true`
- `person_profiles: "anonymous"`
- `maskAllInputs: true` for session recording

Open item:
- If a cookie consent banner is added later, route all tracking through opt-in/opt-out controls rather than revisiting every component.

---

## Rollout Order

1. Install PostHog and add env vars
2. Add provider, pageview tracker, and guarded event helpers
3. Ship `affiliate_click`
4. Ship `product_card_click`
5. Ship homepage CTA tracking
6. Ship filter/sort/search/load-more tracking
7. Ship `brand_card_click`
8. Verify dashboards and event quality before adding anything else

---

## Out of Scope for This Phase

- `posthog-node`
- feature flags and experiments
- consent banner UI
- reverse proxying PostHog through first-party ingestion routes
- broad autocapture-based behavioral analysis
