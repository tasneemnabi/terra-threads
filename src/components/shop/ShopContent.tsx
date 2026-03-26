"use client";

import { useMemo, useCallback, useState, useEffect, useTransition, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { FilterState } from "@/types/database";
import { ProductCard } from "@/components/product/ProductCard";
import { fetchGroupedProducts, type BrandGroup } from "@/app/shop/actions";

type TierFilter = "all" | "natural" | "nearly";
type SortOption = "newest" | "price-asc" | "price-desc";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

interface ShopContentProps {
  initialGroups: BrandGroup[];
  initialTotalCount: number;
  brands: { name: string; slug: string }[];
  categories: string[];
  initialProductTypes: string[];
  materials: string[];
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className="group/cb flex items-center gap-2.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-surface/60"
    >
      <div
        className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] border transition-all duration-150 ${
          checked
            ? "border-text bg-text"
            : "border-muted-light group-hover/cb:border-muted"
        }`}
      >
        {checked && (
          <svg
            className="h-2.5 w-2.5 text-background"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        )}
      </div>
      <span className={`font-body text-[13px] transition-colors ${checked ? "font-medium text-text" : "text-text group-hover/cb:text-secondary"}`}>
        {label}
      </span>
    </button>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-[14px] font-semibold text-text">
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
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
        className="flex w-full items-center justify-between py-4 font-body text-[13px] font-semibold uppercase tracking-[0.06em] text-text transition-colors hover:text-secondary"
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

function BrandRow({ group }: { group: BrandGroup }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, group.products]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("a")?.offsetWidth ?? 300;
    el.scrollBy({ left: direction === "left" ? -cardWidth - 20 : cardWidth + 20, behavior: "smooth" });
  };

  return (
    <div className="group/brand">
      {/* Brand header */}
      <div className="mb-5 flex items-baseline justify-between">
        <Link
          href={`/brand/${group.brandSlug}`}
          className="group/link flex items-baseline gap-3"
        >
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text transition-colors duration-200 group-hover/link:text-accent">
            {group.brandName}
          </h2>
          <span className="font-body text-[13px] text-muted">
            {group.totalForBrand} product{group.totalForBrand !== 1 ? "s" : ""}
          </span>
        </Link>
        <Link
          href={`/brand/${group.brandSlug}`}
          className="font-body text-[13px] text-secondary transition-colors duration-200 hover:text-accent"
        >
          View all <span className="inline-block transition-transform duration-200 hover:translate-x-0.5">&rarr;</span>
        </Link>
      </div>

      {/* Horizontal scrolling product row */}
      <div className="relative">
        {canScrollLeft && (
          <>
            <div className="pointer-events-none absolute -left-1 top-0 z-[5] h-[calc(100%-60px)] w-16 bg-gradient-to-r from-background to-transparent" />
            <button
              onClick={() => scroll("left")}
              className="absolute -left-3 top-1/3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-surface-dark bg-background shadow-sm transition-all duration-200 hover:bg-surface hover:shadow-md"
            >
              <svg className="h-4 w-4 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          </>
        )}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto scrollbar-hide scroll-smooth"
        >
          {group.products.map((product) => (
            <div key={product.id} className="w-[260px] shrink-0 sm:w-[280px]">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
        {canScrollRight && (
          <>
            <div className="pointer-events-none absolute -right-1 top-0 z-[5] h-[calc(100%-60px)] w-16 bg-gradient-to-l from-background to-transparent" />
            <button
              onClick={() => scroll("right")}
              className="absolute -right-3 top-1/3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-surface-dark bg-background shadow-sm transition-all duration-200 hover:bg-surface hover:shadow-md"
            >
              <svg className="h-4 w-4 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function ShopContent({
  initialGroups,
  initialTotalCount,
  brands,
  categories,
  materials,
}: ShopContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filterOpen, setFilterOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [groups, setGroups] = useState(initialGroups);
  const [totalCount, setTotalCount] = useState(initialTotalCount);

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

  // Read filter state from URL
  const tier = (searchParams.get("tier") as TierFilter) || "all";
  const selectedCategory = searchParams.get("category") || null;
  const selectedFibers = useMemo(
    () => searchParams.get("fiber")?.split(",").filter(Boolean) ?? [],
    [searchParams]
  );
  const selectedBrands = useMemo(
    () => searchParams.get("brand")?.split(",").filter(Boolean) ?? [],
    [searchParams]
  );
  const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
  const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
  const sort = (searchParams.get("sort") as SortOption) || "newest";

  const currentFilters = useMemo<Omit<FilterState, "page">>(
    () => ({
      category: selectedCategory || undefined,
      brands: selectedBrands.length ? selectedBrands : undefined,
      materials: selectedFibers.length ? selectedFibers : undefined,
      minPrice,
      maxPrice,
      sort,
      tier,
    }),
    [selectedCategory, selectedBrands, selectedFibers, minPrice, maxPrice, sort, tier]
  );

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchGroupedProducts(currentFilters);
      setGroups(result.groups);
      setTotalCount(result.totalCount);
    });
  }, [currentFilters]);

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value && value !== "all") {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const setTier = (t: TierFilter) => setParams({ tier: t });
  const setSort = (s: SortOption) => setParams({ sort: s === "newest" ? null : s });
  const setCategory = (c: string | null) => setParams({ category: c });

  const toggleFiber = (fiber: string) => {
    const next = selectedFibers.includes(fiber)
      ? selectedFibers.filter((f) => f !== fiber)
      : [...selectedFibers, fiber];
    setParams({ fiber: next.length ? next.join(",") : null });
  };

  const toggleBrand = (brandSlug: string) => {
    const next = selectedBrands.includes(brandSlug)
      ? selectedBrands.filter((b) => b !== brandSlug)
      : [...selectedBrands, brandSlug];
    setParams({ brand: next.length ? next.join(",") : null });
  };

  const clearAllFilters = () => {
    router.replace(pathname, { scroll: false });
  };

  const panelFilterCount =
    selectedFibers.length +
    selectedBrands.length +
    (minPrice !== undefined ? 1 : 0) +
    (maxPrice !== undefined ? 1 : 0) +
    (sort !== "newest" ? 1 : 0);
  const hasActiveFilters = tier !== "all" || panelFilterCount > 0 || selectedCategory !== null;

  const formatCategory = (cat: string) =>
    cat
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  return (
    <>
      {/* Category pills */}
      <section className="px-5 sm:px-8 lg:px-20 pt-5">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setCategory(null)}
              className={`shrink-0 rounded-full px-4 py-2 font-body text-[13px] font-medium transition-all duration-200 ${
                selectedCategory === null
                  ? "bg-[#1A8A5A] text-white shadow-sm"
                  : "text-text hover:bg-surface"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(selectedCategory === cat ? null : cat)}
                className={`shrink-0 rounded-full px-4 py-2 font-body text-[13px] font-medium transition-all duration-200 ${
                  selectedCategory === cat
                    ? "bg-[#1A8A5A] text-white shadow-sm"
                    : "text-text hover:bg-surface"
                }`}
              >
                {formatCategory(cat)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Filter info + button row */}
      <section className="px-5 sm:px-8 lg:px-20 pt-4">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          <p className="font-body text-[12px] text-muted">
            {isPending
              ? "Loading..."
              : `Showing ${totalCount.toLocaleString()} products across ${groups.length} brand${groups.length !== 1 ? "s" : ""}`}
          </p>
          <button
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-muted-light px-4 py-2 font-body text-[13px] text-text transition-colors hover:border-muted"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
              />
            </svg>
            Filters
            {panelFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-background">
                {panelFilterCount}
              </span>
            )}
          </button>
        </div>
      </section>

      {/* Main area: Sidebar + Content */}
      <section className="px-5 sm:px-8 lg:px-20 pb-20">
        <div className="mx-auto flex max-w-[1280px] gap-8">
          {/* Persistent sidebar — desktop only */}
          <aside className="hidden w-[220px] shrink-0 border-r border-muted-light pr-6 pt-8 lg:flex lg:flex-col lg:gap-8">
            <FilterSection title="Fiber Type">
              {materials.map((mat) => (
                <FilterCheckbox
                  key={mat}
                  label={mat}
                  checked={selectedFibers.includes(mat)}
                  onChange={() => toggleFiber(mat)}
                />
              ))}
            </FilterSection>

            <div className="h-px w-full bg-muted-light" />

            <FilterSection title="Brand">
              {brands.map((brand) => (
                <FilterCheckbox
                  key={brand.slug}
                  label={brand.name}
                  checked={selectedBrands.includes(brand.slug)}
                  onChange={() => toggleBrand(brand.slug)}
                />
              ))}
            </FilterSection>

            <div className="h-px w-full bg-muted-light" />

            <FilterSection title="Tier">
              <FilterCheckbox
                label="100% Natural"
                checked={tier === "natural"}
                onChange={() => setTier(tier === "natural" ? "all" : "natural")}
              />
              <FilterCheckbox
                label="Nearly Natural"
                checked={tier === "nearly"}
                onChange={() => setTier(tier === "nearly" ? "all" : "nearly")}
              />
            </FilterSection>

            <div className="h-px w-full bg-muted-light" />

            <FilterSection title="Price Range">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="$0"
                  value={minPrice ?? ""}
                  onChange={(e) =>
                    setParams({ minPrice: e.target.value || null })
                  }
                  className="w-full rounded-md border border-muted-light bg-background px-3 py-2 font-body text-[13px] text-text outline-none focus:border-muted"
                />
                <span className="font-body text-[13px] text-muted">–</span>
                <input
                  type="number"
                  placeholder="$500"
                  value={maxPrice ?? ""}
                  onChange={(e) =>
                    setParams({ maxPrice: e.target.value || null })
                  }
                  className="w-full rounded-md border border-muted-light bg-background px-3 py-2 font-body text-[13px] text-text outline-none focus:border-muted"
                />
              </div>
            </FilterSection>
          </aside>

          {/* Content column */}
          <div className="min-w-0 flex-1">
            <p className="pb-8 pt-8 font-body text-[13px] text-muted">
              {isPending ? (
                "Loading..."
              ) : (
                <>
                  {totalCount.toLocaleString()} product{totalCount !== 1 ? "s" : ""} across{" "}
                  {groups.length} brand{groups.length !== 1 ? "s" : ""}
                </>
              )}
            </p>

            <div
              className={`flex flex-col transition-opacity duration-300 ease-out ${
                isPending ? "opacity-50" : "opacity-100"
              }`}
            >
              {groups.map((group, i) => (
                <div key={group.brandSlug}>
                  {i > 0 && (
                    <div className="my-10 h-px w-full bg-surface-dark" />
                  )}
                  <BrandRow group={group} />
                </div>
              ))}
              {!isPending && groups.length === 0 && (
                <div className="flex flex-col items-center gap-4 py-16">
                  <p className="font-body text-[16px] text-secondary">
                    No products match the selected filters.
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
        </div>
      </section>

      {/* Mobile slide-out filter panel */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-text/20"
            onClick={() => setFilterOpen(false)}
          />
          <div className="relative flex h-full w-full max-w-[400px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-surface-dark px-8 py-6">
              <h2 className="font-display text-[20px] font-semibold tracking-[-0.01em] text-text">
                Filter &amp; Sort
              </h2>
              <div className="flex items-center gap-4">
                <span className="font-body text-[13px] text-muted">
                  {totalCount.toLocaleString()} result{totalCount !== 1 ? "s" : ""}
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

            <div className="flex-1 overflow-y-auto px-8">
              <AccordionSection label="Sort By" defaultOpen={sort !== "newest"}>
                <div className="flex flex-col gap-0.5">
                  {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(
                    ([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setSort(value)}
                        className={`flex items-center justify-between rounded-md px-3 py-2.5 text-left font-body text-[14px] transition-colors ${
                          sort === value
                            ? "bg-surface font-medium text-text"
                            : "text-secondary hover:bg-surface/60 hover:text-text"
                        }`}
                      >
                        {label}
                        {sort === value && (
                          <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    )
                  )}
                </div>
              </AccordionSection>

              <AccordionSection label="Fiber Type" defaultOpen={selectedFibers.length > 0}>
                <div className="flex flex-col gap-0.5">
                  {materials.map((mat) => {
                    const active = selectedFibers.includes(mat);
                    return (
                      <button
                        key={mat}
                        onClick={() => toggleFiber(mat)}
                        className={`flex items-center justify-between rounded-md px-3 py-2.5 text-left font-body text-[14px] transition-colors ${
                          active
                            ? "bg-surface font-medium text-text"
                            : "text-secondary hover:bg-surface/60 hover:text-text"
                        }`}
                      >
                        {mat}
                        {active && (
                          <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </AccordionSection>

              <AccordionSection label="Tier" defaultOpen={tier !== "all"}>
                <div className="flex flex-col gap-0.5">
                  {(
                    [
                      ["all", "All Products"],
                      ["natural", "100% Natural"],
                      ["nearly", "Nearly Natural"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setTier(value)}
                      className={`flex items-center justify-between rounded-md px-3 py-2.5 text-left font-body text-[14px] transition-colors ${
                        tier === value
                          ? "bg-surface font-medium text-text"
                          : "text-secondary hover:bg-surface/60 hover:text-text"
                      }`}
                    >
                      {label}
                      {tier === value && (
                        <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </AccordionSection>

              <AccordionSection label="Brand" defaultOpen={selectedBrands.length > 0}>
                <div className="flex flex-col gap-0.5">
                  {brands.map((brand) => {
                    const active = selectedBrands.includes(brand.slug);
                    return (
                      <button
                        key={brand.slug}
                        onClick={() => toggleBrand(brand.slug)}
                        className={`flex items-center justify-between rounded-md px-3 py-2.5 text-left font-body text-[14px] transition-colors ${
                          active
                            ? "bg-surface font-medium text-text"
                            : "text-secondary hover:bg-surface/60 hover:text-text"
                        }`}
                      >
                        {brand.name}
                        {active && (
                          <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </AccordionSection>

              <AccordionSection label="Price" defaultOpen={minPrice !== undefined || maxPrice !== undefined}>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block font-body text-[12px] text-muted">Min</label>
                    <input
                      type="number"
                      placeholder="$0"
                      value={minPrice ?? ""}
                      onChange={(e) =>
                        setParams({ minPrice: e.target.value || null })
                      }
                      className="w-full rounded-md border border-surface-dark bg-background px-3 py-2 font-body text-[14px] text-text outline-none focus:border-muted"
                    />
                  </div>
                  <span className="mt-5 font-body text-[14px] text-muted">—</span>
                  <div className="flex-1">
                    <label className="mb-1 block font-body text-[12px] text-muted">Max</label>
                    <input
                      type="number"
                      placeholder="$999"
                      value={maxPrice ?? ""}
                      onChange={(e) =>
                        setParams({ maxPrice: e.target.value || null })
                      }
                      className="w-full rounded-md border border-surface-dark bg-background px-3 py-2 font-body text-[14px] text-text outline-none focus:border-muted"
                    />
                  </div>
                </div>
              </AccordionSection>
            </div>

            <div className="flex items-center gap-3 border-t border-surface-dark px-8 py-5">
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="flex-1 rounded-[8px] border border-surface-dark px-5 py-3 font-body text-[14px] font-medium text-text transition-colors hover:bg-surface"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setFilterOpen(false)}
                className="flex-1 rounded-[8px] bg-text px-5 py-3 font-body text-[14px] font-semibold text-background transition-opacity hover:opacity-90"
              >
                View {totalCount.toLocaleString()} Product{totalCount !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
