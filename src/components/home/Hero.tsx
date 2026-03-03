import Link from "next/link";

export function Hero() {
  return (
    <section className="px-20 pb-[120px] pt-[100px]">
      <div className="mx-auto max-w-[1280px]">
        <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-accent">
          Natural Fiber Clothing
        </p>
        <h1 className="mt-6 max-w-[800px] font-display text-[72px] font-bold leading-[76px] tracking-[-0.03em] text-text">
          Clothing without the plastic.
        </h1>
        <p className="mt-7 max-w-[480px] font-body text-[18px] leading-[28px] text-secondary">
          Curated brands making clothing from natural fibers. No polyester, no
          nylon, no compromises — just merino, cotton, linen, and silk.
        </p>
        <div className="mt-[86px] flex items-center gap-6">
          <Link
            href="/brands"
            className="inline-flex items-center justify-center rounded-lg bg-text px-8 py-3.5 font-body text-[15px] font-semibold text-background transition-opacity hover:opacity-90"
          >
            Browse Brands
          </Link>
          <span className="font-body text-[15px] leading-[18px] text-muted">
            20+ brands, 100% natural
          </span>
        </div>
      </div>
    </section>
  );
}
