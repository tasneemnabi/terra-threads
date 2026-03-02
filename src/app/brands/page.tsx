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
          <p className="max-w-[480px] font-body text-[17px] leading-[26px] text-muted">
            Every brand on Fiber has been vetted for their commitment to natural
            fibers. Some are fully natural — others offer select plastic-free
            products.
          </p>
        </div>
      </section>

      {/* Filters + Grid */}
      <BrandsContent brands={brands} />

      {/* Tier Explainer */}
      <section className="px-20 pb-16 pt-12">
        <div className="mx-auto flex max-w-[1280px] gap-10">
          <div className="flex items-start gap-[10px]">
            <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full bg-[#4A7C59]" />
            <div>
              <p className="font-body text-[13px] font-semibold leading-[16px] text-text">
                100% Natural
              </p>
              <p className="mt-1 font-body text-[13px] leading-[19px] text-muted">
                Every product from this brand is made entirely from natural
                fibers. Zero synthetics.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-[10px]">
            <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full bg-[#C4963C]" />
            <div>
              <p className="font-body text-[13px] font-semibold leading-[16px] text-text">
                Nearly Natural
              </p>
              <p className="mt-1 font-body text-[13px] leading-[19px] text-muted">
                Select products qualify — up to 10% elastane allowed, with the
                rest being natural fibers.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
