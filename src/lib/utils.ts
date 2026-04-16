import type { MaterialInfo } from "@/types/database";

export function formatPrice(price: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function isAllNatural(materials: MaterialInfo[]): boolean {
  return materials.length > 0 && materials.every((m) => m.is_natural);
}

export function brandLogoUrl(websiteUrl: string | null): string | null {
  if (!websiteUrl) return null;
  try {
    const domain = new URL(websiteUrl).hostname.replace(/^www\./, "");
    return `/logos/${domain}.png`;
  } catch {
    return null;
  }
}

export function brandDomain(websiteUrl: string | null): string | null {
  if (!websiteUrl) return null;
  try {
    return new URL(websiteUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function formatCategory(cat: string): string {
  return cat
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function affiliateUrl(brandUrl: string, source: string): string {
  try {
    const url = new URL(brandUrl);
    url.searchParams.set("utm_source", "fiber");
    url.searchParams.set("utm_medium", "referral");
    url.searchParams.set("utm_campaign", source);
    return url.toString();
  } catch {
    return brandUrl;
  }
}
