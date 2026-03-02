import Link from "next/link";

const shopLinks = [
  { href: "/category/activewear", label: "Activewear" },
  { href: "/brands", label: "All Brands" },
  { href: "/brands", label: "New Arrivals" },
];

const learnLinks = [
  { href: "/about", label: "About Us" },
  { href: "/about#why-natural", label: "Why Natural Fibers" },
  { href: "/about#curation", label: "How We Curate" },
];

const connectLinks = [
  { label: "Newsletter" },
  { label: "Instagram" },
  { label: "Contact" },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-surface-dark px-20 py-[60px]">
      <div className="mx-auto flex max-w-[1280px] items-start justify-between">
        <div className="max-w-[280px]">
          <span className="font-display text-[22px] font-bold leading-[28px] tracking-[-0.02em] text-text">
            FIBER
          </span>
          <p className="mt-4 font-body text-[14px] leading-[22px] text-muted">
            Helping you find clothing made from natural fibers. No polyester,
            no compromise.
          </p>
        </div>

        <div className="flex gap-16">
          <div>
            <h4 className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-text">
              Shop
            </h4>
            <ul className="mt-4 flex flex-col gap-3">
              {shopLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-body text-[15px] leading-[18px] text-muted transition-colors hover:text-text"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-text">
              Learn
            </h4>
            <ul className="mt-4 flex flex-col gap-3">
              {learnLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-body text-[15px] leading-[18px] text-muted transition-colors hover:text-text"
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
            <ul className="mt-4 flex flex-col gap-3">
              {connectLinks.map((link) => (
                <li key={link.label}>
                  <span className="font-body text-[15px] leading-[18px] text-muted">
                    {link.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
