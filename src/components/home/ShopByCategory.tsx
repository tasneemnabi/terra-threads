import Link from "next/link";
import Image from "next/image";
import { formatCategory } from "@/lib/utils";

interface CategoryItem {
  category: string;
  image_url: string;
}

interface ShopByCategoryProps {
  categories: CategoryItem[];
}

export function ShopByCategory({ categories }: ShopByCategoryProps) {
  if (categories.length === 0) return null;

  return (
    <section className="py-16 sm:py-20">
      {/* Header — constrained */}
      <div className="px-5 sm:px-8 lg:px-20">
        <div className="mx-auto max-w-[1280px] flex items-end justify-between mb-6">
          <h2 className="font-display text-[22px] sm:text-[26px] font-semibold leading-tight tracking-[-0.01em] text-text">
            Start somewhere good.
          </h2>
          <Link
            href="/shop"
            className="hidden sm:inline-flex items-center gap-1.5 font-body text-[14px] font-medium text-accent hover:text-accent/80 transition-colors"
          >
            View all &rarr;
          </Link>
        </div>
      </div>

      {/* Horizontal scroll — bleeds to edges */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pl-5 sm:pl-8 lg:pl-[max(2rem,calc((100vw-1280px)/2+1.25rem))]">
        {categories.map((item, i) => (
          <Link
            key={item.category}
            href={`/shop?category=${encodeURIComponent(item.category)}`}
            className="group relative flex-shrink-0 w-[200px] sm:w-[220px] aspect-[3/4] overflow-hidden rounded-lg"
          >
            <Image
              src={item.image_url}
              alt={formatCategory(item.category)}
              fill
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
              sizes="220px"
              priority={i < 3}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="font-display text-[16px] sm:text-[17px] font-semibold text-white leading-tight">
                {formatCategory(item.category)}
              </p>
            </div>
          </Link>
        ))}
        {/* Trailing spacer for right padding */}
        <div className="flex-shrink-0 w-5 sm:w-8 lg:w-20" aria-hidden="true" />
      </div>
    </section>
  );
}
