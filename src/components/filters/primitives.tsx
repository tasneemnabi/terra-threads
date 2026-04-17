"use client";

// Shared filter primitives used by both ShopContent (sitewide /shop page) and
// BrandProducts (brand-specific pages). These were originally duplicated in
// both files; they are visually and behaviorally identical and must stay in
// sync, so they live here. The filters/ directory also contains an older
// set of filter components used by the category page — those have a
// different API and are intentionally separate.

import { useState } from "react";
import type { SortOption } from "@/types/database";

export const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

export const FIBER_GROUPS: { heading: string; families: { label: string; members: string[] }[] }[] = [
  {
    heading: "Natural",
    families: [
      { label: "Cotton", members: ["Cotton", "Organic Cotton", "Organic Pima Cotton", "Pima Cotton"] },
      { label: "Wool", members: ["Wool", "Merino Wool", "Lambswool", "Cashmere", "Mohair", "Alpaca"] },
      { label: "Linen", members: ["Linen"] },
      { label: "Hemp", members: ["Hemp"] },
      { label: "Silk", members: ["Silk"] },
    ],
  },
  {
    heading: "Semi-Synthetic",
    families: [
      { label: "Lyocell", members: ["Tencel Lyocell", "Bamboo Lyocell"] },
      { label: "Modal", members: ["Modal"] },
      { label: "Viscose", members: ["Viscose"] },
    ],
  },
  {
    heading: "Synthetic",
    families: [
      { label: "Spandex", members: ["Spandex"] },
    ],
  },
];

export function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className="group/cb flex w-full items-center gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-surface/60 active:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 lg:gap-2.5 lg:py-2"
    >
      <div
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-all duration-150 ${
          checked
            ? "border-accent bg-accent"
            : "border-muted-light group-hover/cb:border-muted"
        }`}
      >
        {checked && (
          <svg
            className="h-3 w-3 text-background"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        )}
      </div>
      <span className={`font-body text-[14px] transition-colors lg:text-[13px] ${checked ? "font-medium text-text" : "text-text group-hover/cb:text-secondary"}`}>
        {label}
      </span>
    </button>
  );
}

export function AccordionFilter({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-muted-light/60">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:rounded-md"
      >
        <span className="font-display text-[14px] font-semibold text-text">
          {title}
        </span>
        <svg
          className="h-4 w-4 shrink-0 text-text"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          )}
        </svg>
      </button>
      {open && <div className="flex flex-col pb-3 lg:pb-4 lg:gap-0.5">{children}</div>}
    </div>
  );
}

export function ActiveFilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      onClick={onRemove}
      aria-label={`Remove ${label} filter`}
      className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 font-body text-[12px] font-medium text-accent transition-colors hover:bg-accent/20"
    >
      {label}
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
