"use client";

import type { Material } from "@/types/database";

interface FiberTypeFilterProps {
  materials: Material[];
  selected: string[];
  onChange: (materials: string[]) => void;
}

export function FiberTypeFilter({
  materials,
  selected,
  onChange,
}: FiberTypeFilterProps) {
  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((m) => m !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-text">Fiber Type</h3>
      <div className="mt-3 space-y-2">
        {materials.map((mat) => (
          <label key={mat.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(mat.name)}
              onChange={() => toggle(mat.name)}
              className="h-4 w-4 rounded border-surface-dark text-accent focus:ring-accent"
            />
            <span className="text-secondary">{mat.name}</span>
            {mat.is_natural && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
