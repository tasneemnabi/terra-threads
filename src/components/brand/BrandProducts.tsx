"use client";

import { useState, useMemo, useEffect } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { formatCategory } from "@/lib/utils";
import {
  trackFilterChanged,
  trackFiltersCleared,
  trackLoadMore,
  trackSortChanged,
} from "@/lib/posthog/events";
import type { ProductWithBrand } from "@/types/database";

type SortOption = "newest" | "price-asc" | "price-desc";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

// Same fiber family grouping as ShopContent
const FIBER_GROUPS: { heading: string; families: { label: string; members: string[] }[] }[] = [
  {
    heading: "Natural",
    families: [
      { label: "Cotton", members: ["Cotton", "Organic Cotton", "Organic Pima Cotton", "Pima Cotton"] },
      { label: "Wool", members: ["Wool", "Merino Wool", "Lambswool", "Cashmere", "Mohair", "Alpaca"] },
      { label: "Linen", members: ["Linen"] },
      { label: "Hemp", members: ["Hemp"] },
      { label: "Silk", members: ["Silk"] },
    ],
  },
  {
    heading: "Semi-Synthetic",
    families: [
      { label: "Lyocell", members: ["Tencel Lyocell", "Bamboo Lyocell"] },
      { label: "Modal", members: ["Modal"] },
      { label: "Viscose", members: ["Viscose"] },
    ],
  },
  {
    heading: "Synthetic",
    families: [
      { label: "Spandex", members: ["Spandex"] },
    ],
  },
];

const PAGE_SIZE = 24;

