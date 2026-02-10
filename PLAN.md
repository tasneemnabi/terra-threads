# Natural Fiber Clothing Aggregator — MVP Plan

## Vision

A website that aggregates clothing made from natural fibers (no polyester/plastics). Some brands are fully natural (e.g., Naadam) and all their products qualify. Others (e.g., Gap) have mixed catalogs and only specific products qualify. The site helps consumers find plastic-free clothing, especially in categories where polyester is hardest to avoid.

## MVP Scope

- **10-20 brands** at launch, manually curated
- **1 launch category**: activewear (where polyester is hardest to avoid)
- **Extensible category system** — easy to add outerwear, swimwear, etc. later
- **Women's only** for launch
- **Product-level tagging** — every product lists its fiber composition
- **Affiliate monetization** — users click through to buy on the brand's site
- **Browse + filter only** — no accounts, wishlists, or price tracking

---

## Tech Stack

| Layer          | Choice                     | Rationale                                                        |
| -------------- | -------------------------- | ---------------------------------------------------------------- |
| Framework      | Next.js 15 + TypeScript    | SSG for SEO, React ecosystem, great DX                           |
| Database       | Supabase (Postgres)        | Free tier, admin dashboard, auto-generated API, auth if needed later |
| Styling        | Tailwind CSS               | Rapid UI development, responsive out of the box                  |
| Hosting        | Vercel                     | Zero-config Next.js deploys, free tier sufficient for MVP        |
| Admin          | Supabase dashboard + seeds | Good enough for 10-20 brands; build a proper admin panel later   |
| Affiliate      | Direct brand programs + networks (ShareASale, CJ, Rakuten) | Most clothing brands have affiliate programs |

**Estimated cost at launch: $0/month** (Vercel free tier + Supabase free tier)

---

## Data Model

### `brands`

| Column           | Type    | Notes                                      |
| ---------------- | ------- | ------------------------------------------ |
| id               | uuid    | Primary key                                |
| name             | text    | e.g., "Naadam"                             |
| slug             | text    | URL-safe, unique, e.g., "naadam"           |
| description      | text    | Short brand bio                            |
| website_url      | text    | Brand's homepage                           |
| logo_url         | text    | Brand logo image                           |
| is_fully_natural | boolean | True if the entire catalog is natural fiber |
| created_at       | timestamptz | Auto-set                               |

### `products`

| Column        | Type     | Notes                                          |
| ------------- | -------- | ---------------------------------------------- |
| id            | uuid     | Primary key                                    |
| brand_id      | uuid     | FK → brands.id                                 |
| name          | text     | Product name                                   |
| slug          | text     | URL-safe, unique per brand                     |
| description   | text     | Product description                            |
| price         | decimal  | Current price                                  |
| currency      | text     | Default "USD"                                  |
| affiliate_url | text     | Click-through link with affiliate tracking     |
| image_urls    | text[]   | Array of product image URLs                    |
| category      | text     | e.g., "activewear" — not a fixed enum, new categories added freely |
| created_at    | timestamptz | Auto-set                                    |

### `product_materials`

| Column     | Type    | Notes                                    |
| ---------- | ------- | ---------------------------------------- |
| id         | uuid    | Primary key                              |
| product_id | uuid    | FK → products.id                         |
| material   | text    | e.g., "merino wool", "organic cotton"    |
| percentage | integer | Optional — e.g., 95 for "95% merino"     |

### `materials` (lookup/taxonomy)

| Column     | Type    | Notes                                    |
| ---------- | ------- | ---------------------------------------- |
| id         | uuid    | Primary key                              |
| name       | text    | e.g., "Merino Wool"                      |
| is_natural | boolean | True for natural fibers                  |
| fiber_type | text    | enum: animal, plant — for future tiering |

---

## Pages

### 1. Homepage (`/`)

- Hero section: tagline + mission statement
- Category cards (activewear at launch, more added over time)
- Featured products grid (curated selection)
- "Why natural fibers?" brief explainer section

### 2. Category Page (`/category/[slug]`)

- Product grid with filters sidebar
- Pagination or infinite scroll
- Filter by: fiber type, brand, price range

### 3. Product Page (`/product/[slug]`)

- Product images (carousel or gallery)
- Material composition breakdown (with percentages)
- Price display
- "Shop at [Brand Name]" affiliate CTA button
- Related products from same brand or category

### 4. Brand Page (`/brand/[slug]`)

- Brand logo, description, website link
- Badge if fully-natural brand
- Grid of all their products on the site

### 5. About Page (`/about`)

- Mission statement
- Why avoiding polyester matters
- How products are selected/vetted

---

## Filters

| Filter     | Type         | Options                                           |
| ---------- | ------------ | ------------------------------------------------- |
| Fiber type | Multi-select | Cotton, Linen, Wool/Merino, Silk, Cashmere, Hemp  |
| Brand      | Multi-select | All brands in current category                    |
| Price      | Range slider | Min/max with preset buckets                       |
| Category   | Tabs/select  | Activewear (more added over time)                 |

---

## Data Entry Workflow (Manual Phase)

1. Identify a brand and check their material disclosures
2. For each qualifying product, record:
   - Name, description, category
   - Full material composition with percentages
   - Current price
   - Product page URL → convert to affiliate link
   - Product images (hotlink or download)
3. Enter into Supabase via dashboard or CSV import
4. Redeploy (or use Next.js ISR for incremental updates without full redeploy)

---

## Implementation Order

### Phase 1: Project Setup
- [ ] Initialize Next.js project with TypeScript + Tailwind
- [ ] Set up Supabase project and create database schema
- [ ] Configure Supabase client in Next.js
- [ ] Set up Vercel deployment

### Phase 2: Data Layer
- [ ] Create TypeScript types matching the data model
- [ ] Build data-fetching functions (Supabase queries)
- [ ] Create seed script with sample data (2-3 brands, 10-15 products)

### Phase 3: Core Pages
- [ ] Layout: header with nav, footer
- [ ] Homepage with hero, category cards, featured products
- [ ] Category page with product grid
- [ ] Product detail page
- [ ] Brand page

### Phase 4: Filtering & Search
- [ ] Filter sidebar component (fiber type, brand, price, category)
- [ ] URL-based filter state (shareable filtered views)
- [ ] Client-side filtering with Supabase queries

### Phase 5: Polish & Launch
- [ ] SEO: meta tags, Open Graph, structured data (Product schema)
- [ ] Responsive design pass
- [ ] Populate real data for 10-20 brands
- [ ] Set up affiliate links
- [ ] Deploy to production

---

## Deliberately Deferred (Post-MVP)

- **User accounts & wishlists** — add when there's repeat traffic
- **Price tracking & sale alerts** — requires scheduled scraping jobs
- **Brand quality tiers** — Gold/Silver/Bronze scoring system
- **Marketplace / checkout** — buying directly on-site (requires brand partnerships, payments, logistics)
- **Scraping pipeline** — automated product ingestion from brand sites
- **Blog / content marketing** — "best natural fiber running shorts" type SEO content
- **Email newsletter** — new products, sale alerts
- **Mobile app** — only if web traffic warrants it
