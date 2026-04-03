"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { PaginatedProductGrid } from "@/components/product/PaginatedProductGrid";
import { formatCategory } from "@/lib/utils";
import type { ProductWithBrand } from "@/types/database";

type SortOption = "newest" | "price-asc" | "price-desc";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

interface BrandProductsProps {
  products: ProductWithBrand[];
}

export function BrandProducts({ products }: BrandProductsProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  // Close sort dropdown on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && sortOpen) setSortOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sortOpen]);

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

  const filtered = useMemo(() => {
    let result = activeCategory
      ? products.filter((p) => p.category === activeCategory)
      : products;

    if (sort === "price-asc") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sort === "price-desc") {
      result = [...result].sort((a, b) => b.price - a.price);
    }

    return result;
  }, [products, activeCategory, sort]);

  const showFilters = categories.length > 1;

  return (
    <>
      {/* Top bar: count + sort — matches shop page pattern */}
      <div className="mb-6 flex items-center justify-between">
        <p className="font-body text-[13px] text-muted">
          {filtered.length.toLocaleString()} product{filtered.length !== 1 ? "s" : ""}
        </p>

        <div className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            className="flex items-center gap-1.5 font-body text-[14px] text-text transition-colors hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:rounded-md"
          >
            Sort by{" "}
            <span className="font-medium">{SORT_LABELS[sort]}</span>
            <svg
              className={`h-3.5 w-3.5 transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {sortOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setSortOpen(false)} />
              <div role="listbox" aria-label="Sort options" className="absolute right-0 top-full z-40 mt-2 w-[200px] rounded-lg border border-muted-light bg-white py-1 shadow-lg">
                {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(
                  ([value, label]) => (
                    <button
                      key={value}
                      role="option"
                      aria-selected={sort === value}
                      onClick={() => { setSort(value); setSortOpen(false); }}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left font-body text-[13px] transition-colors ${
                        sort === value
                          ? "font-medium text-text"
                          : "text-secondary hover:bg-surface/60 hover:text-text"
                      }`}
                    >
                      {label}
                      {sort === value && (
                        <svg className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category pills */}
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
            All
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
              {cat.label}
            </button>
          ))}
        </div>
      )}

      <PaginatedProductGrid
        products={filtered}
        hideBrand
        key={`${activeCategory || "all"}-${sort}`}
      />
    </>
  );
}
