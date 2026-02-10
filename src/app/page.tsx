import { Hero } from "@/components/home/Hero";
import { CategoryCards } from "@/components/home/CategoryCards";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { WhyNaturalFibers } from "@/components/home/WhyNaturalFibers";
import { getFeaturedProducts } from "@/lib/queries/products";

export default async function HomePage() {
  const featuredProducts = await getFeaturedProducts();

  return (
    <>
      <Hero />
      <CategoryCards />
      <FeaturedProducts products={featuredProducts} />
      <WhyNaturalFibers />
    </>
  );
}
