import { Hero } from "@/components/home/Hero";
import { FeaturedBrands } from "@/components/home/FeaturedBrands";
import { WhyNaturalFibers } from "@/components/home/WhyNaturalFibers";
import { BrowseByFiber } from "@/components/home/BrowseByFiber";
import { BrandStrip } from "@/components/home/BrandStrip";
import { getAllBrands } from "@/lib/queries/brands";

export default async function HomePage() {
  const brands = await getAllBrands();

  return (
    <>
      <Hero brandCount={brands.length} />
      <FeaturedBrands brands={brands} />
      <WhyNaturalFibers />
      <BrowseByFiber />
      <BrandStrip brands={brands} />
    </>
  );
}
