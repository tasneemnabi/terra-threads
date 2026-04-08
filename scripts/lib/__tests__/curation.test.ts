import { describe, it, expect } from "vitest";
import {
  slugify,
  isSyntheticStretch,
  isBannedMaterial,
  isKnownNatural,
  validateProduct,
  isExtractionBanned,
  isMaterialNatural,
  getMaterialDescription,
  BANNED_MATERIALS,
  SYNTHETIC_STRETCH,
  MAX_SYNTHETIC_PERCENT,
  TRUSTED_MATERIALS,
} from "../curation.js";

// ─── slugify ────────────────────────────────────────────────────────

describe("slugify", () => {
  it("converts to lowercase and replaces spaces with hyphens", () => {
    expect(slugify("Organic Cotton")).toBe("organic-cotton");
  });

  it("removes apostrophes and quotes", () => {
    expect(slugify("Women's Tops")).toBe("womens-tops");
  });

  it("replaces & with 'and'", () => {
    expect(slugify("Shirts & Blouses")).toBe("shirts-and-blouses");
  });

  it("removes leading and trailing hyphens", () => {
    expect(slugify(" -Test- ")).toBe("test");
  });

  it("collapses multiple non-alphanumeric chars", () => {
    expect(slugify("hello   world!!!")).toBe("hello-world");
  });
});

// ─── isSyntheticStretch ─────────────────────────────────────────────

describe("isSyntheticStretch", () => {
  it("identifies elastane as synthetic stretch", () => {
    expect(isSyntheticStretch("elastane")).toBe(true);
  });

  it("identifies spandex as synthetic stretch", () => {
    expect(isSyntheticStretch("spandex")).toBe(true);
  });

  it("identifies lycra as synthetic stretch", () => {
    expect(isSyntheticStretch("lycra")).toBe(true);
  });

  it("handles mixed case via toLowerCase", () => {
    // isSyntheticStretch lowercases before comparison
    expect(isSyntheticStretch("Spandex")).toBe(true);
    expect(isSyntheticStretch("ELASTANE")).toBe(true);
  });

  it("does not flag cotton", () => {
    expect(isSyntheticStretch("cotton")).toBe(false);
  });

  it("does not flag polyester (it's banned, not stretch)", () => {
    expect(isSyntheticStretch("polyester")).toBe(false);
  });
});

// ─── isBannedMaterial ───────────────────────────────────────────────

describe("isBannedMaterial", () => {
  for (const banned of BANNED_MATERIALS) {
    it(`bans ${banned}`, () => {
      expect(isBannedMaterial(banned)).toBe(true);
    });

    it(`bans ${banned} (case-insensitive via includes)`, () => {
      expect(isBannedMaterial(banned.toUpperCase())).toBe(true);
    });
  }

  it("bans 'Recycled Polyester' (contains polyester)", () => {
    expect(isBannedMaterial("Recycled Polyester")).toBe(true);
  });

  it("does not ban cotton", () => {
    expect(isBannedMaterial("Cotton")).toBe(false);
  });

  it("does not ban spandex", () => {
    expect(isBannedMaterial("Spandex")).toBe(false);
  });
});

// ─── isKnownNatural ─────────────────────────────────────────────────

describe("isKnownNatural", () => {
  it("recognizes Merino Wool as natural", () => {
    expect(isKnownNatural("Merino Wool")).toBe(true);
  });

  it("recognizes Organic Cotton as natural", () => {
    expect(isKnownNatural("Organic Cotton")).toBe(true);
  });

  it("recognizes Spandex as NOT natural", () => {
    expect(isKnownNatural("Spandex")).toBe(false);
  });

  it("recognizes Linen from EXTRA_NATURAL_FIBERS", () => {
    expect(isKnownNatural("Linen")).toBe(true);
  });

  it("recognizes Alpaca from EXTRA_NATURAL_FIBERS", () => {
    expect(isKnownNatural("Alpaca")).toBe(true);
  });
});

// ─── isMaterialNatural ──────────────────────────────────────────────

describe("isMaterialNatural", () => {
  it("returns true for known natural materials", () => {
    expect(isMaterialNatural("Merino Wool")).toBe(true);
    expect(isMaterialNatural("Silk")).toBe(true);
  });

  it("returns false for banned materials", () => {
    expect(isMaterialNatural("Polyester")).toBe(false);
    expect(isMaterialNatural("Nylon")).toBe(false);
  });

  it("returns false for synthetic stretch", () => {
    // Spandex is in KNOWN_MATERIALS with is_natural: false
    expect(isMaterialNatural("Spandex")).toBe(false);
  });

  it("returns true for unknown materials that aren't banned/synthetic", () => {
    // An unknown material defaults to natural if not banned/stretch
    expect(isMaterialNatural("SomeUnknownFiber")).toBe(true);
  });
});

