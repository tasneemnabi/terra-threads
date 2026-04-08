"use client";

import Image from "next/image";
import { useState, useCallback } from "react";

interface ProductImage {
  url: string;
  name: string;
}

interface HeroProductCollageProps {
  products: ProductImage[];
}

function CollageImage({
  src,
  alt,
  sizes,
  onSuccess,
  onFail,
}: {
  src: string;
  alt: string;
  sizes: string;
  onSuccess: () => void;
  onFail: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority
      className={`object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      sizes={sizes}
      onLoad={() => {
        setLoaded(true);
        onSuccess();
      }}
      onError={() => {
        setFailed(true);
        onFail();
      }}
    />
  );
}

export function HeroProductCollage({ products }: HeroProductCollageProps) {
  // Track which indices loaded and which failed
  const [loaded, setLoaded] = useState<Set<number>>(new Set());
  const [failed, setFailed] = useState<Set<number>>(new Set());

  const markLoaded = useCallback(
    (i: number) => setLoaded((prev) => new Set(prev).add(i)),
    []
  );
  const markFailed = useCallback(
    (i: number) => setFailed((prev) => new Set(prev).add(i)),
    []
  );

  // Successfully loaded products
  const loadedProducts = products
    .map((p, i) => ({ ...p, i }))
    .filter((p) => loaded.has(p.i));

  const anyLoaded = loadedProducts.length > 0;

  // Render all images (failed ones hide themselves), but only show
  // the container once at least one loads
  return (
    <div
      className={`absolute right-0 top-0 bottom-0 w-[45%] lg:w-[42%] hidden sm:flex items-center justify-center transition-opacity duration-700 ${anyLoaded ? "opacity-100" : "opacity-0"}`}
    >
      {/* Narrow fade on left edge only — keep images clean */}
      <div className="absolute inset-y-0 left-0 w-[30%] z-10 bg-gradient-to-r from-accent to-transparent" />

      <div className="relative w-full h-full flex items-center justify-center gap-4 px-8 lg:px-12">
        {/* Primary slot */}
        <div className="relative z-[1] w-[55%] max-w-[320px] aspect-[3/4] rounded-lg overflow-hidden shadow-2xl">
          {products.map((p, i) => (
            <div
              key={i}
              className={
                // Show if: this image loaded AND it's the first loaded one
                loaded.has(i) && loadedProducts[0]?.i === i
                  ? "absolute inset-0"
                  : loaded.has(i)
                    ? "hidden"
                    : failed.has(i)
                      ? "hidden"
                      : "absolute inset-0"
              }
            >
              <CollageImage
                src={p.url}
                alt={p.name}
                sizes="320px"
                onSuccess={() => markLoaded(i)}
                onFail={() => markFailed(i)}
              />
            </div>
          ))}
        </div>

        {/* Secondary slot */}
        <div className="relative w-[42%] max-w-[240px] aspect-[3/4] rounded-lg overflow-hidden shadow-xl translate-y-8 lg:translate-y-12">
          {products.map((p, i) => (
            <div
              key={i}
              className={
                loaded.has(i) && loadedProducts[1]?.i === i
                  ? "absolute inset-0"
                  : "hidden"
              }
            >
              <CollageImage
                src={p.url}
                alt={p.name}
                sizes="240px"
                onSuccess={() => markLoaded(i)}
                onFail={() => markFailed(i)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
