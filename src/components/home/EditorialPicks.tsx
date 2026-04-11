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
    <Link href={`/product/${product.slug}`} className="group block transition-transform duration-300 ease-out hover:-translate-y-1">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-surface">
        {product.image_url && (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            unoptimized
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

  const [featured, ...rest] = products;

  return (
    <section className="px-5 sm:px-8 lg:px-20 pt-10 sm:pt-12 pb-20 sm:pb-28">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-end justify-between mb-10">
          <h2 className="font-display text-[24px] sm:text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">
            Just landed.
          </h2>
          <Link
            href="/shop?sort=newest"
            className="group/arrow inline-flex items-center gap-1.5 font-body text-[14px] sm:text-[15px] font-medium text-accent hover:text-accent/80 transition-colors"
          >
            See all{" "}
            <span className="inline-block transition-transform duration-200 group-hover/arrow:translate-x-0.5">
              &rarr;
            </span>
          </Link>
        </div>

        {/* Featured + grid — asymmetric layout on desktop */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Featured large card */}
          <div className="lg:w-[45%] lg:flex-shrink-0">
            <Link href={`/product/${featured.slug}`} className="group block transition-transform duration-300 ease-out hover:-translate-y-1">
              <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-surface">
                {featured.image_url && (
                  <Image
                    src={featured.image_url}
                    alt={featured.name}
                    fill
                    unoptimized
                    priority
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    sizes="(max-width: 1024px) 100vw, 45vw"
                  />
                )}
              </div>
              <div className="pt-4">
                <p className="font-body text-[12px] font-normal uppercase tracking-[0.5px] text-secondary">
                  {featured.brand_name}
                </p>
                <h3 className="mt-1 line-clamp-2 font-display text-[18px] sm:text-[20px] font-semibold leading-snug text-text transition-colors duration-200 group-hover:text-accent">
                  {featured.name}
                </h3>
                <div className="mt-1.5">
                  <FiberFactsMini materials={featured.materials} />
                </div>
                <p className="mt-2 font-body text-[17px] font-semibold text-text">
                  {formatPrice(featured.price, featured.currency)}
                </p>
              </div>
            </Link>
          </div>

          {/* Remaining products — compact grid (cap at 6 for even rows) */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 content-start">
            {rest.slice(0, 6).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
