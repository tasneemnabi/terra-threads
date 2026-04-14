"use client";

import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import {
  trackHomepageCtaClick,
  type HomepageSection,
} from "@/lib/posthog/events";

type HrefString = string;

interface TrackedLinkProps extends Omit<LinkProps, "href"> {
  href: HrefString;
  section: HomepageSection;
  ctaText: string;
  itemName?: string | null;
  className?: string;
  children: ReactNode;
}

export function TrackedLink({
  href,
  section,
  ctaText,
  itemName = null,
  className,
  children,
  ...rest
}: TrackedLinkProps) {
  const handleClick = () => {
    trackHomepageCtaClick({
      section,
      cta_text: ctaText,
      destination: href,
      item_name: itemName,
    });
  };

  return (
    <Link href={href} onClick={handleClick} className={className} {...rest}>
      {children}
    </Link>
  );
}