// ─── validateProduct ────────────────────────────────────────────────

describe("validateProduct", () => {
  it("validates a 100% natural product", () => {
    const result = validateProduct(
      { name: "Organic Tee", materials: { "Organic Cotton": 100 } },
      0
    );
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("100% Natural");
    expect(result.errors).toHaveLength(0);
  });

  it("classifies product with ≤10% spandex as 'Nearly Natural'", () => {
    const result = validateProduct(
      {
        name: "Stretch Legging",
        materials: { "Organic Cotton": 92, Spandex: 8 },
      },
      0
    );
    expect(result.valid).toBe(true);
    expect(result.tier).toBe("Nearly Natural");
  });

  it("rejects product with >10% synthetic stretch", () => {
    const result = validateProduct(
      { name: "Super Stretch", materials: { Cotton: 85, Spandex: 15 } },
      0
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("synthetic content"))).toBe(
      true
    );
  });

  it("rejects product with banned material (polyester)", () => {
    const result = validateProduct(
      { name: "Poly Blend", materials: { Cotton: 60, Polyester: 40 } },
      0
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("BANNED"))).toBe(true);
  });

  it("rejects product with no materials", () => {
    const result = validateProduct({ name: "Mystery Shirt", materials: {} }, 0);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("no materials"))).toBe(true);
  });

  it("rejects product with percentages not summing to 100", () => {
    const result = validateProduct(
      { name: "Partial", materials: { Cotton: 60, Linen: 30 } },
      0
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("sum to 90%"))).toBe(true);
  });

  it("rejects product with missing name", () => {
    const result = validateProduct(
      { name: "", materials: { Cotton: 100 } },
      0
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("missing name"))).toBe(true);
  });

  it("rejects product with invalid percentage (0 or negative)", () => {
    const result = validateProduct(
      { name: "Bad Pct", materials: { Cotton: 100, Linen: 0 } },
      0
    );
    expect(result.valid).toBe(false);
  });

  it("warns about unrecognized materials", () => {
    const result = validateProduct(
      { name: "Exotic", materials: { Qiviut: 100 } },
      0
    );
    // Should have a warning about unrecognized material
    expect(result.warnings.some((w) => w.includes("not in the recognized"))).toBe(
      true
    );
  });

  it("validates product with optional price and category", () => {
    const result = validateProduct(
      {
        name: "Tee",
        materials: { Cotton: 100 },
        category: "tops",
        price: 49.99,
      },
      0
    );
    expect(result.valid).toBe(true);
  });

  it("rejects invalid price (≤0)", () => {
    const result = validateProduct(
      { name: "Free Shirt", materials: { Cotton: 100 }, price: 0 },
      0
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invalid price"))).toBe(true);
  });
});

// ─── isExtractionBanned ─────────────────────────────────────────────

describe("isExtractionBanned", () => {
  it("returns true when hasBanned flag is set", () => {
    expect(
      isExtractionBanned({
        hasBanned: true,
        materials: { Cotton: 90, Polyester: 10 },
      })
    ).toBe(true);
  });

  it("returns true when materials contain banned items", () => {
    expect(
      isExtractionBanned({
        hasBanned: false,
        materials: { Cotton: 60, Nylon: 40 },
      })
    ).toBe(true);
  });

  it("returns true when synthetic stretch exceeds MAX_SYNTHETIC_PERCENT", () => {
    expect(
      isExtractionBanned({
        hasBanned: false,
        materials: { Cotton: 85, Spandex: 15 },
      })
    ).toBe(true);
  });

  it("returns false for all-natural extraction", () => {
    expect(
      isExtractionBanned({
        hasBanned: false,
        materials: { "Organic Cotton": 100 },
      })
    ).toBe(false);
  });

  it("returns false for extraction with acceptable spandex (≤10%)", () => {
    expect(
      isExtractionBanned({
        hasBanned: false,
        materials: { Cotton: 95, Spandex: 5 },
      })
    ).toBe(false);
  });
});

// ─── getMaterialDescription ─────────────────────────────────────────

describe("getMaterialDescription", () => {
  it("returns null for materials already in DB (KNOWN_MATERIALS)", () => {
    expect(getMaterialDescription("Merino Wool")).toBeNull();
  });

  it("returns description for EXTRA_NATURAL_FIBERS", () => {
    const desc = getMaterialDescription("Linen");
    expect(desc).toContain("Flax");
  });

  it("returns generic description for unknown materials", () => {
    const desc = getMaterialDescription("SomeFiber");
    expect(desc).toBe("SomeFiber fiber.");
  });
});
