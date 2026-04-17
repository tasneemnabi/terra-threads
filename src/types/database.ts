export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  is_fully_natural: boolean;
  audience: string[];
  fiber_types: string[];
  categories: string[];
  created_at: string;
  shopify_domain: string | null;
  last_synced_at: string | null;
  availability_cadence_days: number;
  sync_enabled: boolean;
}

export interface Product {
  id: string;
  brand_id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  product_type: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  additional_images: string[];
  affiliate_url: string | null;
  is_featured: boolean;
  created_at: string;
  shopify_product_id: number | null;
  shopify_variant_id: number | null;
  last_synced_at: string | null;
  source_updated_at: string | null;
  sync_status: "pending" | "review" | "approved" | "rejected" | null;
  material_confidence: number | null;
  raw_body_html: string | null;
  body_hash: string | null;
  audience: string | null;
  is_available: boolean;
}

export interface Material {
  id: string;
  name: string;
  description: string | null;
  is_natural: boolean;
}

export interface MaterialInfo {
  material_id: string;
  name: string;
  percentage: number;
  is_natural: boolean;
}

export interface ProductWithBrand extends Product {
  brand_name: string;
  brand_slug: string;
  brand_website_url: string | null;
  brand_is_fully_natural: boolean;
  materials: MaterialInfo[];
}

export interface ProductWithBrandAndCount extends ProductWithBrand {
  total_count: number;
}

export interface BrandWithDetails {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  product_count: number;
  fiber_types: string[];
  is_fully_natural: boolean;
  categories: string[];
  audience: string[];
}

export type SortOption = "newest" | "price-asc" | "price-desc";
export type TierFilter = "all" | "natural" | "nearly";

export interface FilterState {
  categories?: string[];
  brands?: string[];
  materials?: string[];
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  sort?: SortOption;
  tier?: TierFilter;
  audience?: string;
  productTypes?: string[];
}
