import type { MaterialInfo } from "@/types/database";
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

  const totalPercent = materials.reduce((sum, m) => sum + m.percentage, 0);
  const sortedMaterials = [...materials].sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="border-2 border-text bg-white px-4 py-3">
      {/* Title */}
      <p className="font-body text-[22px] font-extrabold leading-tight text-text">
        Fiber Facts
      </p>
      <div className="mt-1 h-[6px] bg-text" />

      {/* Total */}
      <div className="mt-2 flex items-baseline justify-between font-body text-sm">
        <span className="font-bold text-text">Total Fiber</span>
        <span className="font-bold text-text">{totalPercent}%</span>
      </div>
      <div className="mt-2 h-[4px] bg-text" />

      {/* Individual materials */}
      {sortedMaterials.map((mat, i) => (
        <div key={mat.material_id}>
          <div className="flex items-baseline justify-between py-1 font-body text-sm">
            <span className="text-text">
              {mat.name}
            </span>
            <span className="font-medium text-text">{mat.percentage}%</span>
          </div>
          {i < sortedMaterials.length - 1 && (
            <div className="h-px bg-surface-dark" />
          )}
        </div>
      ))}
      <div className="mt-1 h-px bg-surface-dark" />

      {/* Verified stamp */}
      <p className="mt-2 font-body text-xs text-muted">Verified by FIBER</p>
    </div>
  );
}
