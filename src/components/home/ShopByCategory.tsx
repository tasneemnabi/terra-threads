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
    <section className="px-5 sm:px-8 lg:px-20 py-16 sm:py-20">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="font-body text-[13px] font-medium uppercase leading-[16px] tracking-[0.08em] text-secondary">
              Shop by category
            </p>
            <h2 className="mt-2 font-display text-[24px] sm:text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text text-balance">
              Find what you&apos;re looking for
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden sm:inline-flex items-center gap-1.5 font-body text-[15px] font-medium text-accent hover:text-accent/80 transition-colors"
          >
            View all &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((item) => (
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
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="font-display text-[16px] sm:text-[18px] font-semibold text-white leading-tight">
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
