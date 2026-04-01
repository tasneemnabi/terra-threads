"use server";

import { getFilteredProducts, getProductTypesForCategory, getAvailableBrandSlugs } from "@/lib/queries/products";
import type { FilterState, ProductWithBrand } from "@/types/database";

export async function fetchProducts(
  filters: FilterState
): Promise<{ products: ProductWithBrand[]; totalCount: number }> {
  try {
    return await getFilteredProducts(filters);
  } catch (e) {
    console.error("fetchProducts action failed:", e);
    return { products: [], totalCount: 0 };
  }
}

export async function fetchProductTypes(category: string): Promise<string[]> {
  try {
    return await getProductTypesForCategory(category);
  } catch (e) {
    console.error("fetchProductTypes action failed:", e);
    return [];
  }
}

export async function fetchAvailableBrands(
  filters: Omit<FilterState, "page" | "brands" | "sort">
): Promise<string[]> {
  try {
    return await getAvailableBrandSlugs(filters);
  } catch (e) {
    console.error("fetchAvailableBrands action failed:", e);
    return [];
  }
}
