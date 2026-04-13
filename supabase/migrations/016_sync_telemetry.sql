-- Sync reliability + throughput telemetry.
--
-- Before this migration the daily sync pipeline only logged to stdout, which
-- made post-mortems guesswork: we couldn't tell which brand or URL ate the
-- time, or where in the pipeline a product hung. These tables give us a
-- durable record of every run.
--
--   sync_runs            one row per orchestration run (daily-sync.ts
--                        invocation). Stores phase timings, error count, and
--                        a JSON summary blob for ad-hoc analysis.
--   sync_run_brands      one row per brand per run. Carries stage timings
--                        (discovery/scrape/extract/db) plus counters that
--                        were previously only in SyncStats.
--   sync_run_failures    FAILURE SUBSET only — not every product. Written
--                        whenever a product path times out or errors, so
--                        you can jump straight from the run summary to the
--                        exact URL that broke.
--
-- brands.last_availability_sweep_at
--   Explicit per-brand sweep timestamp. Until now catalog sync inferred the
--   cadence gate from max(products.last_synced_at), which is noisy because
--   approved products get their last_synced_at bumped even when the sweep
--   was partial. This column is only written after a complete successful
--   sweep, so the cadence gate is consistent.

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'manual',  -- 'daily-sync' | 'manual' | 'cron'
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',  -- 'running' | 'success' | 'partial' | 'failed'
  shopify_phase_ms integer,
  catalog_phase_ms integer,
  llm_phase_ms integer,
  total_ms integer,
  error_count integer not null default 0,
  summary_json jsonb
);

create index if not exists sync_runs_started_idx
  on sync_runs(started_at desc);

create table if not exists sync_run_brands (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references sync_runs(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  brand_slug text not null,
  pipeline text not null,  -- 'shopify' | 'catalog'
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_ms integer,

  -- Stage timings (all milliseconds, all nullable — stages may be skipped).
  fetch_ms integer,         -- shopify /products.json or catalog discovery
  discovery_ms integer,     -- alias used by catalog side
  availability_ms integer,  -- approved-product availability sweep
  scrape_ms integer,        -- Playwright scrape loop
  extract_ms integer,       -- locator + regex + dictionary extraction
  db_ms integer,            -- upsert + material sync

  -- Counters.
  fetched_or_discovered integer not null default 0,
  approved_availability_checked integer not null default 0,
  review_rechecks integer not null default 0,
  skipped_settled integer not null default 0,
  skipped_unchanged integer not null default 0,
  skipped_review_cadence integer not null default 0,
  inserted integer not null default 0,
  updated integer not null default 0,
  flagged_review integer not null default 0,
  skipped_banned integer not null default 0,
  skipped_non_clothing integer not null default 0,
  timeouts integer not null default 0,
  errors integer not null default 0,

  aborted_by_wall_ceiling boolean not null default false,
  locator_sources_json jsonb
);

create index if not exists sync_run_brands_run_idx
  on sync_run_brands(run_id);
create index if not exists sync_run_brands_slug_idx
  on sync_run_brands(brand_slug, started_at desc);

create table if not exists sync_run_failures (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references sync_runs(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  brand_slug text not null,
  pipeline text not null,  -- 'shopify' | 'catalog'
  url text,
  product_ref text,  -- e.g. shopify_product_id or scraped name; human-readable
  stage text not null,  -- 'fetch' | 'scrape' | 'extract' | 'image' | 'db' | 'llm' | 'brand'
  started_at timestamptz not null default now(),
  duration_ms integer,
  failure_type text not null,  -- 'timeout' | 'error' | 'abort'
  message text
);

create index if not exists sync_run_failures_run_idx
  on sync_run_failures(run_id);
create index if not exists sync_run_failures_slug_idx
  on sync_run_failures(brand_slug, started_at desc);

-- Per-brand sweep timestamp. Kept separate from last_synced_at (which is
-- bumped by any write, including partial sweeps).
alter table brands
  add column if not exists last_availability_sweep_at timestamptz;
