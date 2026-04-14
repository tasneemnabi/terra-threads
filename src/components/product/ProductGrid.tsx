import { ProductCard } from "./ProductCard";
import type { ProductCardSource } from "@/lib/posthog/events";
import type { ProductWithBrand } from "@/types/database";

interface ProductGridProps {
  products: ProductWithBrand[];
  hideBrand?: boolean;
  source: ProductCardSource;
}

export function ProductGrid({ products, hideBrand, source }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">No products found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} hideBrand={hideBrand} source={source} />
      ))}
    </div>
  );
}
