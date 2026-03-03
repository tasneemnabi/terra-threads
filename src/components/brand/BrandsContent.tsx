"use client";

import { useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { BrandWithDetails } from "@/types/database";
import { BrandCard } from "./BrandCard";

type TierFilter = "all" | "natural" | "nearly";

interface BrandsContentProps {
  brands: BrandWithDetails[];
}

export function BrandsContent({ brands }: BrandsContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read filter state from URL
  const tier = (searchParams.get("tier") as TierFilter) || "all";
  const selectedFiber = searchParams.get("fiber") || null;
  const selectedCategory = searchParams.get("category") || null;

  // Update URL params without full navigation
  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const setTier = (t: TierFilter) => setParam("tier", t);
  const setSelectedFiber = (f: string | null) => setParam("fiber", f);
  const setSelectedCategory = (c: string | null) => setParam("category", c);

  const clearAllFilters = () => {
    router.replace(pathname, { scroll: false });
  };

  const hasActiveFilters = tier !== "all" || selectedFiber || selectedCategory;

  // Derive available fibers and categories from all brands
  const allFibers = useMemo(() => {
    const set = new Set<string>();
    for (const b of brands) {
      for (const f of b.fiber_types) set.add(f);
    }
    return Array.from(set).sort();
  }, [brands]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const b of brands) {
      for (const c of b.categories) set.add(c);
    }
    return Array.from(set).sort();
  }, [brands]);

  // Filter brands
  const filtered = useMemo(() => {
    return brands.filter((b) => {
      if (tier === "natural" && !b.is_fully_natural) return false;
      if (tier === "nearly" && b.is_fully_natural) return false;
      if (selectedFiber && !b.fiber_types.includes(selectedFiber)) return false;
      if (selectedCategory && !b.categories.includes(selectedCategory))
        return false;
      return true;
    });
  }, [brands, tier, selectedFiber, selectedCategory]);

  // Format category name for display
  const formatCategory = (cat: string) => {
    return cat
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <>
      {/* Filters */}
      <section className="px-20 pt-10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4">
          {/* Tier filter */}
          <div className="flex w-fit items-center gap-0 rounded-[8px] bg-surface p-1">
            <button
              onClick={() => setTier("all")}
              className={`rounded-[6px] px-5 py-[10px] font-body text-[14px] font-medium leading-[18px] transition-colors ${
                tier === "all"
                  ? "bg-text text-background"
                  : "text-secondary hover:text-text"
              }`}
            >
              All Brands
            </button>
            <button
              onClick={() => setTier("natural")}
              className={`flex items-center gap-1.5 rounded-[6px] px-5 py-[10px] font-body text-[14px] font-medium leading-[18px] transition-colors ${
                tier === "natural"
                  ? "bg-text text-background"
                  : "text-secondary hover:text-text"
              }`}
            >
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#4A7C59]" />
              100% Natural
            </button>
            <button
              onClick={() => setTier("nearly")}
              className={`flex items-center gap-1.5 rounded-[6px] px-5 py-[10px] font-body text-[14px] font-medium leading-[18px] transition-colors ${
                tier === "nearly"
                  ? "bg-text text-background"
                  : "text-secondary hover:text-text"
              }`}
            >
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#C4963C]" />
              Nearly Natural
            </button>
          </div>

          {/* Fiber pills */}
          {allFibers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-muted">
                Fiber
              </span>
              {allFibers.map((fiber) => (
                <button
                  key={fiber}
                  onClick={() =>
                    setSelectedFiber(selectedFiber === fiber ? null : fiber)
                  }
                  className={`rounded-full border px-4 py-2 font-body text-[13px] leading-[16px] transition-colors ${
                    selectedFiber === fiber
                      ? "border-surface-dark bg-text text-background"
                      : "border-surface-dark text-secondary hover:border-muted"
                  }`}
                >
                  {fiber}
                </button>
              ))}
            </div>
          )}

          {/* Category pills */}
          {allCategories.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-muted">
                Category
              </span>
              <button
                onClick={() => setSelectedCategory(null)}
                className={`rounded-full border px-4 py-2 font-body text-[13px] leading-[16px] transition-colors ${
                  selectedCategory === null
                    ? "border-surface-dark bg-text text-background"
                    : "border-surface-dark text-secondary hover:border-muted"
                }`}
              >
                All
              </button>
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    setSelectedCategory(
                      selectedCategory === cat ? null : cat
                    )
                  }
                  className={`rounded-full border px-4 py-2 font-body text-[13px] leading-[16px] transition-colors ${
                    selectedCategory === cat
                      ? "border-surface-dark bg-text text-background"
                      : "border-surface-dark text-secondary hover:border-muted"
                  }`}
                >
                  {formatCategory(cat)}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Results info */}
      <section className="px-20 pt-8">
        <div className="mx-auto max-w-[1280px]">
          <p className="font-body text-[14px] leading-[18px] text-muted">
            Showing {filtered.length} brand{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      </section>

      {/* Brand grid */}
      <section className="px-20 pt-6">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-4 py-16">
              <p className="font-body text-[16px] text-muted">
                No brands match the selected filters.
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="rounded-full border border-surface-dark px-5 py-2.5 font-body text-[14px] font-medium text-text transition-colors hover:bg-surface"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
