"use client";

interface ActiveFiltersProps {
  brands: string[];
  materials: string[];
  minPrice?: number;
  maxPrice?: number;
  onRemoveBrand: (slug: string) => void;
  onRemoveMaterial: (name: string) => void;
  onRemovePrice: () => void;
  onClearAll: () => void;
}

export function ActiveFilters({
  brands,
  materials,
  minPrice,
  maxPrice,
  onRemoveBrand,
  onRemoveMaterial,
  onRemovePrice,
  onClearAll,
}: ActiveFiltersProps) {
  const hasFilters =
    brands.length > 0 ||
    materials.length > 0 ||
    minPrice !== undefined ||
    maxPrice !== undefined;

  if (!hasFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted">Filters:</span>

      {brands.map((slug) => (
        <button
          key={slug}
          onClick={() => onRemoveBrand(slug)}
          className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20"
        >
          {slug}
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3.05 3.05a.5.5 0 01.707 0L6 5.293l2.243-2.243a.5.5 0 01.707.707L6.707 6l2.243 2.243a.5.5 0 01-.707.707L6 6.707 3.757 8.95a.5.5 0 01-.707-.707L5.293 6 3.05 3.757a.5.5 0 010-.707z" />
          </svg>
        </button>
      ))}

      {materials.map((name) => (
        <button
          key={name}
          onClick={() => onRemoveMaterial(name)}
          className="inline-flex items-center gap-1 rounded-full bg-natural-light px-2.5 py-1 text-xs font-medium text-natural-dark hover:bg-natural/10"
        >
          {name}
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3.05 3.05a.5.5 0 01.707 0L6 5.293l2.243-2.243a.5.5 0 01.707.707L6.707 6l2.243 2.243a.5.5 0 01-.707.707L6 6.707 3.757 8.95a.5.5 0 01-.707-.707L5.293 6 3.05 3.757a.5.5 0 010-.707z" />
          </svg>
        </button>
      ))}

      {(minPrice !== undefined || maxPrice !== undefined) && (
        <button
          onClick={onRemovePrice}
          className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface-dark"
        >
          {minPrice !== undefined && maxPrice !== undefined
            ? `$${minPrice} - $${maxPrice}`
            : minPrice !== undefined
              ? `From $${minPrice}`
              : `Up to $${maxPrice}`}
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3.05 3.05a.5.5 0 01.707 0L6 5.293l2.243-2.243a.5.5 0 01.707.707L6.707 6l2.243 2.243a.5.5 0 01-.707.707L6 6.707 3.757 8.95a.5.5 0 01-.707-.707L5.293 6 3.05 3.757a.5.5 0 010-.707z" />
          </svg>
        </button>
      )}

      <button
        onClick={onClearAll}
        className="text-xs font-medium text-muted underline hover:text-text"
      >
        Clear all
      </button>
    </div>
  );
}
