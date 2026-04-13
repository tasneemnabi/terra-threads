# FIBER — Natural Fiber Clothing Aggregator

## Vision

A website that aggregates clothing made from natural fibers (no polyester/plastics). Some brands are fully natural (e.g., Naadam) and all their products qualify. Others (e.g., Allbirds) have mixed catalogs and only specific products qualify. The site helps consumers find plastic-free clothing, especially in categories where polyester is hardest to avoid. See `CURATION.md` for the full curation policy (100% Natural vs Nearly Natural tiers).

## MVP Scope

- **10-20 brands** at launch, manually curated
- **Brands-first approach** — first iteration centers on brand discovery, not individual products
- **1 launch category**: activewear (where polyester is hardest to avoid)
- **Women's only** for launch
- **Product-level tagging** — every product lists its fiber composition with percentages
- **Two curation tiers**: 100% Natural (zero synthetics) and Nearly Natural (≤10% elastane)
- **Affiliate monetization** — users click through to buy on the brand's site
- **Browse + filter only** — no accounts, wishlists, or price tracking

---

## Branding & Design

- **Name**: FIBER
- **Design system**: See `memory/design-system.md` for full spec
- **Palette**: warm cream (#FAF7F2), surface (#F0EBE3), surface-dark (#E8E0D5), text (#2C2420), muted (#9C8E82), muted-light (#C8BDB1), accent/dusty rose (#B5636A), secondary/cool slate (#5A6B6E)
- **Typography**: Space Grotesk (display/headings) + DM Sans (body/UI)
- **Direction**: warm minimal, Swiss-editorial, organic warmth
- **Nav**: FIBER logo + Shop / Brands / About

---

## Tech Stack

| Layer          | Choice                     | Rationale                                                        |
| -------------- | -------------------------- | ---------------------------------------------------------------- |
| Framework      | Next.js 15 + TypeScript    | SSG for SEO, React ecosystem, great DX                           |
| Database       | Supabase (Postgres)        | Free tier, admin dashboard, auto-generated API, auth if needed later |
| Styling        | Tailwind CSS v4            | Rapid UI development, responsive out of the box                  |
| Hosting        | Vercel                     | Zero-config Next.js deploys, free tier sufficient for MVP        |
| Admin          | Supabase dashboard + seeds | Good enough for 10-20 brands; build a proper admin panel later   |
| Affiliate      | Direct brand programs + networks (ShareASale, CJ, Rakuten) | Most clothing brands have affiliate programs |

**Estimated cost at launch: $0/month** (Vercel free tier + Supabase free tier)

---

## Data Model (as implemented in `supabase/schema.sql`)

### `brands`

| Column           | Type        | Notes                                      |
| ---------------- | ----------- | ------------------------------------------ |
| id               | uuid        | Primary key                                |
| name             | text        | e.g., "Naadam"                             |
| slug             | text        | URL-safe, unique, e.g., "naadam"           |
| description      | text        | Short brand bio                            |
| website_url      | text        | Brand's homepage                           |
| is_fully_natural | boolean     | True if entire catalog qualifies           |
| audience         | text[]      | e.g., `{women, men, unisex}`               |
| fiber_types      | text[]      | e.g., `{Merino Wool, Organic Cotton}`      |
| categories       | text[]      | e.g., `{activewear, basics}`               |
| created_at       | timestamptz | Auto-set                                   |

### `products`

| Column               | Type     | Notes                                          |
| -------------------- | -------- | ---------------------------------------------- |
| id                   | uuid     | Primary key                                    |
| brand_id             | uuid     | FK → brands.id                                 |
| name                 | text     | Product name                                   |
| slug                 | text     | URL-safe, unique                               |
| description          | text     | Product description                            |
| category             | text     | e.g., "activewear"                             |
| product_type         | text     | e.g., "leggings", "tops", "bras" — subcategory |
| price                | numeric  | Current price                                  |
| currency             | text     | Default "USD"                                  |
| image_url            | text     | Primary product image                          |
| additional_images    | text[]   | Extra product images                           |
| affiliate_url        | text     | Click-through link with affiliate tracking     |
| is_featured          | boolean  | Show on homepage                               |
| shopify_product_type | text     | Raw Shopify product_type (for reference)       |
| created_at           | timestamptz | Auto-set                                    |

### `materials` (lookup/taxonomy)

| Column      | Type    | Notes                                    |
| ----------- | ------- | ---------------------------------------- |
| id          | uuid    | Primary key                              |
| name        | text    | e.g., "Merino Wool"                      |
| description | text    | Brief explainer                          |
| is_natural  | boolean | True for natural fibers, false for elastane etc. |

### `product_materials` (join table)

| Column      | Type    | Notes                                    |
| ----------- | ------- | ---------------------------------------- |
| id          | uuid    | Primary key                              |
| product_id  | uuid    | FK → products.id                         |
| material_id | uuid    | FK → materials.id                        |
| percentage  | integer | 1-100                                    |

### View: `products_with_materials`

Joins products + brands + materials into a single queryable view.

### RPC: `filter_products`

Server-side filtering by category, product_type, brand slugs, material names, price range, sort order, tier (100% Natural / Nearly Natural), audience (Women / Men), with pagination.

---

## Pages

### 1. Homepage (`/`) — DONE ✅

- Hero: "Clothing without the plastic." headline, "Browse Brands" CTA
- Featured Brands: top 3 100%-natural brand cards, linking to `/brand/[slug]`
- Featured Products: 6 recent approved products with real images (New arrivals section)
- Why It Matters: headline + paragraph + 3 stats (60%, 700K, 200+)
- Browse by Fiber: 4 material cards (Merino Wool, Organic Cotton, Linen, Silk)
- Brand Strip: "Trusted by brands who care" with 6 brand names
- Footer: FIBER + tagline, Shop/Learn/Connect columns

### 2. Brands Page (`/brands`) — DONE ✅

- Header: "Brands that never use plastic" + "Our Curation" eyebrow
- Filter pills: Tier (All / 100% Natural / Nearly Natural), Fiber type, Category
- **Filters persisted in URL params** (`?tier=natural&fiber=Merino+Wool`) — shareable, back-button friendly
- Brand cards grid (3-col): clickable cards linking to brand's external website (new tab)
  - Logo, name, natural/nearly badge, description (2-line clamp), fiber type pills
  - Footer: brand domain (e.g. "allbirds.com") + "Shop {name}" CTA with external link icon
  - Hover shadow transition
- **Sort**: 100% Natural brands first, then Nearly Natural, alphabetical within each group
- Empty filter state includes "Clear all filters" button
- Tier explainer footer (100% Natural vs Nearly Natural definitions)

### 3. Brand Detail Page (`/brand/[slug]`) — DONE ✅

- Brand hero with logo, tier badge, fiber pills, description, "Visit Website" CTA
- Product grid shows all approved products with real Shopify images
- Homepage featured brands link to `/brand/[slug]` (internal navigation)

### 4. Shop Page (`/shop`) — DONE ✅

- Browse all products without going through brands first
- **Audience tabs** (All / Women / Men) — Garmentory-inspired underlined text navigation
- **Category pills** (All, Tops, Dresses, Knitwear, Bottoms, Activewear...) — scrollable horizontal
- **Product type pills** — appear when a category is selected (e.g., Activewear → Leggings, Tops, Bras, Shorts)
- **Tier toggle** (All / 100% / Nearly) — compact, inline with category bar
- **Slide-out filter panel** — sort, fiber, brand, price range (matches brands page pattern)
- **Brand-grouped layout** — products organized by brand with horizontal scroll rows + "View all →" links
- URL-based state for shareable links (`/shop?audience=Women&category=activewear&type=leggings`)
- Server-rendered initial data, client refetch on filter changes

### 5. Category Page (`/category/[slug]`) — superseded by /shop

- Old route still exists but effectively replaced by the Shop page

### 5. Product Page (`/product/[slug]`) — DONE ✅

- **Fiber Facts label** — nutrition-facts-style material composition display (the centerpiece)
  - Total fiber %, natural/synthetic split, individual materials sorted by percentage
  - Tier badge: "100% Natural" (green) or "Nearly Natural" (amber)
  - "Not in this garment" section: confirms no polyester, nylon, or acrylic
  - "Verified by FIBER" trust stamp
  - Handles edge cases: 1 material, 0 materials, percentages not summing to 100%
- **Mini Fiber Facts labels** on ProductCard globally (all grids site-wide: homepage, brand page, related products)
  - Shows natural % and top 2 material names in a compact bordered box
  - Green-tinted for 100% natural products
- **Restyled hero**: brand logo (via Logo.dev) + name → product name → price → Fiber Facts → CTA
- **Aggregator-aware CTA**: dark brown "Shop at {Brand}" button + "You'll be taken to {domain}" redirect context
- **Information hierarchy**: materials-first (above CTA), description below — optimized for trust-building and click-through
- Breadcrumb, JSON-LD structured data, related products section

### 6. About Page (`/about`) — needs restyle 🔲

- Mission, why natural fibers matter, curation policy
- Code exists but uses old Terra Threads styling

---

## Current State

### Done ✅
- [x] Next.js project initialized with TypeScript + Tailwind v4
- [x] Supabase project + database schema created (with RLS)
- [x] Supabase client configured (server + client)
- [x] TypeScript types for data model
- [x] Data-fetching queries (brands, products, materials)
- [x] Seed data: **28 brands**, 18 canonical materials
- [x] Homepage — fully restyled to FIBER design system
- [x] Header + Footer — FIBER branding, correct nav links, mobile hamburger menu
- [x] Color palette + typography in globals.css + layout.tsx
- [x] `/brands` page with slide-out filter panel, tier/fiber/category filters, URL param persistence
- [x] Brand cards link to external websites with Logo.dev logos
- [x] Brands sorted by tier (100% Natural first) then alphabetically
- [x] Homepage featured brands DB-driven, link to `/brand/[slug]` (internal)
- [x] Homepage featured products section — 6 recent products with real images via `getHomepageProducts()`
- [x] Brand add/delete scripts (`scripts/add-brand.ts`, `scripts/delete-brand.ts`) with curation policy validation
- [x] Agent prompt for automated brand research (`scripts/add-brand-agent.md`)
- [x] Shopify sync pipeline (`scripts/sync-shopify.ts`) — fetches products, extracts materials via regex + Gemini LLM, auto-approves trusted compositions
- [x] Material extractor (`scripts/lib/material-extractor.ts`) — regex + dictionary + LLM, title extraction, multi-component split, alias normalization
- [x] CLI review tool (`scripts/review-products.ts`) — interactive terminal product review (the `/admin/review` web dashboard was deleted in the 2026-04-13 security remediation; product review is CLI-only now)
- [x] Playwright scraper (`scripts/scrape-products.ts`) — headless browser for JS-rendered pages
- [x] DB helpers with trusted materials guard — prevents junk material names from entering DB
- [x] **4,445 products approved** across 17 Shopify brands with real images from Shopify CDN
- [x] 18 canonical materials (cleaned from 146 junk entries)
- [x] Non-clothing filter — rejects home goods, gift cards, accessories automatically
- [x] Sync script preserves rejected status on re-sync
- [x] ProductCard + ProductImages components render real Shopify CDN images
- [x] Loading skeletons for product, category, and brand-detail routes
- [x] 404 page (exists, needs restyle)
- [x] Category page code (exists, needs restyle)
- [x] Product page redesigned with Fiber Facts label (nutrition-facts-style material composition)
- [x] FiberFactsMini labels on ProductCard globally (all product grids site-wide)
- [x] Aggregator-aware CTA — dark brown "Shop at {Brand}" + redirect context text
- [x] Brand logo on product page via Logo.dev (requires DB view migration)
- [x] `/shop` page — browse all products with audience tabs, category pills, product type subcategories, brand-grouped layout
- [x] Product type classifier (`scripts/lib/product-classifier.ts`) — keyword-based, 87% classification rate across 11 canonical types
- [x] Sync pipeline stores `product_type` + `shopify_product_type` — future syncs auto-classify
- [x] Non-clothing cleanup — rejected shoes, yoga mats, gift cards, ceramics, tote bags across all brands

---

## Launch Checklist

### Must fix (blockers) 🚫

- [x] ~~**Responsive design pass** — FIBER pages use hardcoded `px-20` padding, `text-[72px]` hero, rigid flex layouts~~ — all pages now use `px-5 sm:px-8 lg:px-20`, hero scales, footer/stats stack on mobile
- [x] ~~**Rewrite About page** — still says "Terra Threads" throughout~~ — fully rewritten with FIBER branding, mission, curation policy, affiliate disclosure
- [x] ~~**Fix hardcoded data** — `BrandStrip` lists brands not in DB; `BrowseByFiber` has fake product counts; Hero "20+ brands" should be dynamic~~ — all now DB-driven
- [x] ~~**Restyle 404 page** — uses old `neutral-*` / `primary` color tokens~~ — restyled with FIBER tokens

### Should fix (important) ⚠️

- [x] ~~**SEO basics** — add `robots.txt`, `sitemap.ts`, Open Graph / Twitter card meta tags~~ — all added
- [x] ~~**Global `error.tsx`** — no error boundary~~ — added with FIBER styling, reset + home link
- [x] ~~**Clean up dead code** — remove unused `CategoryCards.tsx`, `FeaturedProducts.tsx`~~ — deleted
- [x] ~~**Decide on old-styled routes**~~ — nav "Activewear" now links to `/brands?category=activewear` instead of old-styled `/category/activewear`

### Polish (post-launch) 💅

- [x] ~~Restyle category page to FIBER design system~~ — page + all filter components restyled
- [x] ~~Restyle product page to FIBER design system~~ — fully redesigned with Fiber Facts label, mini-labels on all ProductCards, aggregator-aware CTA
- [x] ~~Populate product data for more brands (currently only 3/28 have products)~~ — **4,445 approved products** across all 17 Shopify brands
- [x] ~~Real product images (all are placeholders)~~ — Shopify CDN images, ProductCard + ProductImages fixed
- [x] ~~Affiliate tracking parameters on outbound links~~ — `affiliateUrl()` utility adds UTM params to BrandCard, FeaturedBrands, AffiliateButton
- [ ] Per-page Open Graph images
- [x] ~~JSON-LD structured data on brands page~~ — ItemList schema with all brands
- [x] ~~Deploy to production on Vercel~~ — live
- [x] ~~Non-Shopify brand scraper~~ — 6 of 8 scraped (Icebreaker, Pact, Quince, Fair Indigo, Rawganique, Gil Rodriguez). Everlane & prAna dropped (too much effort).
- [x] ~~Brand detail pages — link brand cards to `/brand/[slug]` instead of external sites now that products exist~~ — featured brands on homepage now link internally
- [x] ~~Category/filter UX~~ — replaced by `/shop` page with brand-grouped browsing, audience tabs, category + product type filtering
- [x] ~~Homepage featured products — DB-driven product cards on homepage~~ — FeaturedProducts component with 6 recent products

---

## Product Pipeline

### Shopify Brands (17 brands — DONE ✅)

Automated via `scripts/sync-shopify.ts`:
1. Fetches from Shopify `/products.json` public API
2. Extracts materials via regex (title + body), dictionary fallback, then Gemini LLM
3. Classifies `product_type` via keyword classifier (`scripts/lib/product-classifier.ts`)
4. Auto-approves when: all materials are trusted canonical names, percentages sum to 100%, confidence >= 0.80
5. Non-clothing (home goods, gift cards, shoes, accessories) auto-rejected
6. Rejected products preserved across re-syncs

**Stats**: ~4,400 Shopify-sourced approved (867 with product_type classified), ~1,100 rejected, 0 in review

### Non-Shopify Brands (6 of 8 — DONE ✅)

Scraped via Playwright + LLM extraction:
- ✅ Rawganique (226 approved), Pact (68), Fair Indigo (28), Gil Rodriguez (15), Quince (14), Icebreaker (8)
- ❌ Everlane & prAna — dropped (too much scraping effort, diminishing returns)

### Materials (18 canonical)

Alpaca, Bamboo Lyocell, Cashmere, Cotton, Elastane, Hemp, Lambswool, Linen, Merino Wool, Modal, Mohair, Organic Cotton, Organic Pima Cotton, Pima Cotton, Silk, Tencel Lyocell, Viscose, Wool

Trusted materials whitelist in `scripts/lib/curation.ts` — `ensureMaterialExists()` blocks any name not in the whitelist from entering the DB.

