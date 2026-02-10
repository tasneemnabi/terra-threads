"use client";

import type { Brand } from "@/types/database";

interface BrandFilterProps {
  brands: Brand[];
  selected: string[];
  onChange: (brands: string[]) => void;
}

export function BrandFilter({ brands, selected, onChange }: BrandFilterProps) {
  const toggle = (slug: string) => {
    if (selected.includes(slug)) {
      onChange(selected.filter((b) => b !== slug));
    } else {
      onChange([...selected, slug]);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Brand</h3>
      <div className="mt-3 space-y-2">
        {brands.map((brand) => (
          <label key={brand.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(brand.slug)}
              onChange={() => toggle(brand.slug)}
              className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
            />
            <span className="text-neutral-700">{brand.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
