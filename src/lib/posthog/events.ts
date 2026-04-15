import posthog from "posthog-js";
import { isPostHogEnabled } from "./provider";

// --- Event name constants ---

const EVENTS = {
  AFFILIATE_CLICK: "affiliate_click",
  PRODUCT_CARD_CLICK: "product_card_click",
  FILTER_CHANGED: "filter_changed",
  SORT_CHANGED: "sort_changed",
  SEARCH_RESULTS_LOADED: "search_results_loaded",
  LOAD_MORE: "load_more",
  FILTERS_CLEARED: "filters_cleared",
  HOMEPAGE_CTA_CLICK: "homepage_cta_click",
  BRAND_CARD_CLICK: "brand_card_click",
} as const;

// --- Source / page enums (string unions for DX, not runtime checked) ---

export type AffiliateSource = "product-page" | "brand-detail" | "brand-detail-empty";

export type ProductCardSource =
  | "shop"
  | "search"
  | "brand-page"
  | "related"
  | "editorial-picks";

type FilterPage = "shop" | "brand-page" | "brands-directory";

export type HomepageSection =
  | "hero"
  | "shop-by-category"
  | "editorial-picks"
  | "browse-by-fiber"
  | "featured-brands"
  | "final-cta";

type BrandCardSource = "brands-directory";

// --- Payload shapes ---

interface AffiliateClickPayload {
  brand_name: string;
  brand_slug: string;
  product_slug: string | null;
  product_name: string | null;
  category: string | null;
  price: number | null;
  currency: string | null;
  is_available: boolean;
  domain: string;
  source: AffiliateSource;
  destination_url: string;
}

interface ProductCardClickPayload {
  product_slug: string;
  product_name: string;
  brand_name: string;
  brand_slug: string;
  category: string | null;
  price: number | null;
  currency: string | null;
  is_available: boolean;
  source: ProductCardSource;
  destination: string;
}

interface FilterChangedPayload {
  page: FilterPage;
  filter_key:
    | "category"
    | "audience"
    | "brand"
    | "fiber_family"
    | "product_type"
    | "tier"
    | "price";
  action: "add" | "remove" | "replace";
  ui_value: string | null;
  query_value: string | null;
  active_filter_count: number;
  result_count?: number | null;
}

interface SortChangedPayload {
  page: FilterPage;
  sort_value: string;
  previous_sort: string;
  result_count?: number | null;
}

interface SearchResultsLoadedPayload {
  query: string;
  query_length: number;
  result_count: number;
  page: FilterPage;
}

interface LoadMorePayload {
  page: FilterPage;
  next_page: number;
  products_loaded: number;
  total_visible: number;
  total_available: number;
}

interface FiltersClearedPayload {
  page: FilterPage;
  cleared_filter_count: number;
}

interface HomepageCtaClickPayload {
  section: HomepageSection;
  cta_text: string;
  destination: string;
  item_name: string | null;
}

interface BrandCardClickPayload {
  brand_name: string;
  brand_slug: string;
  is_fully_natural: boolean;
  source: BrandCardSource;
  destination: string;
}

// --- Helper: parse domain from URL safely ---

function parseDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// --- Safe capture: no-op when PostHog isn't configured ---

function safeCapture(event: string, properties: object) {
  if (!isPostHogEnabled()) return;
  try {
    posthog.capture(event, properties as Record<string, unknown>);
  } catch {
    // Swallow — analytics should never break user flows
  }
}

// --- Tracking helpers ---

export function trackAffiliateClick(
  payload: Omit<AffiliateClickPayload, "domain"> & { domain?: string }
) {
  const domain = payload.domain ?? parseDomain(payload.destination_url);
  safeCapture(EVENTS.AFFILIATE_CLICK, { ...payload, domain });
}

export function trackProductCardClick(payload: ProductCardClickPayload) {
  safeCapture(EVENTS.PRODUCT_CARD_CLICK, payload);
}

export function trackFilterChanged(payload: FilterChangedPayload) {
  safeCapture(EVENTS.FILTER_CHANGED, payload);
}

export function trackSortChanged(payload: SortChangedPayload) {
  safeCapture(EVENTS.SORT_CHANGED, payload);
}

export function trackSearchResultsLoaded(payload: SearchResultsLoadedPayload) {
  if (!payload.query.trim()) return;
  safeCapture(EVENTS.SEARCH_RESULTS_LOADED, payload);
}

export function trackLoadMore(payload: LoadMorePayload) {
  safeCapture(EVENTS.LOAD_MORE, payload);
}

export function trackFiltersCleared(payload: FiltersClearedPayload) {
  safeCapture(EVENTS.FILTERS_CLEARED, payload);
}

export function trackHomepageCtaClick(payload: HomepageCtaClickPayload) {
  safeCapture(EVENTS.HOMEPAGE_CTA_CLICK, payload);
}

export function trackBrandCardClick(payload: BrandCardClickPayload) {
  safeCapture(EVENTS.BRAND_CARD_CLICK, payload);
}