// --- Shared UI components (same as ShopContent) ---

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
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className="group/cb flex items-center gap-2.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:rounded-md"
    >
      <div
        className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] border transition-all duration-150 ${
          checked
            ? "border-accent bg-accent"
            : "border-muted-light group-hover/cb:border-muted"
        }`}
      >
        {checked && (
          <svg className="h-2.5 w-2.5 text-background" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </div>
      <span className={`font-body text-[13px] transition-colors ${checked ? "font-medium text-text" : "text-text group-hover/cb:text-secondary"}`}>
        {label}
      </span>
    </button>
  );
}

function AccordionFilter({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-muted-light/60">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:rounded-md"
      >
        <span className="font-display text-[14px] font-semibold text-text">{title}</span>
        <svg className="h-4 w-4 shrink-0 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          )}
        </svg>
      </button>
      {open && <div className="flex flex-col gap-1.5 pb-4">{children}</div>}
    </div>
  );
}

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      onClick={onRemove}
      className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 font-body text-[12px] font-medium text-accent transition-colors hover:bg-accent/20"
    >
      {label}
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

// --- Main component ---

interface BrandProductsProps {
  products: ProductWithBrand[];
}

export function BrandProducts({ products }: BrandProductsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFibers, setSelectedFibers] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [sort, setSort] = useState<SortOption>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);

  // Lock body scroll when mobile filter is open
  useEffect(() => {
    if (filterOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [filterOpen]);

  // ESC to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (sortOpen) setSortOpen(false);
        if (filterOpen) setFilterOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sortOpen, filterOpen]);

  // Derive categories from products
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([slug]) => slug);
  }, [products]);

  // Build fiber groups filtered to materials that exist in this brand's products
  const materialNames = useMemo(
    () => new Set(products.flatMap((p) => p.materials.map((m) => m.name))),
    [products]
  );
  const fiberGroups = useMemo(
    () =>
      FIBER_GROUPS.map((group) => ({
        ...group,
        families: group.families
          .map((fam) => ({ ...fam, members: fam.members.filter((m) => materialNames.has(m)) }))
          .filter((fam) => fam.members.length > 0),
      })).filter((group) => group.families.length > 0),
    [materialNames]
  );
  const allFiberFamilies = useMemo(() => fiberGroups.flatMap((g) => g.families), [fiberGroups]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = products;

    if (selectedCategory) {
      result = result.filter((p) => p.category === selectedCategory);
    }
    if (selectedFibers.length > 0) {
      result = result.filter((p) =>
        p.materials.some((m) => selectedFibers.includes(m.name))
      );
    }
    if (minPrice !== undefined) {
      result = result.filter((p) => p.price >= minPrice);
    }
    if (maxPrice !== undefined) {
      result = result.filter((p) => p.price <= maxPrice);
    }

    if (sort === "price-asc") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sort === "price-desc") {
      result = [...result].sort((a, b) => b.price - a.price);
    }

    return result;
  }, [products, selectedCategory, selectedFibers, minPrice, maxPrice, sort]);

  // Reset pagination when filters change
  useEffect(() => { setShown(PAGE_SIZE); }, [selectedCategory, selectedFibers, minPrice, maxPrice, sort]);

  const visible = filtered.slice(0, shown);
  const hasMore = shown < filtered.length;

  // Count helper — matches the activeChips semantics
  const countActiveBrandFilters = (f: {
    category: string | null;
    fibers: string[];
    min: number | undefined;
    max: number | undefined;
  }): number => {
    let n = 0;
    if (f.category) n++;
    if (f.fibers.length > 0) n++;
    if (f.min !== undefined || f.max !== undefined) n++;
    return n;
  };

  // Toggle helpers
  const toggleCategory = (cat: string) => {
    const prev = selectedCategory;
    const next = prev === cat ? null : cat;
    setSelectedCategory(next);
    trackFilterChanged({
      page: "brand-page",
      filter_key: "category",
      action: next === null ? "remove" : prev && prev !== next ? "replace" : "add",
      ui_value: (next ?? prev) ? formatCategory((next ?? prev)!) : null,
      query_value: next,
      active_filter_count: countActiveBrandFilters({
        category: next,
        fibers: selectedFibers,
        min: minPrice,
        max: maxPrice,
      }),
    });
  };

  const toggleFiberFamily = (family: { label: string; members: string[] }) => {
    const allSelected = family.members.every((m) => selectedFibers.includes(m));
    const next = allSelected
      ? selectedFibers.filter((f) => !family.members.includes(f))
      : [...new Set([...selectedFibers, ...family.members])];
    setSelectedFibers(next);
    trackFilterChanged({
      page: "brand-page",
      filter_key: "fiber_family",
      action: allSelected ? "remove" : "add",
      ui_value: family.label,
      query_value: family.members.join("|"),
      active_filter_count: countActiveBrandFilters({
        category: selectedCategory,
        fibers: next,
        min: minPrice,
        max: maxPrice,
      }),
    });
  };

  const hasActiveFilters =
    selectedCategory !== null ||
    selectedFibers.length > 0 ||
    minPrice !== undefined ||
    maxPrice !== undefined;

  const clearAllFilters = () => {
    const before = countActiveBrandFilters({
      category: selectedCategory,
      fibers: selectedFibers,
      min: minPrice,
      max: maxPrice,
    });
    setSelectedCategory(null);
    setSelectedFibers([]);
    setMinPrice(undefined);
    setMaxPrice(undefined);
    if (before > 0) {
      trackFiltersCleared({ page: "brand-page", cleared_filter_count: before });
    }
  };

  const handleSort = (value: SortOption) => {
    const previous = sort;
    setSort(value);
    setSortOpen(false);
    trackSortChanged({
      page: "brand-page",
      sort_value: value,
      previous_sort: previous,
    });
  };

  const handlePriceCommit = (nextMin: number | undefined, nextMax: number | undefined) => {
    const wasActive = minPrice !== undefined || maxPrice !== undefined;
    const willBeActive = nextMin !== undefined || nextMax !== undefined;
    if (!wasActive && !willBeActive) return;
    if (wasActive && willBeActive && nextMin === minPrice && nextMax === maxPrice) return;
    trackFilterChanged({
      page: "brand-page",
      filter_key: "price",
      action: !willBeActive ? "remove" : wasActive ? "replace" : "add",
      ui_value: willBeActive ? `$${nextMin ?? 0}-$${nextMax ?? "∞"}` : null,
      query_value: willBeActive ? `${nextMin ?? ""}:${nextMax ?? ""}` : null,
      active_filter_count: countActiveBrandFilters({
        category: selectedCategory,
        fibers: selectedFibers,
        min: nextMin,
        max: nextMax,
      }),
    });
  };

  // Active filter chips
  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (selectedCategory) {
    activeChips.push({ label: formatCategory(selectedCategory), onRemove: () => setSelectedCategory(null) });
  }
  for (const fam of allFiberFamilies) {
    if (fam.members.some((m) => selectedFibers.includes(m))) {
      activeChips.push({ label: fam.label, onRemove: () => toggleFiberFamily(fam) });
    }
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    activeChips.push({
      label: `$${minPrice ?? 0} – $${maxPrice ?? "∞"}`,
      onRemove: () => { setMinPrice(undefined); setMaxPrice(undefined); },
    });
  }

  const sidebarContent = (
    <>
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          {activeChips.map((chip) => (
            <ActiveFilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      )}

      {/* Category */}
      {categories.length > 1 && (
        <AccordionFilter title="Category" defaultOpen={selectedCategory !== null}>
          {categories.map((cat) => (
            <FilterCheckbox
              key={cat}
              label={formatCategory(cat)}
              checked={selectedCategory === cat}
              onChange={() => toggleCategory(cat)}
            />
          ))}
        </AccordionFilter>
      )}

      {/* Fiber Type */}
      {fiberGroups.length > 0 && (
        <AccordionFilter title="Fiber Type" defaultOpen={selectedFibers.length > 0}>
          {fiberGroups.map((group, i) => (
            <div key={group.heading} className={i > 0 ? "mt-3" : ""}>
              <p className="mb-1.5 px-1 font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-secondary">
                {group.heading}
              </p>
              {group.families.map((fam) => (
                <FilterCheckbox
                  key={fam.label}
                  label={fam.label}
                  checked={fam.members.some((m) => selectedFibers.includes(m))}
                  onChange={() => toggleFiberFamily(fam)}
                />
              ))}
            </div>
          ))}
        </AccordionFilter>
      )}

      {/* Price */}
      <AccordionFilter title="Price" defaultOpen={minPrice !== undefined || maxPrice !== undefined}>
        <div className="flex items-center gap-2">
          <label className="w-full">
            <span className="sr-only">Minimum price</span>
            <input
              type="number"
              placeholder="$0"
              value={minPrice ?? ""}
              onBlur={(e) => {
                const v = e.target.value ? Number(e.target.value) : undefined;
                setMinPrice(v);
                handlePriceCommit(v, maxPrice);
              }}
              onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full rounded-md border border-muted-light bg-background px-3 py-2 font-body text-[13px] text-text outline-none focus:border-muted focus-visible:ring-2 focus-visible:ring-accent/50"
            />
          </label>
          <span className="font-body text-[13px] text-muted">–</span>
          <label className="w-full">
            <span className="sr-only">Maximum price</span>
            <input
              type="number"
              placeholder="$500"
              value={maxPrice ?? ""}
              onBlur={(e) => {
                const v = e.target.value ? Number(e.target.value) : undefined;
                setMaxPrice(v);
                handlePriceCommit(minPrice, v);
              }}
              onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full rounded-md border border-muted-light bg-background px-3 py-2 font-body text-[13px] text-text outline-none focus:border-muted focus-visible:ring-2 focus-visible:ring-accent/50"
            />
          </label>
        </div>
      </AccordionFilter>
    </>
  );

  return (
    <>
      {/* Top bar: mobile filter button + sort dropdown */}
      <div className="flex items-center justify-between">
        {/* Mobile filter toggle */}
        <button
          onClick={() => setFilterOpen(true)}
          className="flex items-center gap-1.5 font-body text-[14px] font-medium text-text transition-colors hover:text-secondary lg:hidden"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          Filters
          {activeChips.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-background">
              {activeChips.length}
            </span>
          )}
        </button>

        {/* Product count — desktop only */}
        <p className="hidden font-body text-[13px] text-muted lg:block">
          {filtered.length.toLocaleString()} product{filtered.length !== 1 ? "s" : ""}
        </p>

        {/* Sort dropdown */}
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
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
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
                      onClick={() => handleSort(value)}
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

      {/* Main area: Sidebar + Grid */}
      <div className="flex gap-10 pt-2">
        {/* Persistent sidebar — desktop only */}
        <aside className="hidden w-[240px] shrink-0 pt-4 lg:block">
          {sidebarContent}
        </aside>

        {/* Content column */}
        <div className="min-w-0 flex-1">
          {/* Mobile product count */}
          <p className="pb-6 pt-4 font-body text-[13px] text-muted lg:hidden">
            {filtered.length.toLocaleString()} product{filtered.length !== 1 ? "s" : ""}
          </p>

          <div className="grid grid-cols-2 gap-x-5 gap-y-8 pt-4 sm:grid-cols-3 lg:grid-cols-3">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} hideBrand source="brand-page" />
            ))}
          </div>

          {hasMore && (
            <div className="mt-10 text-center">
              <button
                onClick={() => {
                  const nextShown = Math.min(shown + PAGE_SIZE, filtered.length);
                  const loaded = nextShown - shown;
                  setShown(nextShown);
                  trackLoadMore({
                    page: "brand-page",
                    next_page: Math.ceil(nextShown / PAGE_SIZE),
                    products_loaded: loaded,
                    total_visible: nextShown,
                    total_available: filtered.length,
                  });
                }}
                className="inline-flex items-center gap-2 rounded-full border border-muted-light px-6 py-3 font-body text-[14px] font-medium text-text transition-colors hover:border-text"
              >
                Show more ({filtered.length - shown} remaining)
              </button>
            </div>
          )}

          {filtered.length === 0 && (
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

      {/* Mobile slide-out filter panel */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex justify-start lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-text/20" onClick={() => setFilterOpen(false)} />
          <div className="relative flex h-full w-full max-w-[320px] flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-surface-dark px-6 py-5">
              <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">Filters</h2>
              <button
                onClick={() => setFilterOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-text"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
              {sidebarContent}
            </div>

            <div className="border-t border-surface-dark px-6 py-4">
              <button
                onClick={() => setFilterOpen(false)}
                className="w-full rounded-[8px] bg-text px-5 py-3 font-body text-[14px] font-semibold text-background transition-opacity hover:opacity-90"
              >
                View {filtered.length.toLocaleString()} Product{filtered.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
