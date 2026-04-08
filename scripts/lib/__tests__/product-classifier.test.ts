import { describe, it, expect } from "vitest";
import {
  classifyProductType,
  classifyAudience,
  isNonClothing,
  isAccessory,
  shouldRejectProduct,
  mapActivewearType,
  CLOTHING_ONLY_BRANDS,
} from "../product-classifier.js";

// ─── classifyProductType ────────────────────────────────────────────

describe("classifyProductType", () => {
  describe("name-based classification", () => {
    const cases: [string, string][] = [
      ["Women's Classic T-Shirt", "tops"],
      ["Organic Cotton Tank Top", "tops"],
      ["Merino Henley", "tops"],
      ["V-Neck Polo", "tops"],
      ["Cashmere Crew Neck Sweater", "sweaters"],
      ["Wool Cardigan", "sweaters"],
      ["Alpaca Pullover", "sweaters"],
      ["Classic Hoodie", "jackets"],
      ["Winter Jacket", "jackets"],
      ["Half-Zip Sweatshirt", "jackets"],
      ["Yoga Leggings", "leggings"],
      ["7/8 Legging", "leggings"],
      ["High-Rise Flares", "leggings"],
      ["Chino Pants", "pants"],
      ["Cotton Joggers", "pants"],
      ["Slim Trousers", "pants"],
      ["Running Shorts", "shorts"],
      ["Biker Shorts", "shorts"],
      ["A-Line Dress", "dresses"],
      ["T-Shirt Dress", "dresses"],
      ["Linen Kaftan", "dresses"],
      ["Midi Skirt", "skirts"],
      ["Cotton Jumpsuit", "jumpsuits"],
      ["Linen Romper", "jumpsuits"],
      ["Ribbed Bodysuit", "bodysuits"],
      ["Sports Bra", "bras"],
      ["Scoop Bralette", "bras"],
      ["Boxer Briefs", "underwear"],
      ["Cotton Briefs", "underwear"],
      ["Merino Wool Socks", "socks"],
      ["Cotton Tights", "socks"],
      ["Pajama Set", "loungewear"],
      ["Silk Nightgown", "loungewear"],
      ["One-Piece Swimsuit", "swimwear"],
    ];

    for (const [title, expectedType] of cases) {
      it(`classifies "${title}" as ${expectedType}`, () => {
        expect(classifyProductType(title)).toBe(expectedType);
      });
    }
  });

  describe("priority ordering", () => {
    it("classifies 'Boxer Shorts' as underwear, not shorts", () => {
      expect(classifyProductType("Boxer Shorts")).toBe("underwear");
    });

    it("classifies 'T-Shirt Dress' as dresses, not tops", () => {
      expect(classifyProductType("T-Shirt Dress")).toBe("dresses");
    });

    it("classifies 'Sports Bra' as bras, not tops", () => {
      expect(classifyProductType("Sports Bra")).toBe("bras");
    });
  });

  describe("Shopify product_type fallback", () => {
    it("uses Shopify type when name doesn't match", () => {
      expect(classifyProductType("The Essential", "legging")).toBe("leggings");
    });

    it("prefers name match over Shopify type", () => {
      // Name says "dress", Shopify says "tops" — name wins
      expect(classifyProductType("Summer Dress", "tops")).toBe("dresses");
    });
  });

  describe("tags fallback", () => {
    it("uses tags when name and Shopify type don't match", () => {
      expect(
        classifyProductType("The Everyday", undefined, ["cotton", "leggings"])
      ).toBe("leggings");
    });
  });

  it("returns null for unclassifiable products", () => {
    expect(classifyProductType("The Essential")).toBeNull();
  });
});

// ─── isNonClothing ──────────────────────────────────────────────────

describe("isNonClothing", () => {
  const nonClothing = [
    "Yoga Mat",
    "Gift Card",
    "Palo Santo Sticks",
    "Organic Cotton Towel",
    "Duvet Cover",
    "Baby Onesie",
    "Kid's T-Shirt",
    "Tote Bag",
    "Hemp Candle",
    "Loofah Sponge",
  ];

  for (const title of nonClothing) {
    it(`rejects "${title}" as non-clothing`, () => {
      expect(isNonClothing(title)).toBe(true);
    });
  }

  const clothing = [
    "Women's Classic T-Shirt",
    "Merino Wool Sweater",
    "Organic Cotton Leggings",
    "Cashmere Cardigan",
  ];

  for (const title of clothing) {
    it(`does NOT reject "${title}"`, () => {
      expect(isNonClothing(title)).toBe(false);
    });
  }
});

// ─── isAccessory ────────────────────────────────────────────────────

