"use server";

import { headers } from "next/headers";
import { getFilteredProducts, getProductTypesForCategory, getAvailableBrandSlugs, searchProducts } from "@/lib/queries/products";
import { rateLimit } from "@/lib/rate-limit";
import type { FilterState, ProductWithBrand } from "@/types/database";

/**
 * Interleave products so no single brand dominates consecutive positions.
 * Groups by brand, then round-robins through brands sorted by how many
 * products each has (largest first to avoid tail clumping).
 */
function interleaveBrands(products: ProductWithBrand[]): ProductWithBrand[] {
  if (products.length <= 1) return products;

  const byBrand = new Map<string, ProductWithBrand[]>();
  for (const p of products) {
    const key = p.brand_slug;
    if (!byBrand.has(key)) byBrand.set(key, []);
    byBrand.get(key)!.push(p);
  }

  // Sort brand buckets largest-first for even distribution
  const buckets = [...byBrand.values()].sort((a, b) => b.length - a.length);
  const result: ProductWithBrand[] = [];
  let idx = 0;

  while (result.length < products.length) {
    let added = false;
    for (const bucket of buckets) {
      if (idx < bucket.length) {
        result.push(bucket[idx]);
        added = true;
      }
    }
    if (!added) break;
    idx++;
  }

  return result;
}

export async function fetchProducts(
  filters: FilterState
): Promise<{ products: ProductWithBrand[]; totalCount: number }> {
  try {
    const result = await getFilteredProducts(filters);

    // Interleave brands on default sort to surface variety
    const sort = filters.sort || "newest";
    if (sort === "newest") {
      result.products = interleaveBrands(result.products);
    }

    return result;
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

export async function fetchSearchResults(
  query: string
): Promise<ProductWithBrand[]> {
  try {
    const headerStore = await headers();
    const ip = headerStore.get("x-forwarded-for") ?? "unknown";
    if (!rateLimit(`search:${ip}`, 30, 60_000)) {
      return [];
    }
    return await searchProducts(query);
  } catch (e) {
    console.error("fetchSearchResults action failed:", e);
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
