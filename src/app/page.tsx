import { Hero } from "@/components/home/Hero";
import { ShopByCategory } from "@/components/home/ShopByCategory";
import { EditorialPicks } from "@/components/home/EditorialPicks";
import { FeaturedBrands } from "@/components/home/FeaturedBrands";
import { FiberFactsShowcase } from "@/components/home/FiberFactsShowcase";
import { BrowseByFiber } from "@/components/home/BrowseByFiber";
import { FinalCTA } from "@/components/home/FinalCTA";
import { getHomepageProducts, getCategoryImages } from "@/lib/queries/products";
import { getBrandsWithDetails } from "@/lib/queries/brands";

const HOMEPAGE_CATEGORIES = [
  "activewear",
  "tops",
  "bottoms",
  "dresses",
  "loungewear",
  "basics",
];

export default async function HomePage() {
  const [products, categoryImages, allBrands] = await Promise.all([
    getHomepageProducts(8),
    getCategoryImages(HOMEPAGE_CATEGORIES),
    getBrandsWithDetails(),
  ]);

  // Pick top 6 brands by product count
  const featuredBrands = allBrands
    .filter((b) => b.product_count > 0)
    .sort((a, b) => b.product_count - a.product_count)
    .slice(0, 6);

  return (
    <>
      <Hero />
      <ShopByCategory categories={categoryImages} />
      <EditorialPicks products={products} />
      <FeaturedBrands brands={featuredBrands} />
      {products[0] && <FiberFactsShowcase product={products[0]} />}
      <BrowseByFiber />
      <FinalCTA />
    </>
  );
}
