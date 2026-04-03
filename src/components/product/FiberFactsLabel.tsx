import type { MaterialInfo } from "@/types/database";
import { isAllNatural } from "@/lib/utils";

interface FiberFactsLabelProps {
  materials: MaterialInfo[];
}

// Earthy tones for naturals, rose for synthetics (draws attention to the exception)
const NATURAL_COLORS = [
  { bar: "bg-secondary", dot: "bg-secondary" },
  { bar: "bg-natural", dot: "bg-natural" },
  { bar: "bg-muted", dot: "bg-muted" },
  { bar: "bg-text/70", dot: "bg-text/70" },
];
const SYNTHETIC_COLOR = { bar: "bg-accent", dot: "bg-accent" };

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
  const allNatural = isAllNatural(materials);

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-surface-dark/30">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-text">
          Fiber Facts
        </h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-body text-[11px] font-medium ${
            allNatural
              ? "bg-natural-light text-natural-dark"
              : "bg-accent/10 text-accent"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              allNatural ? "bg-natural" : "bg-accent"
            }`}
          />
          {allNatural ? "100% Natural" : "Nearly Natural"}
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
