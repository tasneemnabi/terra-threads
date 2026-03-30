import Link from "next/link";

const fibers = [
  {
    name: "Merino Wool",
    description:
      "Naturally temperature-regulating, odor-resistant, and moisture-wicking. The gold standard for active natural fiber.",
    param: "Merino Wool",
  },
  {
    name: "Organic Cotton",
    description:
      "Soft, breathable, and chemical-free. Ideal for low-impact training, yoga, and everyday movement.",
    param: "Organic Cotton",
  },
  {
    name: "Linen",
    description:
      "Exceptionally breathable and lightweight. Gets softer with every wear. Perfect for warm-weather training.",
    param: "Linen",
  },
  {
    name: "Silk",
    description:
      "Ultralight with natural thermoregulation. A luxury base layer that performs in heat and cold alike.",
    param: "Silk",
  },
];

export function BrowseByFiber() {
  return (
    <section className="px-5 sm:px-8 lg:px-20 py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px]">
        <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-secondary">
          Browse by fiber
        </p>
        <h2 className="mt-2 font-display text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-text">
          Find your material
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {fibers.map((fiber) => (
            <Link
              key={fiber.name}
              href={`/shop?materials=${encodeURIComponent(fiber.param)}`}
              className="group flex flex-col rounded-[14px] bg-surface px-7 py-7 gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="font-display text-[20px] font-semibold leading-[24px] tracking-[-0.01em] text-text">
                {fiber.name}
              </h3>
              <p className="flex-1 font-body text-[15px] leading-[24px] text-secondary">
                {fiber.description}
              </p>
              <p className="pt-1 font-body text-[14px] font-medium leading-[18px] text-accent group-hover:text-accent/80">
                Shop now &rarr;
              </p>
            </Link>
          ))}
          <Link
            href="/shop"
            className="group flex flex-col items-center justify-center rounded-[14px] border border-surface-dark px-7 py-7 gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-accent/30"
          >
            <span className="font-display text-[32px] font-bold text-accent/40 group-hover:text-accent/60 transition-colors">
              18+
            </span>
            <p className="font-body text-[14px] font-medium text-muted group-hover:text-text transition-colors text-center">
              All fibers &rarr;
            </p>
          </Link>
        </div>
      </div>
    </section>
  );
}
