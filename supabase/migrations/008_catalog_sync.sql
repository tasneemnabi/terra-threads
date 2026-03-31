-- Partial unique index for dedup of catalog-scraped products by URL.
-- Only applies to products that have an affiliate_url but no shopify_product_id
-- (i.e. products discovered by sync-catalog.ts, not sync-shopify.ts).
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_affiliate_url
  ON products (brand_id, affiliate_url)
  WHERE affiliate_url IS NOT NULL AND shopify_product_id IS NULL;
