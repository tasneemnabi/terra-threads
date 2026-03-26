import type { MaterialInfo } from "@/types/database";

interface MaterialBreakdownProps {
  materials: MaterialInfo[];
}

export function MaterialBreakdown({ materials }: MaterialBreakdownProps) {
  if (!materials || materials.length === 0) return null;

  const sorted = [...materials].sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text">
        Material Composition
      </h3>
      <div className="space-y-2">
        {sorted.map((mat) => (
          <div key={mat.material_id}>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-secondary">
                {mat.name}
                {mat.is_natural && (
                  <span className="inline-block h-2 w-2 rounded-full bg-natural" title="Natural fiber" />
                )}
              </span>
              <span className="font-medium text-text">
                {mat.percentage}%
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
              <div
                className={`h-full rounded-full ${
                  mat.is_natural ? "bg-accent" : "bg-muted-light"
                }`}
                style={{ width: `${mat.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
