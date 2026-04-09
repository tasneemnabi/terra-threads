"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { BrandWithDetails } from "@/types/database";
import { BrandCard } from "./BrandCard";
import { formatCategory } from "@/lib/utils";

type TierFilter = "all" | "natural" | "nearly";

interface BrandsContentProps {
  brands: BrandWithDetails[];
}

function AccordionSection({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-surface-dark">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 font-body text-[13px] font-semibold uppercase tracking-[0.06em] text-text transition-colors hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:rounded-md"
      >
        {label}
        <svg
          className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

export function BrandsContent({ brands }: BrandsContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filterOpen, setFilterOpen] = useState(false);

  // Lock body scroll when panel is open
  useEffect(() => {
    if (filterOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [filterOpen]);

  // Close filter panel on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && filterOpen) setFilterOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filterOpen]);

  // Read filter state from URL
  const tier = (searchParams.get("tier") as TierFilter) || "all";
  const selectedFiber = searchParams.get("fiber") || null;
  const selectedCategory = searchParams.get("category") || null;
  const selectedAudience = searchParams.get("audience") || null;

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
  const setSelectedAudience = (a: string | null) => setParam("audience", a);

  const clearAllFilters = () => {
    router.replace(pathname, { scroll: false });
  };

  const hasActiveFilters =
    tier !== "all" || selectedFiber || selectedCategory || selectedAudience;
  const activeFilterCount = [selectedFiber, selectedCategory, selectedAudience].filter(Boolean).length;

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

  const allAudiences = useMemo(() => {
    const set = new Set<string>();
    for (const b of brands) {
      for (const a of b.audience) set.add(a);
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
      if (selectedAudience && !b.audience.includes(selectedAudience))
        return false;
      return true;
    });
  }, [brands, tier, selectedFiber, selectedCategory, selectedAudience]);


  return (
    <>
      {/* Filter bar — single row */}
      <section className="px-5 sm:px-8 lg:px-20 pt-10">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          {/* Filters — right side */}
          <div className="flex items-center gap-3">
            {/* Active filter pills */}
            {selectedFiber && (
              <button
                onClick={() => setSelectedFiber(null)}
                className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-body text-[13px] font-medium text-white transition-colors hover:bg-accent/85"
              >
                {selectedFiber}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-body text-[13px] font-medium text-white transition-colors hover:bg-accent/85"
              >
                {formatCategory(selectedCategory)}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {selectedAudience && (
              <button
                onClick={() => setSelectedAudience(null)}
                className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-body text-[13px] font-medium text-white transition-colors hover:bg-accent/85"
              >
                {selectedAudience}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Filter button */}
            <button
              onClick={() => setFilterOpen(true)}
              className="flex items-center gap-2 rounded-[8px] border border-surface-dark px-5 py-[10px] font-body text-[14px] font-medium text-text transition-all hover:border-muted hover:bg-surface hover:shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
              </svg>
              Filter &amp; Sort
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-background">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Filter side panel + overlay */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Filter & Sort">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-text/20"
            onClick={() => setFilterOpen(false)}
          />

          {/* Panel */}
          <div className="relative flex h-full w-full max-w-[400px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-dark px-8 py-6">
              <h2 className="font-display text-[20px] font-semibold tracking-[-0.01em] text-text">
                Filter &amp; Sort
              </h2>
              <div className="flex items-center gap-4">
                <span className="font-body text-[13px] text-muted">
                  {filtered.length} brand{filtered.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => setFilterOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-text"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Accordion sections */}
            <div className="flex-1 overflow-y-auto px-8">
              <AccordionSection label="For" defaultOpen={!!selectedAudience}>
                <div className="flex flex-col gap-0.5">
                  {allAudiences.map((aud) => (
                    <button
                      key={aud}
                      onClick={() =>
                        setSelectedAudience(selectedAudience === aud ? null : aud)
                      }
                      className={`flex items-center justify-between rounded-md px-3 py-2.5 text-left font-body text-[14px] transition-colors ${
                        selectedAudience === aud
                          ? "bg-surface font-medium text-text"
                          : "text-secondary hover:bg-surface/60 hover:text-text"
                      }`}
                    >
                      {aud}
                      {selectedAudience === aud && (
                        <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </AccordionSection>

              <AccordionSection label="Fiber" defaultOpen={!!selectedFiber}>
                <div className="flex flex-col gap-0.5">
                  {allFibers.map((fiber) => (
                    <button
                      key={fiber}
                      onClick={() =>
                        setSelectedFiber(selectedFiber === fiber ? null : fiber)
                      }
                      className={`flex items-center justify-between rounded-md px-3 py-2.5 text-left font-body text-[14px] transition-colors ${
                        selectedFiber === fiber
                          ? "bg-surface font-medium text-text"
                          : "text-secondary hover:bg-surface/60 hover:text-text"
                      }`}
                    >
                      {fiber}
                      {selectedFiber === fiber && (
                        <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </AccordionSection>

              <AccordionSection label="Category" defaultOpen={!!selectedCategory}>
                <div className="flex flex-col gap-0.5">
                  {allCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() =>
                        setSelectedCategory(selectedCategory === cat ? null : cat)
                      }
                      className={`flex items-center justify-between rounded-md px-3 py-2.5 text-left font-body text-[14px] transition-colors ${
                        selectedCategory === cat
                          ? "bg-surface font-medium text-text"
                          : "text-secondary hover:bg-surface/60 hover:text-text"
                      }`}
                    >
                      {formatCategory(cat)}
                      {selectedCategory === cat && (
                        <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </AccordionSection>
            </div>

            {/* Bottom bar */}
            <div className="flex items-center gap-3 border-t border-surface-dark px-8 py-5">
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="flex-1 rounded-[8px] border border-surface-dark px-5 py-3 font-body text-[14px] font-medium text-text transition-colors hover:bg-surface"
                >
                  Clear Filters
                </button>
              )}
              <button
                onClick={() => setFilterOpen(false)}
                className="flex-1 rounded-[8px] bg-accent px-5 py-3 font-body text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                View {filtered.length} Brand{filtered.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brand grid */}
      <section className="px-5 sm:px-8 lg:px-20 pt-8 pb-20">
        <div className="mx-auto max-w-[1280px]">
          <p className="mb-8 font-body text-[14px] leading-[18px] text-muted">
            {filtered.length} brand{filtered.length !== 1 ? "s" : ""}
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {filtered.map((brand, i) => (
              <BrandCard key={brand.id} brand={brand} priority={i < 6} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full flex flex-col items-center gap-4 py-16">
                <p className="font-body text-[16px] text-secondary">
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
        </div>
      </section>
    </>
  );
}
