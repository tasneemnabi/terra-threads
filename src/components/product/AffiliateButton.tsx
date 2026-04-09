"use client";

import { affiliateUrl, brandDomain } from "@/lib/utils";

interface AffiliateButtonProps {
  url: string;
  brandName: string;
  soldOut?: boolean;
}

export function AffiliateButton({ url, brandName, soldOut }: AffiliateButtonProps) {
  const domain = brandDomain(url);

  return (
    <div className="space-y-2">
      <a
        href={affiliateUrl(url, "product-page")}
        target="_blank"
        rel="noopener noreferrer"
        className={
          soldOut
            ? "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-surface-dark bg-surface px-6 py-3.5 text-base font-medium text-muted transition-all hover:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-text/50"
            : "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-text px-6 py-3.5 text-base font-medium text-background transition-all hover:bg-secondary hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-text/50"
        }
      >
        {soldOut ? `View at ${brandName}` : `Shop at ${brandName}`}
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
      {domain && (
        <p className="text-center font-body text-xs text-muted">
          You&apos;ll be taken to {domain} to complete your purchase
        </p>
      )}
    </div>
  );
}
