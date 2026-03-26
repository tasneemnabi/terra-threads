import Link from "next/link";
import { ProductCard } from "@/components/product/ProductCard";
import type { ProductWithBrand } from "@/types/database";

interface FeaturedProductsProps {
  products: ProductWithBrand[];
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  if (products.length === 0) return null;

  return (
    <section className="px-5 sm:px-8 lg:px-20 pt-20">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-secondary">
              New arrivals
            </p>
            <h2 className="mt-2 font-display text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-text">
              Shop natural fiber clothing
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden font-body text-[15px] font-medium leading-[18px] text-accent transition-colors hover:text-accent/80 sm:inline-flex sm:items-center sm:gap-1"
          >
            Browse all &rarr;
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
