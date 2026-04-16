import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = "https://wearfiber.co";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  // Fetch all brand slugs
  const { data: brands } = await supabase
    .from("brands")
    .select("slug, created_at");

  // Fetch all approved product slugs
  const { data: products } = await supabase
    .from("products_with_materials")
    .select("slug, created_at");

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/shop`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/brands`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
  ];

  const brandPages: MetadataRoute.Sitemap = (brands || []).map((brand) => ({
    url: `${BASE_URL}/brand/${brand.slug}`,
    lastModified: new Date(brand.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const productPages: MetadataRoute.Sitemap = (products || []).map((product) => ({
    url: `${BASE_URL}/product/${product.slug}`,
    lastModified: new Date(product.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...brandPages, ...productPages];
}
