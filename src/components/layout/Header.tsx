"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MobileNav } from "./MobileNav";

const shopLinks = [
  { href: "/shop?audience=Women", label: "Women" },
  { href: "/shop?audience=Men", label: "Men" },
  { href: "/shop?category=activewear", label: "Activewear" },
  { href: "/shop?category=tops", label: "Tops" },
  { href: "/shop?category=dresses", label: "Dresses" },
];

const metaLinks = [
  { href: "/brands", label: "Brands" },
  { href: "/about", label: "About" },
];

const allNavLinks = [
  ...shopLinks,
  ...metaLinks,
];

export function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHome = pathname === "/";

  function isActive(href: string) {
    if (href.startsWith("/shop?")) {
      if (pathname !== "/shop") return false;
      const param = new URL(href, "http://x").searchParams;
      for (const [key, value] of param) {
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    }
    if (href === "/brands") {
      return pathname.startsWith("/brands") || pathname.startsWith("/brand/");
    }
    return pathname.startsWith(href);
  }

  return (
    <header className={isHome ? "absolute top-0 left-0 right-0 z-20" : "bg-background"}>
      <div className="mx-auto flex h-[84px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-20">
        <Link href="/" className="flex items-center">
          <span
            className={`font-display text-[22px] font-bold leading-[28px] tracking-[-0.02em] ${
              isHome ? "text-white" : "text-text"
            }`}
          >
            FIBER
          </span>
        </Link>

        <nav className="hidden items-center lg:flex">
          {/* Shopping categories */}
          <div className="flex items-center gap-6">
            {shopLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-body text-[14px] uppercase tracking-[0.04em] leading-[18px] transition-colors py-[13px] ${
                  isHome
                    ? "text-white/80 hover:text-white"
                    : isActive(link.href)
                      ? "font-medium text-text"
                      : "text-muted hover:text-text"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Separator */}
          <div className={`mx-5 h-4 w-px ${isHome ? "bg-white/25" : "bg-muted-light"}`} />

          {/* Meta links */}
          <div className="flex items-center gap-6">
            {metaLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-body text-[14px] leading-[18px] transition-colors py-[13px] ${
                  isHome
                    ? "text-white/80 hover:text-white"
                    : isActive(link.href)
                      ? "font-medium text-text"
                      : "text-muted hover:text-text"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <MobileNav links={allNavLinks} />
      </div>
    </header>
  );
}
