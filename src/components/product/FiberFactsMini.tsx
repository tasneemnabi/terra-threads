import type { MaterialInfo } from "@/types/database";
import { naturalPercentage, isAllNatural } from "@/lib/utils";

interface FiberFactsMiniProps {
  materials: MaterialInfo[];
}

export function FiberFactsMini({ materials }: FiberFactsMiniProps) {
  if (!materials || materials.length === 0) return null;

  const natPercent = naturalPercentage(materials);
  const allNatural = isAllNatural(materials);
  const topMaterials = [...materials]
    .filter((m) => m.is_natural)
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 2)
    .map((m) => m.name)
    .join(", ");

  return (
    <div
      className={`rounded border px-2 py-1 ${
        allNatural
          ? "border-[#4A7A3D]/30 bg-[#4A7A3D]/5"
          : "border-surface-dark bg-white"
      }`}
    >
      <p className="font-body text-xs leading-tight">
        <span className="font-bold text-text">{natPercent}%</span>{" "}
        <span className="text-muted">natural</span>
      </p>
      {topMaterials && (
        <p className="font-body text-[11px] leading-tight text-muted">
          {topMaterials}
        </p>
      )}
    </div>
  );
}
