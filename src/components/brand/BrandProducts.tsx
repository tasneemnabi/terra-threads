"use client";

import { useState, useMemo } from "react";
import { PaginatedProductGrid } from "@/components/product/PaginatedProductGrid";
import { formatCategory } from "@/lib/utils";
import type { ProductWithBrand } from "@/types/database";

interface BrandProductsProps {
  products: ProductWithBrand[];
}

export function BrandProducts({ products }: BrandProductsProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      if (p.category) {
        counts.set(p.category, (counts.get(p.category) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([slug, count]) => ({ slug, label: formatCategory(slug), count }));
  }, [products]);

  const filtered = activeCategory
    ? products.filter((p) => p.category === activeCategory)
    : products;

  const showFilters = categories.length > 1;

  return (
    <>
      {showFilters && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-4 py-2 font-body text-[13px] font-medium transition-colors ${
              activeCategory === null
                ? "bg-text text-background"
                : "border border-muted-light text-secondary hover:border-text hover:text-text"
            }`}
          >
            All ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() =>
                setActiveCategory(
                  activeCategory === cat.slug ? null : cat.slug
                )
              }
              className={`rounded-full px-4 py-2 font-body text-[13px] font-medium transition-colors ${
                activeCategory === cat.slug
                  ? "bg-text text-background"
                  : "border border-muted-light text-secondary hover:border-text hover:text-text"
              }`}
            >
              {cat.label} ({cat.count})
            </button>
          ))}
        </div>
      )}
      <PaginatedProductGrid
        products={filtered}
        hideBrand
        key={activeCategory || "all"}
      />
    </>
  );
}
