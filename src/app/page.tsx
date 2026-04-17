import { Hero } from "@/components/home/Hero";
import { ShopByAudience } from "@/components/home/ShopByAudience";
import { EditorialPicks } from "@/components/home/EditorialPicks";

import { FiberFactsShowcase } from "@/components/home/FiberFactsShowcase";
import { BrowseByFiber } from "@/components/home/BrowseByFiber";
import { FinalCTA } from "@/components/home/FinalCTA";
import { getHomepageProducts, getHeroProducts } from "@/lib/queries/products";


const AUDIENCE_IMAGES = [
  {
    audience: "Women",
    image_url:
      "https://sawrpcmtbsrgtnzhjmho.supabase.co/storage/v1/object/public/product-images/magic-linen-a-line-linen-dress-chiloe-in-black/0.webp",
  },
  {
    audience: "Men",
    image_url:
      "https://cdn.shopify.com/s/files/1/0640/8454/1699/files/mens-linen-shirt-bedarra-in-black-1.jpg?v=1741878376",
  },
];

export default async function HomePage() {
  const [heroProducts, products] = await Promise.all([
    getHeroProducts(8),
    getHomepageProducts(8),
  ]);

  return (
    <>
      <Hero products={heroProducts} />
      <ShopByAudience audiences={AUDIENCE_IMAGES} />
      <EditorialPicks products={products} />
      {products[0] && <FiberFactsShowcase product={products[0]} />}
      <BrowseByFiber />
      <FinalCTA />
    </>
  );
}
