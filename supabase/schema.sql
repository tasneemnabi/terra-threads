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
  logo_url text,
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
  created_at timestamptz default now()
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

-- =============================================
-- View: products with brand + materials
-- =============================================
create or replace view products_with_materials as
select
  p.*,
  b.name as brand_name,
  b.slug as brand_slug,
  b.logo_url as brand_logo_url,
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
group by p.id, b.name, b.slug, b.logo_url;

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
  p_offset integer default 0
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
  brand_logo_url text,
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
      (p_category is null or p.category = p_category)
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
    pwm.brand_logo_url,
    pwm.materials,
    counted.cnt as total_count
  from products_with_materials pwm
  cross join counted
  where pwm.id in (select filtered.id from filtered)
  order by pwm.created_at desc
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
