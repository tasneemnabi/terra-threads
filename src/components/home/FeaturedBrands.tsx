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
    <section className="py-14 sm:py-16 border-y border-surface-dark/30">
      <div className="px-5 sm:px-8 lg:px-20">
        <div className="mx-auto max-w-[1280px]">
          {/* Compact horizontal brand strip */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
            <p className="font-body text-[13px] font-medium uppercase tracking-[0.08em] text-muted flex-shrink-0">
              Our brands
            </p>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 flex-1">
              {brands.map((brand) => {
                const logoSrc = brandLogoUrl(brand.website_url ?? null);
                return (
                  <Link
                    key={brand.slug}
                    href={`/brand/${brand.slug}`}
                    className="group flex-shrink-0"
                  >
                    {logoSrc ? (
                      <div className="relative h-7 w-24 sm:h-8 sm:w-28">
                        <Image
                          src={logoSrc}
                          alt={brand.name}
                          fill
                          className="object-contain opacity-50 transition-opacity duration-200 group-hover:opacity-100"
                          sizes="120px"
                        />
                      </div>
                    ) : (
                      <span className="font-display text-[14px] sm:text-[15px] font-semibold text-muted transition-colors duration-200 group-hover:text-text">
                        {brand.name}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <Link
              href="/brands"
              className="font-body text-[14px] font-medium text-accent hover:text-accent/80 transition-colors flex-shrink-0"
            >
              All brands &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
