import Image from "next/image";
import { TrackedLink } from "@/components/ui/TrackedLink";

interface Entry {
  label: string;
  meta: string;
  href: string;
  image?: string;
}

interface ShopByAudienceProps {
  newArrivalImage?: string | null;
  naturalImage?: string | null;
}

export function ShopByAudience({
  newArrivalImage,
  naturalImage,
}: ShopByAudienceProps = {}) {
  const ENTRIES: Entry[] = [
    {
      label: "Women",
      meta: "Shop the edit",
      href: "/shop?audience=Women",
      image:
        "https://sawrpcmtbsrgtnzhjmho.supabase.co/storage/v1/object/public/product-images/magic-linen-a-line-linen-dress-chiloe-in-black/0.webp",
    },
    {
      label: "Men",
      meta: "Shop the edit",
      href: "/shop?audience=Men",
      image:
        "https://cdn.shopify.com/s/files/1/0640/8454/1699/files/mens-linen-shirt-bedarra-in-black-1.jpg?v=1741878376",
    },
    {
      label: "New arrivals",
      meta: "Latest this week",
      href: "/shop?sort=newest",
      image: newArrivalImage ?? undefined,
    },
    {
      label: "100% Natural",
      meta: "Zero synthetics",
      href: "/shop?tier=natural",
      image: naturalImage ?? undefined,
    },
  ];

  return (
    <section className="px-5 sm:px-8 lg:px-20 py-14 sm:py-20">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-end justify-between mb-5 sm:mb-6">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {ENTRIES.map((entry, i) => (
            <TrackedLink
              key={entry.label}
              href={entry.href}
              section="shop-by-audience"
              ctaText={entry.label}
              itemName={entry.label}
              className="group relative aspect-[4/5] md:aspect-square overflow-hidden rounded-lg bg-surface"
            >
              {entry.image ? (
                <>
                  <Image
                    src={entry.image}
                    alt={entry.label}
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    sizes="(min-width: 768px) 25vw, 50vw"
                    priority={i < 2}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                    <p className="font-display text-[18px] sm:text-[20px] font-semibold text-white leading-tight tracking-[-0.01em] drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                      {entry.label}
                    </p>
                    <p className="mt-0.5 font-body text-[12px] sm:text-[13px] text-white/80">
                      {entry.meta}
                    </p>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5 transition-colors duration-200 group-hover:bg-surface-dark/30">
                  <p className="font-display text-[18px] sm:text-[20px] font-semibold text-text leading-tight tracking-[-0.01em]">
                    {entry.label}
                  </p>
                  <p className="mt-0.5 font-body text-[12px] sm:text-[13px] text-secondary">
                    {entry.meta}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 font-body text-[12px] font-medium text-accent">
                    Shop{" "}
                    <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                      &rarr;
                    </span>
                  </span>
                </div>
              )}
            </TrackedLink>
          ))}
        </div>
      </div>
    </section>
  );
}
