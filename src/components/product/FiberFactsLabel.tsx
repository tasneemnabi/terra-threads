import type { MaterialInfo } from "@/types/database";

interface FiberFactsLabelProps {
  materials: MaterialInfo[];
}

export function FiberFactsLabel({ materials }: FiberFactsLabelProps) {
  if (!materials || materials.length === 0) {
    return (
      <div className="rounded-xl border border-surface-dark/40 bg-white/60 px-5 py-4 text-center">
        <p className="font-body text-sm text-muted">
          Material composition not yet verified
        </p>
      </div>
    );
  }

  const sortedMaterials = [...materials].sort(
    (a, b) => b.percentage - a.percentage
  );

  return (
    <div className="rounded-xl border border-surface-dark/40 bg-white/60 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-text">
          Fiber Facts
        </h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-natural-light px-2.5 py-0.5 font-body text-[11px] font-medium text-natural-dark">
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          Verified
        </span>
      </div>

      {/* Composition bar */}
      <div className="mt-4 flex h-2 gap-px overflow-hidden rounded-full bg-surface">
        {sortedMaterials.map((mat) => (
          <div
            key={mat.material_id}
            className={`h-full ${mat.is_natural ? "bg-natural" : "bg-muted-light"}`}
            style={{ width: `${Math.max(mat.percentage, 3)}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 space-y-2.5">
        {sortedMaterials.map((mat) => (
          <div
            key={mat.material_id}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`h-2.5 w-2.5 rounded-full ${mat.is_natural ? "bg-natural" : "bg-muted-light"}`}
              />
              <span className="font-body text-sm text-text">{mat.name}</span>
            </div>
            <span className="font-body text-sm font-semibold tabular-nums text-text">
              {mat.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
