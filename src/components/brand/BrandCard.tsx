import Image from "next/image";
import type { BrandWithDetails } from "@/types/database";
import { brandLogoUrl } from "@/lib/utils";

interface BrandCardProps {
  brand: BrandWithDetails;
}

export function BrandCard({ brand }: BrandCardProps) {
  const logoUrl = brandLogoUrl(brand.website_url, 128);
  const tierLabel = brand.is_fully_natural ? "100% Natural" : "Nearly Natural";
  const dotColor = brand.is_fully_natural ? "bg-[#4A7A3D]" : "bg-[#C4960C]";

  const formatCategory = (cat: string) =>
    cat
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const metaParts = [
    ...brand.audience,
    ...brand.categories.map(formatCategory),
  ];

  return (
    <a
      href={brand.website_url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col gap-5 rounded-[14px] border border-surface-dark bg-white p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-muted hover:shadow-lg"
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
            unoptimized
          />
        )}
        <h3 className="font-display text-[28px] font-semibold leading-[32px] tracking-[-0.02em] text-text">
          {brand.name}
        </h3>
      </div>

      {/* Tier badge + Fiber type pills */}
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-muted-light px-3 py-1">
          <span className={`h-[6px] w-[6px] rounded-full ${dotColor}`} />
          <span className="font-body text-[13px] leading-[16px] text-secondary">
            {tierLabel}
          </span>
        </span>
        {brand.fiber_types.map((fiber) => (
          <span
            key={fiber}
            className="rounded-full border border-muted-light px-3 py-1 font-body text-[13px] leading-[16px] text-secondary"
          >
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
          className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 17L17 7M17 7H7M17 7v10"
          />
        </svg>
      </div>
    </a>
  );
}
