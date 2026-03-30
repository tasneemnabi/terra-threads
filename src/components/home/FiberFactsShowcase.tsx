import Link from "next/link";
import { FiberFactsLabel } from "@/components/product/FiberFactsLabel";
import type { ProductWithBrand } from "@/types/database";

interface FiberFactsShowcaseProps {
  product: ProductWithBrand;
}

export function FiberFactsShowcase({ product }: FiberFactsShowcaseProps) {
  return (
    <section className="px-5 sm:px-8 lg:px-20 py-20 sm:py-28 bg-surface">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-20">
          {/* Label */}
          <div className="w-full max-w-[280px] mx-auto lg:mx-0 lg:flex-shrink-0">
            <FiberFactsLabel materials={product.materials} />
          </div>

          {/* Copy */}
          <div className="flex-1 lg:pt-2">
            <h2 className="font-display text-[24px] sm:text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">
              Every fiber, listed.
            </h2>
            <p className="mt-4 max-w-[480px] font-body text-[16px] leading-[26px] text-secondary">
              Every product on FIBER shows its exact material breakdown.
              No &ldquo;sustainable blend&rdquo; hand-waving — just the
              percentages, so you know exactly what you&apos;re wearing.
            </p>

            <div className="mt-8 flex gap-8">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-natural" />
                <span className="font-body text-[14px] text-text">
                  100% Natural
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-surface-dark" />
                <span className="font-body text-[14px] text-text">
                  Nearly Natural
                </span>
              </div>
            </div>

            <Link
              href={`/product/${product.slug}`}
              className="mt-8 inline-block font-body text-[14px] font-medium text-accent hover:text-accent/80 transition-colors"
            >
              See it on a product &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
