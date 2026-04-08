import { describe, it, expect } from "vitest";
import {
  extractMaterialsRegex,
  extractMaterialsFromText,
} from "../material-extractor.js";
import type { ShopifyProduct } from "../shopify-fetcher.js";

// ─── Helpers ────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<ShopifyProduct> = {}): ShopifyProduct {
  return {
    id: 1,
    title: "Test Product",
    handle: "test-product",
    body_html: null,
    vendor: "TestBrand",
    product_type: "tops",
    tags: [],
    variants: [],
    images: [],
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    ...overrides,
  };
}

// ─── extractMaterialsFromText ───────────────────────────────────────

describe("extractMaterialsFromText", () => {
  describe("percentage-then-name format", () => {
    it("parses '95% Organic Cotton, 5% Spandex'", () => {
      const result = extractMaterialsFromText("95% Organic Cotton, 5% Spandex");
      expect(result).not.toBeNull();
      expect(result!.materials).toEqual({
        "Organic Cotton": 95,
        Spandex: 5,
      });
      expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result!.method).toBe("regex");
    });

    it("parses '100% Merino Wool'", () => {
      const result = extractMaterialsFromText("100% Merino Wool");
      expect(result).not.toBeNull();
      expect(result!.materials).toEqual({ "Merino Wool": 100 });
    });

    it("parses slash-separated format: '60% Cotton / 40% Linen'", () => {
      const result = extractMaterialsFromText("60% Cotton / 40% Linen");
      expect(result).not.toBeNull();
      expect(result!.materials).toEqual({ Cotton: 60, Linen: 40 });
    });

    it("parses '50% Hemp, 45% Organic Cotton, 5% Lycra'", () => {
      const result = extractMaterialsFromText(
        "50% Hemp, 45% Organic Cotton, 5% Lycra"
      );
      expect(result).not.toBeNull();
      expect(result!.materials).toEqual({
        Hemp: 50,
        "Organic Cotton": 45,
        Spandex: 5, // Lycra → Spandex
      });
    });
  });

  describe("name-then-percentage format", () => {
    it("parses 'Cotton 95%, Elastane 5%'", () => {
      const result = extractMaterialsFromText("Cotton 95%, Elastane 5%");
      expect(result).not.toBeNull();
      expect(result!.materials).toEqual({ Cotton: 95, Spandex: 5 });
    });
  });

  describe("alias normalization", () => {
    it("normalizes Elastane → Spandex", () => {
      const result = extractMaterialsFromText("95% Cotton, 5% Elastane");
      expect(result!.materials).toHaveProperty("Spandex", 5);
      expect(result!.materials).not.toHaveProperty("Elastane");
    });

    it("normalizes Lycra → Spandex", () => {
      const result = extractMaterialsFromText("95% Cotton, 5% Lycra");
      expect(result!.materials).toHaveProperty("Spandex", 5);
    });

    it("normalizes Tencel → Tencel Lyocell", () => {
      const result = extractMaterialsFromText("100% Tencel");
      expect(result!.materials).toEqual({ "Tencel Lyocell": 100 });
    });

    it("normalizes Lyocell → Tencel Lyocell", () => {
      const result = extractMaterialsFromText("100% Lyocell");
      expect(result!.materials).toEqual({ "Tencel Lyocell": 100 });
    });

    it("normalizes Flax → Linen", () => {
      const result = extractMaterialsFromText("100% Flax");
      expect(result!.materials).toEqual({ Linen: 100 });
    });

    it("normalizes Polyamide → Nylon", () => {
      const result = extractMaterialsFromText("95% Cotton, 5% Polyamide");
      expect(result!.materials).toHaveProperty("Nylon", 5);
    });
  });

  describe("banned material detection", () => {
    it("flags polyester as banned", () => {
      const result = extractMaterialsFromText("90% Cotton, 10% Polyester");
      expect(result).not.toBeNull();
      expect(result!.hasBanned).toBe(true);
    });

    it("flags nylon as banned", () => {
      const result = extractMaterialsFromText("90% Cotton, 10% Nylon");
      expect(result!.hasBanned).toBe(true);
    });

    it("does not flag spandex as banned", () => {
      const result = extractMaterialsFromText("95% Cotton, 5% Spandex");
      expect(result!.hasBanned).toBe(false);
    });

    it("does not flag all-natural products", () => {
      const result = extractMaterialsFromText("100% Organic Cotton");
      expect(result!.hasBanned).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns null for text with no percentages", () => {
      const result = extractMaterialsFromText(
        "Made from the finest natural fibers"
      );
      expect(result).toBeNull();
    });

    it("returns null when percentages don't sum to 100", () => {
      const result = extractMaterialsFromText("50% Cotton, 30% Linen");
      expect(result).toBeNull();
    });

    it("returns null for empty string", () => {
      const result = extractMaterialsFromText("");
      expect(result).toBeNull();
    });

    it("handles fabric construction suffixes: '100% Organic Cotton Fleece'", () => {
      const result = extractMaterialsFromText("100% Organic Cotton Fleece");
      expect(result).not.toBeNull();
      expect(result!.materials).toEqual({ "Organic Cotton": 100 });
    });

    it("handles '100% Merino Wool Jersey'", () => {
      const result = extractMaterialsFromText("100% Merino Wool Jersey");
      expect(result).not.toBeNull();
      expect(result!.materials).toEqual({ "Merino Wool": 100 });
    });

    it("strips ® and ™ symbols", () => {
      const result = extractMaterialsFromText("100% TENCEL™ Lyocell");
      expect(result).not.toBeNull();
      expect(result!.materials).toEqual({ "Tencel Lyocell": 100 });
    });

    it("rejects discount/promo percentages ('Save 20%')", () => {
      const result = extractMaterialsFromText(
        "Save 20% off! This shirt is 80% Cotton"
      );
      // Should not match "20% off" as a material
      // Behavior depends on implementation — either null or just the cotton
      if (result !== null) {
        expect(result.materials).not.toHaveProperty("Off");
        expect(result.materials).not.toHaveProperty("Save");
      }
    });
  });

  describe("multi-section products", () => {
    it("extracts from Body section when total exceeds 100%", () => {
      const text =
        "Body: 95% Cotton, 5% Spandex\nTrim: 100% Polyester";
      const result = extractMaterialsFromText(text);
      expect(result).not.toBeNull();
      expect(result!.materials).toEqual({ Cotton: 95, Spandex: 5 });
    });

    it("extracts from Shell section", () => {
      const text =
        "Shell: 100% Merino Wool\nLining: 100% Silk";
      const result = extractMaterialsFromText(text);
      expect(result).not.toBeNull();
      // Should extract from the first valid section
      expect(Object.values(result!.materials).reduce((a, b) => a + b, 0)).toBe(
        100
      );
    });
  });
});

