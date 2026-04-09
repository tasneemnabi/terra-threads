-- Add brand_slug as secondary sort for "newest" to prevent
-- consecutive clustering of products from the same brand.

DROP FUNCTION IF EXISTS filter_products(text,text[],text[],numeric,numeric,integer,integer,text,text,text,text[]);

CREATE FUNCTION filter_products(
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
