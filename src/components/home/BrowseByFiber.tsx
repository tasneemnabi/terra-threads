import Image from "next/image";
import { TrackedLink } from "@/components/ui/TrackedLink";

const fibers = [
  {
    name: "Merino Wool",
    shortName: "Merino",
    description:
      "Temperature-regulating, odor-resistant, moisture-wicking. The gold standard for natural activewear.",
    param: "Merino Wool",
    image: "/fibers/merino-v2.png",
  },
  {
    name: "Organic Cotton",
    shortName: "Cotton",
    description:
      "Soft, breathable, chemical-free. Ideal for yoga, low-impact training, and everyday wear.",
    param: "Organic Cotton",
    image: "/fibers/cotton.png",
  },
  {
    name: "Linen",
    shortName: "Linen",
    description:
      "Exceptionally breathable and lightweight. Gets softer with every wash.",
    param: "Linen",
    image: "/fibers/linen.png",
  },
  {
    name: "Silk",
    shortName: "Silk",
    description:
      "Ultralight with natural thermoregulation. A luxury base layer for heat and cold alike.",
    param: "Silk",
    image: "/fibers/silk.png",
  },
];

export function BrowseByFiber() {
  const [hero, ...rest] = fibers;

  return (
    <section className="px-5 sm:px-8 lg:px-20 py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px]">
        <h2 className="font-display text-[24px] sm:text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">
          The fabric makes the difference.
        </h2>

        {/* Mobile: 2×2 grid of image tiles */}
        <div className="mt-8 grid grid-cols-2 gap-3 lg:hidden">
          {fibers.map((fiber) => (
            <TrackedLink
              key={fiber.name}
              href={`/shop?fiber=${encodeURIComponent(fiber.param)}`}
              section="browse-by-fiber"
              ctaText={`Shop ${fiber.shortName}`}
              itemName={fiber.name}
              className="group relative aspect-square rounded-xl overflow-hidden flex flex-col justify-end"
            >
              <Image
                src={fiber.image}
                alt={`${fiber.name} texture`}
                fill
                unoptimized
                className="object-cover transition-transform duration-500 group-active:scale-[1.03]"
                sizes="50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
              <h3 className="relative px-4 pb-4 font-display text-[18px] font-semibold leading-tight tracking-[-0.01em] text-white">
                {fiber.name}
              </h3>
            </TrackedLink>
          ))}
        </div>

        <TrackedLink
          href="/shop"
          section="browse-by-fiber"
          ctaText="Browse all fibers"
          className="mt-5 inline-flex items-center gap-1.5 font-body text-[14px] font-semibold text-accent lg:hidden"
        >
          Browse all fibers <span aria-hidden>&rarr;</span>
        </TrackedLink>

        {/* Desktop: asymmetric hero + list */}
        <div className="mt-8 hidden lg:flex flex-row gap-6">
          <TrackedLink
            href={`/shop?fiber=${encodeURIComponent(hero.param)}`}
            section="browse-by-fiber"
            ctaText={`Shop ${hero.shortName}`}
            itemName={hero.name}
            className="group w-[45%] flex-shrink-0 relative rounded-xl overflow-hidden flex flex-col justify-end transition-all duration-300 hover:shadow-lg"
          >
            <div className="absolute inset-0">
              <Image
                src={hero.image}
                alt={`${hero.name} texture`}
                fill
                unoptimized
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                sizes="45vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            </div>
            <div className="relative px-10 py-14">
              <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60 mb-3">
                Most popular
              </p>
              <h3 className="font-display text-[32px] font-bold leading-[1.05] tracking-[-0.02em] text-white">
                {hero.name}
              </h3>
              <p className="mt-3 max-w-[340px] font-body text-[15px] leading-[24px] text-white/80">
                {hero.description}
              </p>
              <p className="mt-6 inline-flex items-center gap-1 font-body text-[14px] font-semibold text-white group-hover:gap-2 transition-all duration-200">
                Shop merino <span>&rarr;</span>
              </p>
            </div>
          </TrackedLink>

          <div className="flex-1 flex flex-col gap-3">
            {rest.map((fiber) => (
              <TrackedLink
                key={fiber.name}
                href={`/shop?fiber=${encodeURIComponent(fiber.param)}`}
                section="browse-by-fiber"
                ctaText={`Shop ${fiber.shortName}`}
                itemName={fiber.name}
                className="group flex items-center gap-4 rounded-lg bg-surface px-6 py-5 transition-all duration-200 hover:bg-surface-dark/30"
              >
                <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
                  <Image
                    src={fiber.image}
                    alt={`${fiber.name} texture`}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-[18px] font-semibold text-text">
                    {fiber.name}
                  </h3>
                  <p className="mt-0.5 font-body text-[14px] leading-[20px] text-secondary">
                    {fiber.description}
                  </p>
                </div>
                <span className="font-body text-[13px] font-medium text-accent flex-shrink-0 group-hover:translate-x-0.5 transition-transform duration-200">
                  Shop &rarr;
                </span>
              </TrackedLink>
            ))}

            <TrackedLink
              href="/shop"
              section="browse-by-fiber"
              ctaText="Browse all fibers"
              className="group flex items-center justify-between gap-4 rounded-lg border border-surface-dark/40 px-6 py-5 transition-colors duration-200 hover:bg-surface/50"
            >
              <div>
                <h3 className="font-display text-[18px] font-semibold text-text">
                  All fibers
                </h3>
                <p className="mt-0.5 font-body text-[14px] text-secondary">
                  Explore our full natural fiber library
                </p>
              </div>
              <span className="font-body text-[13px] font-medium text-accent flex-shrink-0 group-hover:translate-x-0.5 transition-transform duration-200">
                Browse all &rarr;
              </span>
            </TrackedLink>
          </div>
        </div>
      </div>
    </section>
  );
}
