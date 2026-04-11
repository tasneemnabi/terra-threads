-- Change detection for sync pipeline.
--
-- Sync scripts currently re-extract materials for every non-settled product
-- on every run, even when the upstream HTML hasn't changed. These columns
-- let sync skip unchanged products and run per-brand availability sweeps on
-- a cadence instead of daily.
--
--   products.body_hash           sha256 of upstream HTML (Shopify body_html or
--                                scraped page content). Primary change signal —
--                                if it matches the last run, skip re-extraction.
--   products.source_updated_at   auxiliary signal (Shopify's products.updated_at),
--                                kept for debugging/telemetry only. NOT a skip
--                                gate because Shopify bumps it on variant /
--                                inventory / tag edits too.
--   brands.availability_cadence_days   how often the per-brand availability
--                                      sweep runs. Default 7 so brands re-check
--                                      stock weekly; stock-sensitive brands can
--                                      override (e.g. 1 for daily, 14 slower).

alter table products
  add column if not exists source_updated_at timestamptz,
  add column if not exists body_hash text;

alter table brands
  add column if not exists availability_cadence_days int not null default 7;

create index if not exists products_source_updated_idx
  on products(brand_id, source_updated_at);
