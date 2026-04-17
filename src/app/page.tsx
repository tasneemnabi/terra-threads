import { Hero } from "@/components/home/Hero";
import { ShopByAudience } from "@/components/home/ShopByAudience";
import { EditorialPicks } from "@/components/home/EditorialPicks";

import { FiberFactsShowcase } from "@/components/home/FiberFactsShowcase";
import { BrowseByFiber } from "@/components/home/BrowseByFiber";
import {
  getHomepageProducts,
  getHeroProducts,
  getAudienceTileImages,
} from "@/lib/queries/products";


export default async function HomePage() {
  const [heroProducts, products, audienceTileImages] = await Promise.all([
    getHeroProducts(8),
    getHomepageProducts(8),
    getAudienceTileImages(),
  ]);

  // Prefer a multi-material product for the Fiber Facts showcase so the label
  // has something interesting to break down — a single "100% Cotton" entry
  // undersells the transparency pitch. Priority:
  //   1) blends that include a stretch fibre (elastane / spandex) — "nearly natural"
  //   2) any product with 2+ materials
  //   3) fall back to the first product
  const showcaseProduct =
    products.find((p) =>
      p.materials.some((m) => /elastane|spandex/i.test(m.name))
    ) ??
    products.find((p) => p.materials.length >= 2) ??
    products[0];

  return (
    <>
      <Hero products={heroProducts} />
      <ShopByAudience
        newArrivalImage={audienceTileImages.newArrivalImage}
        naturalImage={audienceTileImages.naturalImage}
      />
      <EditorialPicks products={products} />
      {showcaseProduct && <FiberFactsShowcase product={showcaseProduct} />}
      <BrowseByFiber />
    </>
  );
}
