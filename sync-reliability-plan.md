# Sync Reliability + Throughput

This document covers the reliability and timing behavior of the daily sync
pipeline. For locator-specific notes and the residual review queue, see
`sync-next-steps.md` — that file is kept narrowly focused on locator work.

## What was already in place before this work

- Body-hash skip gate for Shopify (`products.body_hash` compared to
  `sha256(body_html)`). Approved/rejected/review products skip
  re-processing when upstream HTML hasn't changed.
- Body-hash skip gate for catalog (same idea but on the rendered HTML
  captured by Playwright).
- Settled-status skip: approved and rejected products are short-circuited
  before any extraction work.
- Per-brand availability cadence (`brands.availability_cadence_days`),
  default 7 days for catalog brands. Avoids re-scraping every approved
  product daily.
- LLM batch extraction with rate limit padding (~13 RPM).

## Gaps that this work closes

1. **No outer timeout per product.** A single slow page or stuck Gemini
   call could hang an entire brand for as long as the libraries felt like
   waiting. Kowtow and Magic Linen have hit this in practice.
2. **No brand-level wall-time ceiling.** A brand with hundreds of slow
   pages could starve the rest of the sync.
3. **Catalog scraping was strictly serial.** One brand at a time, one
   product at a time, with a polite 2 s delay. Throughput was determined
   entirely by the slowest brand.
4. **Catalog availability cadence was inferred from
   `max(products.last_synced_at)`** — noisy, because that timestamp is
   bumped on every write, including partial sweeps. The gate could fool
   itself into thinking a brand had been swept recently when it hadn't.
5. **No retry cadence for unresolved Shopify products.** Pending and
   review products were re-extracted on every run even when nothing
   upstream had changed.
6. **No durable telemetry.** Stdout only — post-mortems were guesswork.
   You couldn't tell which URL or which stage burned the time.

## Timeout policy

All timeouts live in `scripts/lib/sync-reliability.ts`. The wrapper is
`withTimeout(promise, ms, stage)` — it races the promise against a timer
and throws `TimeoutError` on expiry. The underlying promise is left to
settle in the background; we don't try to abort it because the SDKs we
depend on (Playwright, Gemini) don't honor `AbortSignal` reliably.

| Layer | Ceiling | Constant |
| --- | --- | --- |
| Per product (locator + extract + image opt + db write) | **60 s** | `TIMEOUT_PER_PRODUCT_MS` |
| Gemini `generateContent` | **30 s** | `TIMEOUT_GEMINI_MS` |
| Playwright scrape (one page, end-to-end) | **45 s** | `TIMEOUT_SCRAPE_MS` |
| Brand wall-time | **15 min** | `BRAND_WALL_TIME_MS` |

On a per-product timeout the pipeline:

1. Bumps `stats.timeouts` and the brand's `timeouts` counter.
2. Writes a `sync_run_failures` row with the URL, stage, and elapsed time.
3. Logs `TIMEOUT (Nms, stage=…): <url>` to stdout.
4. Continues to the next product. The product is left in `review`.

On a Gemini timeout the extractor retries once. If the retry also times
out the entire batch returns empty results so the caller doesn't hang.

On a brand wall-time hit the brand is marked `aborted_by_wall_ceiling`
and the orchestrator moves on. A `sync_run_failures` row records the
abort.

## Concurrency policy

Catalog scraping uses a small pool (`runWithConcurrency`, default
concurrency = 3) sharing a single Playwright browser. Each worker pulls
the next URL from the input queue, processes it under
`TIMEOUT_PER_PRODUCT_MS`, and reports completion. Order in the queue is
preserved but completion order is not.

Shopify sync is **not** parallelized in v1. Shopify's API rate limits
make per-brand parallelism risky and the bigger wall-time win is on the
catalog side.

The concurrency starts deliberately low. Once telemetry confirms the
brands no longer dominate wall time we can tune it up.

## Telemetry tables

Migration `016_sync_telemetry.sql`.

### `sync_runs`

One row per `daily-sync.ts` invocation.

- `id` — uuid (passed into `SyncRunRecorder`).
- `trigger` — `'daily-sync' | 'manual' | 'cron'`.
- `started_at`, `finished_at`, `total_ms`.
- `shopify_phase_ms`, `catalog_phase_ms`, `llm_phase_ms`.
- `status` — `'running' | 'success' | 'partial' | 'failed'`.
- `error_count` — total timeouts + errors across all brands.
- `summary_json` — top-level counters (locator sources, totals).

### `sync_run_brands`

One row per brand per run. Stage timings + counters.

Stage columns (all milliseconds, all nullable):

