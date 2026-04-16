/**
 * sync-reliability.ts — Primitives used by sync-shopify and sync-catalog to
 * contain failures and record what happened.
 *
 * Nothing in here is specific to Shopify or catalog scraping; both pipelines
 * use the same helpers so their telemetry rows line up.
 *
 * Primitives:
 *   withTimeout                bounded Promise.race with a typed error
 *   runWithConcurrency         tiny pool (no external dep) for parallel work
 *   SyncRunRecorder            buffers counters + stage timings per brand,
 *                              flushes to Supabase via upsert, records
 *                              failures as they happen
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Constants ──────────────────────────────────────────────────────

export const TIMEOUT_PER_PRODUCT_MS = 60_000;    // hard ceiling per product path
export const TIMEOUT_GEMINI_MS = 30_000;         // per generateContent call
export const TIMEOUT_SCRAPE_MS = 45_000;         // outer wrap around scrapeProductData
export const BRAND_WALL_TIME_MS = 15 * 60_000;   // 15 min per brand before we bail

export const DEFAULT_REVIEW_CADENCE_DAYS = 3;
const EXTRACTOR_INPUT_CAP_BYTES = 20 * 1024; // 20 KB of stripped text

// ─── Timeout helper ─────────────────────────────────────────────────

export class TimeoutError extends Error {
  readonly stage: string;
  readonly timeoutMs: number;
  constructor(stage: string, timeoutMs: number) {
    super(`${stage} exceeded ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.stage = stage;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Race a promise against a timeout. On timeout we throw TimeoutError; the
 * underlying promise is left to settle on its own (Node will keep the handle
 * alive until it does, but that's acceptable — the alternative is a leak
 * when some library ignores AbortSignal).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stage: string
): Promise<T> {
  let handle: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new TimeoutError(stage, timeoutMs)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (handle) clearTimeout(handle);
  });
}

// ─── Tiny concurrency pool ──────────────────────────────────────────

/**
 * Run `items` through `worker` with at most `concurrency` in flight at a
 * time. Preserves input order in the returned array. Rejections propagate
 * per-item — callers should catch inside `worker` if they want to keep
 * going on failure (both sync pipelines do).
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners: Promise<void>[] = [];

  const runNext = async (): Promise<void> => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  };

  const n = Math.max(1, Math.min(concurrency, items.length));
  for (let i = 0; i < n; i++) runners.push(runNext());
  await Promise.all(runners);
  return results;
}

// ─── Input cap for the regex extractor ──────────────────────────────

/**
 * Cap stripped text at EXTRACTOR_INPUT_CAP_BYTES. We cut by character count
 * instead of byte length for simplicity — close enough in practice and it
 * avoids mid-codepoint slicing.
 */
export function capExtractorInput(text: string): string {
  if (text.length <= EXTRACTOR_INPUT_CAP_BYTES) return text;
  return text.slice(0, EXTRACTOR_INPUT_CAP_BYTES);
}

// ─── Run recorder ───────────────────────────────────────────────────

type SyncPipeline = "shopify" | "catalog";

interface BrandStageTimings {
  fetch_ms?: number;
  discovery_ms?: number;
  availability_ms?: number;
  scrape_ms?: number;
  extract_ms?: number;
  db_ms?: number;
}

interface BrandCounters {
  fetched_or_discovered?: number;
  approved_availability_checked?: number;
  review_rechecks?: number;
  skipped_settled?: number;
  skipped_unchanged?: number;
  skipped_review_cadence?: number;
  inserted?: number;
  updated?: number;
  flagged_review?: number;
  skipped_banned?: number;
  skipped_non_clothing?: number;
  timeouts?: number;
  errors?: number;
}

interface BrandRunSnapshot {
  brandId: string | null;
  brandSlug: string;
  pipeline: SyncPipeline;
  startedAt: Date;
  finishedAt: Date;
  totalMs: number;
  stage: BrandStageTimings;
  counters: BrandCounters;
  abortedByWallCeiling: boolean;
  locatorSources: Record<string, number>;
}

interface FailureRecord {
  brandId: string | null;
  brandSlug: string;
  pipeline: SyncPipeline;
  url?: string;
  productRef?: string;
  stage: string;           // 'fetch' | 'scrape' | 'extract' | 'image' | 'db' | 'llm' | 'brand'
  startedAt: Date;
  durationMs: number;
  failureType: "timeout" | "error" | "abort";
  message: string;
}

