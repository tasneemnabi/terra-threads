"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileNav } from "./MobileNav";

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/brands", label: "Brands" },
  { href: "/about", label: "About" },
];

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

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

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`font-body text-[15px] leading-[18px] transition-colors py-[13px] ${
                isHome
                  ? "text-white/80 hover:text-white"
                  : pathname.startsWith(link.href) || (link.href === "/brands" && pathname.startsWith("/brand/"))
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
