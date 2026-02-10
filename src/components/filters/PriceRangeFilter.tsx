"use client";

import { useState, useEffect } from "react";

interface PriceRangeFilterProps {
  minPrice?: number;
  maxPrice?: number;
  onChange: (min: number | undefined, max: number | undefined) => void;
}

export function PriceRangeFilter({
  minPrice,
  maxPrice,
  onChange,
}: PriceRangeFilterProps) {
  const [min, setMin] = useState(minPrice?.toString() ?? "");
  const [max, setMax] = useState(maxPrice?.toString() ?? "");

  useEffect(() => {
    setMin(minPrice?.toString() ?? "");
    setMax(maxPrice?.toString() ?? "");
  }, [minPrice, maxPrice]);

  const handleApply = () => {
    onChange(
      min ? Number(min) : undefined,
      max ? Number(max) : undefined
    );
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">Price Range</h3>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          placeholder="Min"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          onBlur={handleApply}
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-neutral-400">-</span>
        <input
          type="number"
          placeholder="Max"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          onBlur={handleApply}
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}
