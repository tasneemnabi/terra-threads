import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              Terra Threads
            </h3>
            <p className="mt-2 text-sm text-neutral-500">
              Curating the best natural fiber activewear for women who care
              about what they wear.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Shop</h3>
            <ul className="mt-2 space-y-2">
              <li>
                <Link
                  href="/category/activewear"
                  className="text-sm text-neutral-500 hover:text-primary"
                >
                  Activewear
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Company</h3>
            <ul className="mt-2 space-y-2">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-neutral-500 hover:text-primary"
                >
                  About
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-neutral-200 pt-8 text-center text-sm text-neutral-400">
          &copy; {new Date().getFullYear()} Terra Threads. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
