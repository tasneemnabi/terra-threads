"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`font-body text-[15px] leading-[18px] transition-colors py-3 ${
        isActive
          ? "font-medium text-text border-b-2 border-text"
          : "text-text hover:text-muted"
      }`}
    >
      {children}
    </Link>
  );
}
