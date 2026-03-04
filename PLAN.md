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
- **Nav**: FIBER logo + Activewear / Brands / About

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

| Column            | Type     | Notes                                          |
| ----------------- | -------- | ---------------------------------------------- |
| id                | uuid     | Primary key                                    |
| brand_id          | uuid     | FK → brands.id                                 |
| name              | text     | Product name                                   |
| slug              | text     | URL-safe, unique                               |
| description       | text     | Product description                            |
| category          | text     | e.g., "activewear"                             |
| price             | numeric  | Current price                                  |
| currency          | text     | Default "USD"                                  |
| image_url         | text     | Primary product image                          |
| additional_images | text[]   | Extra product images                           |
| affiliate_url     | text     | Click-through link with affiliate tracking     |
| is_featured       | boolean  | Show on homepage                               |
| created_at        | timestamptz | Auto-set                                    |

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

Server-side filtering by category, brand slugs, material names, price range with pagination.

---

## Pages

### 1. Homepage (`/`) — DONE ✅

- Hero: "Clothing without the plastic." headline, "Browse Brands" CTA
- Featured Brands: 3 brand cards from DB
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

### 3. Brand Detail Page (`/brand/[slug]`) — DEFERRED

- Not needed for brands-first iteration — brand cards link directly to external websites
- Code exists as fallback (breadcrumb, brand info, product grid) but not actively used
- Will revisit if/when individual product pages are added

### 4. Category Page (`/category/[slug]`) — needs restyle 🔲

- Sidebar filters (fiber type, brand, price range)
- 3-col product grid with pagination
- Code exists but uses old Terra Threads styling

### 5. Product Page (`/product/[slug]`) — needs restyle 🔲

- Product images, material breakdown, price, affiliate CTA
- Code exists but uses old Terra Threads styling

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
- [x] Seed data: **28 brands**, 10 products (3 brands), 7 materials
- [x] Homepage — fully restyled to FIBER design system
- [x] Header + Footer — FIBER branding, correct nav links, mobile hamburger menu
- [x] Color palette + typography in globals.css + layout.tsx
- [x] `/brands` page with slide-out filter panel, tier/fiber/category filters, URL param persistence
- [x] Brand cards link to external websites with Logo.dev logos
- [x] Brands sorted by tier (100% Natural first) then alphabetically
- [x] Homepage featured brands DB-driven, link to external websites
- [x] Brand add/delete scripts (`scripts/add-brand.ts`, `scripts/delete-brand.ts`) with curation policy validation
- [x] Agent prompt for automated brand research (`scripts/add-brand-agent.md`)
- [x] Loading skeletons for product, category, and brand-detail routes
- [x] 404 page (exists, needs restyle)
- [x] Category page code (exists, needs restyle)
- [x] Product page code with JSON-LD structured data (exists, needs restyle)

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
- [x] ~~Restyle product page to FIBER design system~~ — page + ProductImages, MaterialBreakdown, AffiliateButton, RelatedProducts restyled
- [ ] Populate product data for more brands (currently only 3/28 have products)
- [ ] Real product images (all are placeholders)
- [x] ~~Affiliate tracking parameters on outbound links~~ — `affiliateUrl()` utility adds UTM params to BrandCard, FeaturedBrands, AffiliateButton
- [ ] Per-page Open Graph images
- [x] ~~JSON-LD structured data on brands page~~ — ItemList schema with all brands
- [ ] Deploy to production on Vercel

---

## Seed Data Guide

When adding brands + products, follow the curation policy in `CURATION.md`:

- **Accepted fibers**: Merino Wool, Organic Cotton, Cashmere, Silk, Linen, Hemp, Tencel/Lyocell, Modal
- **Allowed in small amounts**: Elastane/Spandex ≤10% (product qualifies as "Nearly Natural")
- **Never allowed**: Polyester, Nylon, Acrylic in any amount
- **Materials already in DB**: Merino Wool, Organic Cotton, Cashmere, Hemp, Tencel Lyocell, Silk, Elastane
- **Materials to add**: Linen, Modal, Alpaca, Yak, Mohair (as needed for new products)

Existing brand IDs follow pattern: `b1000000-0000-0000-0000-00000000000X`
Existing product IDs: `c1000000-0000-0000-0000-00000000000X`
Existing material IDs: `a1000000-0000-0000-0000-00000000000X`

---

## Deliberately Deferred (Post-MVP)

- **User accounts & wishlists** — add when there's repeat traffic
- **Price tracking & sale alerts** — requires scheduled scraping jobs
- **Brand quality tiers** — Gold/Silver/Bronze scoring system
- **Marketplace / checkout** — buying directly on-site
- **Scraping pipeline** — automated product ingestion from brand sites
- **Blog / content marketing** — "best natural fiber running shorts" type SEO content
- **Email newsletter** — new products, sale alerts
- **Mobile app** — only if web traffic warrants it
