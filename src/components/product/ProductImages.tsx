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
  const hasMultiple = allImages.length > 1;

  function goNext() {
    setSelectedIndex((i) => (i + 1) % allImages.length);
  }

  function goPrev() {
    setSelectedIndex((i) => (i - 1 + allImages.length) % allImages.length);
  }

  return (
    <div className="space-y-4">
      <div className="group relative aspect-square overflow-hidden rounded-xl bg-surface">
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

        {/* Navigation arrows */}
        {hasMultiple && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-text opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:bg-white group-hover:opacity-100"
              aria-label="Previous image"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-text opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:bg-white group-hover:opacity-100"
              aria-label="Next image"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {allImages.map((img, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface transition-opacity ${
                index === selectedIndex
                  ? "opacity-100"
                  : "opacity-60 hover:opacity-90"
              }`}
              aria-label={`View image ${index + 1} of ${productName}`}
            >
              {isRemoteUrl(img) ? (
                <Image
                  src={img}
                  alt={`${productName} ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="80px"
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
