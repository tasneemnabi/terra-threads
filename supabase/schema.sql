-- =============================================
-- Natural Fiber Clothing Aggregator — Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Brands
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  website_url text,
  is_fully_natural boolean not null default true,
  audience text[] default '{}',
  fiber_types text[] default '{}',
  categories text[] default '{}',
  shopify_domain text,
  last_synced_at timestamptz,
  sync_enabled boolean default true,
  scrape_fallback boolean not null default false,
  created_at timestamptz default now()
);

-- 2. Materials
create table materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_natural boolean not null default true
);

-- 3. Products
create table products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  category text not null,
  price numeric(10,2) not null,
  currency text not null default 'USD',
  image_url text,
  additional_images text[] default '{}',
  affiliate_url text,
  is_featured boolean default false,
  shopify_product_id bigint,
  shopify_variant_id bigint,
  last_synced_at timestamptz,
  sync_status text default null,
  material_confidence numeric(3,2),
  raw_body_html text,
  created_at timestamptz default now(),
  constraint uq_brand_shopify_product unique (brand_id, shopify_product_id)
);

-- 4. Product–Material join (with percentage)
create table product_materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  material_id uuid not null references materials(id) on delete cascade,
  percentage integer not null check (percentage > 0 and percentage <= 100),
  unique (product_id, material_id)
);

-- =============================================
-- Indexes
-- =============================================
create index idx_products_category on products(category);
create index idx_products_brand_id on products(brand_id);
create index idx_products_slug on products(slug);
create index idx_brands_slug on brands(slug);
create index idx_product_materials_product on product_materials(product_id);
create index idx_product_materials_material on product_materials(material_id);
create index idx_products_sync_status on products(sync_status);
create index idx_products_shopify_product_id on products(shopify_product_id);
create index idx_brands_shopify_domain on brands(shopify_domain) where shopify_domain is not null;

-- =============================================
-- View: products with brand + materials
-- Only shows visible products (sync_status IS NULL or 'approved')
-- =============================================
create view products_with_materials
with (security_invoker = on) as
select
  p.*,
  b.name as brand_name,
  b.slug as brand_slug,
  b.website_url as brand_website_url,
  b.is_fully_natural as brand_is_fully_natural,
  coalesce(
    json_agg(
      json_build_object(
        'material_id', m.id,
        'name', m.name,
        'percentage', pm.percentage,
        'is_natural', m.is_natural
      )
      order by pm.percentage desc
    ) filter (where m.id is not null),
    '[]'::json
  ) as materials
from products p
join brands b on b.id = p.brand_id
left join product_materials pm on pm.product_id = p.id
left join materials m on m.id = pm.material_id
where p.sync_status is null or p.sync_status = 'approved'
group by p.id, b.name, b.slug, b.website_url, b.is_fully_natural;

-- =============================================
-- RPC: filter_products
-- =============================================
create or replace function filter_products(
  p_category text default null,
  p_brand_slugs text[] default null,
  p_material_names text[] default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_sort text default 'newest',
  p_tier text default null,
  p_audience text default null
)
returns table (
  id uuid,
  brand_id uuid,
  name text,
  slug text,
  description text,
  category text,
  price numeric,
  currency text,
  image_url text,
  additional_images text[],
  affiliate_url text,
  is_featured boolean,
  created_at timestamptz,
  brand_name text,
  brand_slug text,
  brand_website_url text,
  brand_is_fully_natural boolean,
  materials json,
  total_count bigint
)
language sql stable
as $$
  with filtered as (
    select p.id
    from products p
    join brands b on b.id = p.brand_id
    where
      (p.sync_status is null or p.sync_status = 'approved')
      and (p_category is null or p.category = p_category)
      and (p_brand_slugs is null or b.slug = any(p_brand_slugs))
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (
        p_material_names is null
        or exists (
          select 1
          from product_materials pm2
          join materials m2 on m2.id = pm2.material_id
          where pm2.product_id = p.id
            and m2.name = any(p_material_names)
        )
      )
      and (p_audience is null or p_audience = any(b.audience))
      and (
        p_tier is null
        or (p_tier = 'natural' and not exists (
          select 1 from product_materials pm3
          join materials m3 on m3.id = pm3.material_id
          where pm3.product_id = p.id and m3.is_natural = false
        ))
        or (p_tier = 'nearly' and exists (
          select 1 from product_materials pm3
          join materials m3 on m3.id = pm3.material_id
          where pm3.product_id = p.id and m3.is_natural = false
        ))
      )
  ),
  counted as (
    select count(*) as cnt from filtered
  )
  select
    pwm.id,
    pwm.brand_id,
    pwm.name,
    pwm.slug,
    pwm.description,
    pwm.category,
    pwm.price,
    pwm.currency,
    pwm.image_url,
    pwm.additional_images,
    pwm.affiliate_url,
    pwm.is_featured,
    pwm.created_at,
    pwm.brand_name,
    pwm.brand_slug,
    pwm.brand_website_url,
    pwm.brand_is_fully_natural,
    pwm.materials,
    counted.cnt as total_count
  from products_with_materials pwm
  cross join counted
  where pwm.id in (select filtered.id from filtered)
  order by
    case when p_sort = 'price-asc' then pwm.price end asc,
    case when p_sort = 'price-desc' then pwm.price end desc,
    case when p_sort = 'newest' or p_sort is null then pwm.created_at end desc
  limit p_limit
  offset p_offset;
$$;

-- =============================================
-- Row Level Security (read-only for anon)
-- =============================================
alter table brands enable row level security;
alter table products enable row level security;
alter table materials enable row level security;
alter table product_materials enable row level security;

create policy "Brands are viewable by everyone"
  on brands for select using (true);

create policy "Products are viewable by everyone"
  on products for select using (true);

create policy "Materials are viewable by everyone"
  on materials for select using (true);

create policy "Product materials are viewable by everyone"
  on product_materials for select using (true);
