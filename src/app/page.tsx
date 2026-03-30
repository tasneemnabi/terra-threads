import { Hero } from "@/components/home/Hero";
import { EditorialPicks } from "@/components/home/EditorialPicks";
import { FiberFactsShowcase } from "@/components/home/FiberFactsShowcase";
import { BrowseByFiber } from "@/components/home/BrowseByFiber";
import { FinalCTA } from "@/components/home/FinalCTA";
import { getHomepageProducts } from "@/lib/queries/products";

export default async function HomePage() {
  const products = await getHomepageProducts(9);

  return (
    <>
      <Hero products={products.slice(0, 4)} />
      <EditorialPicks products={products.slice(4)} />
      <FiberFactsShowcase product={products[0]} />
      <BrowseByFiber />
      <FinalCTA />
    </>
  );
}
