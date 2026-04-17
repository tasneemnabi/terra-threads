import type { MaterialInfo } from "@/types/database";
import { isAllNatural } from "@/lib/utils";
import { TierDot } from "@/components/ui/TierDot";

interface FiberFactsLabelProps {
  materials: MaterialInfo[];
  brandName?: string;
}

// Earthy tones for naturals, rose for synthetics (draws attention to the exception)
const NATURAL_COLORS = [
  { bar: "bg-natural", dot: "bg-natural" },
  { bar: "bg-secondary", dot: "bg-secondary" },
  { bar: "bg-muted", dot: "bg-muted" },
  { bar: "bg-text/70", dot: "bg-text/70" },
];
const SYNTHETIC_COLOR = { bar: "bg-accent", dot: "bg-accent" };

function getSegmentColor(mat: MaterialInfo, naturalIndex: number) {
  if (!mat.is_natural) return SYNTHETIC_COLOR;
  return NATURAL_COLORS[naturalIndex % NATURAL_COLORS.length];
}

export function FiberFactsLabel({ materials, brandName }: FiberFactsLabelProps) {
  if (!materials || materials.length === 0) {
    return (
      <div className="rounded-xl bg-background px-5 py-5 shadow-sm ring-1 ring-surface-dark/30">
        <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-text">
          Fiber Facts
        </h3>
        <p className="mt-2 font-body text-sm leading-relaxed text-muted">
          Material composition not yet verified.
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 font-body text-sm leading-relaxed text-secondary">
          <span>
            {brandName
              ? `We're checking with ${brandName}. Tap through to see material details on their site.`
              : "We're checking with the brand. Tap through to see material details on their site."}
          </span>
          <svg
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
          </svg>
        </p>
      </div>
    );
  }

  const sortedMaterials = [...materials].sort(
    (a, b) => b.percentage - a.percentage
  );
  const allNatural = isAllNatural(materials);

  return (
    <div className="rounded-xl bg-background p-5 shadow-sm ring-1 ring-surface-dark/30">
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
          <TierDot tier={allNatural ? "natural" : "nearly"} size={6} />
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
