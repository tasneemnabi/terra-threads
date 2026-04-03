import Link from "next/link";
import Image from "next/image";

export function Hero() {
  return (
    <section className="relative min-h-[75vh] sm:min-h-[80vh] flex items-end overflow-hidden bg-text">
      {/* Texture overlay — subtle abstract art */}
      <div className="absolute inset-0 flex items-center justify-end opacity-30">
        <Image
          src="/hero-texture.png"
          alt=""
          width={1200}
          height={1400}
          className="h-full w-auto max-w-none translate-x-[10%]"
          priority
        />
      </div>

      {/* Warm gradient from left for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-text via-text/80 to-transparent" />

      {/* Content */}
      <div className="relative z-10 w-full px-5 sm:px-8 lg:px-20 pb-14 sm:pb-20 lg:pb-24">
        <div className="mx-auto max-w-[1280px]">
          <h1 className="max-w-[800px] font-display text-[44px] leading-[0.98] sm:text-[64px] lg:text-[88px] font-bold tracking-[-0.03em] text-white">
            Clothing without{" "}
            <br className="hidden sm:block" />
            the plastic.
          </h1>
          <p className="mt-5 sm:mt-6 max-w-[440px] font-body text-[16px] sm:text-[18px] leading-[26px] text-white/65">
            Merino, cotton, linen, silk — clothes that breathe, last, and
            never shed microplastics.
          </p>
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-start gap-4">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 font-body text-[15px] font-semibold text-text transition-opacity hover:opacity-90"
            >
              Shop All Products
            </Link>
            <Link
              href="/brands"
              className="inline-flex items-center justify-center px-2 py-3.5 font-body text-[15px] font-medium text-white/60 transition-colors hover:text-white"
            >
              Browse Brands &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
