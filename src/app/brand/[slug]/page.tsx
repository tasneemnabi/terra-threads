import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getBrandBySlug } from "@/lib/queries/brands";
import { getProductsByBrand } from "@/lib/queries/products";
import { BrandProducts } from "@/components/brand/BrandProducts";
import { brandLogoUrl, affiliateUrl } from "@/lib/utils";

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
          <Link href="/" className="inline-flex items-center min-h-[44px] hover:text-text transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/brands" className="inline-flex items-center min-h-[44px] hover:text-text transition-colors">
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
            <h1 className="font-display text-[36px] sm:text-[56px] font-medium leading-[1.15] tracking-[-0.03em] text-text text-balance">
              {brand.name}
            </h1>
          </div>

          {brand.description && (
            <p className="max-w-[640px] font-body text-[17px] leading-[26px] text-secondary">
              {brand.description}
            </p>
          )}

          {brand.website_url && (
            <a
              href={affiliateUrl(brand.website_url, "brand-detail")}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 min-h-[44px] font-body text-[14px] font-medium text-white transition-colors hover:bg-accent/90"
            >
              Shop {brand.name}
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
      </section>

      {/* Products */}
      <section className="px-5 sm:px-8 lg:px-20 pb-20">
        <div className="mx-auto max-w-[1280px]">
          {products.length > 0 && products.every((p) => !p.is_available) && (
            <div className="mb-8 rounded-[14px] border border-accent/20 bg-accent/5 p-5 text-center">
              <p className="font-body text-[15px] leading-[22px] text-secondary">
                This brand releases in limited drops — check back soon for new arrivals.
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
      </section>

      {/* Back link */}
      <section className="px-5 sm:px-8 lg:px-20 pb-16">
        <div className="mx-auto max-w-[1280px]">
          <Link
            href="/brands"
            className="inline-flex items-center gap-1 min-h-[44px] font-body text-[14px] font-medium text-accent hover:text-accent/80 transition-colors"
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
