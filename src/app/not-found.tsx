import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center sm:px-8 lg:px-20">
      <p className="font-display text-[120px] font-bold leading-none tracking-[-0.04em] text-surface-dark">
        404
      </p>
      <h1 className="mt-4 font-display text-[24px] font-semibold text-text sm:text-[28px]">
        Page not found
      </h1>
      <p className="mt-3 max-w-[400px] font-body text-[16px] leading-[24px] text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-lg bg-text px-6 py-3 font-body text-[15px] font-semibold text-background transition-opacity hover:opacity-90"
      >
        Back to Home
      </Link>
    </div>
  );
}
