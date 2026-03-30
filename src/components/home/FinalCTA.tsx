import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="px-5 sm:px-8 lg:px-20 py-20 sm:py-28 bg-text">
      <div className="mx-auto max-w-[1280px]">
        <h2 className="font-display text-[28px] sm:text-[36px] font-bold leading-tight tracking-[-0.02em] text-background text-balance">
          Ready to ditch the polyester?
        </h2>
        <div className="mt-8 flex flex-col sm:flex-row items-start gap-4">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-lg bg-background px-8 py-3.5 font-body text-[15px] font-semibold text-text transition-opacity hover:opacity-90"
          >
            Shop All Products
          </Link>
          <Link
            href="/brands"
            className="inline-flex items-center justify-center rounded-lg border border-background/30 px-8 py-3.5 font-body text-[15px] font-semibold text-background transition-colors hover:bg-background/10"
          >
            Browse Brands
          </Link>
        </div>
      </div>
    </section>
  );
}
