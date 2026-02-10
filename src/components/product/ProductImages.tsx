"use client";

import { useState } from "react";

interface ProductImagesProps {
  mainImage: string | null;
  additionalImages: string[];
  productName: string;
}

export function ProductImages({
  mainImage,
  additionalImages,
  productName,
}: ProductImagesProps) {
  const allImages = [mainImage, ...additionalImages].filter(Boolean) as string[];
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className="space-y-4">
      <div className="aspect-square overflow-hidden rounded-xl bg-neutral-100">
        <div className="flex h-full items-center justify-center text-neutral-400">
          <svg className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      {allImages.length > 1 && (
        <div className="flex gap-3">
          {allImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`h-16 w-16 rounded-lg bg-neutral-100 ${
                index === selectedIndex
                  ? "ring-2 ring-primary"
                  : "ring-1 ring-neutral-200"
              }`}
              aria-label={`View image ${index + 1} of ${productName}`}
            >
              <div className="flex h-full items-center justify-center text-neutral-300">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
