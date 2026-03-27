import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "FIBER curates brands committed to natural fiber clothing. Learn about our mission, curation process, and why natural fibers matter.",
};

export default function AboutPage() {
  return (
    <div className="font-body">
      {/* Hero */}
      <section className="px-5 pb-16 pt-20 sm:px-8 sm:pb-20 sm:pt-28 lg:px-20">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-accent">
            About
          </p>
          <h1 className="mt-5 max-w-[720px] font-display text-[40px] font-bold leading-[1.1] tracking-[-0.03em] text-text sm:text-[56px] lg:text-[64px]">
            We help you find clothing without the plastic.
          </h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-[28px] text-secondary sm:text-[18px] sm:leading-[30px]">
            FIBER is a curated directory of brands that make clothing from
            natural fibers — merino wool, organic cotton, linen, hemp, silk, and
            more. No polyester. No nylon. No greenwashing.
          </p>
        </div>
      </section>

      {/* Our Mission */}
      <section id="mission" className="px-5 py-16 sm:px-8 sm:py-20 lg:px-20">
        <div className="mx-auto max-w-[1280px]">
          <div className="max-w-[680px]">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-secondary">
              Our Mission
            </p>
            <h2 className="mt-3 font-display text-[28px] font-semibold leading-[36px] tracking-[-0.01em] text-text sm:text-[32px] sm:leading-[40px]">
              Making natural fiber clothing easy to find.
            </h2>
            <p className="mt-5 text-[17px] leading-[28px] text-secondary sm:text-[18px] sm:leading-[30px]">
              The clothing industry is dominated by synthetics. Finding brands
              that genuinely use natural fibers means hours of research, reading
              labels, and deciphering vague marketing claims. FIBER does that
              work for you.
            </p>
            <p className="mt-4 text-[17px] leading-[28px] text-secondary sm:text-[18px] sm:leading-[30px]">
              We research every brand we feature, verifying their materials and
              cataloging their fiber compositions. The result is a directory you
              can trust — every brand on FIBER has been reviewed by hand.
            </p>
          </div>
        </div>
      </section>

      {/* Why Natural Fibers */}
      <section
        id="why-natural"
        className="bg-surface px-5 py-16 sm:px-8 sm:py-20 lg:px-20"
      >
        <div className="mx-auto max-w-[1280px]">
          <div className="max-w-[680px]">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-secondary">
              Why Natural Fibers
            </p>
            <h2 className="mt-3 font-display text-[28px] font-semibold leading-[36px] tracking-[-0.01em] text-text sm:text-[32px] sm:leading-[40px]">
              60% of clothing is made from plastic.
            </h2>
            <p className="mt-5 text-[17px] leading-[28px] text-secondary sm:text-[18px] sm:leading-[30px]">
              Polyester is a plastic derived from petroleum, and it dominates the
              clothing industry. Every time you wash a synthetic garment, it
              releases hundreds of thousands of microplastic fibers into our
              waterways — fibers that end up in our oceans, our food, and our
              bodies.
            </p>
            <p className="mt-4 text-[17px] leading-[28px] text-secondary sm:text-[18px] sm:leading-[30px]">
              Natural fibers are different. Merino wool regulates temperature.
              Linen gets softer with every wash. Cotton breathes. Hemp is
              naturally antimicrobial. And when their life is over, they
              biodegrade — they don&apos;t sit in a landfill for 200 years.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-12 sm:gap-16">
            {[
              { value: "60%", label: "of clothing contains polyester" },
              { value: "700K", label: "microfibers released per wash" },
              { value: "200+", label: "years for polyester to decompose" },
            ].map((stat) => (
              <div key={stat.value}>
                <p className="font-display text-[36px] font-bold leading-[44px] tracking-[-0.02em] text-accent">
                  {stat.value}
                </p>
                <p className="mt-1.5 max-w-[160px] text-[14px] leading-[18px] text-secondary">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How We Curate */}
      <section
        id="curation"
        className="px-5 py-16 sm:px-8 sm:py-20 lg:px-20"
      >
        <div className="mx-auto max-w-[1280px]">
          <div className="max-w-[680px]">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-secondary">
              How We Curate
            </p>
            <h2 className="mt-3 font-display text-[28px] font-semibold leading-[36px] tracking-[-0.01em] text-text sm:text-[32px] sm:leading-[40px]">
              Every fiber, listed. No exceptions.
            </h2>
            <p className="mt-5 text-[17px] leading-[28px] text-secondary sm:text-[18px] sm:leading-[30px]">
              Every product on FIBER shows its full material composition. No
              polyester, no nylon, no acrylic — ever. Some products include a
              small amount of spandex for stretch (up to 10%), and we show that
              too. You always know exactly what you&apos;re wearing.
            </p>
          </div>
        </div>
      </section>

      {/* Affiliate Disclosure */}
      <section className="border-t border-surface-dark px-5 py-16 sm:px-8 sm:py-20 lg:px-20">
        <div className="mx-auto max-w-[1280px]">
          <div className="max-w-[680px]">
            <h2 className="font-display text-[20px] font-semibold text-text sm:text-[24px]">
              Affiliate Disclosure
            </h2>
            <p className="mt-4 text-[15px] leading-[24px] text-secondary">
              Some links on FIBER are affiliate links. If you purchase through
              one of these links, we may earn a small commission at no extra cost
              to you. This helps us keep the site running, continue researching
              brands, and maintain the directory. Our curation is never
              influenced by affiliate relationships.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20 sm:px-8 lg:px-20">
        <div className="mx-auto max-w-[1280px]">
          <Link
            href="/brands"
            className="inline-flex items-center justify-center rounded-lg bg-text px-8 py-3.5 text-[15px] font-semibold text-background transition-opacity hover:opacity-90"
          >
            Browse Brands
          </Link>
        </div>
      </section>
    </div>
  );
}
