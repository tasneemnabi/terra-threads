-- Add brand_slug as secondary sort for "newest" to prevent
-- consecutive clustering of products from the same brand.
-- This groups by creation date, then alphabetically by brand within each day.

CREATE OR REPLACE FUNCTION filter_products(
  p_category text DEFAULT NULL,
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
  name text,
  slug text,
  price numeric,
  currency text,
  image_url text,
  external_url text,
  category text,
  product_type text,
  description text,
  brand_id uuid,
  affiliate_url text,
  is_featured boolean,
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
    SELECT pwm.id
    FROM products_with_materials pwm
    WHERE
      (p_category IS NULL OR pwm.category = p_category)
      AND (p_brand_slugs IS NULL OR pwm.brand_slug = ANY(p_brand_slugs))
      AND (p_material_names IS NULL OR EXISTS (
        SELECT 1 FROM json_array_elements(pwm.materials) AS mat
        WHERE mat->>'name' = ANY(p_material_names)
      ))
      AND (p_min_price IS NULL OR pwm.price >= p_min_price)
      AND (p_max_price IS NULL OR pwm.price <= p_max_price)
      AND (p_tier IS NULL
        OR (p_tier = 'natural' AND NOT EXISTS (
          SELECT 1 FROM json_array_elements(pwm.materials) AS mat
          WHERE (mat->>'is_natural')::boolean = false
        ))
        OR (p_tier = 'nearly' AND EXISTS (
          SELECT 1 FROM json_array_elements(pwm.materials) AS mat
          WHERE (mat->>'is_natural')::boolean = false
        ))
      )
      AND (p_audience IS NULL OR pwm.brand_id IN (
        SELECT b.id FROM brands b WHERE p_audience = ANY(b.audience)
      ))
      AND (p_product_type IS NULL OR pwm.product_type = ANY(p_product_type))
  ),
  counted AS (
    SELECT count(*) AS cnt FROM filtered
  )
  SELECT
    pwm.id,
    pwm.name,
    pwm.slug,
    pwm.price,
    pwm.currency,
    pwm.image_url,
    pwm.external_url,
    pwm.category,
    pwm.product_type,
    pwm.description,
    pwm.brand_id,
    pwm.affiliate_url,
    pwm.is_featured,
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
