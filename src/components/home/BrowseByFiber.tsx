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
  return (
    <section className="px-5 sm:px-8 lg:px-20 py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px]">
        <h2 className="font-display text-[24px] sm:text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">
          The fabric makes the difference.
        </h2>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
          {fibers.map((fiber) => {
            const lowContrast =
              fiber.name === "Organic Cotton" || fiber.name === "Linen";
            return (
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
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03] group-active:scale-[1.03]"
                  sizes="(min-width: 1024px) 640px, 50vw"
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-t to-transparent ${
                    lowContrast
                      ? "from-black/80 via-black/30"
                      : "from-black/65 via-black/15"
                  }`}
                />
                <h3 className="relative px-4 pb-4 sm:px-6 sm:pb-6 font-display text-[18px] sm:text-[22px] font-semibold leading-tight tracking-[-0.01em] text-white">
                  {fiber.name}
                </h3>
              </TrackedLink>
            );
          })}
        </div>

        <TrackedLink
          href="/shop"
          section="browse-by-fiber"
          ctaText="Browse all fibers"
          className="mt-6 inline-flex items-center gap-1.5 font-body text-[14px] font-semibold text-accent hover:text-accent/80 transition-colors"
        >
          Browse all fibers <span aria-hidden>&rarr;</span>
        </TrackedLink>
      </div>
    </section>
  );
}
