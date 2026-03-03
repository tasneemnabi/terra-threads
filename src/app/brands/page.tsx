import { Suspense } from "react";
import type { Metadata } from "next";
import { getBrandsWithDetails } from "@/lib/queries/brands";
import { BrandsContent } from "@/components/brand/BrandsContent";

export const metadata: Metadata = {
  title: "Brands | FIBER",
  description:
    "Discover clothing brands committed to natural fibers. Every brand on FIBER has been vetted — no polyester, no nylon, no plastic.",
};

export default async function BrandsPage() {
  const brands = await getBrandsWithDetails();

  return (
    <>
      {/* Page Header */}
      <section className="px-20 pt-14">
        <div className="mx-auto max-w-[1280px] flex flex-col gap-5">
          <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.12em] text-accent">
            Our Curation
          </p>
          <h1 className="font-display text-[48px] font-medium leading-[54px] tracking-[-0.03em] text-text">
            Brands that never
            <br />
            use plastic.
          </h1>
          <p className="max-w-[480px] font-body text-[17px] leading-[26px] text-secondary">
            Every brand on Fiber has been vetted for their commitment to natural
            fibers. Some are fully natural — others offer select plastic-free
            products.
          </p>
        </div>
      </section>

      {/* Filters + Grid */}
      <Suspense>
        <BrandsContent brands={brands} />
      </Suspense>

      {/* Tier Explainer */}
      <section className="px-20 pb-16 pt-12">
        <div className="mx-auto flex max-w-[1280px] gap-10">
          <div className="flex items-start gap-3">
            <span className="mt-[2px] shrink-0 font-body text-[12px] font-semibold uppercase tracking-[0.06em] text-accent">
              100% Natural
            </span>
            <p className="font-body text-[14px] leading-[22px] text-secondary">
              Every product from this brand is made entirely from natural
              fibers. Zero synthetics.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-[2px] shrink-0 font-body text-[12px] font-semibold uppercase tracking-[0.06em] text-secondary">
              Nearly Natural
            </span>
            <p className="font-body text-[14px] leading-[22px] text-secondary">
              Select products qualify — up to 10% elastane allowed, with the
              rest being natural fibers.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
