import { Hero } from "@/components/home/Hero";
import { EditorialPicks } from "@/components/home/EditorialPicks";
import { FiberFactsShowcase } from "@/components/home/FiberFactsShowcase";
import { BrowseByFiber } from "@/components/home/BrowseByFiber";
import { FinalCTA } from "@/components/home/FinalCTA";
import { getHomepageProducts } from "@/lib/queries/products";

export default async function HomePage() {
  const products = await getHomepageProducts(5);

  return (
    <>
      <Hero />
      <EditorialPicks products={products} />
      {products[0] && <FiberFactsShowcase product={products[0]} />}
      <BrowseByFiber />
      <FinalCTA />
    </>
  );
}
