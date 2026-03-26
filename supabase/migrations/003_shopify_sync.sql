-- =============================================
-- Migration: Shopify sync pipeline columns
-- Adds sync-related columns to brands + products
-- =============================================

-- 1. Brand sync columns
ALTER TABLE brands ADD COLUMN shopify_domain text;
ALTER TABLE brands ADD COLUMN last_synced_at timestamptz;
ALTER TABLE brands ADD COLUMN sync_enabled boolean DEFAULT true;

-- 2. Product sync columns
ALTER TABLE products ADD COLUMN shopify_product_id bigint;
ALTER TABLE products ADD COLUMN shopify_variant_id bigint;
ALTER TABLE products ADD COLUMN last_synced_at timestamptz;
ALTER TABLE products ADD COLUMN sync_status text DEFAULT NULL;
ALTER TABLE products ADD COLUMN material_confidence numeric(3,2);
ALTER TABLE products ADD COLUMN raw_body_html text;

-- 3. Unique constraint for upsert
ALTER TABLE products ADD CONSTRAINT uq_brand_shopify_product UNIQUE (brand_id, shopify_product_id);

-- 4. Index for sync queries
CREATE INDEX idx_products_sync_status ON products(sync_status);
CREATE INDEX idx_products_shopify_product_id ON products(shopify_product_id);
CREATE INDEX idx_brands_shopify_domain ON brands(shopify_domain) WHERE shopify_domain IS NOT NULL;

-- 5. Populate shopify_domain for Shopify brands (22 of 30)
UPDATE brands SET shopify_domain = 'allwear.com' WHERE slug = 'allwear';
UPDATE brands SET shopify_domain = 'ecoaya.com' WHERE slug = 'aya';
UPDATE brands SET shopify_domain = 'beaumontorganic.com' WHERE slug = 'beaumont-organic';
UPDATE brands SET shopify_domain = 'harvestandmill.com' WHERE slug = 'harvest-and-mill';
UPDATE brands SET shopify_domain = 'indigoluna.store' WHERE slug = 'indigo-luna';
UPDATE brands SET shopify_domain = 'industryofallnations.com' WHERE slug = 'industry-of-all-nations';
UPDATE brands SET shopify_domain = 'jungmaven.com' WHERE slug = 'jungmaven';
UPDATE brands SET shopify_domain = 'kotn.com' WHERE slug = 'kotn';
UPDATE brands SET shopify_domain = 'kowtowclothing.com' WHERE slug = 'kowtow';
UPDATE brands SET shopify_domain = 'losano.com' WHERE slug = 'losano';
UPDATE brands SET shopify_domain = 'magiclinen.com' WHERE slug = 'magic-linen';
UPDATE brands SET shopify_domain = 'maggiesorganics.com' WHERE slug = 'maggies-organics';
UPDATE brands SET shopify_domain = 'matethelabel.com' WHERE slug = 'mate-the-label';
UPDATE brands SET shopify_domain = 'nadsunder.com' WHERE slug = 'nads';
UPDATE brands SET shopify_domain = 'naadam.co' WHERE slug = 'naadam';
UPDATE brands SET shopify_domain = 'plainandsimple.com' WHERE slug = 'plainandsimple';
UPDATE brands SET shopify_domain = 'pyneandsmith.com' WHERE slug = 'pyne-and-smith';
UPDATE brands SET shopify_domain = 'rykerclothingco.com' WHERE slug = 'ryker';
UPDATE brands SET shopify_domain = 'tobytiger.co.uk' WHERE slug = 'toby-tiger';
UPDATE brands SET shopify_domain = 'vividlinen.com' WHERE slug = 'vivid-linen';
UPDATE brands SET shopify_domain = 'woronstore.com' WHERE slug = 'woron';
UPDATE brands SET shopify_domain = 'layere.com' WHERE slug = 'layere';

-- Non-Shopify brands (shopify_domain stays NULL):
-- everlane, fair-indigo, icebreaker, pact, prana, quince, rawganique, gil-rodriguez

-- 6. Recreate products_with_materials view (must DROP first — adding columns
--    to products changed what p.* expands to, which alters the view's column
--    list; Postgres blocks CREATE OR REPLACE in that case).
DROP VIEW IF EXISTS products_with_materials;
CREATE VIEW products_with_materials
WITH (security_invoker = on) AS
SELECT
  p.*,
  b.name AS brand_name,
  b.slug AS brand_slug,
  coalesce(
    json_agg(
      json_build_object(
        'material_id', m.id,
        'name', m.name,
        'percentage', pm.percentage,
        'is_natural', m.is_natural
      )
      ORDER BY pm.percentage DESC
    ) FILTER (WHERE m.id IS NOT NULL),
    '[]'::json
  ) AS materials
FROM products p
JOIN brands b ON b.id = p.brand_id
LEFT JOIN product_materials pm ON pm.product_id = p.id
LEFT JOIN materials m ON m.id = pm.material_id
WHERE p.sync_status IS NULL OR p.sync_status = 'approved'
GROUP BY p.id, b.name, b.slug;

-- 7. Recreate filter_products RPC (must DROP first — the view it references
--    was recreated with new columns, changing the return row type).
DROP FUNCTION IF EXISTS filter_products(text,text[],text[],numeric,numeric,integer,integer);
CREATE FUNCTION filter_products(
  p_category text DEFAULT NULL,
  p_brand_slugs text[] DEFAULT NULL,
  p_material_names text[] DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  brand_id uuid,
  name text,
  slug text,
  description text,
  category text,
  price numeric,
  currency text,
  image_url text,
  additional_images text[],
  affiliate_url text,
  is_featured boolean,
  created_at timestamptz,
  brand_name text,
  brand_slug text,
  materials json,
  total_count bigint
)
LANGUAGE sql STABLE
AS $$
  WITH filtered AS (
    SELECT p.id
    FROM products p
    JOIN brands b ON b.id = p.brand_id
    WHERE
      (p.sync_status IS NULL OR p.sync_status = 'approved')
      AND (p_category IS NULL OR p.category = p_category)
      AND (p_brand_slugs IS NULL OR b.slug = ANY(p_brand_slugs))
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (
        p_material_names IS NULL
        OR EXISTS (
          SELECT 1
          FROM product_materials pm2
          JOIN materials m2 ON m2.id = pm2.material_id
          WHERE pm2.product_id = p.id
            AND m2.name = ANY(p_material_names)
        )
      )
  ),
  counted AS (
    SELECT count(*) AS cnt FROM filtered
  )
  SELECT
    pwm.id,
    pwm.brand_id,
    pwm.name,
    pwm.slug,
    pwm.description,
    pwm.category,
    pwm.price,
    pwm.currency,
    pwm.image_url,
    pwm.additional_images,
    pwm.affiliate_url,
    pwm.is_featured,
    pwm.created_at,
    pwm.brand_name,
    pwm.brand_slug,
    pwm.materials,
    counted.cnt AS total_count
  FROM products_with_materials pwm
  CROSS JOIN counted
  WHERE pwm.id IN (SELECT filtered.id FROM filtered)
  ORDER BY pwm.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;
