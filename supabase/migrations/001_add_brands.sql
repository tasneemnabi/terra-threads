-- Migration: Add is_fully_natural column + 25 new brands
-- Run in Supabase SQL Editor

-- 1. Add column
ALTER TABLE brands ADD COLUMN IF NOT EXISTS is_fully_natural boolean NOT NULL DEFAULT true;

-- 2. Drop logo_url (we use Logo.dev now)
ALTER TABLE brands DROP COLUMN IF EXISTS logo_url;

-- 3. Set is_fully_natural for existing brands
UPDATE brands SET is_fully_natural = true WHERE slug = 'naadam';
UPDATE brands SET is_fully_natural = false WHERE slug = 'icebreaker';
UPDATE brands SET is_fully_natural = false WHERE slug = 'prana';

-- 4. Update Icebreaker description to match curated list
UPDATE brands SET description = 'A pioneer of merino wool performance apparel, moving toward a 100% plastic-free future for its natural fiber collections.' WHERE slug = 'icebreaker';

-- 5. Insert new brands (ON CONFLICT to be safe if re-run)
INSERT INTO brands (id, name, slug, description, website_url, is_fully_natural) VALUES
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
   'https://woronstore.com', false)
ON CONFLICT (slug) DO NOTHING;
