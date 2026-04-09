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
            className="group/arrow hidden sm:inline-flex items-center gap-1.5 font-body text-[14px] font-medium text-accent hover:text-accent/80 transition-colors"
          >
            View all{" "}
            <span className="inline-block transition-transform duration-200 group-hover/arrow:translate-x-0.5">
              &rarr;
            </span>
          </Link>
        </div>
      </div>

      <div className="px-5 sm:px-8 lg:px-20">
        <div className="mx-auto max-w-[1280px] grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((item, i) => (
            <Link
              key={item.category}
              href={`/shop?category=${encodeURIComponent(item.category)}`}
              className="group relative aspect-[3/4] overflow-hidden rounded-lg"
            >
              <Image
                src={item.image_url}
                alt={formatCategory(item.category)}
                fill
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                sizes="(min-width: 1024px) 200px, (min-width: 768px) 180px, 33vw"
                priority={i < 3}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="font-display text-[14px] sm:text-[16px] font-semibold text-white leading-tight transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
                  {formatCategory(item.category)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
