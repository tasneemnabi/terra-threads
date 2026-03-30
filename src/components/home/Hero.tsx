import Link from "next/link";
import Image from "next/image";
import type { ProductWithBrand } from "@/types/database";

interface HeroProps {
  products: ProductWithBrand[];
}

export function Hero({ products }: HeroProps) {
  const heroProducts = products.slice(0, 4);

  return (
    <section className="px-5 sm:px-8 lg:px-20 pt-12 sm:pt-16 lg:pt-20 pb-20 sm:pb-28 lg:pb-[120px]">
      <div className="mx-auto max-w-[1280px] flex flex-col lg:flex-row lg:items-center lg:gap-16">
        {/* Text */}
        <div className="flex-1">
          <h1 className="max-w-[620px] font-display text-[40px] leading-[1.08] sm:text-[56px] lg:text-[72px] font-bold tracking-[-0.035em] text-text">
            Clothing without
            <br />
            <span className="text-accent">the plastic.</span>
          </h1>
          <p className="mt-6 sm:mt-8 max-w-[420px] font-body text-[17px] sm:text-[18px] leading-[28px] text-secondary">
            We find the brands making clothes from merino, cotton, linen, and silk — so you don&apos;t have to.
          </p>
          <div className="mt-10 sm:mt-14 flex flex-col sm:flex-row items-start gap-4">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center rounded-lg bg-accent px-8 py-3.5 font-body text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Shop All Products
            </Link>
            <Link
              href="/brands"
              className="inline-flex items-center justify-center rounded-lg border border-text/20 px-8 py-3.5 font-body text-[15px] font-semibold text-text transition-colors hover:bg-text/5"
            >
              Browse Brands
            </Link>
          </div>
        </div>

        {/* Product image grid */}
        {heroProducts.length >= 4 && (
          <div className="mt-12 lg:mt-0 w-full max-w-[520px] grid grid-cols-2 gap-3">
            {heroProducts.map((product, i) => (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className={`group relative overflow-hidden rounded-xl bg-surface ${
                  i === 0 ? "aspect-[3/4]" : "aspect-[3/4]"
                }`}
              >
                {product.image_url && (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    sizes="(max-width: 1024px) 45vw, 250px"
                    priority={i < 2}
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent p-3 pt-8">
                  <p className="font-body text-[11px] uppercase tracking-[0.5px] text-white/70">
                    {product.brand_name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
