-- Change p_product_type from single text to text[] to support multi-select
-- Drop ALL overloads of filter_products to avoid ambiguity
DROP FUNCTION IF EXISTS filter_products;

CREATE FUNCTION filter_products(
  p_category text DEFAULT NULL,
  p_brand_slugs text[] DEFAULT NULL,
  p_material_names text[] DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
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
    SELECT p.id
    FROM products p
    JOIN brands b ON b.id = p.brand_id
    WHERE
      (p.sync_status IS NULL OR p.sync_status = 'approved')
      AND (p_category IS NULL OR p.category = p_category)
      AND (p_product_type IS NULL OR p.product_type = ANY(p_product_type))
      AND (p_brand_slugs IS NULL OR b.slug = ANY(p_brand_slugs))
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_audience IS NULL OR p_audience = ANY(b.audience))
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
    CASE WHEN p_sort = 'newest' OR p_sort IS NULL THEN pwm.created_at END DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;
