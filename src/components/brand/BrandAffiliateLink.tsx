"use client";

import type { ReactNode } from "react";
import { affiliateUrl } from "@/lib/utils";
import { trackAffiliateClick, type AffiliateSource } from "@/lib/posthog/events";

interface BrandAffiliateLinkProps {
  url: string;
  brandName: string;
  brandSlug: string;
  source: Extract<AffiliateSource, "brand-detail" | "brand-detail-empty">;
  className?: string;
  children: ReactNode;
}

export function BrandAffiliateLink({
  url,
  brandName,
  brandSlug,
  source,
  className,
  children,
}: BrandAffiliateLinkProps) {
  const destinationUrl = affiliateUrl(url, source);

  const handleClick = () => {
    trackAffiliateClick({
      brand_name: brandName,
      brand_slug: brandSlug,
      product_slug: null,
      product_name: null,
      category: null,
      price: null,
      currency: null,
      is_available: true,
      source,
      destination_url: destinationUrl,
    });
  };

  return (
    <a
      href={destinationUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}
