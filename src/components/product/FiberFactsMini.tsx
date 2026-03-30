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
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block h-[6px] w-[6px] shrink-0 rounded-full ${
          allNatural ? "bg-natural" : "bg-accent"
        }`}
      />
      <p className="font-body text-[11px] leading-tight text-muted">
        {fibers}
      </p>
    </div>
  );
}
