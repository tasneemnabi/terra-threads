import Link from "next/link";
import Image from "next/image";

const fibers = [
  {
    name: "Merino Wool",
    shortName: "Merino",
    description:
      "Temperature-regulating, odor-resistant, moisture-wicking. The gold standard for natural activewear.",
    param: "Merino Wool",
    image: "/fibers/merino.jpg",
  },
  {
    name: "Organic Cotton",
    shortName: "Cotton",
    description:
      "Soft, breathable, chemical-free. Ideal for yoga, low-impact training, and everyday wear.",
    param: "Organic Cotton",
    image: "/fibers/cotton.jpg",
  },
  {
    name: "Linen",
    shortName: "Linen",
    description:
      "Exceptionally breathable and lightweight. Gets softer with every wash.",
    param: "Linen",
    image: "/fibers/linen.jpg",
  },
  {
    name: "Silk",
    shortName: "Silk",
    description:
      "Ultralight with natural thermoregulation. A luxury base layer for heat and cold alike.",
    param: "Silk",
    image: "/fibers/silk.jpg",
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

        {/* Asymmetric: hero fiber left + stacked list right */}
        <div className="mt-8 flex flex-col lg:flex-row gap-5 lg:gap-6">
          {/* Hero fiber — large feature card with image */}
          <Link
            href={`/shop?fiber=${encodeURIComponent(hero.param)}`}
            className="group lg:w-[45%] lg:flex-shrink-0 relative rounded-xl overflow-hidden flex flex-col justify-end transition-all duration-300 hover:shadow-lg"
          >
            {/* Full-bleed fiber image */}
            <div className="absolute inset-0">
              <Image
                src={hero.image}
                alt={`${hero.name} texture`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
            </div>
            <div className="relative px-8 py-10 sm:px-10 sm:py-14">
              <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50 mb-3">
                Most popular
              </p>
              <h3 className="font-display text-[28px] sm:text-[32px] font-bold leading-[1.05] tracking-[-0.02em] text-white">
                {hero.name}
              </h3>
              <p className="mt-3 max-w-[340px] font-body text-[15px] leading-[24px] text-white/70">
                {hero.description}
              </p>
              <p className="mt-6 inline-flex items-center gap-1 font-body text-[14px] font-semibold text-white group-hover:gap-2 transition-all duration-200">
                Shop merino <span>&rarr;</span>
              </p>
            </div>
          </Link>

          {/* Remaining fibers — image thumbnails with text */}
          <div className="flex-1 flex flex-col gap-3">
            {rest.map((fiber) => (
              <Link
                key={fiber.name}
                href={`/shop?fiber=${encodeURIComponent(fiber.param)}`}
                className="group flex items-center gap-4 rounded-lg bg-surface px-5 py-4 sm:px-6 sm:py-5 transition-all duration-200 hover:bg-surface-dark/30"
              >
                {/* Fiber thumbnail */}
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-md overflow-hidden flex-shrink-0">
                  <Image
                    src={fiber.image}
                    alt={`${fiber.name} texture`}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-[17px] sm:text-[18px] font-semibold text-text">
                    {fiber.name}
                  </h3>
                  <p className="mt-0.5 font-body text-[14px] leading-[20px] text-secondary line-clamp-1 sm:line-clamp-none">
                    {fiber.description}
                  </p>
                </div>
                <span className="font-body text-[13px] font-medium text-accent flex-shrink-0 group-hover:translate-x-0.5 transition-transform duration-200">
                  Shop &rarr;
                </span>
              </Link>
            ))}

            {/* All fibers link */}
            <Link
              href="/shop"
              className="group flex items-center justify-between gap-4 rounded-lg border border-surface-dark/40 px-5 py-4 sm:px-6 sm:py-5 transition-colors duration-200 hover:bg-surface/50"
            >
              <div>
                <h3 className="font-display text-[17px] sm:text-[18px] font-semibold text-text">
                  All fibers
                </h3>
                <p className="mt-0.5 font-body text-[14px] text-secondary">
                  Explore our full natural fiber library
                </p>
              </div>
              <span className="font-body text-[13px] font-medium text-accent flex-shrink-0 group-hover:translate-x-0.5 transition-transform duration-200">
                Browse all &rarr;
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
