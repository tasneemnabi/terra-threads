import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getBrandBySlug } from "@/lib/queries/brands";
import { getProductsByBrand } from "@/lib/queries/products";
import { ProductGrid } from "@/components/product/ProductGrid";
import { brandLogoUrl, affiliateUrl, brandDomain } from "@/lib/utils";

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
      brand.description || `Shop ${brand.name} natural fiber activewear.`,
  };
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);

  if (!brand) notFound();

  const products = await getProductsByBrand(brand.id);
  const logoUrl = brandLogoUrl(brand.website_url);
  const domain = brandDomain(brand.website_url);
  const formatCategory = (cat: string) =>
    cat
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const metaParts = [
    ...brand.audience,
    ...brand.categories.map(formatCategory),
  ];

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
          <Link href="/" className="hover:text-text transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/brands" className="hover:text-text transition-colors">
            Brands
          </Link>
          <span>/</span>
          <span className="text-text">{brand.name}</span>
        </div>
      </nav>

      {/* Brand Hero */}
      <section className="px-5 sm:px-8 lg:px-20 pt-10 pb-12">
        <div className="mx-auto max-w-[1280px] flex flex-col gap-5">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <Image
                src={logoUrl}
                alt={`${brand.name} logo`}
                width={64}
                height={64}
                className="shrink-0 rounded-[10px]"
              />
            )}
            <h1 className="font-display text-[48px] font-medium leading-[54px] tracking-[-0.03em] text-text">
              {brand.name}
            </h1>
          </div>

          {/* Fiber type pills */}
          <div className="flex flex-wrap gap-2">
            {brand.fiber_types.map((fiber) => (
              <span
                key={fiber}
                className="rounded-full border border-muted-light px-3 py-1 font-body text-[13px] leading-[16px] text-secondary"
              >
                {fiber}
              </span>
            ))}
          </div>

          {brand.description && (
            <p className="max-w-[640px] font-body text-[17px] leading-[26px] text-secondary">
              {brand.description}
            </p>
          )}

          {metaParts.length > 0 && (
            <p className="font-body text-[14px] leading-[20px] text-muted">
              {metaParts.join(" \u00B7 ")}
            </p>
          )}

          {brand.website_url && (
            <div className="flex items-center gap-3">
              <a
                href={affiliateUrl(brand.website_url, "brand-detail")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-body text-[14px] font-medium text-white transition-colors hover:bg-accent/90"
              >
                Visit Website
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
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
              {domain && (
                <span className="font-body text-[14px] text-muted">
                  {domain}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Products Section */}
      <section className="px-5 sm:px-8 lg:px-20 pb-16">
        <div className="mx-auto max-w-[1280px]">
          <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.12em] text-accent">
            Natural Fiber Products
          </p>
          <h2 className="mt-3 font-display text-[28px] font-medium leading-[34px] tracking-[-0.02em] text-text">
            {products.length > 0
              ? `${products.length} product${products.length === 1 ? "" : "s"}`
              : "Products"}
          </h2>

          <div className="mt-8">
            {products.length > 0 ? (
              <ProductGrid products={products} />
            ) : (
              <div className="rounded-[14px] border border-surface-dark bg-background p-10 text-center">
                <p className="font-body text-[17px] leading-[26px] text-secondary">
                  We&apos;re curating {brand.name}&apos;s natural fiber
                  collection. Check back soon.
                </p>
                {brand.website_url && (
                  <a
                    href={affiliateUrl(brand.website_url, "brand-detail-empty")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1 font-body text-[14px] font-medium text-accent hover:text-accent/80 transition-colors"
                  >
                    Shop {brand.name} directly
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
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Back link */}
      <section className="px-5 sm:px-8 lg:px-20 pb-16">
        <div className="mx-auto max-w-[1280px]">
          <Link
            href="/brands"
            className="inline-flex items-center gap-1 font-body text-[14px] font-medium text-accent hover:text-accent/80 transition-colors"
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
