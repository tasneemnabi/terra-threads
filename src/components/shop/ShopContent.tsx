"use client";

import { useMemo, useCallback, useState, useEffect, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { FilterState, ProductWithBrand } from "@/types/database";
import { ProductCard } from "@/components/product/ProductCard";
import { fetchProducts } from "@/app/shop/actions";

type TierFilter = "all" | "natural" | "nearly";
type SortOption = "newest" | "price-asc" | "price-desc";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

const FIBER_FAMILIES: { label: string; members: string[] }[] = [
  { label: "Cotton", members: ["Cotton", "Organic Cotton", "Organic Pima Cotton", "Pima Cotton"] },
  { label: "Wool", members: ["Wool", "Merino Wool", "Lambswool", "Cashmere", "Mohair", "Alpaca"] },
  { label: "Linen", members: ["Linen"] },
  { label: "Hemp", members: ["Hemp"] },
  { label: "Silk", members: ["Silk"] },
  { label: "Lyocell & Modal", members: ["Bamboo Lyocell", "Tencel Lyocell", "Modal", "Viscose"] },
  { label: "Spandex", members: ["Spandex"] },
];

interface ShopContentProps {
  initialProducts: ProductWithBrand[];
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

export function ShopContent({
  initialProducts,
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

  const [products, setProducts] = useState(initialProducts);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  // When filters change, reset to page 1
  useEffect(() => {
    setPage(1);
    startTransition(async () => {
      const result = await fetchProducts({ ...currentFilters, page: 1 });
      setProducts(result.products);
      setTotalCount(result.totalCount);
    });
  }, [currentFilters]);

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const result = await fetchProducts({ ...currentFilters, page: nextPage });
      setProducts((prev) => [...prev, ...result.products]);
      setPage(nextPage);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentFilters, page]);

  const hasMore = products.length < totalCount;

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

  // Build fiber families filtered to only materials that exist in the DB
  const fiberFamilies = useMemo(
    () =>
      FIBER_FAMILIES.map((fam) => ({
        ...fam,
        members: fam.members.filter((m) => materials.includes(m)),
      })).filter((fam) => fam.members.length > 0),
    [materials]
  );

  const toggleFiberFamily = (family: { label: string; members: string[] }) => {
    const allSelected = family.members.every((m) => selectedFibers.includes(m));
    const next = allSelected
      ? selectedFibers.filter((f) => !family.members.includes(f))
      : [...new Set([...selectedFibers, ...family.members])];
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
                  ? "bg-accent text-white shadow-sm"
                  : "bg-surface-dark/40 text-secondary hover:bg-surface-dark/60 hover:text-text"
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
                    ? "bg-accent text-white shadow-sm"
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
        <div className="mx-auto flex max-w-[1280px] items-center justify-end">
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
              {fiberFamilies.map((fam) => (
                <FilterCheckbox
                  key={fam.label}
                  label={fam.label}
                  checked={fam.members.some((m) => selectedFibers.includes(m))}
                  onChange={() => toggleFiberFamily(fam)}
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
                  {totalCount.toLocaleString()} product{totalCount !== 1 ? "s" : ""}
                </>
              )}
            </p>

            <div
              className={`transition-opacity duration-300 ease-out ${
                isPending ? "opacity-50" : "opacity-100"
              }`}
            >
              <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {!isPending && hasMore && (
                <div className="mt-12 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="rounded-full border border-surface-dark px-8 py-3 font-body text-[14px] font-medium text-text transition-colors hover:bg-surface disabled:opacity-50"
                  >
                    {isLoadingMore ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}

              {!isPending && products.length === 0 && (
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
                  {fiberFamilies.map((fam) => {
                    const active = fam.members.some((m) => selectedFibers.includes(m));
                    return (
                      <button
                        key={fam.label}
                        onClick={() => toggleFiberFamily(fam)}
                        className={`flex items-center justify-between rounded-md px-3 py-2.5 text-left font-body text-[14px] transition-colors ${
                          active
                            ? "bg-surface font-medium text-text"
                            : "text-secondary hover:bg-surface/60 hover:text-text"
                        }`}
                      >
                        {fam.label}
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
