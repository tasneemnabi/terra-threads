"use client";

import { useMemo, useCallback, useState, useEffect, useRef, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { FilterState, ProductWithBrand, SortOption, TierFilter } from "@/types/database";
import { ProductCard } from "@/components/product/ProductCard";
import {
  FilterCheckbox,
  AccordionFilter,
  ActiveFilterChip,
  FIBER_GROUPS,
  SORT_LABELS,
} from "@/components/filters/primitives";
import { fetchProducts, fetchProductTypes, fetchAvailableBrands, fetchSearchResults } from "@/app/shop/actions";
import { formatCategory } from "@/lib/utils";
import {
  trackFilterChanged,
  trackFiltersCleared,
  trackLoadMore,
  trackSearchResultsLoaded,
  trackSortChanged,
} from "@/lib/posthog/events";

const TIER_LABELS: Record<TierFilter, string> = {
  all: "All",
  natural: "100% Natural",
  nearly: "Nearly Natural",
};

const TIER_DESCRIPTIONS: Record<TierFilter, string> = {
  all: "Show all products",
  natural: "Only products made entirely from natural fibers — cotton, wool, linen, hemp, silk",
  nearly: "Products with up to 10% elastane or spandex, rest natural fibers",
};

interface ShopContentProps {
  initialProducts: ProductWithBrand[];
  initialTotalCount: number;
  brands: { name: string; slug: string }[];
  audiences: string[];
  categories: string[];
  initialProductTypes: string[];
  materials: string[];
}

function PriceRangeInputs({
  minPrice,
  maxPrice,
  onApply,
}: {
  minPrice: number | undefined;
  maxPrice: number | undefined;
  onApply: (min: string | null, max: string | null) => void;
}) {
  const [localMin, setLocalMin] = useState(minPrice?.toString() ?? "");
  const [localMax, setLocalMax] = useState(maxPrice?.toString() ?? "");

  // Sync from URL when external changes happen (e.g. "Clear all filters")
  useEffect(() => { setLocalMin(minPrice?.toString() ?? ""); }, [minPrice]);
  useEffect(() => { setLocalMax(maxPrice?.toString() ?? ""); }, [maxPrice]);

  const apply = () => {
    onApply(localMin || null, localMax || null);
  };

  return (
    <div className="flex items-center gap-2">
      <label className="w-full">
        <span className="sr-only">Minimum price</span>
        <input
          type="number"
          placeholder="$0"
          value={localMin}
          onChange={(e) => setLocalMin(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          className="w-full rounded-md border border-muted-light bg-background px-3 py-2 font-body text-[13px] text-text outline-none focus:border-muted focus-visible:ring-2 focus-visible:ring-accent/50"
        />
      </label>
      <span className="font-body text-[13px] text-muted">–</span>
      <label className="w-full">
        <span className="sr-only">Maximum price</span>
        <input
          type="number"
          placeholder="$500"
          value={localMax}
          onChange={(e) => setLocalMax(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          className="w-full rounded-md border border-muted-light bg-background px-3 py-2 font-body text-[13px] text-text outline-none focus:border-muted focus-visible:ring-2 focus-visible:ring-accent/50"
        />
      </label>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/5] rounded-lg bg-surface" />
      <div className="mt-3 h-3 w-20 rounded bg-surface" />
      <div className="mt-2 h-4 w-full rounded bg-surface" />
      <div className="mt-2 h-4 w-2/3 rounded bg-surface" />
      <div className="mt-2 h-4 w-16 rounded bg-surface" />
    </div>
  );
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  "sports-bras": "Sports Bras",
  outerwear: "Outerwear",
};

function countActiveFilters(f: {
  category?: string | null;
  audience?: string | null;
  productTypes?: string[];
  brands?: string[];
  fibers?: string[];
  tier?: TierFilter;
  minPrice?: number;
  maxPrice?: number;
}): number {
  let n = 0;
  if (f.category) n++;
  if (f.audience) n++;
  if (f.productTypes?.length) n++;
  if (f.brands?.length) n++;
  if (f.fibers?.length) n++;
  if (f.tier && f.tier !== "all") n++;
  if (f.minPrice !== undefined || f.maxPrice !== undefined) n++;
  return n;
}

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
  const [availableBrandSlugs, setAvailableBrandSlugs] = useState<string[] | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProductWithBrand[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Back to top
  const [showBackToTop, setShowBackToTop] = useState(false);

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

  // Close filter panel or sort dropdown on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (sortOpen) setSortOpen(false);
        if (filterOpen) setFilterOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filterOpen, sortOpen]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute search
  useEffect(() => {
    const query = debouncedSearch.trim();
    if (!query) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    fetchSearchResults(query).then((results) => {
      if (!cancelled) {
        setSearchResults(results);
        setIsSearching(false);
        trackSearchResultsLoaded({
          query,
          query_length: query.length,
          result_count: results.length,
          page: "shop",
        });
      }
    });
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  // Back to top scroll listener
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Read filter state from URL
  const tier = (searchParams.get("tier") as TierFilter) || "all";
  const selectedCategory = searchParams.get("category") || null;
  const selectedAudience = searchParams.get("audience") || null;
  const selectedProductTypes = useMemo(
    () => searchParams.get("type")?.split(",").filter(Boolean) ?? [],
    [searchParams]
  );
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
      productTypes: selectedProductTypes.length ? selectedProductTypes : undefined,
      brands: selectedBrands.length ? selectedBrands : undefined,
      materials: selectedFibers.length ? selectedFibers : undefined,
      minPrice,
      maxPrice,
      sort,
      tier,
    }),
    [selectedCategory, selectedAudience, selectedProductTypes, selectedBrands, selectedFibers, minPrice, maxPrice, sort, tier]
  );

  const nonBrandFilters = useMemo(() => {
    const { brands, sort, ...rest } = currentFilters;
    return rest;
  }, [currentFilters]);

  // Refresh available brands when non-brand filters change
  useEffect(() => {
    const hasActive = Object.values(nonBrandFilters).some(
      (v) => v !== undefined && v !== "all"
    );

    if (!hasActive) {
      setAvailableBrandSlugs(null);
      return;
    }

    let cancelled = false;
    fetchAvailableBrands(nonBrandFilters).then((slugs) => {
      if (!cancelled) setAvailableBrandSlugs(slugs);
    });
    return () => { cancelled = true; };
  }, [nonBrandFilters]);

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
      let loadedCount = 0;
      let totalVisible = 0;
      setProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newProducts = result.products.filter((p) => !existingIds.has(p.id));
        loadedCount = newProducts.length;
        const merged = [...prev, ...newProducts];
        totalVisible = merged.length;
        return merged;
      });
      setPage(nextPage);
      trackLoadMore({
        page: "shop",
        next_page: nextPage,
        products_loaded: loadedCount,
        total_visible: totalVisible,
        total_available: result.totalCount,
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentFilters, page]);

  const hasMore = products.length < totalCount;

  // Infinite scroll via intersection observer
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isPending) {
          loadMore();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isPending, loadMore]);

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

  const currentCountBase = {
    category: selectedCategory ?? undefined,
    audience: selectedAudience ?? undefined,
    productTypes: selectedProductTypes,
    brands: selectedBrands,
    fibers: selectedFibers,
    tier,
    minPrice,
    maxPrice,
  };

  const setSort = (s: SortOption) => {
    setParams({ sort: s === "newest" ? null : s });
    setSortOpen(false);
    trackSortChanged({
      page: "shop",
      sort_value: s,
      previous_sort: sort,
    });
  };
  const setCategory = (c: string | null) => {
    const prev = selectedCategory;
    setParams({ category: c, type: null });
    if (c) {
      fetchProductTypes(c).then(setProductTypes);
    } else {
      setProductTypes([]);
    }
    trackFilterChanged({
      page: "shop",
      filter_key: "category",
      action: c === null ? "remove" : prev && prev !== c ? "replace" : "add",
      ui_value: c ? formatCategory(c) : prev ? formatCategory(prev) : null,
      query_value: c,
      active_filter_count: countActiveFilters({
        ...currentCountBase,
        category: c ?? undefined,
        productTypes: [],
      }),
    });
  };
  const setAudience = (a: string | null) => {
    const prev = selectedAudience;
    setParams({ audience: a });
    trackFilterChanged({
      page: "shop",
      filter_key: "audience",
      action: a === null ? "remove" : prev && prev !== a ? "replace" : "add",
      ui_value: a ?? prev,
      query_value: a,
      active_filter_count: countActiveFilters({
        ...currentCountBase,
        audience: a ?? undefined,
      }),
    });
  };
  const toggleProductType = (t: string) => {
    const wasSelected = selectedProductTypes.includes(t);
    const next = wasSelected
      ? selectedProductTypes.filter((pt) => pt !== t)
      : [...selectedProductTypes, t];
    setParams({ type: next.length ? next.join(",") : null });
    trackFilterChanged({
      page: "shop",
      filter_key: "product_type",
      action: wasSelected ? "remove" : "add",
      ui_value: PRODUCT_TYPE_LABELS[t] || formatCategory(t),
      query_value: t,
      active_filter_count: countActiveFilters({
        ...currentCountBase,
        productTypes: next,
      }),
    });
  };

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
    trackFilterChanged({
      page: "shop",
      filter_key: "fiber_family",
      action: allSelected ? "remove" : "add",
      ui_value: family.label,
      query_value: family.members.join("|"),
      active_filter_count: countActiveFilters({
        ...currentCountBase,
        fibers: next,
      }),
    });
  };

  const toggleBrand = (brandSlug: string) => {
    const wasSelected = selectedBrands.includes(brandSlug);
    const next = wasSelected
      ? selectedBrands.filter((b) => b !== brandSlug)
      : [...selectedBrands, brandSlug];
    setParams({ brand: next.length ? next.join(",") : null });
    const brand = brands.find((b) => b.slug === brandSlug);
    trackFilterChanged({
      page: "shop",
      filter_key: "brand",
      action: wasSelected ? "remove" : "add",
      ui_value: brand?.name ?? brandSlug,
      query_value: brandSlug,
      active_filter_count: countActiveFilters({
        ...currentCountBase,
        brands: next,
      }),
    });
  };

  const visibleBrands = useMemo(
    () =>
      availableBrandSlugs
        ? brands.filter((b) => availableBrandSlugs.includes(b.slug) || selectedBrands.includes(b.slug))
        : brands,
    [brands, availableBrandSlugs, selectedBrands]
  );

  const clearAllFilters = () => {
    const before = countActiveFilters(currentCountBase);
    router.replace(pathname, { scroll: false });
    if (before > 0) {
      trackFiltersCleared({ page: "shop", cleared_filter_count: before });
    }
  };

  const hasActiveFilters =
    selectedAudience !== null ||
    selectedCategory !== null ||
    selectedProductTypes.length > 0 ||
    selectedFibers.length > 0 ||
    selectedBrands.length > 0 ||
    minPrice !== undefined ||
    maxPrice !== undefined;


  // Build active filter chips
  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (selectedAudience) {
    activeChips.push({ label: selectedAudience, onRemove: () => setAudience(null) });
  }
  if (selectedCategory) {
    activeChips.push({ label: formatCategory(selectedCategory), onRemove: () => setCategory(null) });
  }
  for (const pt of selectedProductTypes) {
    activeChips.push({ label: PRODUCT_TYPE_LABELS[pt] || formatCategory(pt), onRemove: () => toggleProductType(pt) });
  }
  // Consolidate fiber chips when all natural families are selected (e.g. via tier pill)
  const naturalFamilies = fiberGroups.find((g) => g.heading === "Natural")?.families ?? [];
  const allNaturalSelected =
    naturalFamilies.length > 0 &&
    naturalFamilies.every((fam) => fam.members.some((m) => selectedFibers.includes(m)));

  if (allNaturalSelected) {
    activeChips.push({
      label: "All Natural Fibers",
      onRemove: () => {
        const naturalMembers = naturalFamilies.flatMap((f) => f.members);
        const next = selectedFibers.filter((f) => !naturalMembers.includes(f));
        setParams({ fiber: next.length ? next.join(",") : null, tier: null });
      },
    });
    // Only show chips for non-natural families that are also selected
    for (const fam of allFiberFamilies) {
      const isNatural = naturalFamilies.some((nf) => nf.label === fam.label);
      if (!isNatural && fam.members.some((m) => selectedFibers.includes(m))) {
        activeChips.push({ label: fam.label, onRemove: () => toggleFiberFamily(fam) });
      }
    }
  } else {
    for (const fam of allFiberFamilies) {
      if (fam.members.some((m) => selectedFibers.includes(m))) {
        activeChips.push({ label: fam.label, onRemove: () => toggleFiberFamily(fam) });
      }
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

  // Display logic: search overrides normal view
  const isSearchActive = searchResults !== null;
  const displayProducts = isSearchActive ? searchResults : products;

  // All natural fiber members (for tier sync)
  const allNaturalMembers = useMemo(
    () => fiberGroups.find((g) => g.heading === "Natural")?.families.flatMap((f) => f.members) ?? [],
    [fiberGroups]
  );

  // When "100% Natural" tier pill is clicked, auto-select all natural fiber checkboxes;
  // when leaving "natural" tier, clear the auto-selected fibers
  const prevTierRef = useRef(tier);
  useEffect(() => {
    if (tier === "natural" && prevTierRef.current !== "natural" && allNaturalMembers.length > 0) {
      const merged = [...new Set([...selectedFibers, ...allNaturalMembers])];
      setParams({ fiber: merged.join(",") });
    } else if (tier !== "natural" && prevTierRef.current === "natural") {
      const remaining = selectedFibers.filter((f) => !allNaturalMembers.includes(f));
      setParams({ fiber: remaining.length ? remaining.join(",") : null });
    }
    prevTierRef.current = tier;
  }, [tier, allNaturalMembers, selectedFibers, setParams]);

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

      {/* Fiber Type — first and always open */}
      <AccordionFilter title="Fiber Type" defaultOpen>
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
          <div key={cat}>
            <FilterCheckbox
              label={formatCategory(cat)}
              checked={selectedCategory === cat}
              onChange={() => setCategory(selectedCategory === cat ? null : cat)}
            />
            {selectedCategory === cat && productTypes.length > 0 && (
              <div className="ml-6 mt-0.5 mb-1 flex flex-col gap-0.5">
                {productTypes.map((pt) => (
                  <FilterCheckbox
                    key={pt}
                    label={PRODUCT_TYPE_LABELS[pt] || formatCategory(pt)}
                    checked={selectedProductTypes.includes(pt)}
                    onChange={() => toggleProductType(pt)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </AccordionFilter>

      {/* Brand */}
      {visibleBrands.length > 0 && (
        <AccordionFilter title="Brand" defaultOpen={selectedBrands.length > 0}>
          <div className="relative">
            <div className="max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
              {visibleBrands.map((brand) => (
                <FilterCheckbox
                  key={brand.slug}
                  label={brand.name}
                  checked={selectedBrands.includes(brand.slug)}
                  onChange={() => toggleBrand(brand.slug)}
                />
              ))}
            </div>
            {visibleBrands.length > 8 && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
            )}
          </div>
        </AccordionFilter>
      )}

      {/* Price — applies on blur or Enter to avoid rapid re-fetching */}
      <AccordionFilter title="Price" defaultOpen={minPrice !== undefined || maxPrice !== undefined}>
        <PriceRangeInputs
          minPrice={minPrice}
          maxPrice={maxPrice}
          onApply={(min, max) => {
            setParams({ minPrice: min, maxPrice: max });
            const nextMin = min ? Number(min) : undefined;
            const nextMax = max ? Number(max) : undefined;
            const willBeActive = nextMin !== undefined || nextMax !== undefined;
            const wasActive = minPrice !== undefined || maxPrice !== undefined;
            trackFilterChanged({
              page: "shop",
              filter_key: "price",
              action: !willBeActive
                ? "remove"
                : wasActive
                  ? "replace"
                  : "add",
              ui_value: willBeActive ? `$${nextMin ?? 0}-$${nextMax ?? "∞"}` : null,
              query_value: willBeActive ? `${nextMin ?? ""}:${nextMax ?? ""}` : null,
              active_filter_count: countActiveFilters({
                ...currentCountBase,
                minPrice: nextMin,
                maxPrice: nextMax,
              }),
            });
          }}
        />
      </AccordionFilter>
    </>
  );

  return (
    <>
      {/* Accessible page heading */}
      <h1 className="sr-only">Shop Natural Fiber Clothing</h1>

      {/* Sticky top bar */}
      <section className={`sticky top-0 z-20 bg-background px-5 sm:px-8 lg:px-20 pt-5 pb-4 transition-shadow duration-200 ${showBackToTop ? "shadow-[0_1px_8px_rgba(0,0,0,0.06)]" : ""}`}>
        <div className="mx-auto max-w-[1280px]">
          {/* Search + Tier row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-[400px]">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="search"
                placeholder="Search products or brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-muted-light bg-background py-2 pl-9 pr-3 font-body text-[14px] text-text placeholder:text-muted-light outline-none transition-colors focus:border-muted focus-visible:ring-2 focus-visible:ring-accent/50"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSearchResults(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Tier pills */}
            <div className="flex items-center gap-1.5">
              {(Object.entries(TIER_LABELS) as [TierFilter, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => {
                    const prev = tier;
                    setParams({ tier: value === "all" ? null : value });
                    trackFilterChanged({
                      page: "shop",
                      filter_key: "tier",
                      action:
                        value === "all"
                          ? "remove"
                          : prev === "all"
                            ? "add"
                            : "replace",
                      ui_value: label,
                      query_value: value,
                      active_filter_count: countActiveFilters({
                        ...currentCountBase,
                        tier: value,
                      }),
                    });
                  }}
                  title={TIER_DESCRIPTIONS[value]}
                  className={`rounded-full px-3 py-1.5 font-body text-[12px] font-medium transition-colors ${
                    tier === value
                      ? "bg-text text-background"
                      : "bg-surface text-secondary hover:bg-surface-dark hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile filter toggle */}
          <div className="mt-3 lg:hidden">
            <button
              onClick={() => setFilterOpen(true)}
              className="flex items-center gap-1.5 font-body text-[14px] font-medium text-text transition-colors hover:text-secondary"
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
            {/* Count + sort row */}
            <div className="flex items-center justify-between pb-4 pt-4">
              <p className="font-body text-[14px] text-secondary">
                {isPending || isSearching ? (
                  "Loading..."
                ) : isSearchActive ? (
                  <>
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{debouncedSearch}&rdquo;
                  </>
                ) : (
                  <>
                    Showing {products.length.toLocaleString()} of{" "}
                    {totalCount.toLocaleString()} product{totalCount !== 1 ? "s" : ""}
                  </>
                )}
              </p>
              <div className="relative">
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                  className="flex items-center gap-1.5 font-body text-[14px] text-secondary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:rounded-md"
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
                    <div role="listbox" aria-label="Sort options" className="absolute right-0 top-full z-40 mt-2 w-[200px] rounded-lg border border-muted-light bg-background py-1 shadow-lg">
                      {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(
                        ([value, label]) => (
                          <button
                            key={value}
                            role="option"
                            aria-selected={sort === value}
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

            <div
              className={`transition-opacity duration-300 ease-out ${
                isPending ? "opacity-50" : "opacity-100"
              }`}
            >
              {/* Loading skeletons */}
              {(isPending || isSearching) && displayProducts.length === 0 ? (
                <div className="grid grid-cols-2 gap-x-5 gap-y-8 pt-4 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <ProductSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-8 pt-4 sm:grid-cols-3 lg:grid-cols-4">
                    {displayProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        source={isSearchActive ? "search" : "shop"}
                      />
                    ))}
                  </div>

                  {/* Load more / infinite scroll */}
                  {!isPending && !isSearchActive && hasMore && (
                    <div ref={sentinelRef} className="mt-12 flex flex-col items-center gap-4 py-4">
                      {isLoadingMore ? (
                        <div className="grid w-full grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <ProductSkeleton key={i} />
                          ))}
                        </div>
                      ) : (
                        <button
                          onClick={loadMore}
                          className="rounded-full border border-surface-dark px-6 py-2.5 font-body text-[14px] font-medium text-text transition-colors hover:bg-surface"
                        >
                          Load more
                        </button>
                      )}
                    </div>
                  )}

                  {!isPending && !isSearching && displayProducts.length === 0 && (
                    <div className="flex flex-col items-center gap-4 py-16">
                      <svg className="h-10 w-10 text-muted-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                      <p className="font-body text-[16px] text-secondary">
                        {isSearchActive
                          ? `No results for "${debouncedSearch}"`
                          : "No products match these filters"}
                      </p>
                      <p className="font-body text-[13px] text-muted">
                        {isSearchActive
                          ? "Try a different term or browse by category instead."
                          : "Try removing a filter or broadening your search."}
                      </p>
                      {(hasActiveFilters || isSearchActive) && (
                        <button
                          onClick={() => {
                            if (isSearchActive) {
                              setSearchQuery("");
                              setSearchResults(null);
                            }
                            clearAllFilters();
                          }}
                          className="rounded-full border border-surface-dark px-5 py-2.5 font-body text-[14px] font-medium text-text transition-colors hover:bg-surface"
                        >
                          {isSearchActive ? "Clear search" : "Clear all filters"}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile slide-out filter panel (from left) */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 flex justify-start lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
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

      {/* Back to top button */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-8 right-8 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-text text-background shadow-lg transition-all hover:opacity-90"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      )}
    </>
  );
}
