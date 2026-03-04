import type { Brand } from "@/types/database";

interface BrandStripProps {
  brands: Brand[];
}

export function BrandStrip({ brands }: BrandStripProps) {
  // Pick up to 6 brands, prefer fully natural ones
  const sorted = [...brands].sort((a, b) => {
    if (a.is_fully_natural !== b.is_fully_natural) {
      return a.is_fully_natural ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  const displayed = sorted.slice(0, 6);

  if (displayed.length === 0) return null;

  return (
    <section className="px-5 sm:px-8 lg:px-20 pt-20">
      <div className="mx-auto max-w-[1280px] flex flex-col items-center gap-8">
        <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-muted">
          Trusted by brands who care
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {displayed.map((brand) => (
            <span
              key={brand.slug}
              className="font-display text-[20px] font-semibold leading-[24px] tracking-[-0.01em] text-muted-light"
            >
              {brand.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
