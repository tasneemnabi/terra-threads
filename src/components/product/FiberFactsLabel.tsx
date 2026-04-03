import type { MaterialInfo } from "@/types/database";

interface FiberFactsLabelProps {
  materials: MaterialInfo[];
}

// Rich warm tones for natural fibers, muted neutral for synthetics
const NATURAL_COLORS = [
  { bar: "bg-accent", dot: "bg-accent" },
  { bar: "bg-secondary", dot: "bg-secondary" },
  { bar: "bg-natural", dot: "bg-natural" },
  { bar: "bg-muted", dot: "bg-muted" },
];
const SYNTHETIC_COLOR = { bar: "bg-surface-dark", dot: "bg-surface-dark" };

function getSegmentColor(mat: MaterialInfo, naturalIndex: number) {
  if (!mat.is_natural) return SYNTHETIC_COLOR;
  return NATURAL_COLORS[naturalIndex % NATURAL_COLORS.length];
}

export function FiberFactsLabel({ materials }: FiberFactsLabelProps) {
  if (!materials || materials.length === 0) {
    return (
      <div className="rounded-xl bg-white px-5 py-4 text-center shadow-sm ring-1 ring-surface-dark/30">
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
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-surface-dark/30">
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
      {(() => {
        let natIdx = 0;
        return (
          <div className="mt-4 flex h-2.5 gap-px overflow-hidden rounded-full bg-surface">
            {sortedMaterials.map((mat) => {
              const color = getSegmentColor(mat, natIdx);
              if (mat.is_natural) natIdx++;
              return (
                <div
                  key={mat.material_id}
                  className={`h-full ${color.bar}`}
                  style={{ width: `${Math.max(mat.percentage, 3)}%` }}
                />
              );
            })}
          </div>
        );
      })()}

      {/* Legend */}
      {(() => {
        let natIdx = 0;
        return (
          <div className="mt-4 space-y-2.5">
            {sortedMaterials.map((mat) => {
              const color = getSegmentColor(mat, natIdx);
              if (mat.is_natural) natIdx++;
              return (
                <div
                  key={mat.material_id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${color.dot}`}
                    />
                    <span className="font-body text-sm text-text">
                      {mat.name}
                    </span>
                  </div>
                  <span className="font-body text-sm font-semibold tabular-nums text-text">
                    {mat.percentage}%
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
