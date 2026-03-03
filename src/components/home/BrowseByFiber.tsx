import Link from "next/link";

const fibers = [
  {
    name: "Merino Wool",
    description:
      "Naturally temperature-regulating, odor-resistant, and moisture-wicking. The gold standard for active natural fiber.",
    count: 48,
    slug: "merino-wool",
  },
  {
    name: "Organic Cotton",
    description:
      "Soft, breathable, and chemical-free. Ideal for low-impact training, yoga, and everyday movement.",
    count: 35,
    slug: "organic-cotton",
  },
  {
    name: "Linen",
    description:
      "Exceptionally breathable and lightweight. Gets softer with every wear. Perfect for warm-weather training.",
    count: 22,
    slug: "linen",
  },
  {
    name: "Silk",
    description:
      "Ultralight with natural thermoregulation. A luxury base layer that performs in heat and cold alike.",
    count: 12,
    slug: "silk",
  },
];

export function BrowseByFiber() {
  return (
    <section className="px-20 pt-20">
      <div className="mx-auto max-w-[1280px]">
        <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-secondary">
          Browse by fiber
        </p>
        <h2 className="mt-2 font-display text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-text">
          Find your material
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {fibers.map((fiber) => (
            <Link
              key={fiber.slug}
              href={`/category/activewear?material=${fiber.slug}`}
              className="group flex flex-col rounded-[14px] bg-surface px-7 py-7 gap-3"
            >
              <h3 className="font-display text-[20px] font-semibold leading-[24px] tracking-[-0.01em] text-text">
                {fiber.name}
              </h3>
              <p className="flex-1 font-body text-[15px] leading-[24px] text-secondary">
                {fiber.description}
              </p>
              <p className="pt-1 font-body text-[14px] font-medium leading-[18px] text-accent group-hover:text-accent/80">
                {fiber.count} products &rarr;
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
