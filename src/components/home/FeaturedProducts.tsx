import { ProductGrid } from "@/components/product/ProductGrid";
import type { ProductWithBrand } from "@/types/database";

interface FeaturedProductsProps {
  products: ProductWithBrand[];
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-bold text-neutral-900">Featured Products</h2>
      <p className="mt-2 text-neutral-500">
        Hand-picked natural fiber activewear from top brands.
      </p>
      <div className="mt-8">
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
