import { Skeleton } from "@/components/ui/Skeleton";

export default function BrandLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="mb-8 h-4 w-32" />
      <Skeleton className="mb-3 h-9 w-48" />
      <Skeleton className="mb-12 h-12 w-96" />
      <Skeleton className="mb-6 h-6 w-32" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-neutral-200">
            <Skeleton className="aspect-[4/5] w-full" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
