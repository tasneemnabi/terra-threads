import { Suspense } from "react";
import type { Metadata } from "next";
import { getBrandsWithDetails } from "@/lib/queries/brands";
import { BrandsContent } from "@/components/brand/BrandsContent";

export const metadata: Metadata = {
  title: "Brands",
  description:
    "Not every product from these brands is plastic-free, but every product on FIBER is. Real fibers, vetted brands.",
};

export default async function BrandsPage() {
  const brands = await getBrandsWithDetails();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Natural Fiber Clothing Brands",
            description:
              "Curated directory of clothing brands committed to natural fibers.",
            numberOfItems: brands.length,
            itemListElement: brands.map((brand, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item: {
                "@type": "Brand",
                name: brand.name,
                description: brand.description,
                url: brand.website_url,
              },
            })),
          }),
        }}
      />

      {/* Page Header */}
      <section className="px-5 sm:px-8 lg:px-20 pt-14">
        <div className="mx-auto max-w-[1280px] flex flex-col gap-5">
          <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-accent">
            Our Curation
          </p>
          <h1 className="font-display text-[40px] font-medium leading-[46px] tracking-[-0.03em] text-text text-balance sm:text-[56px] sm:leading-[64px]">
            Real fibers, vetted brands.
          </h1>
          <p className="max-w-[480px] font-body text-[17px] leading-[26px] text-secondary">
            Not every product from these brands is plastic-free, but every
            product on Fiber is. We do the filtering so you can shop with
            confidence.
          </p>
        </div>
      </section>

      {/* Filters + Grid */}
      <Suspense>
        <BrandsContent brands={brands} />
      </Suspense>

    </>
  );
}
