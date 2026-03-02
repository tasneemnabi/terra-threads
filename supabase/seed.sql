-- =============================================
-- Seed Data — Natural Fiber Activewear
-- Run AFTER schema.sql in Supabase SQL Editor
-- =============================================

-- Brands
insert into brands (id, name, slug, description, website_url, is_fully_natural) values
  ('b1000000-0000-0000-0000-000000000001', 'Naadam', 'naadam',
   'Sustainable cashmere and natural fiber basics. Ethically sourced from Mongolian herders.',
   'https://naadam.co', true),

  ('b1000000-0000-0000-0000-000000000002', 'Icebreaker', 'icebreaker',
   'A pioneer of merino wool performance apparel, moving toward a 100% plastic-free future for its natural fiber collections.',
   'https://icebreaker.com', false),

  ('b1000000-0000-0000-0000-000000000003', 'prAna', 'prana',
   'Yoga and outdoor apparel made with organic cotton, hemp, and recycled materials.',
   'https://www.prana.com', false),

  ('b1000000-0000-0000-0000-000000000004', 'Allwear Organic Clothing', 'allwear',
   'Creates non-toxic, premium essentials using organic cotton, bamboo, and Tencel, designed for comfort and health.',
   'https://allwear.com', false),

  ('b1000000-0000-0000-0000-000000000005', 'Aya', 'aya',
   'A Peruvian brand that aims for a plastic-free reality by using regenerative organic Pima cotton and alpaca wool.',
   'https://ecoaya.com', true),

  ('b1000000-0000-0000-0000-000000000006', 'Beaumont Organic', 'beaumont-organic',
   'An ethical fashion brand specializing in luxury casual pieces made from organic cotton and other sustainable fabrics.',
   'https://beaumontorganic.com', false),

  ('b1000000-0000-0000-0000-000000000007', 'Everlane', 'everlane',
   'Known for Radical Transparency, Everlane partners with ethical factories to create high-quality, modern essentials.',
   'https://everlane.com', false),

  ('b1000000-0000-0000-0000-000000000008', 'Fair Indigo', 'fair-indigo',
   'Specializes in exceptionally soft, fair trade, organic Peruvian Pima cotton basics.',
   'https://fairindigo.com', false),

  ('b1000000-0000-0000-0000-000000000009', 'Harvest & Mill', 'harvest-and-mill',
   'Produces organic cotton clothing that is grown, milled, and sewn exclusively in the USA, featuring non-toxic, dye-free heirloom cotton.',
   'https://harvestandmill.com', true),

  ('b1000000-0000-0000-0000-000000000010', 'Indigo Luna', 'indigo-luna',
   'An ethically made, small-batch yoga and swimwear brand focusing on organic and recycled materials.',
   'https://indigoluna.store', false),

  ('b1000000-0000-0000-0000-000000000011', 'Industry of All Nations', 'industry-of-all-nations',
   'Reimagines production by developing goods where raw materials originate, using natural dyes and organic fibers.',
   'https://industryofallnations.com', true),

  ('b1000000-0000-0000-0000-000000000012', 'Jungmaven', 'jungmaven',
   'On a mission to raise awareness about the benefits of hemp, creating high-quality hemp and organic cotton clothing.',
   'https://jungmaven.com', true),

  ('b1000000-0000-0000-0000-000000000013', 'Kotn', 'kotn',
   'Crafts high-quality basics from Egyptian cotton and other natural fibers, focusing on traceability and supporting farming communities.',
   'https://kotn.com', true),

  ('b1000000-0000-0000-0000-000000000014', 'Kowtow', 'kowtow',
   'A New Zealand-based label producing 100% Fairtrade organic cotton garments with a focus on circularity and plastic-free trims.',
   'https://kowtowclothing.com', true),

  ('b1000000-0000-0000-0000-000000000015', 'Losano', 'losano',
   'Focuses on non-toxic activewear and essentials using materials like organic cotton and recycled polyester.',
   'https://losano.com', false),

  ('b1000000-0000-0000-0000-000000000016', 'Magic Linen', 'magic-linen',
   'A family-owned business providing high-quality linen home textiles and clothing, handmade in Lithuania.',
   'https://magiclinen.com', true),

  ('b1000000-0000-0000-0000-000000000017', 'Maggie''s Organics', 'maggies-organics',
   'A pioneer in fair trade and organic textiles, producing durable socks and apparel with a transparent supply chain.',
   'https://maggiesorganics.com', false),

  ('b1000000-0000-0000-0000-000000000018', 'MATE the Label', 'mate-the-label',
   'A women-founded brand providing clean essentials made with non-toxic, natural, and organic materials in Los Angeles.',
   'https://matethelabel.com', false),

  ('b1000000-0000-0000-0000-000000000019', 'Nads', 'nads',
   'Specializes in 100% organic cotton men''s underwear designed for breathability and health without toxic synthetics.',
   'https://nadsunder.com', true),

  ('b1000000-0000-0000-0000-000000000020', 'Pact', 'pact',
   'Offers carbon-neutral, organic cotton clothing and home goods produced in Fair Trade Certified factories.',
   'https://wearpact.com', false),

  ('b1000000-0000-0000-0000-000000000021', 'PlainandSimple', 'plainandsimple',
   'A UK-based brand focusing on high-quality everyday essentials made from 100% GOTS-certified organic cotton with zero plastic.',
   'https://plainandsimple.com', true),

  ('b1000000-0000-0000-0000-000000000022', 'Pyne & Smith', 'pyne-and-smith',
   'Designs and makes timeless, functional dresses from high-quality European flax linen.',
   'https://pyneandsmith.com', true),

  ('b1000000-0000-0000-0000-000000000023', 'Quince', 'quince',
   'Offers high-quality luxury items at accessible prices by shipping directly from factories, using materials like silk and organic cotton.',
   'https://quince.com', false),

  ('b1000000-0000-0000-0000-000000000024', 'Rawganique', 'rawganique',
   'Offers 100% organic cotton, linen, hemp, and merino clothing for a plastic-free lifestyle, focusing on chemical-free and biodegradable products.',
   'https://rawganique.com', true),

  ('b1000000-0000-0000-0000-000000000025', 'Ryker', 'ryker',
   'An activewear brand dedicated to eliminating plastic by using 100% natural fibers like merino wool and organic cotton.',
   'https://rykerclothingco.com', true),

  ('b1000000-0000-0000-0000-000000000026', 'Toby Tiger', 'toby-tiger',
   'The UK''s leading organic childrenswear company, known for its colorful, GOTS-certified cotton baby and kids'' clothes.',
   'https://tobytiger.co.uk', true),

  ('b1000000-0000-0000-0000-000000000027', 'Vivid Linen', 'vivid-linen',
   'Designs sophisticated, high-quality apparel made from 100% pure linen and natural fiber blends.',
   'https://vividlinen.com', true),

  ('b1000000-0000-0000-0000-000000000028', 'WORON', 'woron',
   'A vegan brand based in Copenhagen that creates sustainable lingerie and everyday essentials with a focus on fit and comfort.',
   'https://woronstore.com', false);

