import { Suspense } from "react";
import type { Metadata } from "next";
import { getFilteredProducts, getDistinctCategories, getProductTypesForCategory } from "@/lib/queries/products";
import { getAllMaterials } from "@/lib/queries/materials";
import { getAllBrands } from "@/lib/queries/brands";
import { ShopContent } from "@/components/shop/ShopContent";
import type { FilterState } from "@/types/database";

export const metadata: Metadata = {
  title: "Shop Natural Fiber Clothing",
  description:
    "Browse thousands of products made from natural fibers. Filter by material, brand, price, and more. No polyester, no nylon, no plastic.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const initialFilters: FilterState = {
    categories: typeof params.category === "string" ? params.category.split(",").filter(Boolean) : undefined,
    brands: typeof params.brand === "string" ? params.brand.split(",").filter(Boolean) : undefined,
    materials: typeof params.fiber === "string" ? params.fiber.split(",").filter(Boolean) : undefined,
    minPrice: typeof params.minPrice === "string" ? Number(params.minPrice) : undefined,
    maxPrice: typeof params.maxPrice === "string" ? Number(params.maxPrice) : undefined,
    sort: typeof params.sort === "string" ? (params.sort as FilterState["sort"]) : undefined,
    tier: typeof params.tier === "string" ? (params.tier as FilterState["tier"]) : undefined,
    audience: typeof params.audience === "string" ? params.audience : undefined,
    productTypes: typeof params.type === "string" ? params.type.split(",").filter(Boolean) : undefined,
    page: 1,
  };

  // Product-type suboptions only make sense when exactly one category is selected.
  const singleCategory =
    initialFilters.categories?.length === 1 ? initialFilters.categories[0] : null;

  const [{ products: rawProducts, totalCount }, brands, categories, materials, productTypes] = await Promise.all([
    getFilteredProducts(initialFilters),
    getAllBrands(),
    getDistinctCategories(),
    getAllMaterials(),
    singleCategory ? getProductTypesForCategory(singleCategory) : Promise.resolve([]),
  ]);

  // Interleave brands on default sort so no single brand dominates the top
  const sort = initialFilters.sort || "newest";
  let products = rawProducts;
  if (sort === "newest" && rawProducts.length > 1) {
    const byBrand = new Map<string, typeof rawProducts>();
    for (const p of rawProducts) {
      if (!byBrand.has(p.brand_slug)) byBrand.set(p.brand_slug, []);
      byBrand.get(p.brand_slug)!.push(p);
    }
    const buckets = [...byBrand.values()].sort((a, b) => b.length - a.length);
    products = [];
    let idx = 0;
    while (products.length < rawProducts.length) {
      let added = false;
      for (const bucket of buckets) {
        if (idx < bucket.length) { products.push(bucket[idx]); added = true; }
      }
      if (!added) break;
      idx++;
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Natural Fiber Clothing",
            description:
              "Curated collection of clothing made from natural fibers — no polyester, no nylon.",
            numberOfItems: totalCount,
          }),
        }}
      />

      <Suspense>
        <ShopContent
          initialProducts={products}
          initialTotalCount={totalCount}
          brands={brands.map((b) => ({ name: b.name, slug: b.slug }))}
          audiences={[...new Set(brands.flatMap((b) => b.audience))].sort()}
          categories={categories}
          initialProductTypes={productTypes}
          materials={materials.map((m) => m.name)}
        />
      </Suspense>
    </>
  );
}
