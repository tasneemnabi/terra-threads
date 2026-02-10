import Link from "next/link";

const categories = [
  {
    name: "Activewear",
    slug: "activewear",
    description: "Leggings, tops, sports bras, and layers made from natural fibers.",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

export function CategoryCards() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-bold text-neutral-900">Shop by Category</h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/category/${cat.slug}`}
            className="group flex items-start gap-4 rounded-xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-md"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {cat.icon}
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 group-hover:text-primary">
                {cat.name}
              </h3>
              <p className="mt-1 text-sm text-neutral-500">{cat.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
