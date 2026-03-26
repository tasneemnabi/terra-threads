"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateProductStatus, batchUpdateStatus, approveAllPendingForBrand } from "./actions";

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
  materials: Array<{ name: string; percentage: number; is_natural: boolean }>;
}

interface Props {
  products: ProductRow[];
  brands: Array<{ id: string; name: string; slug: string }>;
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
                    <div className="flex items-center gap-3">
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
                        <div className="font-medium text-sm text-text leading-tight">
                          {product.name}
                        </div>
                        <div className="text-xs text-muted mt-0.5">{product.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">{product.brand_name}</td>
                  <td className="px-4 py-3">
                    {product.materials.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {product.materials
                          .sort((a, b) => b.percentage - a.percentage)
                          .map((m) => (
                            <span
                              key={m.name}
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
                      <span className="text-xs text-muted italic">No materials</span>
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
