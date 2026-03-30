-- Returns distinct brand slugs that have products matching the given filters
-- (brand filter itself is excluded so the sidebar can show relevant brands)
CREATE FUNCTION get_available_brands(
  p_category text DEFAULT NULL,
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
  WHERE
    (p.sync_status IS NULL OR p.sync_status = 'approved')
    AND (p_category IS NULL OR p.category = p_category)
    AND (p_product_type IS NULL OR p.product_type = ANY(p_product_type))
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
  ORDER BY b.slug;
$$;
