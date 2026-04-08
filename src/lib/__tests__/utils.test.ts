import { describe, it, expect } from "vitest";
import {
  formatPrice,
  slugify,
  materialSummary,
  isAllNatural,
  brandLogoUrl,
  brandDomain,
  naturalPercentage,
  formatCategory,
  affiliateUrl,
} from "../utils";
import type { MaterialInfo } from "@/types/database";

// ─── Helpers ────────────────────────────────────────────────────────

function makeMaterial(
  overrides: Partial<MaterialInfo> = {}
): MaterialInfo {
  return {
    name: "Cotton",
    percentage: 100,
    is_natural: true,
    material_id: "test-id",
    ...overrides,
  };
}

// ─── formatPrice ────────────────────────────────────────────────────

describe("formatPrice", () => {
  it("formats a whole number price", () => {
    expect(formatPrice(50)).toBe("$50.00");
  });

  it("formats a price with cents", () => {
    expect(formatPrice(49.99)).toBe("$49.99");
  });

  it("formats zero", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("formats large prices with comma separators", () => {
    expect(formatPrice(1250)).toBe("$1,250.00");
  });

  it("supports custom currency", () => {
    const result = formatPrice(50, "EUR");
    // Intl.NumberFormat output varies by locale, but should contain the amount
    expect(result).toContain("50.00");
  });
});

// ─── slugify ────────────────────────────────────────────────────────

describe("slugify", () => {
  it("converts to lowercase with hyphens", () => {
    expect(slugify("Organic Cotton")).toBe("organic-cotton");
  });

  it("removes special characters", () => {
    expect(slugify("100% Natural!")).toBe("100-natural");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("collapses consecutive non-alphanumeric chars", () => {
    expect(slugify("a---b___c")).toBe("a-b-c");
  });
});

// ─── materialSummary ────────────────────────────────────────────────

describe("materialSummary", () => {
  it("formats materials sorted by percentage descending", () => {
    const materials = [
      makeMaterial({ name: "Spandex", percentage: 5, is_natural: false }),
      makeMaterial({ name: "Organic Cotton", percentage: 95 }),
    ];
    expect(materialSummary(materials)).toBe(
      "95% Organic Cotton, 5% Spandex"
    );
  });

  it("returns empty string for empty array", () => {
    expect(materialSummary([])).toBe("");
  });

  it("returns empty string for null/undefined", () => {
    expect(materialSummary(null as unknown as MaterialInfo[])).toBe("");
    expect(materialSummary(undefined as unknown as MaterialInfo[])).toBe("");
  });

  it("handles single material", () => {
    const materials = [makeMaterial({ name: "Merino Wool", percentage: 100 })];
    expect(materialSummary(materials)).toBe("100% Merino Wool");
  });
});

// ─── isAllNatural ───────────────────────────────────────────────────

describe("isAllNatural", () => {
  it("returns true when all materials are natural", () => {
    const materials = [
      makeMaterial({ name: "Cotton", is_natural: true }),
      makeMaterial({ name: "Linen", percentage: 40, is_natural: true }),
    ];
    expect(isAllNatural(materials)).toBe(true);
  });

  it("returns false when any material is not natural", () => {
    const materials = [
      makeMaterial({ name: "Cotton", percentage: 95, is_natural: true }),
      makeMaterial({ name: "Spandex", percentage: 5, is_natural: false }),
    ];
    expect(isAllNatural(materials)).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(isAllNatural([])).toBe(false);
  });
});

// ─── brandLogoUrl ───────────────────────────────────────────────────

describe("brandLogoUrl", () => {
  it("generates logo path from website URL", () => {
    expect(brandLogoUrl("https://www.kotn.com")).toBe("/logos/kotn.com.png");
  });

  it("strips www. prefix", () => {
    expect(brandLogoUrl("https://www.naadam.co")).toBe("/logos/naadam.co.png");
  });

  it("handles URLs without www", () => {
    expect(brandLogoUrl("https://kotn.com")).toBe("/logos/kotn.com.png");
  });

  it("returns null for null input", () => {
    expect(brandLogoUrl(null)).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(brandLogoUrl("not-a-url")).toBeNull();
  });
});

// ─── brandDomain ────────────────────────────────────────────────────

describe("brandDomain", () => {
  it("extracts domain from URL", () => {
    expect(brandDomain("https://www.kotn.com/shop")).toBe("kotn.com");
  });

  it("strips www prefix", () => {
    expect(brandDomain("https://www.example.com")).toBe("example.com");
  });

  it("returns null for null", () => {
    expect(brandDomain(null)).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(brandDomain("not-a-url")).toBeNull();
  });
});

// ─── naturalPercentage ──────────────────────────────────────────────

describe("naturalPercentage", () => {
  it("returns sum of natural material percentages", () => {
    const materials = [
      makeMaterial({ name: "Cotton", percentage: 90, is_natural: true }),
      makeMaterial({ name: "Spandex", percentage: 10, is_natural: false }),
    ];
    expect(naturalPercentage(materials)).toBe(90);
  });

  it("returns 100 for all-natural product", () => {
    const materials = [
      makeMaterial({ name: "Cotton", percentage: 60, is_natural: true }),
      makeMaterial({ name: "Linen", percentage: 40, is_natural: true }),
    ];
    expect(naturalPercentage(materials)).toBe(100);
  });

  it("returns 0 for empty array", () => {
    expect(naturalPercentage([])).toBe(0);
  });

  it("returns 0 for null/undefined", () => {
    expect(naturalPercentage(null as unknown as MaterialInfo[])).toBe(0);
    expect(naturalPercentage(undefined as unknown as MaterialInfo[])).toBe(0);
  });
});

// ─── formatCategory ─────────────────────────────────────────────────

describe("formatCategory", () => {
  it("capitalizes hyphen-separated words", () => {
    expect(formatCategory("t-shirts")).toBe("T Shirts");
  });

  it("handles single word", () => {
    expect(formatCategory("tops")).toBe("Tops");
  });

  it("handles multi-word categories", () => {
    expect(formatCategory("sports-bras")).toBe("Sports Bras");
  });
});

// ─── affiliateUrl ───────────────────────────────────────────────────

describe("affiliateUrl", () => {
  it("adds UTM parameters to a URL", () => {
    const result = affiliateUrl("https://kotn.com/product/tee", "product-page");
    const url = new URL(result);
    expect(url.searchParams.get("utm_source")).toBe("fiber");
    expect(url.searchParams.get("utm_medium")).toBe("referral");
    expect(url.searchParams.get("utm_campaign")).toBe("product-page");
  });

  it("preserves existing query params", () => {
    const result = affiliateUrl(
      "https://kotn.com/product/tee?color=blue",
      "test"
    );
    const url = new URL(result);
    expect(url.searchParams.get("color")).toBe("blue");
    expect(url.searchParams.get("utm_source")).toBe("fiber");
  });

  it("returns original string for invalid URL", () => {
    expect(affiliateUrl("not-a-url", "test")).toBe("not-a-url");
  });
});
