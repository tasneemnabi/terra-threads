"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface MobileNavProps {
  links: { href: string; label: string }[];
  variant?: "default" | "inverted";
  className?: string;
}

export function MobileNav({ links, variant = "default", className = "" }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const buttonColor = open
    ? "text-text"
    : variant === "inverted"
    ? "text-white/90 hover:text-white"
    : "text-text hover:text-muted";

  return (
    <div className={`md:hidden ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative z-[60] inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors ${buttonColor}`}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 7h16M4 17h16" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-text/20 backdrop-blur-sm animate-fade-up [--delay:0ms]"
          />
          <div className="fixed inset-x-0 top-0 z-50 bg-background px-5 pt-20 pb-8 shadow-xl animate-fade-up [--delay:40ms]">
            <nav className="flex flex-col">
              {links.map((link, i) => (
                <Link
                  key={`${link.href}-${link.label}`}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="animate-fade-up border-b border-surface py-4 font-display text-[20px] font-medium text-text transition-colors hover:text-accent"
                  style={{ ["--delay" as string]: `${80 + i * 30}ms` }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
