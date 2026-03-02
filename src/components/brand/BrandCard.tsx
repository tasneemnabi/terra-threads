import Image from "next/image";
import Link from "next/link";
import type { BrandWithDetails } from "@/types/database";
import { brandLogoUrl } from "@/lib/utils";

interface BrandCardProps {
  brand: BrandWithDetails;
}

export function BrandCard({ brand }: BrandCardProps) {
  const logoUrl = brandLogoUrl(brand.website_url, 128);

  return (
    <div className="flex flex-col gap-4 rounded-[12px] bg-surface p-7">
      {/* Header: name + badge */}
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

      {/* Description */}
      <p className="font-body text-[14px] leading-[22px] text-secondary">
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

      {/* Bottom: product count + view link */}
      <div className="mt-auto flex items-center justify-between">
        <span className="font-body text-[13px] leading-[16px] text-muted">
          {brand.product_count} product{brand.product_count !== 1 ? "s" : ""}
        </span>
        <Link
          href={`/brand/${brand.slug}`}
          className="font-body text-[13px] font-medium leading-[16px] text-accent hover:text-accent/80"
        >
          View brand &rarr;
        </Link>
      </div>
    </div>
  );
}
