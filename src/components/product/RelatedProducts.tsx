import { ProductGrid } from "./ProductGrid";
import type { ProductWithBrand } from "@/types/database";

interface RelatedProductsProps {
  products: ProductWithBrand[];
}

export function RelatedProducts({ products }: RelatedProductsProps) {
  if (products.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="text-xl font-bold text-neutral-900">You Might Also Like</h2>
      <div className="mt-6">
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
