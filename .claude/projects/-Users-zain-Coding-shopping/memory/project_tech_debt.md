---
name: Tech debt from code review (2026-03-30)
description: Four cleanup items identified during /simplify review of the dynamic brand filter and product card changes
type: project
---

## Tech Debt Items

### 1. Extract shared SQL filter logic between `filter_products` and `get_available_brands`

**Why:** Both RPCs in `supabase/migrations/008_product_type_multi.sql` and `009_available_brands.sql` contain an identical WHERE clause (~35 lines) for filtering products by category, product_type, price, audience, materials, and tier. Any new filter dimension must be updated in both places or they'll silently drift.

**How to apply:** Create a SQL view or function that returns filtered product IDs given the shared filter parameters. Both `filter_products` and `get_available_brands` compose on top of it. This requires a new migration that drops and recreates both functions. Test by verifying shop page filters still work identically before and after.

### 2. Deduplicate `formatCategory` across 4 files

**Why:** The same slug-to-title-case function (`"sports-bras"` → `"Sports Bras"`) is copy-pasted in:
- `src/components/shop/ShopContent.tsx`
- `src/components/brand/BrandCard.tsx`
- `src/components/brand/BrandsContent.tsx`
- `src/app/brand/[slug]/page.tsx`

**How to apply:** Move to `src/lib/utils.ts` (which already has `slugify`) and import everywhere. Search for `formatCategory` to find all instances.

### 3. Consolidate duplicate `getAllMaterials` query functions

**Why:** Two versions exist:
- `src/lib/queries/materials.ts` — returns full `Material[]` (id, name, description, is_natural)
- `src/lib/queries/products.ts` — returns `{ name: string; is_natural: boolean }[]`

**How to apply:** Delete the `products.ts` version. Import from `materials.ts` and `.map()` to the narrower type at the call site if needed. Check `src/app/shop/page.tsx` which is the main consumer.

### 4. Consider merging `get_available_brands` into `filter_products` response

**Why:** When non-brand filters change, two parallel RPCs fire against the DB with nearly identical filter logic. Merging would halve the DB load on filter changes.

**How to apply:** Add an `available_brand_slugs text[]` column to `filter_products` return type, computed via a window function or CTE. The client would extract it from the first row of results. This is a larger refactor — the migration must drop/recreate `filter_products`, the TypeScript types must be updated, and `ShopContent` would derive available brands from the product fetch response instead of a separate effect. Only worth doing if DB load becomes a concern at scale.
