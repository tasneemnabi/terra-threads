import Image from "next/image";
import Link from "next/link";
import type { BrandWithDetails } from "@/types/database";
import { brandLogoUrl, formatCategory } from "@/lib/utils";

interface BrandCardProps {
  brand: BrandWithDetails;
  priority?: boolean;
}

const NATURAL_FIBERS = new Set([
  "organic cotton", "cotton", "pima cotton", "organic pima cotton", "egyptian cotton",
  "merino wool", "wool", "organic merino wool", "lambswool",
  "cashmere", "silk", "hemp", "linen", "alpaca", "mohair", "yak",
]);

function fiberPillClasses(fiber: string): string {
  const isNatural = NATURAL_FIBERS.has(fiber.toLowerCase());
  return isNatural
    ? "rounded-full bg-natural/[0.10] px-3 py-1 font-body text-[13px] font-medium leading-[16px] text-natural-dark"
    : "rounded-full bg-accent/[0.12] px-3 py-1 font-body text-[13px] font-medium leading-[16px] text-accent";
}

export function BrandCard({ brand, priority = false }: BrandCardProps) {
  const logoUrl = brandLogoUrl(brand.website_url);

  const metaParts = [
    ...brand.audience,
    ...brand.categories.map(formatCategory),
  ];

  return (
    <Link
      href={`/brand/${brand.slug}`}
      className="group relative flex flex-col gap-5 rounded-[14px] border border-[#DDD5CB] bg-white p-7 shadow-[0_2px_8px_rgba(140,120,100,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-lg"
    >
      {/* Top row: Logo + Name */}
      <div className="flex items-center gap-3">
        {logoUrl && (
          <Image
            src={logoUrl}
            alt={`${brand.name} logo`}
            width={48}
            height={48}
            className="shrink-0 rounded-[10px]"
            {...(priority && { priority: true })}
          />
        )}
        <h2 className="font-display text-[28px] font-semibold leading-[32px] tracking-[-0.02em] text-text">
          {brand.name}
        </h2>
      </div>

      {/* Fiber type pills */}
      <div className="flex flex-wrap gap-2">
        {brand.fiber_types.map((fiber) => (
          <span key={fiber} className={fiberPillClasses(fiber)}>
            {fiber}
          </span>
        ))}
      </div>

      {/* Bottom metadata */}
      <div className="mt-auto flex items-center justify-between border-t border-muted-light pt-3">
        <p className="font-body text-[13px] leading-[18px] text-secondary">
          {metaParts.join(" \u00B7 ")}
        </p>
        <svg
          className="h-4 w-4 shrink-0 text-accent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Link>
  );
}
