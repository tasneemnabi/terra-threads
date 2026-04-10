import { Hero } from "@/components/home/Hero";
import { ShopByCategory } from "@/components/home/ShopByCategory";
import { EditorialPicks } from "@/components/home/EditorialPicks";

import { FiberFactsShowcase } from "@/components/home/FiberFactsShowcase";
import { BrowseByFiber } from "@/components/home/BrowseByFiber";
import { FinalCTA } from "@/components/home/FinalCTA";
import { getHomepageProducts, getHeroProducts, getCategoryImages } from "@/lib/queries/products";


const HOMEPAGE_CATEGORIES = [
  "activewear",
  "tops",
  "bottoms",
  "dresses",
  "loungewear",
  "basics",
];

export default async function HomePage() {
  const [heroProducts, products, categoryImages] = await Promise.all([
    getHeroProducts(8),
    getHomepageProducts(8),
    getCategoryImages(HOMEPAGE_CATEGORIES),
  ]);

  return (
    <>
      <Hero products={heroProducts} />
      <ShopByCategory categories={categoryImages} />
      <EditorialPicks products={products} />
      {products[0] && <FiberFactsShowcase product={products[0]} />}
      <BrowseByFiber />
      <FinalCTA />
    </>
  );
}