-- Materials
insert into materials (id, name, description, is_natural) values
  ('a1000000-0000-0000-0000-000000000001', 'Merino Wool',
   'Fine, breathable wool from Merino sheep. Naturally temperature-regulating and odor-resistant.', true),
  ('a1000000-0000-0000-0000-000000000002', 'Organic Cotton',
   'Cotton grown without synthetic pesticides or fertilizers.', true),
  ('a1000000-0000-0000-0000-000000000003', 'Cashmere',
   'Ultra-soft fiber from cashmere goats. Lightweight yet incredibly warm.', true),
  ('a1000000-0000-0000-0000-000000000004', 'Hemp',
   'Durable, breathable plant fiber that requires minimal water to grow.', true),
  ('a1000000-0000-0000-0000-000000000005', 'Tencel Lyocell',
   'Fiber made from sustainably harvested wood pulp. Silky smooth and biodegradable.', true),
  ('a1000000-0000-0000-0000-000000000006', 'Silk',
   'Natural protein fiber with a smooth feel and natural temperature regulation.', true),
  ('a1000000-0000-0000-0000-000000000007', 'Elastane',
   'Synthetic stretch fiber for flexibility in activewear.', false);

-- Products
-- Naadam
insert into products (id, brand_id, name, slug, description, category, price, image_url, affiliate_url, is_featured) values
  ('c1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000001',
   'Cashmere Crewneck Sweater',
   'naadam-cashmere-crewneck',
   'Lightweight cashmere crewneck perfect for layering over workout gear or wearing to the studio. Grade-A Mongolian cashmere with a relaxed fit.',
   'activewear', 98.00,
   '/products/naadam-cashmere-crewneck.jpg',
   'https://naadam.co/products/cashmere-crewneck', true),

  ('c1000000-0000-0000-0000-000000000002',
   'b1000000-0000-0000-0000-000000000001',
   'Cotton Cashmere Jogger',
   'naadam-cotton-cashmere-jogger',
   'Soft cotton-cashmere blend jogger with tapered leg and elastic waistband. From studio to street.',
   'activewear', 125.00,
   '/products/naadam-jogger.jpg',
   'https://naadam.co/products/cotton-cashmere-jogger', false),

  ('c1000000-0000-0000-0000-000000000003',
   'b1000000-0000-0000-0000-000000000001',
   'Cashmere Hoodie',
   'naadam-cashmere-hoodie',
   'Cozy cashmere hoodie with kangaroo pocket. The ultimate post-workout layer.',
   'activewear', 175.00,
   '/products/naadam-hoodie.jpg',
   'https://naadam.co/products/cashmere-hoodie', true);

