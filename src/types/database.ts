export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  brand_id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  price: number;
  currency: string;
  image_url: string | null;
  additional_images: string[];
  affiliate_url: string | null;
  is_featured: boolean;
  created_at: string;
}

export interface Material {
  id: string;
  name: string;
  description: string | null;
  is_natural: boolean;
}

export interface ProductMaterial {
  id: string;
  product_id: string;
  material_id: string;
  percentage: number;
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
  brand_logo_url: string | null;
  materials: MaterialInfo[];
}

export interface ProductWithBrandAndCount extends ProductWithBrand {
  total_count: number;
}

export interface FilterState {
  category?: string;
  brands?: string[];
  materials?: string[];
  minPrice?: number;
  maxPrice?: number;
  page?: number;
}
