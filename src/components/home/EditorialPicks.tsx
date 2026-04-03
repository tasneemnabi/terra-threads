import Link from "next/link";
import Image from "next/image";
import { FiberFactsMini } from "@/components/product/FiberFactsMini";
import { formatPrice } from "@/lib/utils";
import type { ProductWithBrand } from "@/types/database";

interface EditorialPicksProps {
  products: ProductWithBrand[];
}

function ProductCard({
  product,
  priority = false,
}: {
  product: ProductWithBrand;
  priority?: boolean;
}) {
  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-surface">
        {product.image_url && (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            priority={priority}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        )}
      </div>
      <div className="pt-3">
        <p className="font-body text-[11px] font-normal uppercase tracking-[0.5px] text-secondary">
          {product.brand_name}
        </p>
        <h3 className="mt-0.5 line-clamp-2 font-body text-[14px] font-medium leading-snug text-text transition-colors duration-200 group-hover:text-accent min-h-[2.5em]">
          {product.name}
        </h3>
        <div className="mt-1">
          <FiberFactsMini materials={product.materials} />
        </div>
        <p className="mt-1.5 font-body text-[15px] font-semibold text-text">
          {formatPrice(product.price, product.currency)}
        </p>
      </div>
    </Link>
  );
}

export function EditorialPicks({ products }: EditorialPicksProps) {
  if (products.length === 0) return null;

  return (
    <section className="px-5 sm:px-8 lg:px-20 py-16 sm:py-20">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-end justify-between mb-8">
          <h2 className="font-display text-[24px] sm:text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text text-balance">
            New arrivals
          </h2>
          <Link
            href="/shop?sort=newest"
            className="inline-flex items-center gap-1.5 font-body text-[14px] sm:text-[15px] font-medium text-accent hover:text-accent/80 transition-colors"
          >
            See all &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={i < 4} />
          ))}
        </div>
      </div>
    </section>
  );
}
