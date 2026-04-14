"use client";

import { useState } from "react";
import { ProductGrid } from "./ProductGrid";
import type { ProductCardSource } from "@/lib/posthog/events";
import type { ProductWithBrand } from "@/types/database";

const PAGE_SIZE = 24;

interface PaginatedProductGridProps {
  products: ProductWithBrand[];
  hideBrand?: boolean;
  source: ProductCardSource;
}

export function PaginatedProductGrid({ products, hideBrand, source }: PaginatedProductGridProps) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const visible = products.slice(0, shown);
  const remaining = products.length - shown;
  const hasMore = remaining > 0;

  return (
    <>
      <ProductGrid products={visible} hideBrand={hideBrand} source={source} />
      {hasMore && (
        <div className="mt-10 text-center">
          <button
            onClick={() => setShown((s) => Math.min(s + PAGE_SIZE, products.length))}
            className="inline-flex items-center gap-2 rounded-full border border-muted-light px-6 py-3 font-body text-[14px] font-medium text-text transition-colors hover:border-text"
          >
            Show more ({remaining} remaining)
          </button>
        </div>
      )}
    </>
  );
}
