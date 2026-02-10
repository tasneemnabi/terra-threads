import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function Hero() {
  return (
    <section className="bg-gradient-to-br from-primary-dark to-primary px-4 py-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Activewear that&apos;s better for you{" "}
          <span className="text-accent-light">&amp; the planet</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">
          Discover women&apos;s activewear made from merino wool, organic cotton,
          cashmere, and hemp. Curated from brands that put natural fibers first.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/category/activewear">
            <Button variant="secondary" size="lg">
              Shop Activewear
            </Button>
          </Link>
          <Link href="/about">
            <Button
              variant="outline"
              size="lg"
              className="border-white/30 text-white hover:bg-white/10"
            >
              Learn More
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
