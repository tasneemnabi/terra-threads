import Link from "next/link";
import Image from "next/image";
import { FiberFactsMini } from "@/components/product/FiberFactsMini";
import { formatPrice } from "@/lib/utils";
import type { ProductWithBrand } from "@/types/database";

interface ProductCardProps {
  product: ProductWithBrand;
  hideBrand?: boolean;
}

export function ProductCard({ product, hideBrand }: ProductCardProps) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-surface ring-1 ring-black/[0.04]">
        {product.image_url && product.image_url.startsWith("http") ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className={`object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]${!product.is_available ? " opacity-60" : ""}`}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-muted-light">
            <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {!product.is_available && (
          <div className="absolute inset-0 flex items-end justify-start p-3">
            <span className="rounded-full bg-text/80 px-2.5 py-1 font-body text-[11px] font-medium uppercase tracking-wide text-background">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {!hideBrand && (
        <p className="pt-3 font-body text-[11px] font-normal uppercase tracking-[0.5px] text-secondary">
          {product.brand_name}
        </p>
      )}
      <h3 className="mt-0.5 line-clamp-2 font-body text-[14px] font-medium leading-snug text-text transition-colors duration-200 group-hover:text-accent">
        {product.name}
      </h3>
      {product.price > 0 && (
        <p className="mt-1.5 font-body text-[15px] font-semibold text-text">
          {formatPrice(product.price, product.currency)}
        </p>
      )}
      <div className="mt-1">
        <FiberFactsMini materials={product.materials} />
      </div>
    </Link>
  );
}
