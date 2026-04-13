-- Item 7: Tighten RLS on products table
-- Only approved products visible via anon key; explicit deny-all for writes

-- 1. Replace the overly-permissive SELECT policy with approved-only
drop policy if exists "Products are viewable by everyone" on products;

create policy "Products are viewable by everyone"
  on products for select
  using (sync_status = 'approved');

-- 2. Explicit deny-all write policies on products (belt-and-suspenders)
create policy "No public inserts" on products for insert with check (false);
create policy "No public updates" on products for update using (false);
create policy "No public deletes" on products for delete using (false);

-- 3. Same for product_materials
create policy "No public inserts" on product_materials for insert with check (false);
create policy "No public updates" on product_materials for update using (false);
create policy "No public deletes" on product_materials for delete using (false);
