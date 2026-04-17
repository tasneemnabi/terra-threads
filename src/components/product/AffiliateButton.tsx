"use client";

import { affiliateUrl, brandDomain } from "@/lib/utils";
import { trackAffiliateClick } from "@/lib/posthog/events";

interface AffiliateButtonProps {
  url: string;
  brandName: string;
  brandSlug: string;
  productSlug: string;
  productName: string;
  category: string | null;
  price: number | null;
  currency: string | null;
  isAvailable: boolean;
  soldOut?: boolean;
}

export function AffiliateButton({
  url,
  brandName,
  brandSlug,
  productSlug,
  productName,
  category,
  price,
  currency,
  isAvailable,
  soldOut,
}: AffiliateButtonProps) {
  const domain = brandDomain(url);
  const destinationUrl = affiliateUrl(url, "product-page");

  const handleClick = () => {
    trackAffiliateClick({
      brand_name: brandName,
      brand_slug: brandSlug,
      product_slug: productSlug,
      product_name: productName,
      category,
      price,
      currency,
      is_available: isAvailable,
      source: "product-page",
      destination_url: destinationUrl,
    });
  };

  return (
    <div className="space-y-3">
      {/* Confidence band — above the CTA */}
      {!soldOut && (
        <div className="flex items-center justify-center gap-2 font-body text-sm text-text">
          <span
            aria-hidden
            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent/10 text-accent"
          >
            <svg
              className="h-2.5 w-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span>Vetted for plastic-free materials.</span>
        </div>
      )}

      <a
        href={destinationUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={
          soldOut
            ? "group inline-flex w-full items-center justify-center gap-2 rounded-lg border border-surface-dark bg-surface px-6 py-3.5 text-base font-medium text-muted transition-colors duration-300 hover:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-text/50 active:scale-[0.98]"
            : "group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-text px-6 py-3.5 text-base font-medium text-background transition-colors duration-300 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-text/50 active:scale-[0.98]"
        }
      >
        {soldOut ? `View at ${brandName}` : `Shop at ${brandName}`}
        <svg
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
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
          Continue to {brandName} to check out — we don&apos;t sell direct.
        </p>
      )}
    </div>
  );
}
