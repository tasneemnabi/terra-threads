-- Allow the /shop page to filter on multiple categories at once
-- (e.g. Activewear + Basics). Widen p_category from text to text[] across
-- the shared filter function, filter_products, and get_available_brands.
--
-- Also preserves the availability (013) and product-level audience (012)
-- behavior: the previous version of this migration accidentally reverted
-- to the pre-013/012 filter body, which caused sold-out products to
-- reappear and is_available to drop off the result set.

DROP FUNCTION IF EXISTS get_available_brands(text,text[],numeric,numeric,text,text,text[]);
DROP FUNCTION IF EXISTS get_available_brands(text[],text[],numeric,numeric,text,text,text[]);
DROP FUNCTION IF EXISTS filter_products(text,text[],text[],numeric,numeric,integer,integer,text,text,text,text[]);
DROP FUNCTION IF EXISTS filter_products(text[],text[],text[],numeric,numeric,integer,integer,text,text,text,text[]);
DROP FUNCTION IF EXISTS filtered_product_ids(text,text[],text[],numeric,numeric,text,text,text[]);
DROP FUNCTION IF EXISTS filtered_product_ids(text[],text[],text[],numeric,numeric,text,text,text[]);

CREATE FUNCTION filtered_product_ids(
  p_category text[] DEFAULT NULL,
  p_brand_slugs text[] DEFAULT NULL,
  p_material_names text[] DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_tier text DEFAULT NULL,
  p_audience text DEFAULT NULL,
  p_product_type text[] DEFAULT NULL
)
RETURNS TABLE (product_id uuid)
LANGUAGE sql STABLE
AS $$
  SELECT p.id AS product_id
  FROM products p
  JOIN brands b ON b.id = p.brand_id
  WHERE
    (p.sync_status IS NULL OR p.sync_status = 'approved')
    AND p.is_available = true
    AND p.image_url IS NOT NULL
    AND p.price IS NOT NULL AND p.price > 0
    AND (p_category IS NULL OR p.category = ANY(p_category))
    AND (p_product_type IS NULL OR p.product_type = ANY(p_product_type))
    AND (p_brand_slugs IS NULL OR b.slug = ANY(p_brand_slugs))
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (
      p_audience IS NULL
      OR p.audience = p_audience
      OR (p.audience IS NULL AND p_audience = ANY(b.audience))
    )
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
    AND (
      p_tier IS NULL
      OR (p_tier = 'natural' AND NOT EXISTS (
        SELECT 1 FROM product_materials pm3
        JOIN materials m3 ON m3.id = pm3.material_id
        WHERE pm3.product_id = p.id AND m3.is_natural = false
      ))
      OR (p_tier = 'nearly' AND EXISTS (
        SELECT 1 FROM product_materials pm3
        JOIN materials m3 ON m3.id = pm3.material_id
        WHERE pm3.product_id = p.id AND m3.is_natural = false
      ))
    );
$$;

CREATE FUNCTION filter_products(
  p_category text[] DEFAULT NULL,
  p_brand_slugs text[] DEFAULT NULL,
  p_material_names text[] DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0,
  p_sort text DEFAULT 'newest',
  p_tier text DEFAULT NULL,
  p_audience text DEFAULT NULL,
  p_product_type text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  brand_id uuid,
  name text,
  slug text,
  description text,
  category text,
  product_type text,
  price numeric,
  currency text,
  image_url text,
  additional_images text[],
  affiliate_url text,
  is_featured boolean,
  is_available boolean,
  created_at timestamptz,
  brand_name text,
  brand_slug text,
  brand_website_url text,
  brand_is_fully_natural boolean,
  materials json,
  total_count bigint
)
LANGUAGE sql STABLE
AS $$
  WITH filtered AS (
    SELECT product_id AS id
    FROM filtered_product_ids(
      p_category, p_brand_slugs, p_material_names,
      p_min_price, p_max_price, p_tier, p_audience, p_product_type
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
    pwm.product_type,
    pwm.price,
    pwm.currency,
    pwm.image_url,
    pwm.additional_images,
    pwm.affiliate_url,
    pwm.is_featured,
    pwm.is_available,
    pwm.created_at,
    pwm.brand_name,
    pwm.brand_slug,
    pwm.brand_website_url,
    pwm.brand_is_fully_natural,
    pwm.materials,
    counted.cnt AS total_count
  FROM products_with_materials pwm
  CROSS JOIN counted
  WHERE pwm.id IN (SELECT filtered.id FROM filtered)
  ORDER BY
    CASE WHEN p_sort = 'price-asc' THEN pwm.price END ASC,
    CASE WHEN p_sort = 'price-desc' THEN pwm.price END DESC,
    CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN pwm.created_at::date END DESC,
    CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN pwm.brand_slug END ASC,
    CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN pwm.created_at END DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE FUNCTION get_available_brands(
  p_category text[] DEFAULT NULL,
  p_material_names text[] DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_tier text DEFAULT NULL,
  p_audience text DEFAULT NULL,
  p_product_type text[] DEFAULT NULL
)
RETURNS TABLE (brand_slug text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT b.slug AS brand_slug
  FROM products p
  JOIN brands b ON b.id = p.brand_id
  WHERE p.id IN (
    SELECT product_id
    FROM filtered_product_ids(
      p_category, NULL, p_material_names,
      p_min_price, p_max_price, p_tier, p_audience, p_product_type
    )
  )
  ORDER BY b.slug;
$$;
