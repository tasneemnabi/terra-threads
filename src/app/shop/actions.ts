"use server";

import { getFilteredProducts, getProductTypesForCategory } from "@/lib/queries/products";
import type { FilterState, ProductWithBrand } from "@/types/database";

export async function fetchProducts(
  filters: FilterState
): Promise<{ products: ProductWithBrand[]; totalCount: number }> {
  return getFilteredProducts(filters);
}

export interface BrandGroup {
  brandName: string;
  brandSlug: string;
  products: ProductWithBrand[];
  totalForBrand: number;
}

export async function fetchProductTypes(category: string): Promise<string[]> {
  return getProductTypesForCategory(category);
}

export async function fetchGroupedProducts(
  filters: Omit<FilterState, "page">
): Promise<{ groups: BrandGroup[]; totalCount: number }> {
  // Fetch a large batch to group by brand (up to 500)
  const result = await getFilteredProducts({ ...filters, page: 1 }, 500);

  // Group by brand
  const brandMap = new Map<string, ProductWithBrand[]>();
  const brandOrder: string[] = [];

  for (const product of result.products) {
    const key = product.brand_slug;
    if (!brandMap.has(key)) {
      brandMap.set(key, []);
      brandOrder.push(key);
    }
    brandMap.get(key)!.push(product);
  }

  const groups: BrandGroup[] = brandOrder.map((slug) => {
    const products = brandMap.get(slug)!;
    return {
      brandName: products[0].brand_name,
      brandSlug: slug,
      products,
      totalForBrand: products.length,
    };
  });

  return { groups, totalCount: result.totalCount };
}
