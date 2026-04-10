"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateProductStatus,
  batchUpdateStatus,
  approveAllPendingForBrand,
  updateProductMaterials,
} from "./actions";

interface CanonicalMaterial {
  id: string;
  name: string;
  is_natural: boolean;
}

interface ProductMaterial {
  id: string;
  name: string;
  percentage: number;
  is_natural: boolean;
}

interface ProductRow {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
  affiliate_url: string | null;
  sync_status: string;
  material_confidence: number | null;
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  materials: ProductMaterial[];
}

interface Props {
  products: ProductRow[];
  brands: Array<{ id: string; name: string; slug: string }>;
  canonicalMaterials: CanonicalMaterial[];
  statusCounts: Record<string, number>;
  currentStatus: string;
  currentBrand: string;
  currentPage: number;
  totalCount: number;
  pageSize: number;
}

export function ReviewDashboard({
  products,
  brands,
  canonicalMaterials,
  statusCounts,
  currentStatus,
  currentBrand,
  currentPage,
  totalCount,
  pageSize,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusIndex, setFocusIndex] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCount / pageSize);

  function navigate(status?: string, brand?: string, page?: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (brand) params.set("brand", brand);
    if (page && page > 1) params.set("page", String(page));
    router.push(`/admin/review?${params.toString()}`);
  }

  const handleAction = useCallback(
    (productId: string, status: "approved" | "rejected") => {
      startTransition(async () => {
        await updateProductStatus(productId, status);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      });
    },
    []
  );

  const handleBatchAction = useCallback(
    (status: "approved" | "rejected") => {
      if (selected.size === 0) return;
      startTransition(async () => {
        await batchUpdateStatus(Array.from(selected), status);
        setSelected(new Set());
      });
    },
    [selected]
  );

  const handleApproveAllBrand = useCallback(
    (brandId: string) => {
      startTransition(async () => {
        await approveAllPendingForBrand(brandId);
      });
    },
    []
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === "j") setFocusIndex((i) => Math.min(i + 1, products.length - 1));
      if (e.key === "k") setFocusIndex((i) => Math.max(i - 1, 0));
      if (e.key === "a" && products[focusIndex]) handleAction(products[focusIndex].id, "approved");
      if (e.key === "r" && products[focusIndex]) handleAction(products[focusIndex].id, "rejected");
      if (e.key === "x" && products[focusIndex]) toggleSelect(products[focusIndex].id);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [focusIndex, products, handleAction]);

  return (
    <div>
      {/* Status tabs */}
      <div className="flex gap-2 mb-6">
        {(["pending", "review", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => navigate(s, currentBrand)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentStatus === s
                ? "bg-accent text-white"
                : "bg-surface text-muted hover:bg-surface-dark"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}{" "}
            <span className="opacity-70">({statusCounts[s] || 0})</span>
          </button>
        ))}
      </div>

      {/* Filters + batch actions bar */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <select
          value={currentBrand}
          onChange={(e) => navigate(currentStatus, e.target.value)}
          className="bg-surface border border-surface-dark rounded-lg px-3 py-2 text-sm text-text"
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted">{selected.size} selected</span>
            <button
              onClick={() => handleBatchAction("approved")}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              Approve selected
            </button>
            <button
              onClick={() => handleBatchAction("rejected")}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              Reject selected
            </button>
          </div>
        )}

        {currentStatus === "pending" && currentBrand && (
          <button
            onClick={() => {
              const brand = brands.find((b) => b.slug === currentBrand);
              if (brand) handleApproveAllBrand(brand.id);
            }}
            disabled={isPending}
            className="ml-auto px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve all {currentBrand} pending
          </button>
        )}
      </div>

      {/* Keyboard hints */}
      <div className="text-xs text-muted mb-4 flex gap-4">
        <span><kbd className="px-1.5 py-0.5 rounded bg-surface text-text font-mono">j</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-surface text-text font-mono">k</kbd> navigate</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-surface text-text font-mono">a</kbd> approve</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-surface text-text font-mono">r</kbd> reject</span>
        <span><kbd className="px-1.5 py-0.5 rounded bg-surface text-text font-mono">x</kbd> select</span>
      </div>

      {/* Product table */}
      {products.length === 0 ? (
        <div className="text-center py-16 text-muted">
          No products with status &ldquo;{currentStatus}&rdquo;
          {currentBrand && ` for ${currentBrand}`}
        </div>
      ) : (
        <div className="border border-surface-dark rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface text-left text-xs font-medium text-muted uppercase tracking-wider">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Materials</th>
                <th className="px-4 py-3 w-20">Conf.</th>
                <th className="px-4 py-3 w-20">Price</th>
                <th className="px-4 py-3 w-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {products.map((product, idx) => (
                <tr
                  key={product.id}
                  className={`transition-colors ${
                    idx === focusIndex
                      ? "bg-accent/5 ring-1 ring-inset ring-accent/20"
                      : "hover:bg-surface/50"
                  } ${isPending ? "opacity-60" : ""}`}
                  onClick={() => setFocusIndex(idx)}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={product.affiliate_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-3 group"
                      title="Open product page"
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover bg-surface"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-muted text-xs">
                          ?
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-sm text-text leading-tight group-hover:text-accent group-hover:underline">
                          {product.name}
                        </div>
                        <div className="text-xs text-muted mt-0.5">{product.category}</div>
                      </div>
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">{product.brand_name}</td>
                  <td className="px-4 py-3">
                    {editingId === product.id ? (
                      <MaterialsEditor
                        productId={product.id}
                        initial={product.materials}
                        canonicalMaterials={canonicalMaterials}
                        onClose={() => setEditingId(null)}
                        onSave={(mats) =>
                          startTransition(async () => {
                            await updateProductMaterials(product.id, mats);
                            setEditingId(null);
                          })
                        }
                        isPending={isPending}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(product.id);
                        }}
                        className="text-left w-full hover:bg-surface/60 rounded -mx-1 px-1 py-0.5 cursor-pointer"
                        title="Click to edit materials"
                      >
                        {product.materials.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {product.materials
                              .slice()
                              .sort((a, b) => b.percentage - a.percentage)
                              .map((m) => (
                                <span
                                  key={m.id}
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                                    m.is_natural
                                      ? "bg-green-100 text-green-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {m.percentage}% {m.name}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted italic">+ Add materials</span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge value={product.material_confidence} />
                  </td>
                  <td className="px-4 py-3 text-sm text-text">
                    ${product.price?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {product.affiliate_url && (
                        <a
                          href={product.affiliate_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded text-xs text-muted hover:text-text hover:bg-surface"
                        >
                          View
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(product.id, "approved");
                        }}
                        disabled={isPending}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(product.id, "rejected");
                        }}
                        disabled={isPending}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted">
            Page {currentPage} of {totalPages} ({totalCount} products)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(currentStatus, currentBrand, currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg text-sm bg-surface hover:bg-surface-dark disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => navigate(currentStatus, currentBrand, currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm bg-surface hover:bg-surface-dark disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined)
    return <span className="text-xs text-muted">—</span>;

  const pct = Math.round(value * 100);
  let color = "bg-red-100 text-red-800";
  if (value >= 0.8) color = "bg-green-100 text-green-800";
  else if (value >= 0.5) color = "bg-amber-100 text-amber-800";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {pct}%
    </span>
  );
}

interface EditorRow {
  materialId: string;
  percentage: number;
}

function MaterialsEditor({
  productId: _productId,
  initial,
  canonicalMaterials,
  onClose,
  onSave,
  isPending,
}: {
  productId: string;
  initial: ProductMaterial[];
  canonicalMaterials: CanonicalMaterial[];
  onClose: () => void;
  onSave: (rows: EditorRow[]) => void;
  isPending: boolean;
}) {
  const [rows, setRows] = useState<EditorRow[]>(() =>
    initial.length > 0
      ? initial.map((m) => ({ materialId: m.id, percentage: m.percentage }))
      : [{ materialId: "", percentage: 100 }]
  );

  const total = rows.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0);
  const totalOk = total === 100;

  const updateRow = (idx: number, patch: Partial<EditorRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, { materialId: "", percentage: 0 }]);
  const removeRow = (idx: number) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div
      className="space-y-2 bg-surface/50 rounded-lg p-2 border border-surface-dark"
      onClick={(e) => e.stopPropagation()}
    >
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <select
            value={row.materialId}
            onChange={(e) => updateRow(idx, { materialId: e.target.value })}
            className="flex-1 min-w-0 bg-white border border-surface-dark rounded px-2 py-1 text-xs text-text"
          >
            <option value="">Select material…</option>
            {canonicalMaterials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.is_natural ? "" : " (synthetic)"}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={100}
            value={row.percentage}
            onChange={(e) =>
              updateRow(idx, { percentage: Number(e.target.value) || 0 })
            }
            className="w-14 bg-white border border-surface-dark rounded px-1.5 py-1 text-xs text-text text-right"
          />
          <span className="text-xs text-muted">%</span>
          <button
            type="button"
            onClick={() => removeRow(idx)}
            className="text-xs text-muted hover:text-red-600 px-1"
            title="Remove"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={addRow}
          className="text-xs text-accent hover:underline"
        >
          + Add material
        </button>
        <span
          className={`text-xs font-mono ${totalOk ? "text-green-700" : "text-red-600"}`}
        >
          total {total}%
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={!totalOk || isPending || rows.some((r) => !r.materialId)}
          onClick={() =>
            onSave(rows.filter((r) => r.materialId && r.percentage > 0))
          }
          className="px-2.5 py-1 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="px-2.5 py-1 rounded-md text-xs font-medium bg-surface text-text hover:bg-surface-dark disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
