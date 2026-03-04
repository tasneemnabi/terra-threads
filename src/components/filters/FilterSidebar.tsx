"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { FiberTypeFilter } from "./FiberTypeFilter";
import { BrandFilter } from "./BrandFilter";
import { PriceRangeFilter } from "./PriceRangeFilter";
import { ActiveFilters } from "./ActiveFilters";
import type { Brand, Material } from "@/types/database";

interface FilterSidebarProps {
  brands: Brand[];
  materials: Material[];
}

export function FilterSidebar({ brands, materials }: FilterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedBrands = searchParams.get("brand")?.split(",").filter(Boolean) ?? [];
  const selectedMaterials = searchParams.get("fiber")?.split(",").filter(Boolean) ?? [];
  const minPrice = searchParams.get("minPrice")
    ? Number(searchParams.get("minPrice"))
    : undefined;
  const maxPrice = searchParams.get("maxPrice")
    ? Number(searchParams.get("maxPrice"))
    : undefined;

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Reset to page 1 when filters change
      params.delete("page");

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, searchParams]
  );

  const handleBrandsChange = (brands: string[]) => {
    updateParams({ brand: brands.length > 0 ? brands.join(",") : undefined });
  };

  const handleMaterialsChange = (materials: string[]) => {
    updateParams({ fiber: materials.length > 0 ? materials.join(",") : undefined });
  };

  const handlePriceChange = (min: number | undefined, max: number | undefined) => {
    updateParams({
      minPrice: min?.toString(),
      maxPrice: max?.toString(),
    });
  };

  const clearAll = () => {
    router.push(pathname);
  };

  return (
    <div className="space-y-6">
      <ActiveFilters
        brands={selectedBrands}
        materials={selectedMaterials}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onRemoveBrand={(slug) =>
          handleBrandsChange(selectedBrands.filter((b) => b !== slug))
        }
        onRemoveMaterial={(name) =>
          handleMaterialsChange(selectedMaterials.filter((m) => m !== name))
        }
        onRemovePrice={() => handlePriceChange(undefined, undefined)}
        onClearAll={clearAll}
      />

      <div className="space-y-6 rounded-xl border border-surface-dark bg-background p-5">
        <FiberTypeFilter
          materials={materials}
          selected={selectedMaterials}
          onChange={handleMaterialsChange}
        />

        <hr className="border-surface-dark" />

        <BrandFilter
          brands={brands}
          selected={selectedBrands}
          onChange={handleBrandsChange}
        />

        <hr className="border-surface-dark" />

        <PriceRangeFilter
          minPrice={minPrice}
          maxPrice={maxPrice}
          onChange={handlePriceChange}
        />
      </div>
    </div>
  );
}
