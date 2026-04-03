import Link from "next/link";
import Image from "next/image";
import { brandLogoUrl } from "@/lib/utils";
import type { BrandWithDetails } from "@/types/database";

interface FeaturedBrandsProps {
  brands: BrandWithDetails[];
}

export function FeaturedBrands({ brands }: FeaturedBrandsProps) {
  if (brands.length === 0) return null;

  return (
    <section className="px-5 sm:px-8 lg:px-20 py-16 sm:py-20 bg-surface">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-secondary">
              Our brands
            </p>
            <h2 className="mt-2 font-display text-[24px] sm:text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text text-balance">
              Curated for natural fibers
            </h2>
          </div>
          <Link
            href="/brands"
            className="hidden sm:inline-flex items-center gap-1.5 font-body text-[15px] font-medium text-accent hover:text-accent/80 transition-colors"
          >
            All brands &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
          {brands.map((brand) => {
            const logoSrc = brandLogoUrl(brand.website_url ?? null);
            return (
              <Link
                key={brand.slug}
                href={`/brand/${brand.slug}`}
                className="group flex flex-col items-center gap-3 rounded-lg bg-background px-4 py-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                {logoSrc ? (
                  <div className="relative h-10 w-full">
                    <Image
                      src={logoSrc}
                      alt={brand.name}
                      fill
                      className="object-contain opacity-80 transition-opacity group-hover:opacity-100"
                      sizes="160px"
                    />
                  </div>
                ) : (
                  <p className="font-display text-[15px] font-semibold text-text text-center">
                    {brand.name}
                  </p>
                )}
                <p className="font-body text-[12px] text-muted text-center">
                  {brand.product_count} pieces
                </p>
              </Link>
            );
          })}
        </div>

        <Link
          href="/brands"
          className="mt-8 block text-center sm:hidden font-body text-[14px] font-medium text-accent hover:text-accent/80 transition-colors"
        >
          All brands &rarr;
        </Link>
      </div>
    </section>
  );
}
