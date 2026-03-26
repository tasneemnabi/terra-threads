import { Hero } from "@/components/home/Hero";
import { FeaturedBrands } from "@/components/home/FeaturedBrands";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { WhyNaturalFibers } from "@/components/home/WhyNaturalFibers";
import { BrowseByFiber } from "@/components/home/BrowseByFiber";
import { BrandStrip } from "@/components/home/BrandStrip";
import { getAllBrands } from "@/lib/queries/brands";
import { getHomepageProducts } from "@/lib/queries/products";

export default async function HomePage() {
  const [brands, products] = await Promise.all([
    getAllBrands(),
    getHomepageProducts(),
  ]);

  return (
    <>
      <Hero brandCount={brands.length} />
      <FeaturedBrands brands={brands} />
      <FeaturedProducts products={products} />
      <WhyNaturalFibers />
      <BrowseByFiber />
      <BrandStrip brands={brands} />
    </>
  );
}
