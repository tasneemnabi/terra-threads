import type { MaterialInfo } from "@/types/database";
import { naturalPercentage, isAllNatural } from "@/lib/utils";

interface FiberFactsLabelProps {
  materials: MaterialInfo[];
}

export function FiberFactsLabel({ materials }: FiberFactsLabelProps) {
  if (!materials || materials.length === 0) {
    return (
      <div className="rounded-lg border-2 border-surface-dark bg-white px-5 py-4 text-center">
        <p className="font-body text-sm text-muted">
          Material composition not yet verified
        </p>
      </div>
    );
  }

  const natPercent = naturalPercentage(materials);
  const synPercent = 100 - natPercent;
  const allNatural = isAllNatural(materials);
  const totalPercent = materials.reduce((sum, m) => sum + m.percentage, 0);
  const naturalMats = materials.filter((m) => m.is_natural).sort((a, b) => b.percentage - a.percentage);
  const syntheticMats = materials.filter((m) => !m.is_natural).sort((a, b) => b.percentage - a.percentage);
  const sortedMaterials = [...naturalMats, ...syntheticMats];

  return (
    <div className="border-2 border-text bg-white px-4 py-3">
      {/* Title */}
      <p className="font-body text-[22px] font-extrabold leading-tight text-text">
        Fiber Facts
      </p>
      <div className="mt-1 h-[6px] bg-text" />

      {/* Totals */}
      <div className="mt-2 flex items-baseline justify-between font-body text-sm">
        <span className="font-bold text-text">Total Fiber</span>
        <span className="font-bold text-text">{totalPercent}%</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between pl-4 font-body text-sm">
        <span className="text-text">Natural</span>
        <span className="font-medium text-text">{natPercent}%</span>
      </div>
      {!allNatural && (
        <div className="flex items-baseline justify-between pl-4 font-body text-sm">
          <span className="text-text">Synthetic</span>
          <span className="font-medium text-text">{synPercent}%</span>
        </div>
      )}
      <div className="mt-2 h-[4px] bg-text" />

      {/* Individual materials */}
      {sortedMaterials.map((mat, i) => (
        <div key={mat.material_id}>
          <div className="flex items-baseline justify-between py-1 font-body text-sm">
            <span className={mat.is_natural ? "text-text" : "text-muted"}>
              {mat.name}
            </span>
            <span className="font-medium text-text">{mat.percentage}%</span>
          </div>
          {i < sortedMaterials.length - 1 && (
            <div className="h-px bg-surface-dark" />
          )}
        </div>
      ))}
      <div className="mt-1 h-[4px] bg-text" />

      {/* Tier */}
      <div className="mt-2 flex items-center gap-1.5 font-body text-sm">
        <span
          className={`h-[6px] w-[6px] rounded-full ${
            allNatural ? "bg-[#4A7A3D]" : "bg-[#C4960C]"
          }`}
        />
        <span className="font-medium text-text">
          {allNatural ? "100% Natural" : "Nearly Natural"}
        </span>
      </div>
      <div className="mt-2 h-[4px] bg-text" />

      {/* Not in this garment */}
      <div className="mt-2 space-y-0.5">
        {["Polyester", "Nylon", "Acrylic"].map((banned) => (
          <div
            key={banned}
            className="flex items-center gap-1.5 font-body text-sm text-text"
          >
            <svg
              className="h-3.5 w-3.5 shrink-0 text-[#4A7A3D]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            No {banned.toLowerCase()}
          </div>
        ))}
      </div>
      <div className="mt-2 h-px bg-surface-dark" />

      {/* Verified stamp */}
      <p className="mt-2 font-body text-xs text-muted">Verified by FIBER</p>
    </div>
  );
}
