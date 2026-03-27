import Link from "next/link";
import Image from "next/image";
import { FiberFactsMini } from "@/components/product/FiberFactsMini";
import { formatPrice } from "@/lib/utils";
import type { ProductWithBrand } from "@/types/database";

interface ProductCardProps {
  product: ProductWithBrand;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-surface">
        {product.image_url && product.image_url.startsWith("http") ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-muted-light">
            <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex flex-col pt-3">
        <p className="font-body text-[11px] font-normal uppercase tracking-[0.5px] text-secondary">
          {product.brand_name}
        </p>
        <h3 className="mt-1 min-h-[2.75em] line-clamp-2 font-body text-[14px] font-medium leading-snug text-text transition-colors duration-200 group-hover:text-accent">
          {product.name}
        </h3>
        <div className="mt-1.5">
          <FiberFactsMini materials={product.materials} />
        </div>
        <p className="mt-2 font-body text-[15px] font-semibold text-text">
          {formatPrice(product.price, product.currency)}
        </p>
      </div>
    </Link>
  );
}
