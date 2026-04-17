import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getBrandBySlug, getBrandsWithDetails } from "@/lib/queries/brands";
import { getProductsByBrand } from "@/lib/queries/products";
import { BrandProducts } from "@/components/brand/BrandProducts";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { brandLogoUrl } from "@/lib/utils";
import type { BrandWithDetails } from "@/types/database";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) return { title: "Brand Not Found" };

  return {
    title: `${brand.name} | FIBER`,
    description:
      brand.description || `Shop ${brand.name} natural fiber clothing.`,
  };
}

// Pick up to `limit` sister brands that overlap the current brand's fiber
// types. Falls back to other brands when no overlap is available.
function pickSisterBrands(
  all: BrandWithDetails[],
  currentSlug: string,
  currentFibers: string[],
  limit = 4
): BrandWithDetails[] {
  const others = all.filter((b) => b.slug !== currentSlug);
  const fiberSet = new Set(currentFibers.map((f) => f.toLowerCase()));
  const scored = others
    .map((b) => {
      const overlap = b.fiber_types.filter((f) => fiberSet.has(f.toLowerCase())).length;
      return { brand: b, overlap };
    })
    .sort((a, b) => {
      if (a.overlap !== b.overlap) return b.overlap - a.overlap;
      // Secondary: prefer brands with more products, then A–Z
      if (a.brand.product_count !== b.brand.product_count)
        return b.brand.product_count - a.brand.product_count;
      return a.brand.name.localeCompare(b.brand.name);
    });
  return scored.slice(0, limit).map((s) => s.brand);
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);

  if (!brand) notFound();

  const [products, allBrands] = await Promise.all([
    getProductsByBrand(brand.id),
    getBrandsWithDetails(),
  ]);
  const logoUrl = brandLogoUrl(brand.website_url);
  const sisterBrands = pickSisterBrands(
    allBrands,
    brand.slug,
    brand.fiber_types || [],
    4
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Brand",
            name: brand.name,
            description: brand.description,
            url: brand.website_url,
            logo: logoUrl,
          }),
        }}
      />

      {/* Breadcrumb */}
      <nav className="px-5 sm:px-8 lg:px-20 pt-8">
        <div className="mx-auto max-w-[1280px] flex items-center gap-1 font-body text-[14px] leading-[20px] text-muted">
          <Link
            href="/"
            className="inline-flex items-center min-h-[44px] hover:text-text transition-colors"
          >
            Home
          </Link>
          <span>/</span>
          <Link
            href="/brands"
            className="inline-flex items-center min-h-[44px] hover:text-text transition-colors"
          >
            Brands
          </Link>
          <span>/</span>
          <span className="text-text">{brand.name}</span>
        </div>
      </nav>

      {/* Brand Hero — 1.5× breathing room, wider description column */}
      <section className="px-5 sm:px-8 lg:px-20 pt-14 pb-16 sm:pt-16 sm:pb-20">
        <div className="mx-auto max-w-[1280px] flex flex-col gap-7">
          <div className="flex items-center gap-5">
            <BrandLogo
              src={logoUrl}
              name={brand.name}
              size={72}
              priority
            />
            <h1 className="font-display text-[36px] sm:text-[56px] font-medium leading-[1.1] tracking-[-0.03em] text-text text-balance">
              {brand.name}
            </h1>
          </div>

          {brand.description && (
            <p className="max-w-[640px] font-body text-[17px] leading-[1.65] text-secondary">
              {brand.description}
            </p>
          )}
        </div>
      </section>

      {/* Products */}
      <section className="px-5 sm:px-8 lg:px-20 pb-20">
        <div className="mx-auto max-w-[1280px]">
          {products.length > 0 && products.every((p) => !p.is_available) && (
            <div className="mb-8 rounded-[14px] border border-accent/20 bg-accent/5 p-5 text-center">
              <p className="font-body text-[15px] leading-[22px] text-secondary">
                This brand releases in limited drops — check back soon for new
                arrivals.
              </p>
            </div>
          )}
          {products.length > 0 ? (
            <BrandProducts products={products} />
          ) : (
            <div className="rounded-[14px] border border-surface-dark bg-background p-10 text-center">
              <p className="font-body text-[17px] leading-[26px] text-secondary">
                We&apos;re curating {brand.name}&apos;s natural fiber
                collection. Check back soon.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Sister brands */}
      {sisterBrands.length > 0 && (
        <section className="px-5 sm:px-8 lg:px-20 pb-16 border-t border-surface-dark pt-14">
          <div className="mx-auto max-w-[1280px] flex flex-col gap-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-[22px] sm:text-[26px] font-medium leading-[1.2] tracking-[-0.02em] text-text">
                More natural-fiber brands
              </h2>
              <Link
                href="/brands"
                className="font-body text-[14px] font-medium text-accent transition-colors hover:text-accent/80"
              >
                View all brands →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-4 sm:gap-5">
              {sisterBrands.map((sister) => (
                <Link
                  key={sister.id}
                  href={`/brand/${sister.slug}`}
                  className="group flex flex-col gap-3 rounded-[14px] border border-surface-dark bg-white p-5 transition-colors hover:border-muted"
                >
                  <div className="flex items-center gap-3">
                    <BrandLogo
                      src={brandLogoUrl(sister.website_url)}
                      name={sister.name}
                      size={40}
                    />
                    <span className="font-display text-[18px] font-semibold leading-[1.2] tracking-[-0.01em] text-text truncate">
                      {sister.name}
                    </span>
                  </div>
                  <p className="font-body text-[13px] leading-[18px] text-muted line-clamp-2">
                    {sister.fiber_types.slice(0, 3).join(" · ") ||
                      "Natural fibers"}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back link */}
      <section className="px-5 sm:px-8 lg:px-20 pb-20">
        <div className="mx-auto max-w-[1280px]">
          <Link
            href="/brands"
            className="inline-flex items-center gap-1 min-h-[44px] font-body text-[14px] text-muted hover:text-text transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to all brands
          </Link>
        </div>
      </section>
    </>
  );
}
