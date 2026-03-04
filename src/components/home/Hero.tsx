import Link from "next/link";

interface HeroProps {
  brandCount: number;
}

export function Hero({ brandCount }: HeroProps) {
  return (
    <section className="px-5 sm:px-8 lg:px-20 pb-16 sm:pb-20 lg:pb-[120px] pt-12 sm:pt-16 lg:pt-[100px]">
      <div className="mx-auto max-w-[1280px]">
        <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-accent">
          Natural Fiber Clothing
        </p>
        <h1 className="mt-6 max-w-[800px] font-display text-[36px] leading-[42px] sm:text-[52px] sm:leading-[58px] lg:text-[72px] lg:leading-[76px] font-bold tracking-[-0.03em] text-text">
          Clothing without the plastic.
        </h1>
        <p className="mt-7 max-w-[480px] font-body text-[18px] leading-[28px] text-secondary">
          Curated brands making clothing from natural fibers. No polyester, no
          nylon, no compromises — just merino, cotton, linen, and silk.
        </p>
        <div className="mt-10 sm:mt-14 lg:mt-[86px] flex items-center gap-6">
          <Link
            href="/brands"
            className="inline-flex items-center justify-center rounded-lg bg-text px-8 py-3.5 font-body text-[15px] font-semibold text-background transition-opacity hover:opacity-90"
          >
            Browse Brands
          </Link>
          <span className="font-body text-[15px] leading-[18px] text-muted">
            {brandCount}+ brands, 100% natural
          </span>
        </div>
      </div>
    </section>
  );
}
