import type { MaterialInfo } from "@/types/database";

export function formatPrice(price: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function materialSummary(materials: MaterialInfo[]): string {
  if (!materials || materials.length === 0) return "";

  return materials
    .sort((a, b) => b.percentage - a.percentage)
    .map((m) => `${m.percentage}% ${m.name}`)
    .join(", ");
}

export function isAllNatural(materials: MaterialInfo[]): boolean {
  return materials.length > 0 && materials.every((m) => m.is_natural);
}

export function brandLogoUrl(websiteUrl: string | null, size = 64): string | null {
  if (!websiteUrl) return null;
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  if (!token) return null;
  try {
    const domain = new URL(websiteUrl).hostname.replace(/^www\./, "");
    return `https://img.logo.dev/${domain}?token=${token}&size=${size}&format=png`;
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

export function naturalPercentage(materials: MaterialInfo[]): number {
  if (!materials || materials.length === 0) return 0;
  return materials
    .filter((m) => m.is_natural)
    .reduce((sum, m) => sum + m.percentage, 0);
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