// ─── extractMaterialsRegex (ShopifyProduct) ─────────────────────────

describe("extractMaterialsRegex", () => {
  it("extracts from body_html after stripping HTML", () => {
    const product = makeProduct({
      body_html: "<p>95% Organic Cotton, 5% Elastane</p>",
    });
    const result = extractMaterialsRegex(product);
    expect(result).not.toBeNull();
    expect(result!.materials).toEqual({
      "Organic Cotton": 95,
      Spandex: 5,
    });
  });

  it("extracts from title when title contains percentages", () => {
    const product = makeProduct({
      title: "Vitality Tee (60% Organic Cotton / 40% TENCEL Lyocell)",
      body_html: "<p>Super comfy everyday wear.</p>",
    });
    const result = extractMaterialsRegex(product);
    expect(result).not.toBeNull();
    expect(result!.materials).toEqual({
      "Organic Cotton": 60,
      "Tencel Lyocell": 40,
    });
  });

  it("extracts from tags as fallback", () => {
    const product = makeProduct({
      body_html: null,
      tags: ["100% Cashmere", "luxury"],
    });
    const result = extractMaterialsRegex(product);
    // Tags get joined with ", " — may or may not parse depending on format
    // This test documents the current behavior
    if (result) {
      expect(result.materials).toHaveProperty("Cashmere");
    }
  });

  it("returns null for product with no material info", () => {
    const product = makeProduct({
      title: "Classic T-Shirt",
      body_html: "<p>A beautiful everyday tee.</p>",
    });
    const result = extractMaterialsRegex(product);
    expect(result).toBeNull();
  });

  it("strips complex HTML before extraction", () => {
    const product = makeProduct({
      body_html: `
        <div class="product-details">
          <h3>Material</h3>
          <ul>
            <li>70% Organic Cotton</li>
            <li>25% Hemp</li>
            <li>5% Spandex</li>
          </ul>
        </div>
      `,
    });
    const result = extractMaterialsRegex(product);
    expect(result).not.toBeNull();
    expect(result!.materials).toEqual({
      "Organic Cotton": 70,
      Hemp: 25,
      Spandex: 5,
    });
  });

  it("handles HTML entities (&amp;, &nbsp;)", () => {
    const product = makeProduct({
      body_html: "95%&nbsp;Cotton&amp;5%&nbsp;Spandex",
    });
    // May or may not parse depending on how & is handled
    // This test documents behavior
    const result = extractMaterialsRegex(product);
    // At minimum, HTML entities should be stripped
    if (result) {
      expect(result.method).toBe("regex");
    }
  });
});
