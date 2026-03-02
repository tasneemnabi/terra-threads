const brandNames = [
  "Naadam",
  "Allbirds",
  "Tracksmith",
  "Vuori",
  "Icebreaker",
  "Prana",
];

export function BrandStrip() {
  return (
    <section className="px-20 pt-20">
      <div className="mx-auto max-w-[1280px] flex flex-col items-center gap-8">
        <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-muted">
          Trusted by brands who care
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {brandNames.map((name) => (
            <span
              key={name}
              className="font-display text-[20px] font-semibold leading-[24px] tracking-[-0.01em] text-muted-light"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
