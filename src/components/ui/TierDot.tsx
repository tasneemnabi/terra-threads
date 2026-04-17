import type { ReactNode } from "react";

export type Tier = "natural" | "nearly";

interface TierDotProps {
  /** Which tier the dot represents. */
  tier: Tier;
  /** Diameter of the dot in pixels. Defaults to 7px to match the tier strip. */
  size?: number;
  className?: string;
}

/**
 * Small colored dot used to signal product/brand tier
 * (100% Natural → green, Nearly Natural → rose).
 *
 * Shared across the brand detail "tier strip" and the /brands tier-chip row
 * so both surfaces stay visually coordinated. Accepts `size` for the rare
 * case a caller wants a slightly larger dot (e.g. legend next to larger
 * text).
 */
export function TierDot({ tier, size = 7, className = "" }: TierDotProps) {
  const color = tier === "natural" ? "bg-natural" : "bg-accent";
  return (
    <span
      aria-hidden
      className={`inline-block rounded-full ${color} ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

interface TierLegendItemProps {
  tier: Tier;
  children: ReactNode;
  size?: number;
  className?: string;
}

/** Dot + label pair, used in tier legends (homepage showcase, brands page). */
export function TierLegendItem({
  tier,
  children,
  size = 10,
  className = "",
}: TierLegendItemProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <TierDot tier={tier} size={size} />
      {children}
    </span>
  );
}
