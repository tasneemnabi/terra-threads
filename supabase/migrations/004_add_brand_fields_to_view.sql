-- Add brand_website_url and brand_is_fully_natural to products_with_materials view
drop view if exists products_with_materials cascade;

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
