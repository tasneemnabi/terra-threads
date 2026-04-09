import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="px-5 sm:px-8 lg:px-20 py-20 sm:py-28 bg-accent">
      <div className="mx-auto max-w-[1280px]">
        <h2 className="font-display text-[28px] sm:text-[36px] font-bold leading-tight tracking-[-0.02em] text-background text-balance">
          Your wardrobe, rewoven.
        </h2>
        <p className="mt-4 max-w-[480px] font-body text-[16px] leading-[26px] text-background/70">
          Every piece here is vetted for natural fibers. No polyester, no compromise — just clothes that feel as good as they look.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-start gap-4">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-full bg-background px-8 py-3.5 font-body text-[15px] font-semibold text-text transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 active:translate-y-0 active:shadow-md"
          >
            Start Shopping
          </Link>
          <Link
            href="/brands"
            className="group/arrow inline-flex items-center justify-center px-2 py-3.5 font-body text-[15px] font-medium text-background/70 transition-colors hover:text-background"
          >
            See All Brands{" "}
            <span className="inline-block ml-1 transition-transform duration-200 group-hover/arrow:translate-x-1">
              &rarr;
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
