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
  large = false,
}: {
  product: ProductWithBrand;
  large?: boolean;
}) {
  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div
        className={`relative overflow-hidden rounded-lg bg-surface ${
          large ? "aspect-[3/4]" : "aspect-[4/5]"
        }`}
      >
        {product.image_url && (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            sizes={
              large
                ? "(max-width: 1024px) 100vw, 50vw"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            }
          />
        )}
      </div>
      <div className="pt-3">
        <p className="font-body text-[12px] uppercase tracking-[0.08em] text-secondary">
          {product.brand_name}
        </p>
        <h3
          className={`mt-1 line-clamp-2 font-body font-medium leading-snug text-text transition-colors duration-200 group-hover:text-accent ${
            large ? "text-[16px]" : "text-[14px] min-h-[2.75em]"
          }`}
        >
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

export function EditorialPicks({ products }: EditorialPicksProps) {
  if (products.length === 0) return null;

  const featured = products[0];
  const rest = products.slice(1, 5);

  return (
    <section className="px-5 sm:px-8 lg:px-20 py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-end justify-between mb-10">
          <h2 className="font-display text-[24px] sm:text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">
            New arrivals
          </h2>
          <Link
            href="/shop"
            className="hidden sm:block font-body text-[14px] font-medium text-accent hover:text-accent/80 transition-colors"
          >
            See all &rarr;
          </Link>
        </div>

        {/* Featured + side grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Large featured product */}
          <ProductCard product={featured} large />

          {/* 2x2 grid of smaller products */}
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            {rest.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>

        <Link
          href="/shop"
          className="mt-8 block text-center sm:hidden font-body text-[14px] font-medium text-accent hover:text-accent/80 transition-colors"
        >
          See all &rarr;
        </Link>
      </div>
    </section>
  );
}
