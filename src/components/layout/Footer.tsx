import Link from "next/link";

const shopLinks = [
  { href: "/shop?category=activewear", label: "Activewear" },
  { href: "/brands", label: "All Brands" },
  { href: "/shop?sort=newest", label: "New Arrivals" },
];

const connectLinks = [
  { href: "mailto:hello@wearfiber.com", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="border-t border-surface-dark px-5 sm:px-8 lg:px-20 py-14 sm:py-[60px]">
      <div className="mx-auto flex flex-col gap-12 max-w-[1280px] lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[280px]">
          <span className="font-display text-[22px] font-bold leading-[28px] tracking-[-0.02em] text-text">
            FIBER
          </span>
          <p className="mt-4 font-body text-[14px] leading-[22px] text-secondary">
            Helping you find clothing made from natural fibers. No polyester,
            no compromise.
          </p>
        </div>

        <div className="flex flex-wrap gap-8 sm:gap-16">
          <div>
            <h4 className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-text">
              Shop
            </h4>
            <ul className="mt-4 flex flex-col gap-1">
              {shopLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center min-h-[44px] font-body text-[15px] leading-[18px] text-muted transition-colors hover:text-text"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

<div>
            <h4 className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-text">
              Connect
            </h4>
            <ul className="mt-4 flex flex-col gap-1">
              {connectLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="inline-flex items-center min-h-[44px] font-body text-[15px] leading-[18px] text-muted transition-colors hover:text-text"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-[1280px] border-t border-surface-dark pt-6">
        <p className="font-body text-[12px] leading-[16px] text-muted-light">
          &copy; {new Date().getFullYear()} FIBER
        </p>
      </div>
    </footer>
  );
}
