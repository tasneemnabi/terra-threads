"use server";

import { getFilteredProducts, getProductTypesForCategory } from "@/lib/queries/products";
import type { FilterState, ProductWithBrand } from "@/types/database";

export async function fetchProducts(
  filters: FilterState
): Promise<{ products: ProductWithBrand[]; totalCount: number }> {
  return getFilteredProducts(filters);
}

export async function fetchProductTypes(category: string): Promise<string[]> {
  return getProductTypesForCategory(category);
}
