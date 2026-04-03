import { ProductGrid } from "./ProductGrid";
import type { ProductWithBrand } from "@/types/database";

interface RelatedProductsProps {
  products: ProductWithBrand[];
}

export function RelatedProducts({ products }: RelatedProductsProps) {
  if (products.length === 0) return null;

  return (
    <section className="mt-20">
      <h2 className="font-display text-[28px] font-semibold tracking-[-0.01em] text-text">You Might Also Like</h2>
      <div className="mt-6">
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
