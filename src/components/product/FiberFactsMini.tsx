import type { MaterialInfo } from "@/types/database";
import { isAllNatural } from "@/lib/utils";

interface FiberFactsMiniProps {
  materials: MaterialInfo[];
}

export function FiberFactsMini({ materials }: FiberFactsMiniProps) {
  if (!materials || materials.length === 0) return null;

  const allNatural = isAllNatural(materials);
  const fibers = [...materials]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3)
    .map((m) => `${m.percentage}% ${m.name}`)
    .join(", ");

  return (
    <div
      className={`rounded border px-2 py-1 ${
        allNatural
          ? "border-natural/30 bg-natural-light"
          : "border-surface-dark bg-background"
      }`}
    >
      <p className="font-body text-[11px] leading-tight text-muted">
        {fibers}
      </p>
    </div>
  );
}