-- Icebreaker
insert into products (id, brand_id, name, slug, description, category, price, image_url, affiliate_url, is_featured) values
  ('c1000000-0000-0000-0000-000000000004',
   'b1000000-0000-0000-0000-000000000002',
   'Merino 200 Oasis Long Sleeve',
   'icebreaker-merino-200-oasis',
   'Versatile merino base layer with flatlock seams. Naturally odor-resistant for multi-day wear.',
   'activewear', 100.00,
   '/products/icebreaker-oasis.jpg',
   'https://www.icebreaker.com/en-us/womens-baselayers/merino-200-oasis', true),

  ('c1000000-0000-0000-0000-000000000005',
   'b1000000-0000-0000-0000-000000000002',
   'Merino Sphere Tank',
   'icebreaker-sphere-tank',
   'Lightweight merino wool tank with Cool-Lite technology. Perfect for high-intensity workouts.',
   'activewear', 75.00,
   '/products/icebreaker-sphere-tank.jpg',
   'https://www.icebreaker.com/en-us/womens-t-shirts/sphere-tank', false),

  ('c1000000-0000-0000-0000-000000000006',
   'b1000000-0000-0000-0000-000000000002',
   'Merino Fastray High Rise Tight',
   'icebreaker-fastray-tight',
   'Performance leggings in merino-blend fabric with four-way stretch. High rise for yoga and running.',
   'activewear', 140.00,
   '/products/icebreaker-fastray.jpg',
   'https://www.icebreaker.com/en-us/womens-pants/fastray-high-rise-tight', true),

  ('c1000000-0000-0000-0000-000000000007',
   'b1000000-0000-0000-0000-000000000002',
   'Merino 260 Tech Leggings',
   'icebreaker-260-tech-leggings',
   'Heavyweight merino base layer leggings for cold-weather training. Soft brushed interior.',
   'activewear', 120.00,
   '/products/icebreaker-260-tech.jpg',
   'https://www.icebreaker.com/en-us/womens-baselayers/260-tech-leggings', false);

-- prAna
insert into products (id, brand_id, name, slug, description, category, price, image_url, affiliate_url, is_featured) values
  ('c1000000-0000-0000-0000-000000000008',
   'b1000000-0000-0000-0000-000000000003',
   'Organic Cotton Stretch Tank',
   'prana-organic-stretch-tank',
   'Classic yoga tank in organic cotton with a hint of stretch. Fair Trade Certified.',
   'activewear', 45.00,
   '/products/prana-stretch-tank.jpg',
   'https://www.prana.com/organic-stretch-tank', false),

  ('c1000000-0000-0000-0000-000000000009',
   'b1000000-0000-0000-0000-000000000003',
   'Hemp Bra Top',
   'prana-hemp-bra-top',
   'Supportive bra top in a hemp-organic cotton blend. Light support for yoga and barre.',
   'activewear', 55.00,
   '/products/prana-hemp-bra.jpg',
   'https://www.prana.com/hemp-bra-top', true),

  ('c1000000-0000-0000-0000-000000000010',
   'b1000000-0000-0000-0000-000000000003',
   'Tencel Flowy Pant',
   'prana-tencel-flowy-pant',
   'Wide-leg yoga pant in silky Tencel Lyocell. Breathable and drapes beautifully.',
   'activewear', 89.00,
   '/products/prana-tencel-pant.jpg',
   'https://www.prana.com/tencel-flowy-pant', false);

-- Product–Material mappings
-- Naadam Cashmere Crewneck: 100% cashmere
insert into product_materials (product_id, material_id, percentage) values
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 100);

-- Naadam Cotton Cashmere Jogger: 70% organic cotton, 30% cashmere
insert into product_materials (product_id, material_id, percentage) values
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 70),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003', 30);

-- Naadam Cashmere Hoodie: 100% cashmere
insert into product_materials (product_id, material_id, percentage) values
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 100);

-- Icebreaker Merino 200 Oasis: 100% merino wool
insert into product_materials (product_id, material_id, percentage) values
  ('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 100);

-- Icebreaker Sphere Tank: 83% merino, 12% tencel, 5% elastane
insert into product_materials (product_id, material_id, percentage) values
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 83),
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 12),
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000007', 5);

-- Icebreaker Fastray Tight: 83% merino, 12% tencel lyocell, 5% elastane
insert into product_materials (product_id, material_id, percentage) values
  ('c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 83),
  ('c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000005', 12),
  ('c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000007', 5);

-- Icebreaker 260 Tech Leggings: 100% merino wool
insert into product_materials (product_id, material_id, percentage) values
  ('c1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 100);

-- prAna Organic Stretch Tank: 93% organic cotton, 7% elastane
insert into product_materials (product_id, material_id, percentage) values
  ('c1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 93),
  ('c1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000007', 7);

-- prAna Hemp Bra Top: 55% hemp, 40% organic cotton, 5% elastane
insert into product_materials (product_id, material_id, percentage) values
  ('c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000004', 55),
  ('c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002', 40),
  ('c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000007', 5);

-- prAna Tencel Flowy Pant: 95% tencel lyocell, 5% elastane
insert into product_materials (product_id, material_id, percentage) values
  ('c1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000005', 95),
  ('c1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000007', 5);
