"use client";

import { useState } from "react";

interface BrandLogoProps {
  src: string | null;
  name: string;
  size?: number;
  className?: string;
  priority?: boolean;
}

/**
 * Resilient brand logo. Uses a plain <img> so layout never collapses,
 * explicit width/height so the slot is reserved before load, and falls back
 * to a cream-background monogram when the image is missing or fails to load.
 */
export function BrandLogo({
  src,
  name,
  size = 64,
  className = "",
  priority = false,
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  const shouldFallback = !src || failed;

  const baseStyle = {
    width: `${size}px`,
    height: `${size}px`,
  } as const;

  if (shouldFallback) {
    return (
      <div
        aria-label={`${name} logo`}
        role="img"
        style={baseStyle}
        className={`shrink-0 flex items-center justify-center rounded-[10px] bg-surface text-text font-display font-medium ${className}`}
      >
        <span
          aria-hidden
          style={{ fontSize: Math.max(14, Math.round(size * 0.45)) }}
          className="leading-none tracking-[-0.02em]"
        >
          {initial}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${name} logo`}
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      style={baseStyle}
      className={`shrink-0 rounded-[10px] object-contain bg-surface ${className}`}
    />
  );
}
