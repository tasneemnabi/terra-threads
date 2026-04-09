import Link from "next/link";
import { FiberFactsLabel } from "@/components/product/FiberFactsLabel";
import type { ProductWithBrand } from "@/types/database";

interface FiberFactsShowcaseProps {
  product: ProductWithBrand;
}

export function FiberFactsShowcase({ product }: FiberFactsShowcaseProps) {
  return (
    <section className="relative bg-accent py-24 sm:py-32 lg:py-40 overflow-hidden">
      {/* Subtle texture background */}
      <div className="absolute inset-0 opacity-[0.04]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #FAF7F2 0px, #FAF7F2 1px, transparent 1px, transparent 60px), repeating-linear-gradient(0deg, #FAF7F2 0px, #FAF7F2 1px, transparent 1px, transparent 60px)",
          }}
        />
      </div>

      <div className="relative px-5 sm:px-8 lg:px-20">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:text-left lg:gap-24">
            {/* Copy — larger, more prominent */}
            <div className="flex-1 order-2 lg:order-1 mt-12 lg:mt-0">
              <p className="font-body text-[13px] font-medium uppercase tracking-[0.08em] text-background/40">
                Fiber Facts
              </p>
              <h2 className="mt-4 font-display text-[32px] sm:text-[40px] lg:text-[48px] font-bold leading-[1.05] tracking-[-0.025em] text-background">
                Every thread,
                <br />
                accounted for.
              </h2>
              <p className="mt-5 max-w-[440px] mx-auto lg:mx-0 font-body text-[17px] leading-[28px] text-background/60">
                No &ldquo;sustainable blend&rdquo; hand-waving. Full material
                breakdowns on every product — fiber by fiber, percent by
                percent.
              </p>

              <div className="mt-8 flex justify-center lg:justify-start gap-6">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-natural" />
                  <span className="font-body text-[14px] text-background/70">
                    100% Natural
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-surface-dark" />
                  <span className="font-body text-[14px] text-background/70">
                    Nearly Natural
                  </span>
                </div>
              </div>

              <Link
                href={`/product/${product.slug}`}
                className="group/arrow mt-8 inline-flex items-center justify-center rounded-full bg-background px-7 py-3 font-body text-[14px] font-semibold text-text transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 active:translate-y-0 active:shadow-md"
              >
                See it in action{" "}
                <span className="inline-block ml-1 transition-transform duration-200 group-hover/arrow:translate-x-0.5">
                  &rarr;
                </span>
              </Link>
            </div>

            {/* Label — dramatic scale */}
            <div className="order-1 lg:order-2 w-full max-w-[380px] sm:max-w-[420px] lg:flex-shrink-0 transform lg:rotate-[-2deg] transition-transform duration-500 ease-out hover:rotate-0 hover:scale-[1.02]">
              <div className="bg-background rounded-xl p-8 shadow-2xl">
                <FiberFactsLabel materials={product.materials} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
