import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getBrandBySlug } from "@/lib/queries/brands";
import { getProductsByBrand } from "@/lib/queries/products";
import { ProductGrid } from "@/components/product/ProductGrid";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) return { title: "Brand Not Found" };

  return {
    title: brand.name,
    description: brand.description || `Shop ${brand.name} natural fiber activewear.`,
  };
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);

  if (!brand) notFound();

  const products = await getProductsByBrand(brand.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-8 text-sm text-neutral-500">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        {" / "}
        <span className="text-neutral-900">{brand.name}</span>
      </nav>

      <div className="mb-12">
        <h1 className="text-3xl font-bold text-neutral-900">{brand.name}</h1>
        {brand.description && (
          <p className="mt-3 max-w-2xl text-neutral-600">{brand.description}</p>
        )}
        {brand.website_url && (
          <a
            href={brand.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark"
          >
            Visit Website
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>

      <h2 className="mb-6 text-xl font-bold text-neutral-900">
        Products ({products.length})
      </h2>
      <ProductGrid products={products} />
    </div>
  );
}
