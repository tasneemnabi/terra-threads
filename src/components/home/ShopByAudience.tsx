import Image from "next/image";
import { TrackedLink } from "@/components/ui/TrackedLink";

interface AudienceItem {
  audience: string;
  image_url: string;
}

interface ShopByAudienceProps {
  audiences: AudienceItem[];
}

export function ShopByAudience({ audiences }: ShopByAudienceProps) {
  if (audiences.length === 0) return null;

  return (
    <section className="py-14 sm:py-20">
      <div className="px-5 sm:px-8 lg:px-20">
        <div className="mx-auto max-w-[1280px] flex items-end justify-between mb-5 sm:mb-6">
          <h2 className="font-display text-[26px] sm:text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">
            Start somewhere good.
          </h2>
          <TrackedLink
            href="/shop"
            section="shop-by-audience"
            ctaText="View all"
            className="group/arrow inline-flex items-center gap-1 font-body text-[13px] sm:text-[14px] font-medium text-accent hover:text-accent/80 transition-colors"
          >
            View all{" "}
            <span className="inline-block transition-transform duration-200 group-hover/arrow:translate-x-0.5">
              &rarr;
            </span>
          </TrackedLink>
        </div>
      </div>

      <div className="px-5 sm:px-8 lg:px-20">
        <div className="mx-auto max-w-[1280px] grid grid-cols-2 gap-3 sm:gap-4">
          {audiences.map((item, i) => (
            <TrackedLink
              key={item.audience}
              href={`/shop?audience=${encodeURIComponent(item.audience)}`}
              section="shop-by-audience"
              ctaText={item.audience}
              itemName={item.audience}
              className="group relative aspect-[4/5] md:aspect-[5/4] overflow-hidden rounded-lg"
            >
              <Image
                src={item.image_url}
                alt={item.audience}
                fill
                unoptimized
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                sizes="(min-width: 1024px) 620px, (min-width: 640px) 45vw, 50vw"
                priority={i < 2}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <p className="font-display text-[24px] sm:text-[32px] lg:text-[36px] font-semibold text-white leading-tight tracking-[-0.01em] drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
                  {item.audience}
                </p>
              </div>
            </TrackedLink>
          ))}
        </div>
      </div>
    </section>
  );
}
