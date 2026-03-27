import { Suspense } from "react";
import type { Metadata } from "next";
import { getFilteredProducts, getDistinctCategories, getAllMaterials, getProductTypesForCategory } from "@/lib/queries/products";
import { getAllBrands } from "@/lib/queries/brands";
import { ShopContent } from "@/components/shop/ShopContent";
import type { FilterState } from "@/types/database";

export const metadata: Metadata = {
  title: "Shop Natural Fiber Clothing | FIBER",
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
    category: typeof params.category === "string" ? params.category : undefined,
    brands: typeof params.brand === "string" ? params.brand.split(",").filter(Boolean) : undefined,
    materials: typeof params.fiber === "string" ? params.fiber.split(",").filter(Boolean) : undefined,
    minPrice: typeof params.minPrice === "string" ? Number(params.minPrice) : undefined,
    maxPrice: typeof params.maxPrice === "string" ? Number(params.maxPrice) : undefined,
    sort: typeof params.sort === "string" ? (params.sort as FilterState["sort"]) : undefined,
    tier: typeof params.tier === "string" ? (params.tier as FilterState["tier"]) : undefined,
    audience: typeof params.audience === "string" ? params.audience : undefined,
    productType: typeof params.type === "string" ? params.type : undefined,
    page: 1,
  };

  const [{ products, totalCount }, brands, categories, materials, productTypes] = await Promise.all([
    getFilteredProducts(initialFilters),
    getAllBrands(),
    getDistinctCategories(),
    getAllMaterials(),
    initialFilters.category ? getProductTypesForCategory(initialFilters.category) : Promise.resolve([]),
  ]);

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
          categories={categories}
          initialProductTypes={productTypes}
          materials={materials.map((m) => m.name)}
        />
      </Suspense>
    </>
  );
}
