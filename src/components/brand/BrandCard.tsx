import Image from "next/image";
import type { BrandWithDetails } from "@/types/database";
import { brandLogoUrl } from "@/lib/utils";

interface BrandCardProps {
  brand: BrandWithDetails;
}

export function BrandCard({ brand }: BrandCardProps) {
  const logoUrl = brandLogoUrl(brand.website_url, 128);

  return (
    <a
      href={brand.website_url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-4 rounded-[12px] bg-surface p-7 transition-shadow hover:shadow-md"
    >
      {/* Header: logo + name + badge */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <Image
              src={logoUrl}
              alt={`${brand.name} logo`}
              width={40}
              height={40}
              className="rounded-[6px]"
              unoptimized
            />
          )}
          <h3 className="font-display text-[22px] font-semibold leading-[28px] tracking-[-0.01em] text-text">
            {brand.name}
          </h3>
        </div>
        {brand.product_count > 0 && (
          <span
            className={`inline-flex shrink-0 items-center gap-[5px] rounded-[4px] px-[10px] py-1 font-body text-[12px] font-medium leading-[16px] ${
              brand.is_fully_natural
                ? "bg-[#4A7C591A] text-[#4A7C59]"
                : "bg-[#C4963C1A] text-[#C4963C]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                brand.is_fully_natural ? "bg-[#4A7C59]" : "bg-[#C4963C]"
              }`}
            />
            {brand.is_fully_natural ? "100% Natural" : "Nearly Natural"}
          </span>
        )}
      </div>

      {/* Description — clamped to 2 lines */}
      <p className="line-clamp-2 font-body text-[14px] leading-[22px] text-secondary">
        {brand.description || "Natural fiber clothing"}
      </p>

      {/* Fiber type pills */}
      {brand.fiber_types.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {brand.fiber_types.map((fiber) => (
            <span
              key={fiber}
              className="rounded-[4px] bg-background px-[10px] py-1 font-body text-[12px] leading-[16px] text-secondary"
            >
              {fiber}
            </span>
          ))}
        </div>
      )}

      {/* Bottom: visit CTA */}
      <div className="mt-auto flex items-center justify-end">
        <span className="inline-flex items-center gap-1.5 font-body text-[13px] font-medium leading-[16px] text-accent group-hover:text-accent/80">
          Visit website
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </span>
      </div>
    </a>
  );
}
