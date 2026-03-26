"use client";

import { useState } from "react";
import Image from "next/image";

interface ProductImagesProps {
  mainImage: string | null;
  additionalImages: string[];
  productName: string;
}

const Placeholder = ({ className = "h-24 w-24" }: { className?: string }) => (
  <div className="flex h-full items-center justify-center text-muted-light">
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  </div>
);

function isRemoteUrl(url: string) {
  return url.startsWith("http");
}

export function ProductImages({
  mainImage,
  additionalImages,
  productName,
}: ProductImagesProps) {
  const allImages = [mainImage, ...additionalImages].filter(Boolean) as string[];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const currentImage = allImages[selectedIndex];

  return (
    <div className="space-y-4">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-surface">
        {currentImage && isRemoteUrl(currentImage) ? (
          <Image
            src={currentImage}
            alt={productName}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        ) : (
          <Placeholder />
        )}
      </div>

      {allImages.length > 1 && (
        <div className="flex gap-3 overflow-x-auto">
          {allImages.map((img, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`relative h-16 w-16 shrink-0 rounded-lg bg-surface overflow-hidden ${
                index === selectedIndex
                  ? "ring-2 ring-accent"
                  : "ring-1 ring-surface-dark"
              }`}
              aria-label={`View image ${index + 1} of ${productName}`}
            >
              {isRemoteUrl(img) ? (
                <Image
                  src={img}
                  alt={`${productName} ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              ) : (
                <Placeholder className="h-6 w-6" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
