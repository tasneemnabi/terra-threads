-- Rank-based brand interleave for "newest" sort.
--
-- Previous sort (013) bucketed by created_at::date then brand_slug, which
-- didn't help when a single batch scrape dropped many products from one
-- brand on the same day — that brand would still dominate the first page.
--
-- New approach: rank each product within its brand by recency (newest = 1),
-- then sort by rank ASC, created_at DESC. Result is round-robin across
-- brands: newest-of-A, newest-of-B, newest-of-C, ..., 2nd-newest-of-A,
-- 2nd-newest-of-B, ... Stable across page loads, so pagination works.

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
  ),
  ranked AS (
    SELECT
      pwm.*,
      row_number() OVER (
        PARTITION BY pwm.brand_slug
        ORDER BY pwm.created_at DESC, pwm.id
      ) AS brand_rank
    FROM products_with_materials pwm
    WHERE pwm.id IN (SELECT filtered.id FROM filtered)
  )
  SELECT
    ranked.id,
    ranked.brand_id,
    ranked.name,
    ranked.slug,
    ranked.description,
    ranked.category,
    ranked.product_type,
    ranked.price,
    ranked.currency,
    ranked.image_url,
    ranked.additional_images,
    ranked.affiliate_url,
    ranked.is_featured,
    ranked.created_at,
    ranked.brand_name,
    ranked.brand_slug,
    ranked.brand_website_url,
    ranked.brand_is_fully_natural,
    ranked.materials,
    counted.cnt AS total_count
  FROM ranked
  CROSS JOIN counted
  ORDER BY
    CASE WHEN p_sort = 'price-asc' THEN ranked.price END ASC,
    CASE WHEN p_sort = 'price-desc' THEN ranked.price END DESC,
    CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN ranked.brand_rank END ASC,
    CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN ranked.created_at END DESC,
    ranked.id
  LIMIT p_limit
  OFFSET p_offset;
$$;
