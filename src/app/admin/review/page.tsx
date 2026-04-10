import { createAdminClient } from "@/lib/supabase/admin";
import { ReviewDashboard } from "./ReviewDashboard";

interface SearchParams {
  status?: string;
  brand?: string;
  page?: string;
}

const PAGE_SIZE = 50;

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const status = params.status || "pending";
  const brandSlug = params.brand || "";
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * PAGE_SIZE;

  // Fetch brand list for filter
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug")
    .not("shopify_domain", "is", null)
    .order("name");

  // Build product query
  let query = supabase
    .from("products")
    .select(
      "id, name, price, category, image_url, affiliate_url, sync_status, material_confidence, brand_id, brands!inner(name, slug)",
      { count: "exact" }
    )
    .eq("sync_status", status)
    .not("shopify_product_id", "is", null)
    .order("material_confidence", { ascending: status === "review" })
    .range(offset, offset + PAGE_SIZE - 1);

  if (brandSlug) {
    query = query.eq("brands.slug", brandSlug);
  }

  const { data: products, count } = await query;

  // Fetch materials for these products
  const productIds = (products || []).map((p) => p.id);
  const { data: allMaterials } = productIds.length
    ? await supabase
        .from("product_materials")
        .select("product_id, percentage, materials(id, name, is_natural)")
        .in("product_id", productIds)
    : { data: [] };

  const materialsByProduct: Record<
    string,
    Array<{ id: string; name: string; percentage: number; is_natural: boolean }>
  > = {};
  for (const pm of allMaterials || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mat = pm.materials as any;
    if (!mat) continue;
    if (!materialsByProduct[pm.product_id]) materialsByProduct[pm.product_id] = [];
    materialsByProduct[pm.product_id].push({
      id: mat.id,
      name: mat.name,
      percentage: pm.percentage,
      is_natural: mat.is_natural,
    });
  }

  // Canonical material list for the inline editor dropdown
  const { data: canonicalMaterials } = await supabase
    .from("materials")
    .select("id, name, is_natural")
    .order("name");

  // Get counts per status
  const statusCounts: Record<string, number> = {};
  for (const s of ["pending", "review", "approved", "rejected"]) {
    const { count: c } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("sync_status", s)
      .not("shopify_product_id", "is", null);
    statusCounts[s] = c || 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedProducts = (products || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    category: p.category,
    image_url: p.image_url,
    affiliate_url: p.affiliate_url,
    sync_status: p.sync_status,
    material_confidence: p.material_confidence,
    brand_id: p.brand_id,
    brand_name: p.brands?.name || "Unknown",
    brand_slug: p.brands?.slug || "",
    materials: materialsByProduct[p.id] || [],
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-bold text-text mb-2">
          Product Review
        </h1>
        <p className="text-muted mb-8">
          Review synced products before they appear on the site.
        </p>

        <ReviewDashboard
          products={formattedProducts}
          brands={(brands || []).map((b) => ({ id: b.id, name: b.name, slug: b.slug }))}
          canonicalMaterials={canonicalMaterials || []}
          statusCounts={statusCounts}
          currentStatus={status}
          currentBrand={brandSlug}
          currentPage={page}
          totalCount={count || 0}
          pageSize={PAGE_SIZE}
        />
      </div>
    </div>
  );
}
