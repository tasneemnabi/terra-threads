import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getProductBySlug, getRelatedProducts } from "@/lib/queries/products";
import { ProductImages } from "@/components/product/ProductImages";
import { FiberFactsLabel } from "@/components/product/FiberFactsLabel";
import { AffiliateButton } from "@/components/product/AffiliateButton";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { formatPrice, brandLogoUrl } from "@/lib/utils";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };

  return {
    title: `${product.name} | ${product.brand_name} | FIBER`,
    description: product.description || `${product.name} by ${product.brand_name} — natural fiber clothing on FIBER`,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const relatedProducts = await getRelatedProducts(product.id, product.category);
  const logoUrl = brandLogoUrl(product.brand_website_url);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.image_url,
    brand: {
      "@type": "Brand",
      name: product.brand_name,
    },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8 lg:px-20 py-8">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-1 font-body text-sm text-muted">
          <Link href="/" className="py-2 hover:text-text transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link
            href={`/shop?category=${product.category}`}
            className="py-2 capitalize hover:text-text transition-colors"
          >
            {product.category}
          </Link>
          <span>/</span>
          <span className="text-text">{product.name}</span>
        </nav>

        {/* Hero: two-column grid */}
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <ProductImages
            mainImage={product.image_url}
            additionalImages={product.additional_images}
            productName={product.name}
          />

          <div className="space-y-6">
            {/* Brand identity */}
            <Link
              href={`/brand/${product.brand_slug}`}
              className="group inline-flex items-center gap-2.5 transition-colors hover:text-text"
            >
              {logoUrl && (
                <Image
                  src={logoUrl}
                  alt={`${product.brand_name} logo`}
                  width={32}
                  height={32}
                  className="shrink-0 rounded-md"
                />
              )}
              <span className="font-body text-sm font-medium uppercase tracking-wide text-muted group-hover:text-text transition-colors">
                {product.brand_name}
              </span>
              <svg className="h-3.5 w-3.5 text-muted-light group-hover:text-text transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {/* Product name */}
            <h1 className="font-display text-[32px] font-semibold leading-[1.15] tracking-[-0.02em] text-text sm:text-[36px] lg:text-[44px]">
              {product.name}
            </h1>

            {/* Price */}
            <p className="font-body text-2xl font-bold text-text">
              {formatPrice(product.price, product.currency)}
            </p>

            {/* Fiber Facts Label — the centerpiece */}
            <FiberFactsLabel materials={product.materials} />

            {/* CTA */}
            {product.affiliate_url && (
              <AffiliateButton
                url={product.affiliate_url}
                brandName={product.brand_name}
              />
            )}

            <p className="font-body text-xs text-muted-light">
              We may earn a commission when you shop through our links.
            </p>

            {/* Description */}
            {product.description && (
              <p className="font-body text-base leading-relaxed text-secondary">
                {product.description}
              </p>
            )}
          </div>
        </div>

        {/* Related Products */}
        <RelatedProducts products={relatedProducts} />
      </div>
    </>
  );
}
