"use client";

import { affiliateUrl } from "@/lib/utils";

interface AffiliateButtonProps {
  url: string;
  brandName: string;
}

export function AffiliateButton({ url, brandName }: AffiliateButtonProps) {
  return (
    <a
      href={affiliateUrl(url, "product-page")}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-base font-medium text-white transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/50"
    >
      Shop at {brandName}
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}
