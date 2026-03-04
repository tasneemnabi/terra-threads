const stats = [
  { value: "60%", label: "of clothing contains polyester" },
  { value: "700K", label: "microfibers per wash cycle" },
  { value: "200+", label: "years for polyester to decompose" },
];

export function WhyNaturalFibers() {
  return (
    <section className="px-5 sm:px-8 lg:px-20 py-20">
      <div className="mx-auto flex flex-col gap-8 max-w-[1280px] lg:flex-row lg:items-start lg:gap-20">
        <div className="lg:w-[400px] lg:shrink-0">
          <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-secondary">
            Why it matters
          </p>
          <h2 className="mt-3 font-display text-[28px] font-semibold leading-[36px] tracking-[-0.01em] text-text">
            Your activewear is probably made of plastic.
          </h2>
        </div>

        <div className="max-w-[800px]">
          <p className="max-w-[560px] font-body text-[18px] leading-[30px] text-secondary">
            Over 60% of all clothing produced today contains polyester — a
            plastic derived from petroleum. Every wash releases microplastics
            into our waterways. Natural fibers biodegrade, breathe better, and
            perform just as well.
          </p>

          <div className="mt-10 flex flex-wrap gap-8 sm:gap-16">
            {stats.map((stat) => (
              <div key={stat.value}>
                <p className="font-display text-[36px] font-bold leading-[44px] tracking-[-0.02em] text-accent">
                  {stat.value}
                </p>
                <p className="mt-1.5 max-w-[140px] font-body text-[14px] leading-[18px] text-secondary">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
