"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center sm:px-8 lg:px-20">
      <h1 className="font-display text-[28px] font-semibold text-text sm:text-[32px]">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-[420px] font-body text-[16px] leading-[24px] text-muted">
        We hit an unexpected error. Please try again.
      </p>
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-text px-6 py-3 font-body text-[15px] font-semibold text-background transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-surface-dark px-6 py-3 font-body text-[15px] font-semibold text-text transition-colors hover:bg-surface"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
