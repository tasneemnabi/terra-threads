"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileNav } from "./MobileNav";

const shopLinks = [
  { href: "/shop?audience=Women", label: "Women" },
  { href: "/shop?audience=Men", label: "Men" },
  { href: "/shop?category=activewear", label: "Activewear" },
  { href: "/shop?category=tops", label: "Tops" },
  { href: "/shop?category=dresses", label: "Dresses" },
];

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/brands", label: "Brands" },
  { href: "/about", label: "About" },
];

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) {
    return (
      <header className="absolute top-0 left-0 right-0 z-20">
        <div className="mx-auto flex h-[84px] max-w-[1440px] items-center px-5 sm:px-8 lg:px-20">
          <Link href="/" className="flex items-center">
            <span className="font-display text-[22px] font-bold leading-[28px] tracking-[-0.02em] text-white">
              FIBER
            </span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-6 lg:flex">
            {shopLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-body text-[13px] uppercase tracking-[0.06em] leading-[18px] text-white/75 transition-colors py-[13px] hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <span className="mx-1 h-3.5 w-px bg-white/25" />
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-body text-[13px] tracking-[0.02em] leading-[18px] text-white/75 transition-colors py-[13px] hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <MobileNav links={navLinks} />
        </div>
      </header>
    );
  }

  return (
    <header className="bg-background">
      <div className="mx-auto flex h-[84px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-20">
        <Link href="/" className="flex items-center">
          <span className="font-display text-[22px] font-bold leading-[28px] tracking-[-0.02em] text-text">
            FIBER
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`font-body text-[15px] leading-[18px] transition-colors py-[13px] ${
                pathname.startsWith(link.href) || (link.href === "/brands" && pathname.startsWith("/brand/"))
                  ? "font-medium text-text"
                  : "text-muted hover:text-text"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <MobileNav links={navLinks} />
      </div>
    </header>
  );
}