/**
 * Writes telemetry rows to Supabase. The recorder is also the place where
 * the brand wall-time ceiling gets enforced — call checkWallTime() inside
 * your per-product loop and bail if it returns true.
 */
export class SyncRunRecorder {
  readonly runId: string | null;
  private readonly supabase: SupabaseClient | null;
  private readonly dryRun: boolean;
  private brandSnapshots: BrandRunSnapshot[] = [];

  constructor(
    supabase: SupabaseClient | null,
    runId: string | null,
    options: { dryRun?: boolean } = {}
  ) {
    this.supabase = supabase;
    this.runId = runId;
    this.dryRun = options.dryRun === true;
  }

  /** Start a brand. Returns a handle you push counters/timings into. */
  beginBrand(
    brandId: string | null,
    brandSlug: string,
    pipeline: SyncPipeline
  ): BrandRunContext {
    return new BrandRunContext(this, brandId, brandSlug, pipeline);
  }

  /** Called by BrandRunContext.finish(). Buffers for summary + writes row. */
  async _finishBrand(snapshot: BrandRunSnapshot): Promise<void> {
    this.brandSnapshots.push(snapshot);
    if (!this.supabase || !this.runId || this.dryRun) return;

    const row = {
      run_id: this.runId,
      brand_id: snapshot.brandId,
      brand_slug: snapshot.brandSlug,
      pipeline: snapshot.pipeline,
      started_at: snapshot.startedAt.toISOString(),
      finished_at: snapshot.finishedAt.toISOString(),
      total_ms: snapshot.totalMs,
      fetch_ms: snapshot.stage.fetch_ms ?? null,
      discovery_ms: snapshot.stage.discovery_ms ?? null,
      availability_ms: snapshot.stage.availability_ms ?? null,
      scrape_ms: snapshot.stage.scrape_ms ?? null,
      extract_ms: snapshot.stage.extract_ms ?? null,
      db_ms: snapshot.stage.db_ms ?? null,
      fetched_or_discovered: snapshot.counters.fetched_or_discovered ?? 0,
      approved_availability_checked:
        snapshot.counters.approved_availability_checked ?? 0,
      review_rechecks: snapshot.counters.review_rechecks ?? 0,
      skipped_settled: snapshot.counters.skipped_settled ?? 0,
      skipped_unchanged: snapshot.counters.skipped_unchanged ?? 0,
      skipped_review_cadence: snapshot.counters.skipped_review_cadence ?? 0,
      inserted: snapshot.counters.inserted ?? 0,
      updated: snapshot.counters.updated ?? 0,
      flagged_review: snapshot.counters.flagged_review ?? 0,
      skipped_banned: snapshot.counters.skipped_banned ?? 0,
      skipped_non_clothing: snapshot.counters.skipped_non_clothing ?? 0,
      timeouts: snapshot.counters.timeouts ?? 0,
      errors: snapshot.counters.errors ?? 0,
      aborted_by_wall_ceiling: snapshot.abortedByWallCeiling,
      locator_sources_json: snapshot.locatorSources,
    };

    const { error } = await this.supabase.from("sync_run_brands").insert(row);
    if (error) {
      // Telemetry must never hang the sync — log and continue.
      console.warn(`  [telemetry] failed to write sync_run_brands: ${error.message}`);
    }
  }

  /** Record a single failure row. Safe to call mid-run. */
  async recordFailure(failure: FailureRecord): Promise<void> {
    if (!this.supabase || !this.runId || this.dryRun) return;
    const row = {
      run_id: this.runId,
      brand_id: failure.brandId,
      brand_slug: failure.brandSlug,
      pipeline: failure.pipeline,
      url: failure.url ?? null,
      product_ref: failure.productRef ?? null,
      stage: failure.stage,
      started_at: failure.startedAt.toISOString(),
      duration_ms: failure.durationMs,
      failure_type: failure.failureType,
      message: failure.message.slice(0, 2000),
    };
    const { error } = await this.supabase.from("sync_run_failures").insert(row);
    if (error) {
      console.warn(`  [telemetry] failed to write sync_run_failures: ${error.message}`);
    }
  }

  /** Returns all brand snapshots buffered so far (for final summary). */
  getBrandSnapshots(): BrandRunSnapshot[] {
    return this.brandSnapshots;
  }
}

/**
 * A mutable accumulator for one brand's run. Held open for the duration of
 * syncBrand / syncCatalogBrand, then .finish()ed to push the row to the
 * recorder.
 */
export class BrandRunContext {
  private readonly recorder: SyncRunRecorder;
  readonly brandId: string | null;
  readonly brandSlug: string;
  readonly pipeline: SyncPipeline;
  readonly startedAt: Date;
  private readonly startMs: number;

