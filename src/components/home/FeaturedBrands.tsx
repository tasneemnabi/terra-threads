import Link from "next/link";
import type { Brand } from "@/types/database";

interface FeaturedBrandsProps {
  brands: Brand[];
}

export function FeaturedBrands({ brands }: FeaturedBrandsProps) {
  if (brands.length === 0) return null;

  // Prefer 100% natural brands first, then alphabetical
  const sorted = [...brands].sort((a, b) => {
    if (a.is_fully_natural !== b.is_fully_natural) return a.is_fully_natural ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const featured = sorted.slice(0, 3);

  return (
    <section className="px-5 sm:px-8 lg:px-20">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-secondary">
              Featured
            </p>
            <h2 className="mt-2 font-display text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-text">
              Brands we love
            </h2>
          </div>
          <Link
            href="/brands"
            className="hidden font-body text-[15px] font-medium leading-[18px] text-accent transition-colors hover:text-accent/80 sm:inline-flex sm:items-center sm:gap-1"
          >
            View all brands &rarr;
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((brand) => (
            <Link
              key={brand.slug}
              href={`/brand/${brand.slug}`}
              className="group flex flex-col"
            >
              <div className="flex h-[370px] items-end rounded-[14px] bg-surface-dark p-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-text/80 px-3 py-1.5 font-body text-[12px] font-medium text-background">
                  <span className={`h-1.5 w-1.5 rounded-full ${brand.is_fully_natural ? "bg-natural" : "bg-nearly"}`} />
                  {brand.is_fully_natural ? "100% Natural" : "Nearly Natural"}
                </span>
              </div>
              <div className="px-1 pt-3">
                <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-muted">
                  {brand.name}
                </p>
                <p className="mt-1.5 font-body text-[16px] font-medium leading-[22px] text-text">
                  {brand.description
                    ? brand.description.split(".")[0] + "."
                    : "Natural fiber clothing"}
                </p>
                <p className="mt-2 font-body text-[14px] font-medium text-accent">
                  Browse {brand.name} &rarr;
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
