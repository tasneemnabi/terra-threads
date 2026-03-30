"use client";

import { useMemo, useCallback, useState, useEffect, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { FilterState, ProductWithBrand } from "@/types/database";
import { ProductCard } from "@/components/product/ProductCard";
import { fetchProducts, fetchProductTypes } from "@/app/shop/actions";

type TierFilter = "all" | "natural" | "nearly";
type SortOption = "newest" | "price-asc" | "price-desc";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

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

interface ShopContentProps {
  initialProducts: ProductWithBrand[];
  initialTotalCount: number;
  brands: { name: string; slug: string }[];
  audiences: string[];
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
        className="flex w-full items-center justify-between py-4 text-left focus:outline-none"
      >
        <span className="font-display text-[14px] font-semibold text-text">
          {title}
        </span>
        <svg
          className="h-4 w-4 shrink-0 text-text"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
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

function ActiveFilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      onClick={onRemove}
      className="flex items-center gap-1.5 rounded-[4px] border border-text px-3 py-1.5 font-body text-[12px] font-medium text-text transition-colors hover:bg-surface"
    >
      {label}
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  "sports-bras": "Sports Bras",
  outerwear: "Outerwear",
};

export function ShopContent({
  initialProducts,
  initialTotalCount,
  brands,
  audiences,
  categories,
  initialProductTypes,
  materials,
}: ShopContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [products, setProducts] = useState(initialProducts);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [productTypes, setProductTypes] = useState(initialProductTypes);

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
  const selectedAudience = searchParams.get("audience") || null;
  const selectedProductType = searchParams.get("type") || null;
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
      audience: selectedAudience || undefined,
      productType: selectedProductType || undefined,
      brands: selectedBrands.length ? selectedBrands : undefined,
      materials: selectedFibers.length ? selectedFibers : undefined,
      minPrice,
      maxPrice,
      sort,
      tier,
    }),
    [selectedCategory, selectedAudience, selectedProductType, selectedBrands, selectedFibers, minPrice, maxPrice, sort, tier]
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

  const setSort = (s: SortOption) => {
    setParams({ sort: s === "newest" ? null : s });
    setSortOpen(false);
  };
  const setCategory = (c: string | null) => {
    setParams({ category: c, type: null });
    if (c) {
      fetchProductTypes(c).then(setProductTypes);
    } else {
      setProductTypes([]);
    }
  };
  const setAudience = (a: string | null) => setParams({ audience: a });
  const setProductType = (t: string | null) => setParams({ type: t });

  // Build fiber groups filtered to only materials that exist in the DB
  const fiberGroups = useMemo(
    () =>
      FIBER_GROUPS.map((group) => ({
        ...group,
        families: group.families
          .map((fam) => ({
            ...fam,
            members: fam.members.filter((m) => materials.includes(m)),
          }))
          .filter((fam) => fam.members.length > 0),
      })).filter((group) => group.families.length > 0),
    [materials]
  );

  const allFiberFamilies = useMemo(
    () => fiberGroups.flatMap((g) => g.families),
    [fiberGroups]
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

  const hasActiveFilters =
    selectedAudience !== null ||
    selectedCategory !== null ||
    selectedProductType !== null ||
    selectedFibers.length > 0 ||
    selectedBrands.length > 0 ||
    minPrice !== undefined ||
    maxPrice !== undefined;

  const formatCategory = (cat: string) =>
    cat
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  // Build active filter chips
  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (selectedAudience) {
    activeChips.push({ label: selectedAudience, onRemove: () => setAudience(null) });
  }
  if (selectedCategory) {
    activeChips.push({ label: formatCategory(selectedCategory), onRemove: () => setCategory(null) });
  }
  if (selectedProductType) {
    activeChips.push({ label: PRODUCT_TYPE_LABELS[selectedProductType] || selectedProductType, onRemove: () => setProductType(null) });
  }
  for (const fam of allFiberFamilies) {
    if (fam.members.some((m) => selectedFibers.includes(m))) {
      activeChips.push({ label: fam.label, onRemove: () => toggleFiberFamily(fam) });
    }
  }
  for (const brandSlug of selectedBrands) {
    const brand = brands.find((b) => b.slug === brandSlug);
    if (brand) {
      activeChips.push({ label: brand.name, onRemove: () => toggleBrand(brandSlug) });
    }
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceLabel = `$${minPrice ?? 0} – $${maxPrice ?? "∞"}`;
    activeChips.push({
      label: priceLabel,
      onRemove: () => setParams({ minPrice: null, maxPrice: null }),
    });
  }

  const sidebarContent = (
    <>
      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          {activeChips.map((chip) => (
            <ActiveFilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      )}

      {/* Gender */}
      {audiences.length > 0 && (
        <AccordionFilter title="Gender" defaultOpen={selectedAudience !== null}>
          {["Women", "Men", "Unisex"]
            .filter((a) => audiences.includes(a))
            .map((aud) => (
              <FilterCheckbox
                key={aud}
                label={aud}
                checked={selectedAudience === aud}
                onChange={() => setAudience(selectedAudience === aud ? null : aud)}
              />
            ))}
        </AccordionFilter>
      )}

      {/* Category */}
      <AccordionFilter title="Category" defaultOpen={selectedCategory !== null}>
        {categories.map((cat) => (
          <FilterCheckbox
            key={cat}
            label={formatCategory(cat)}
            checked={selectedCategory === cat}
            onChange={() => setCategory(selectedCategory === cat ? null : cat)}
          />
        ))}
      </AccordionFilter>

      {/* Product Type (shown when a category is selected and types exist) */}
      {productTypes.length > 0 && selectedCategory && (
        <AccordionFilter title="Type" defaultOpen={selectedProductType !== null}>
          {productTypes.map((pt) => (
            <FilterCheckbox
              key={pt}
              label={PRODUCT_TYPE_LABELS[pt] || formatCategory(pt)}
              checked={selectedProductType === pt}
              onChange={() => setProductType(selectedProductType === pt ? null : pt)}
            />
          ))}
        </AccordionFilter>
      )}

      {/* Fiber Type */}
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

      {/* Brand */}
      <AccordionFilter title="Brand" defaultOpen={selectedBrands.length > 0}>
        <div className="relative">
          <div className="max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
            {brands.map((brand) => (
              <FilterCheckbox
                key={brand.slug}
                label={brand.name}
                checked={selectedBrands.includes(brand.slug)}
                onChange={() => toggleBrand(brand.slug)}
              />
            ))}
          </div>
          {brands.length > 8 && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
          )}
        </div>
      </AccordionFilter>

      {/* Price */}
      <AccordionFilter title="Price" defaultOpen={minPrice !== undefined || maxPrice !== undefined}>
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
      </AccordionFilter>
    </>
  );

  return (
    <>
      {/* Top bar: mobile filter button + sort dropdown */}
      <section className="px-5 sm:px-8 lg:px-20 pt-5">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          {/* Mobile filter toggle */}
          <button
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-1.5 font-body text-[14px] font-medium text-text transition-colors hover:text-secondary lg:hidden"
          >
            <svg
              className="h-4 w-4"
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
            {activeChips.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-background">
                {activeChips.length}
              </span>
            )}
          </button>

          {/* Product count (desktop, takes place of filter button) */}
          <p className="hidden font-body text-[13px] text-muted lg:block">
            {isPending ? "Loading..." : `${totalCount.toLocaleString()} product${totalCount !== 1 ? "s" : ""}`}
          </p>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-1.5 font-body text-[14px] text-text transition-colors hover:text-secondary"
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
                <div className="absolute right-0 top-full z-40 mt-2 w-[200px] rounded-lg border border-muted-light bg-white py-1 shadow-lg">
                  {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(
                    ([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setSort(value)}
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
      </section>

      {/* Main area: Sidebar + Content */}
      <section className="px-5 sm:px-8 lg:px-20 pb-20">
        <div className="mx-auto flex max-w-[1280px] gap-10">
          {/* Persistent sidebar — desktop only */}
          <aside className="hidden w-[240px] shrink-0 pt-4 lg:block">
            {sidebarContent}
          </aside>

          {/* Content column */}
          <div className="min-w-0 flex-1">
            {/* Mobile product count */}
            <p className="pb-6 pt-4 font-body text-[13px] text-muted lg:hidden">
              {isPending ? "Loading..." : `${totalCount.toLocaleString()} product${totalCount !== 1 ? "s" : ""}`}
            </p>

            <div
              className={`transition-opacity duration-300 ease-out ${
                isPending ? "opacity-50" : "opacity-100"
              }`}
            >
              <div className="grid grid-cols-2 gap-x-5 gap-y-8 pt-4 sm:grid-cols-3 lg:grid-cols-4">
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

      {/* Mobile slide-out filter panel (from left) */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex justify-start lg:hidden">
          <div
            className="absolute inset-0 bg-text/20"
            onClick={() => setFilterOpen(false)}
          />
          <div className="relative flex h-full w-full max-w-[320px] flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-surface-dark px-6 py-5">
              <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
                Filters
              </h2>
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
                View {totalCount.toLocaleString()} Product{totalCount !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