  readonly stage: BrandStageTimings = {};
  readonly counters: BrandCounters = {};
  readonly locatorSources: Record<string, number> = {};
  abortedByWallCeiling = false;

  constructor(
    recorder: SyncRunRecorder,
    brandId: string | null,
    brandSlug: string,
    pipeline: SyncPipeline
  ) {
    this.recorder = recorder;
    this.brandId = brandId;
    this.brandSlug = brandSlug;
    this.pipeline = pipeline;
    this.startedAt = new Date();
    this.startMs = Date.now();
  }

  /** True if we've blown the per-brand wall-time ceiling. */
  checkWallTime(ceilingMs: number = BRAND_WALL_TIME_MS): boolean {
    return Date.now() - this.startMs > ceilingMs;
  }

  elapsedMs(): number {
    return Date.now() - this.startMs;
  }

  addStage(key: keyof BrandStageTimings, ms: number): void {
    this.stage[key] = (this.stage[key] ?? 0) + ms;
  }

  bump(key: keyof BrandCounters, by: number = 1): void {
    this.counters[key] = (this.counters[key] ?? 0) + by;
  }

  recordLocatorSource(source: string): void {
    this.locatorSources[source] = (this.locatorSources[source] || 0) + 1;
  }

  /** Helper: record a product-level failure and bump timeout/error counters. */
  async recordProductFailure(
    args: {
      stage: string;
      url?: string;
      productRef?: string;
      startedAt: Date;
      durationMs: number;
      failureType: "timeout" | "error";
      message: string;
    }
  ): Promise<void> {
    if (args.failureType === "timeout") {
      this.bump("timeouts");
    } else {
      this.bump("errors");
    }
    await this.recorder.recordFailure({
      brandId: this.brandId,
      brandSlug: this.brandSlug,
      pipeline: this.pipeline,
      url: args.url,
      productRef: args.productRef,
      stage: args.stage,
      startedAt: args.startedAt,
      durationMs: args.durationMs,
      failureType: args.failureType,
      message: args.message,
    });
  }

  async finish(): Promise<void> {
    const finishedAt = new Date();
    await this.recorder._finishBrand({
      brandId: this.brandId,
      brandSlug: this.brandSlug,
      pipeline: this.pipeline,
      startedAt: this.startedAt,
      finishedAt,
      totalMs: finishedAt.getTime() - this.startedAt.getTime(),
      stage: this.stage,
      counters: this.counters,
      abortedByWallCeiling: this.abortedByWallCeiling,
      locatorSources: this.locatorSources,
    });
  }
}

// ─── Run lifecycle helpers ──────────────────────────────────────────

/**
 * Insert a sync_runs row and return its id. Caller passes that id into
 * SyncRunRecorder. If Supabase is unavailable we still return null so the
 * sync can run against an empty recorder.
 */
export async function startRun(
  supabase: SupabaseClient,
  trigger: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({ trigger, status: "running" })
    .select("id")
    .single();

  if (error || !data) {
    console.warn(`  [telemetry] failed to create sync_runs row: ${error?.message ?? "no data"}`);
    return null;
  }
  return data.id as string;
}

interface FinishRunArgs {
  shopifyPhaseMs?: number;
  catalogPhaseMs?: number;
  llmPhaseMs?: number;
  errorCount: number;
  status: "success" | "partial" | "failed";
  summary: Record<string, unknown>;
}

export async function finishRun(
  supabase: SupabaseClient,
  runId: string | null,
  args: FinishRunArgs
): Promise<void> {
  if (!runId) return;
  const finishedAt = new Date().toISOString();
  const startedAt = (
    await supabase.from("sync_runs").select("started_at").eq("id", runId).single()
  ).data?.started_at as string | undefined;
  const totalMs = startedAt
    ? Date.now() - new Date(startedAt).getTime()
    : null;

  const { error } = await supabase
    .from("sync_runs")
    .update({
      finished_at: finishedAt,
      status: args.status,
      shopify_phase_ms: args.shopifyPhaseMs ?? null,
      catalog_phase_ms: args.catalogPhaseMs ?? null,
      llm_phase_ms: args.llmPhaseMs ?? null,
      total_ms: totalMs,
      error_count: args.errorCount,
      summary_json: args.summary,
    })
    .eq("id", runId);

  if (error) {
    console.warn(`  [telemetry] failed to finalize sync_runs row: ${error.message}`);
  }
}