describe("isAccessory", () => {
  const accessories = [
    "Merino Beanie",
    "Cashmere Scarf",
    "Wool Glove",
    "Cotton Headband",
    "Hair Scrunchie",
  ];

  for (const title of accessories) {
    it(`identifies "${title}" as accessory`, () => {
      expect(isAccessory(title)).toBe(true);
    });
  }

  it("does not flag regular clothing", () => {
    expect(isAccessory("Cotton T-Shirt")).toBe(false);
  });
});

// ─── shouldRejectProduct ────────────────────────────────────────────

describe("shouldRejectProduct", () => {
  it("rejects non-clothing products", () => {
    const result = shouldRejectProduct("Yoga Mat", "some-brand");
    expect(result.rejected).toBe(true);
    expect(result.reason).toBe("non-clothing");
  });

  it("rejects accessories", () => {
    const result = shouldRejectProduct("Cashmere Scarf", "some-brand");
    expect(result.rejected).toBe(true);
    expect(result.reason).toBe("accessory");
  });

  it("accepts valid clothing", () => {
    const result = shouldRejectProduct("Cotton T-Shirt", "some-brand");
    expect(result.rejected).toBe(false);
  });

  it("rejects unrecognized products from clothing-only brands", () => {
    const brandSlug = [...CLOTHING_ONLY_BRANDS][0]; // get first clothing-only brand
    const result = shouldRejectProduct("Something Mysterious", brandSlug);
    expect(result.rejected).toBe(true);
    expect(result.reason).toContain("clothing-only brand");
  });

  it("accepts recognized clothing from clothing-only brands", () => {
    const brandSlug = [...CLOTHING_ONLY_BRANDS][0];
    const result = shouldRejectProduct("Linen Dress", brandSlug);
    expect(result.rejected).toBe(false);
  });

  it("does not reject clothing even if product name is ambiguous for non-clothing-only brands", () => {
    // If the product has a valid clothing type, it should not be rejected
    const result = shouldRejectProduct("Cotton T-Shirt Belt", "normal-brand");
    // This has both "t-shirt" (clothing) and "belt" (accessory) — clothing type wins
    expect(result.rejected).toBe(false);
  });
});

// ─── classifyAudience ───────────────────────────────────────────────

describe("classifyAudience", () => {
  describe("tag-based classification (Tier 1)", () => {
    it("identifies Women from tags", () => {
      expect(classifyAudience("T-Shirt", ["shop-women", "cotton"])).toBe(
        "Women"
      );
    });

    it("identifies Men from tags", () => {
      expect(classifyAudience("T-Shirt", ["shop-men", "cotton"])).toBe("Men");
    });

    it("identifies Unisex from tags", () => {
      expect(classifyAudience("T-Shirt", ["unisex", "cotton"])).toBe("Unisex");
    });
  });

  describe("title-based classification (Tier 2)", () => {
    it("identifies Women from title prefix", () => {
      expect(classifyAudience("Women's Classic Tee")).toBe("Women");
    });

    it("identifies Men from title prefix", () => {
      expect(classifyAudience("Men's Classic Tee")).toBe("Men");
    });
  });

  describe("product type classification (Tier 3)", () => {
    it("classifies bras as Women", () => {
      expect(classifyAudience("Scoop Bra", [], "bras")).toBe("Women");
    });

    it("classifies dresses as Women", () => {
      expect(classifyAudience("The Essential", [], "dresses")).toBe("Women");
    });
  });

  describe("brand audience fallback (Tier 4)", () => {
    it("uses single-gender brand audience", () => {
      expect(
        classifyAudience("The Essential", [], undefined, ["Women"])
      ).toBe("Women");
    });

    it("defaults to Unisex for multi-gender brands", () => {
      expect(
        classifyAudience("The Essential", [], undefined, ["Women", "Men"])
      ).toBe("Unisex");
    });
  });

  it("defaults to Unisex when no signal is available", () => {
    expect(classifyAudience("The Essential")).toBe("Unisex");
  });
});

// ─── mapActivewearType ──────────────────────────────────────────────

describe("mapActivewearType", () => {
  it("maps tops → tops", () => {
    expect(mapActivewearType("tops")).toBe("tops");
  });

  it("maps bras → sports-bras", () => {
    expect(mapActivewearType("bras")).toBe("sports-bras");
  });

  it("maps leggings → bottoms", () => {
    expect(mapActivewearType("leggings")).toBe("bottoms");
  });

  it("maps shorts → bottoms", () => {
    expect(mapActivewearType("shorts")).toBe("bottoms");
  });

  it("maps jackets → outerwear", () => {
    expect(mapActivewearType("jackets")).toBe("outerwear");
  });
});
