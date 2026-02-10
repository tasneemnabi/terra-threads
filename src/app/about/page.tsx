import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Terra Threads — curating the best natural fiber activewear for women who care about what they wear.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-neutral-900">
        About Terra Threads
      </h1>

      <div className="mt-8 space-y-6 text-neutral-600">
        <p>
          Terra Threads is a curated directory of women&apos;s activewear made
          from natural fibers. We believe that what you wear matters — for your
          body and for the planet.
        </p>

        <h2 className="text-xl font-semibold text-neutral-900">Our Mission</h2>
        <p>
          The activewear industry is dominated by synthetic fabrics derived from
          petroleum. We want to make it easy to find alternatives — clothing
          made from merino wool, organic cotton, cashmere, hemp, Tencel, and
          other natural or sustainably produced fibers.
        </p>

        <h2 className="text-xl font-semibold text-neutral-900">
          How It Works
        </h2>
        <p>
          We research and curate activewear from brands that prioritize natural
          fibers. Each product listing shows the exact material composition so
          you know exactly what you&apos;re getting. When you find something you
          love, we link you directly to the brand&apos;s website to purchase.
        </p>

        <h2 className="text-xl font-semibold text-neutral-900">
          Affiliate Disclosure
        </h2>
        <p>
          Some links on this site are affiliate links. This means we may earn a
          small commission if you make a purchase through our links, at no extra
          cost to you. This helps us keep the site running and continue curating
          the best natural fiber activewear.
        </p>
      </div>

      <div className="mt-12">
        <Link href="/category/activewear">
          <Button size="lg">Browse Activewear</Button>
        </Link>
      </div>
    </div>
  );
}
