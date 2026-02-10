const reasons = [
  {
    title: "Temperature Regulation",
    description:
      "Merino wool and silk naturally regulate body temperature, keeping you cool during workouts and warm during rest.",
  },
  {
    title: "Odor Resistant",
    description:
      "Natural fibers like merino wool resist odor-causing bacteria, so you stay fresh longer between washes.",
  },
  {
    title: "Sustainable",
    description:
      "Organic cotton, hemp, and Tencel are renewable, biodegradable, and have a lower environmental footprint than synthetics.",
  },
  {
    title: "Gentle on Skin",
    description:
      "Free from petrochemical-based fabrics that can irritate skin. Natural fibers are breathable and hypoallergenic.",
  },
];

export function WhyNaturalFibers() {
  return (
    <section className="bg-surface px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-2xl font-bold text-neutral-900">
          Why Natural Fibers?
        </h2>
        <p className="mt-2 text-neutral-500">
          Performance meets sustainability. Here&apos;s why natural fibers are the
          future of activewear.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="rounded-xl bg-white p-6 shadow-sm"
            >
              <h3 className="font-semibold text-neutral-900">{reason.title}</h3>
              <p className="mt-2 text-sm text-neutral-500">
                {reason.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
