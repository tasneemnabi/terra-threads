import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getProductBySlug, getRelatedProducts } from "@/lib/queries/products";
import { ProductImages } from "@/components/product/ProductImages";
import { MaterialBreakdown } from "@/components/product/MaterialBreakdown";
import { AffiliateButton } from "@/components/product/AffiliateButton";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { NaturalBadge } from "@/components/brand/NaturalBadge";
import { Badge } from "@/components/ui/Badge";
import { formatPrice, isAllNatural, naturalPercentage } from "@/lib/utils";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };

  return {
    title: product.name,
    description: product.description || `${product.name} by ${product.brand_name}`,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const relatedProducts = await getRelatedProducts(product.id, product.category);
  const natPercent = naturalPercentage(product.materials);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
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
        <nav className="mb-8 text-sm text-muted">
          <Link href="/" className="hover:text-accent">
            Home
          </Link>
          {" / "}
          <Link
            href={`/category/${product.category}`}
            className="capitalize hover:text-accent"
          >
            {product.category}
          </Link>
          {" / "}
          <span className="text-text">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <ProductImages
            mainImage={product.image_url}
            additionalImages={product.additional_images}
            productName={product.name}
          />

          <div className="space-y-6">
            <div>
              <Link
                href={`/brand/${product.brand_slug}`}
                className="text-sm font-medium uppercase tracking-wide text-muted hover:text-accent"
              >
                {product.brand_name}
              </Link>
              <h1 className="mt-1 font-display text-[36px] font-semibold leading-[42px] tracking-[-0.02em] text-text">
                {product.name}
              </h1>
              <p className="mt-2 text-2xl font-bold text-text">
                {formatPrice(product.price, product.currency)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral" className="capitalize">
                {product.category}
              </Badge>
              {isAllNatural(product.materials) && <NaturalBadge />}
              {!isAllNatural(product.materials) && natPercent > 0 && (
                <Badge variant="success">{natPercent}% Natural Fibers</Badge>
              )}
            </div>

            {product.description && (
              <p className="text-secondary">{product.description}</p>
            )}

            <MaterialBreakdown materials={product.materials} />

            {product.affiliate_url && (
              <AffiliateButton
                url={product.affiliate_url}
                brandName={product.brand_name}
              />
            )}

            <p className="text-xs text-muted-light">
              We may earn a commission when you shop through our links.
            </p>
          </div>
        </div>

        <RelatedProducts products={relatedProducts} />
      </div>
    </>
  );
}
