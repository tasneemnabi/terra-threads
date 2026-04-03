import Link from "next/link";
import Image from "next/image";

export function Hero() {
  return (
    <section className="px-5 sm:px-8 lg:px-20 pt-12 sm:pt-16 lg:pt-20 pb-12 sm:pb-16 lg:pb-20">
      <div className="mx-auto max-w-[1280px] flex flex-col lg:flex-row lg:items-center lg:gap-16">
        {/* Text */}
        <div className="flex-1">
          <h1 className="max-w-[620px] font-display text-[40px] leading-[1.08] sm:text-[56px] lg:text-[72px] font-bold tracking-[-0.03em] text-text text-balance">
            Clothing without
            <br />
            <span className="text-accent">the plastic.</span>
          </h1>
          <p className="mt-6 sm:mt-8 max-w-[420px] font-body text-[17px] sm:text-[18px] leading-[28px] text-secondary">
            Merino, cotton, linen, silk — clothes that breathe, last, and never shed microplastics.
          </p>
          <div className="mt-10 sm:mt-14 flex flex-col sm:flex-row items-start gap-4">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center rounded-lg bg-accent px-8 py-3.5 font-body text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Shop All Products
            </Link>
            <Link
              href="/brands"
              className="inline-flex items-center justify-center rounded-lg border border-text/30 px-8 py-3.5 font-body text-[15px] font-semibold text-text transition-colors hover:bg-text/5"
            >
              Browse Brands
            </Link>
          </div>
        </div>

        {/* Hero illustration */}
        <div className="mt-12 lg:mt-0 w-full max-w-[480px] flex-shrink-0">
          <Image
            src="/hero-texture.png"
            alt="Abstract textile composition in dusty rose and slate"
            width={1200}
            height={1400}
            className="w-full h-auto"
            priority
          />
        </div>
      </div>
    </section>
  );
}
