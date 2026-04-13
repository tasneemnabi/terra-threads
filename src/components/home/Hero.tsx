import Link from "next/link";
import Image from "next/image";
import { HeroProductCollage } from "./HeroProductImage";
import type { ProductWithBrand } from "@/types/database";

interface HeroProps {
  products?: ProductWithBrand[];
}

export function Hero({ products = [] }: HeroProps) {
  // Diversify hero images by brand — pick one per brand, then pass all as fallbacks
  const withImages = products.filter((p) => p.image_url);
  const seenBrands = new Set<string>();
  const diversified: typeof withImages = [];
  const rest: typeof withImages = [];
  for (const p of withImages) {
    if (!seenBrands.has(p.brand_slug)) {
      seenBrands.add(p.brand_slug);
      diversified.push(p);
    } else {
      rest.push(p);
    }
  }
  const heroProducts = [...diversified, ...rest].map((p) => ({
    url: p.image_url!,
    name: p.name,
  }));

  return (
    <section className="relative min-h-[75vh] sm:min-h-[80vh] flex items-end overflow-hidden bg-accent">
      {/* Texture overlay — subtle background */}
      <div className="absolute inset-0 flex items-center justify-end opacity-15 mix-blend-soft-light">
        <Image
          src="/hero-texture.png"
          alt=""
          width={1200}
          height={1400}
          className="h-full w-auto max-w-none translate-x-[10%]"
          priority
          unoptimized
        />
      </div>

      {/* Warm gradient from left for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent via-accent/85 to-accent/40" />

      {/* Product images — right side collage (fades in when loaded) */}
      {heroProducts.length > 0 && (
        <HeroProductCollage products={heroProducts} />
      )}

      {/* Content */}
      <div className="relative z-10 w-full px-5 sm:px-8 lg:px-20 pb-14 sm:pb-20 lg:pb-24">
        <div className="mx-auto max-w-[1280px]">
          <h1 className="animate-fade-up max-w-[800px] font-display text-[44px] leading-[0.98] sm:text-[64px] lg:text-[88px] font-bold tracking-[-0.03em] text-white">
            Clothing without{" "}
            <br className="hidden sm:block" />
            the plastic.
          </h1>
          <p className="animate-fade-up [--delay:120ms] mt-5 sm:mt-6 max-w-[440px] font-body text-[16px] sm:text-[18px] leading-[26px] text-white/65">
            Merino, cotton, linen, silk. Clothes that breathe, last, and
            never shed microplastics.
          </p>
          <div className="animate-fade-up [--delay:240ms] mt-8 sm:mt-10 flex flex-col sm:flex-row items-start gap-4">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 font-body text-[15px] font-semibold text-text transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 active:translate-y-0 active:shadow-md"
            >
              Shop All Products
            </Link>
            <Link
              href="/brands"
              className="group/arrow inline-flex items-center justify-center px-2 py-3.5 font-body text-[15px] font-medium text-white/60 transition-colors hover:text-white"
            >
              Browse Brands{" "}
              <span className="inline-block ml-1 transition-transform duration-200 group-hover/arrow:translate-x-1">
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
