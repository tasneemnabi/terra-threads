import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { NaturalBadge } from "@/components/brand/NaturalBadge";
import { formatPrice, materialSummary, isAllNatural } from "@/lib/utils";
import type { ProductWithBrand } from "@/types/database";

interface ProductCardProps {
  product: ProductWithBrand;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block overflow-hidden rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/5] bg-neutral-100">
        {product.image_url ? (
          <div className="flex h-full items-center justify-center p-8 text-neutral-400">
            <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-neutral-400">
            <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {isAllNatural(product.materials) && (
          <div className="absolute left-3 top-3">
            <NaturalBadge />
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {product.brand_name}
        </p>
        <h3 className="mt-1 text-sm font-semibold text-neutral-900 group-hover:text-primary">
          {product.name}
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          {materialSummary(product.materials)}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-base font-bold text-neutral-900">
            {formatPrice(product.price, product.currency)}
          </span>
          <Badge variant="neutral">{product.category}</Badge>
        </div>
      </div>
    </Link>
  );
}