- `fetch_ms` — Shopify `/products.json` fetch.
- `discovery_ms` — catalog sitemap / collection crawl.
- `availability_ms` — approved-product availability sweep.
- `scrape_ms` — Playwright pool runtime.
- `extract_ms` — locator + regex + dictionary cumulative.
- `db_ms` — upsert + material sync cumulative.

Counters mirror the `SyncStats` shape and add:

- `skipped_review_cadence` — pending/review product retries deferred
  because Shopify `updated_at` is unchanged and `last_synced_at` is
  within the cadence window.
- `timeouts` — per-product timeout count.
- `aborted_by_wall_ceiling` — true if the brand hit the 15 min ceiling.
- `locator_sources_json` — distribution of which locator branches fired.

### `sync_run_failures`

**Failure subset only.** Not every product. Written on timeout, error, or
abort.

- `pipeline`, `brand_slug`, `url`, `product_ref`.
- `stage` — `'fetch' | 'scrape' | 'extract' | 'image' | 'db' | 'llm' | 'product' | 'brand'`.
- `started_at`, `duration_ms`.
- `failure_type` — `'timeout' | 'error' | 'abort'`.
- `message` — error string, capped at 2000 chars.

## Incremental sync gaps that were closed

### Shopify: review cadence gate

For products in `pending` or `review`:

- If Shopify's `updated_at` matches what we stored last run, **and**
- our own `last_synced_at` is within `review_cadence_days` (default 3),

then skip. Counter: `skipped_review_cadence`.

The body_hash gate already covered settled products; this gate covers
the unresolved-but-quiet-upstream case so we stop re-extracting the same
broken product every single day.

The default cadence is global. Per-brand overrides are not in v1 — add
them only if a brand actually needs one.

### Catalog: explicit `last_availability_sweep_at`

The cadence gate now reads `brands.last_availability_sweep_at` directly
instead of `max(products.last_synced_at)`. The new column is only
written when a sweep finishes successfully — partial sweeps don't
advance it, so the gate can't hide stale stock.

## Defensive extractor guardrails

We didn't rewrite the regex. We added containment instead.

- **Stripped-text input cap (20 KB).** `extractFromCombinedText` slices
  long inputs before handing them to regex. A pathological multi-megabyte
  body can no longer dominate wall time.
- **Per-product 60 s timeout.** If extraction (or anything else in the
  product path) blows the budget we bail with a `TimeoutError` and move
  on. The product is recorded as a failure with stage `extract`.

## Operational playbook

### "Which brand is slow?"

```sql
select brand_slug, total_ms, fetch_ms, scrape_ms, extract_ms, db_ms
from sync_run_brands
where run_id = '<latest-run-id>'
order by total_ms desc
limit 10;
```

The orchestrator already prints the top 5 to stdout under "Slowest
brands by total time" and "Slowest brands by scrape time".

### "Which exact URL hung?"

```sql
select brand_slug, stage, failure_type, duration_ms, url, message
from sync_run_failures
where run_id = '<latest-run-id>'
order by duration_ms desc;
```

`stage` tells you whether the time was spent in the scrape, the
locator/extract step, image optimization, or the DB write.

### "When should I use `--force-rescan`?"

When you've shipped a regex/locator change and want every product to be
re-evaluated against it instead of waiting for the cadence gate to
release them naturally. `--force-rescan` bypasses both the body-hash
gate and the review cadence gate.

### "A brand keeps getting aborted by wall-time."

Look at the `sync_run_failures` rows for that brand. If most failures
are stage `scrape` with `failure_type=timeout`, the brand's pages are
genuinely slow — bump `availability_cadence_days` so the brand isn't
swept every run, or write a brand-specific locator that uses
`fetchHtml` (cheap) instead of full Playwright.

If most failures are stage `extract`, the regex is choking on something.
Capture the failing HTML, add a fixture, and tighten the locator.

## Constants summary

```ts
// scripts/lib/sync-reliability.ts
export const TIMEOUT_PER_PRODUCT_MS = 60_000;
export const TIMEOUT_GEMINI_MS = 30_000;
export const TIMEOUT_SCRAPE_MS = 45_000;
export const BRAND_WALL_TIME_MS = 15 * 60_000;
export const DEFAULT_REVIEW_CADENCE_DAYS = 3;
export const EXTRACTOR_INPUT_CAP_BYTES = 20 * 1024;
const CATALOG_CONCURRENCY = 3; // sync-catalog.ts
```

All can be overridden per brand call via `options.{wallTimeCeilingMs,
reviewCadenceDays, concurrency}`.
