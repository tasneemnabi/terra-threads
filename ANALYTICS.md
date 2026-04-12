# PostHog Analytics Integration for FIBER

## Context

FIBER is an affiliate-revenue site — users browse natural fiber clothing and click through to buy on brand sites. Currently the only analytics is `@vercel/analytics` which gives basic pageviews but zero insight into what drives affiliate clicks, how people filter/browse, or which homepage sections generate engagement. PostHog gives us custom events, funnels, session replay, and feature flags on a generous free tier (1M events/month).

---

## New Files to Create

| File | Purpose |
|---|---|
| `src/lib/posthog/provider.tsx` | `"use client"` — PostHog init + `PostHogProvider` wrapper |
| `src/lib/posthog/pageview.tsx` | `"use client"` — SPA pageview tracker using `usePathname` + `useSearchParams` |
| `src/lib/posthog/events.ts` | Event name constants + typed capture helper functions |
| `src/components/ui/TrackedLink.tsx` | `"use client"` — thin `next/link` wrapper that fires a PostHog event on click |
| `src/components/brand/BrandAffiliateLink.tsx` | `"use client"` — extracted affiliate `<a>` for the brand detail page (server component can't have onClick) |

## Files to Modify

| File | Change |
|---|---|
| `src/app/layout.tsx` | Wrap body contents in `<PHProvider>`, add `<PostHogPageview />` in `<Suspense>` |
| `src/components/product/AffiliateButton.tsx` | Add product context props + `onClick` → `trackAffiliateClick()` |
| `src/app/product/[slug]/page.tsx` | Pass extra props to `AffiliateButton` (slug, name, category, price, currency) |
| `src/app/brand/[slug]/page.tsx` | Replace inline affiliate `<a>` tags with `<BrandAffiliateLink>` |
| `src/components/product/ProductCard.tsx` | Add `source` prop + `onClick` → `trackProductCardClick()` |
| `src/components/shop/ShopContent.tsx` | Add tracking calls in `setSort`, `setCategory`, `setAudience`, `toggleBrand`, `toggleFiberFamily`, `clearAllFilters`, `loadMore`, search effect |
| `src/components/brand/BrandProducts.tsx` | Add tracking calls in filter toggles |
| `src/components/brand/BrandsContent.tsx` | Add tracking calls in filter handlers |
| `src/components/brand/BrandCard.tsx` | Add `onClick` → `trackBrandCardClick()` |
| `src/components/home/Hero.tsx` | Replace `<Link>` with `<TrackedLink>` for the two CTAs |
| `src/components/home/ShopByCategory.tsx` | Replace category `<Link>`s with `<TrackedLink>` |
| `src/components/home/EditorialPicks.tsx` | Add tracking to product + "See all" links |
| `src/components/home/BrowseByFiber.tsx` | Replace `<Link>`s with `<TrackedLink>` |
| `src/components/home/FeaturedBrands.tsx` | Replace `<Link>`s with `<TrackedLink>` |
| `src/components/home/FinalCTA.tsx` | Replace `<Link>`s with `<TrackedLink>` |
| `.env.example` | Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` |

---

## Event Schema

### Tier 1 — Revenue-Critical

**`affiliate_click`** — fired on every outbound affiliate link click

| Property | Type | Example |
|---|---|---|
| `brand_name` | string | `"Naadam"` |
| `brand_slug` | string | `"naadam"` |
| `product_slug` | string \| null | `"merino-crop-top"` (null on brand page) |
| `product_name` | string \| null | `"Merino Crop Top"` |
| `category` | string \| null | `"activewear"` |
| `price` | number \| null | `98` |
| `is_available` | boolean | `true` |
| `domain` | string | `"naadam.co"` |
| `source` | string | `"product-page"` / `"brand-detail"` / `"brand-detail-empty"` |

Sources:
- `AffiliateButton.tsx` (product page) — onClick on the `<a>` tag (line 16)
- `BrandAffiliateLink.tsx` (new) — extracted from brand detail page (lines 91-112, 135-155)

### Tier 2 — Product Discovery

**`product_card_click`** — fired when any ProductCard is clicked

| Property | Type | Example |
|---|---|---|
| `product_slug` | string | `"merino-crop-top"` |
| `product_name` | string | `"Merino Crop Top"` |
| `brand_name` | string | `"Naadam"` |
| `brand_slug` | string | `"naadam"` |
| `category` | string | `"activewear"` |
| `price` | number | `98` |
| `source` | string | `"shop"` / `"brand-page"` / `"related"` / `"editorial-picks"` / `"search"` |

Implementation: Add a `source` prop to `ProductCard`, thread from parent components.

### Tier 3 — Filter & Browse Behavior

**`filter_applied`** — fired on each individual filter change

| Property | Type | Example |
|---|---|---|
| `filter_type` | string | `"category"` / `"brand"` / `"fiber"` / `"tier"` / `"audience"` / `"product_type"` / `"price"` |
| `filter_value` | string | `"activewear"` / `"naadam"` / `"Cotton"` |
| `action` | string | `"add"` / `"remove"` |
| `page` | string | `"shop"` / `"brand-page"` / `"brands-directory"` |

Insertion points in `ShopContent.tsx`:
- `setCategory()` (line 455)
- `setAudience()` (line 463)
- `toggleBrand()` (line 499)
- `toggleFiberFamily()` (line 491)
- Product type toggle
- Tier toggle
- Price range in FilterSidebar

**`sort_changed`** — `{ sort_value, previous_sort }`
- In `setSort()` (line 451)

**`search_executed`** — `{ query, result_count }`
- In search effect (line 306), after results return

**`load_more`** — `{ page_number, products_loaded, total_available }`
- In `loadMore()` (line 398)

**`filters_cleared`** — `{ page }`
- In `clearAllFilters()` (line 514)

### Tier 4 — Homepage Engagement

**`homepage_cta_click`** — single event for all homepage section clicks, broken down by `section`

| Property | Type | Example |
|---|---|---|
| `section` | string | `"hero"` / `"shop-by-category"` / `"editorial-picks"` / `"browse-by-fiber"` / `"featured-brands"` / `"final-cta"` |
| `cta_text` | string | `"Shop All Products"` |
| `destination` | string | `"/shop"` / `"/shop?category=activewear"` |
| `item_name` | string \| null | `"Merino Wool"` / `"Naadam"` (for fiber/brand clicks) |

Implementation: Use `TrackedLink` as drop-in replacement for `<Link>` in homepage server components. `TrackedLink` is a client component — server components can render client component children.

### Tier 5 — Brand Engagement

**`brand_card_click`** — `{ brand_name, brand_slug, is_fully_natural, source }`
- In `BrandCard.tsx` onClick

---

## Implementation Steps (in order)

### Step 1: Install + env vars
- `npm install posthog-js`
- Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example`
- Set actual values in `.env.local` (and Vercel dashboard)

### Step 2: Create core PostHog files
- **`src/lib/posthog/provider.tsx`** — `"use client"`, calls `posthog.init()` with config:
  - `person_profiles: 'anonymous'` (no auth in this app)
  - `capture_pageview: false` (manual SPA tracking via PostHogPageview component)
  - `capture_pageleave: true`
  - `autocapture: true` (safety net for uncovered clicks)
  - `session_recording: { maskAllInputs: true }`
  - `respect_dnt: true`
- **`src/lib/posthog/pageview.tsx`** — `"use client"`, captures `$pageview` on `pathname`/`searchParams` change via `useEffect`. Wrapped in `<Suspense>` because `useSearchParams()` requires it in App Router.
- **`src/lib/posthog/events.ts`** — event name constants (`EVENTS.AFFILIATE_CLICK`, etc.) + typed capture functions to prevent typos and enforce consistent property shapes

### Step 3: Wire into layout
- Modify `src/app/layout.tsx`: wrap body contents in `<PHProvider>`, add `<Suspense><PostHogPageview /></Suspense>`
- Keep existing `<Analytics />` from Vercel alongside

### Step 4: Instrument affiliate clicks (revenue tracking goes live)
- Expand `AffiliateButton` props to include product context (slug, name, category, price, currency)
- Add `onClick` handler calling `trackAffiliateClick()`
- Update `src/app/product/[slug]/page.tsx` to pass the extra props (product object is already available)
- Create `BrandAffiliateLink.tsx` (`"use client"`), use it in `src/app/brand/[slug]/page.tsx` to replace the two inline affiliate `<a>` tags (hero CTA at line 91 and empty-state link at line 135) — server components can't have onClick handlers

### Step 5: Instrument product card clicks
- Add `source` prop to `ProductCard` interface
- Add `onClick` calling `trackProductCardClick()`
- Thread `source` from parent contexts:
  - `ShopContent` → `"shop"` (and `"search"` when in search mode)
  - `BrandProducts` → `"brand-page"`
  - `RelatedProducts` → `"related"`
  - `EditorialPicks` → `"editorial-picks"`

### Step 6: Create TrackedLink, instrument homepage
- Create `src/components/ui/TrackedLink.tsx` — wraps `next/link`, fires event on click
- Replace `<Link>` with `<TrackedLink>` in all 6 homepage section components:
  - `Hero.tsx` — 2 CTAs ("Shop All Products", "Browse Brands")
  - `ShopByCategory.tsx` — 6 category cards + "View all" link
  - `EditorialPicks.tsx` — "See all" link + product links
  - `BrowseByFiber.tsx` — hero fiber card + 4 fiber list items + "All fibers" link
  - `FeaturedBrands.tsx` — brand logos + "All brands" link
  - `FinalCTA.tsx` — 2 CTAs ("Start Shopping", "See All Brands")

### Step 7: Instrument filter/browse tracking
- Add tracking calls at each semantic filter function in `ShopContent.tsx`:
  - `setSort()` → `sort_changed`
  - `setCategory()` → `filter_applied` with `filter_type: "category"`
  - `setAudience()` → `filter_applied` with `filter_type: "audience"`
  - `toggleBrand()` → `filter_applied` with `filter_type: "brand"`
  - `toggleFiberFamily()` → `filter_applied` with `filter_type: "fiber"`
  - `clearAllFilters()` → `filters_cleared`
  - `loadMore()` → `load_more`
  - Search effect (after results return) → `search_executed`
- Mirror the same pattern in `BrandProducts.tsx` and `BrandsContent.tsx` filter handlers

### Step 8: Instrument brand card clicks
- Add `onClick` to `BrandCard.tsx` → `trackBrandCardClick()`

### Step 9: Verify
- Run dev server, open PostHog debug toolbar
- Walk through each user flow and confirm events fire with correct properties
- Check session replay is recording
- Confirm SPA pageviews track correctly on client-side navigation

---

## PostHog Configuration Notes

### Autocapture
Keep **ON** as a safety net — captures generic button/link clicks without explicit instrumentation. But do NOT rely on it for affiliate clicks or filter events (need rich custom properties autocapture can't provide).

### Session Replay
- `maskAllInputs: true` — masks price range inputs and search box
- No PII risk since there's no auth, no forms with personal data
- 100% recording rate initially (low traffic) — reduce later if volume grows

### Privacy
- No PII collected — all event properties are public catalog data (product names, prices, brand names)
- `respect_dnt: true` — honors browser Do Not Track setting
- `person_profiles: 'anonymous'` — no user identification
- Cookie consent banner not in scope but PostHog's `opt_out_capturing()` / `opt_in_capturing()` API is ready when we add one

---

## Not in Scope (future enhancements)
- `posthog-node` for server-side events (not needed — all user signals are client-side)
- Feature flags / A/B testing (infrastructure ready once SDK is in, tests created in PostHog dashboard)
- Cookie consent banner UI
- Group analytics (use event property breakdowns by brand/fiber instead)
- Reverse proxy for PostHog (route through `/ingest` to avoid ad blockers — do this post-launch if needed)
