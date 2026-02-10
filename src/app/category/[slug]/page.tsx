import type { Metadata } from "next";
import { getFilteredProducts } from "@/lib/queries/products";
import { getAllBrands } from "@/lib/queries/brands";
import { getAllMaterials } from "@/lib/queries/materials";
import { FilterSidebar } from "@/components/filters/FilterSidebar";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 12;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = slug.charAt(0).toUpperCase() + slug.slice(1);
  return {
    title,
    description: `Browse ${title.toLowerCase()} made from natural fibers like merino wool, organic cotton, and hemp.`,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;

  const brandParam = typeof sp.brand === "string" ? sp.brand : undefined;
  const fiberParam = typeof sp.fiber === "string" ? sp.fiber : undefined;
  const minPriceParam = typeof sp.minPrice === "string" ? sp.minPrice : undefined;
  const maxPriceParam = typeof sp.maxPrice === "string" ? sp.maxPrice : undefined;
  const pageParam = typeof sp.page === "string" ? sp.page : undefined;

  const page = pageParam ? parseInt(pageParam, 10) : 1;

  const [{ products, totalCount }, brands, materials] = await Promise.all([
    getFilteredProducts({
      category: slug,
      brands: brandParam ? brandParam.split(",") : undefined,
      materials: fiberParam ? fiberParam.split(",") : undefined,
      minPrice: minPriceParam ? Number(minPriceParam) : undefined,
      maxPrice: maxPriceParam ? Number(maxPriceParam) : undefined,
      page,
    }),
    getAllBrands(),
    getAllMaterials(),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const categoryTitle = slug.charAt(0).toUpperCase() + slug.slice(1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">{categoryTitle}</h1>
        <p className="mt-2 text-neutral-500">
          {totalCount} {totalCount === 1 ? "product" : "products"} found
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside>
          <FilterSidebar brands={brands} materials={materials} />
        </aside>

        <div>
          <ProductGrid products={products} />
          <Pagination currentPage={page} totalPages={totalPages} />
        </div>
      </div>
    </div>
  );
}
