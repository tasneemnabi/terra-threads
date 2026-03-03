-- =============================================
-- Migration: Add brand-level metadata columns
-- audience, fiber_types, categories
-- =============================================

ALTER TABLE brands ADD COLUMN audience text[] DEFAULT '{}';
ALTER TABLE brands ADD COLUMN fiber_types text[] DEFAULT '{}';
ALTER TABLE brands ADD COLUMN categories text[] DEFAULT '{}';

-- Backfill all 28 brands

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Cashmere,Organic Cotton}',
  categories = '{Basics,Knitwear}'
WHERE slug = 'naadam';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Merino Wool,Tencel Lyocell}',
  categories = '{Activewear,Basics}'
WHERE slug = 'icebreaker';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Organic Cotton,Hemp,Tencel Lyocell}',
  categories = '{Activewear,Yoga}'
WHERE slug = 'prana';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Organic Cotton,Tencel Lyocell}',
  categories = '{Basics}'
WHERE slug = 'allwear';

UPDATE brands SET
  audience = '{Women}',
  fiber_types = '{Organic Cotton,Alpaca}',
  categories = '{Basics,Knitwear}'
WHERE slug = 'aya';

UPDATE brands SET
  audience = '{Women}',
  fiber_types = '{Organic Cotton,Linen}',
  categories = '{Dresses,Tops}'
WHERE slug = 'beaumont-organic';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Organic Cotton,Cashmere,Linen}',
  categories = '{Basics,Denim,Knitwear}'
WHERE slug = 'everlane';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Organic Cotton}',
  categories = '{Basics,Tops}'
WHERE slug = 'fair-indigo';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Organic Cotton}',
  categories = '{Basics,Underwear}'
WHERE slug = 'harvest-and-mill';

UPDATE brands SET
  audience = '{Women}',
  fiber_types = '{Organic Cotton}',
  categories = '{Activewear,Swimwear}'
WHERE slug = 'indigo-luna';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Organic Cotton,Linen}',
  categories = '{Basics}'
WHERE slug = 'industry-of-all-nations';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Hemp,Organic Cotton}',
  categories = '{Basics}'
WHERE slug = 'jungmaven';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Organic Cotton}',
  categories = '{Basics,Underwear}'
WHERE slug = 'kotn';

UPDATE brands SET
  audience = '{Women}',
  fiber_types = '{Organic Cotton}',
  categories = '{Basics,Dresses}'
WHERE slug = 'kowtow';

UPDATE brands SET
  audience = '{Women}',
  fiber_types = '{Organic Cotton}',
  categories = '{Activewear,Basics}'
WHERE slug = 'losano';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Linen}',
  categories = '{Dresses,Basics}'
WHERE slug = 'magic-linen';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Organic Cotton,Wool}',
  categories = '{Socks,Basics}'
WHERE slug = 'maggies-organics';

UPDATE brands SET
  audience = '{Women}',
  fiber_types = '{Organic Cotton,Tencel Lyocell}',
  categories = '{Basics,Underwear}'
WHERE slug = 'mate-the-label';

UPDATE brands SET
  audience = '{Men}',
  fiber_types = '{Organic Cotton}',
  categories = '{Underwear}'
WHERE slug = 'nads';

UPDATE brands SET
  audience = '{Women,Men,Kids}',
  fiber_types = '{Organic Cotton}',
  categories = '{Basics,Underwear}'
WHERE slug = 'pact';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Organic Cotton}',
  categories = '{Basics}'
WHERE slug = 'plainandsimple';

UPDATE brands SET
  audience = '{Women}',
  fiber_types = '{Linen}',
  categories = '{Dresses}'
WHERE slug = 'pyne-and-smith';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Organic Cotton,Silk,Cashmere,Linen}',
  categories = '{Basics,Knitwear}'
WHERE slug = 'quince';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Organic Cotton,Linen,Hemp,Merino Wool}',
  categories = '{Basics,Activewear}'
WHERE slug = 'rawganique';

UPDATE brands SET
  audience = '{Women,Men}',
  fiber_types = '{Merino Wool,Organic Cotton}',
  categories = '{Activewear}'
WHERE slug = 'ryker';

UPDATE brands SET
  audience = '{Kids}',
  fiber_types = '{Organic Cotton}',
  categories = '{Kids}'
WHERE slug = 'toby-tiger';

UPDATE brands SET
  audience = '{Women}',
  fiber_types = '{Linen}',
  categories = '{Dresses,Tops}'
WHERE slug = 'vivid-linen';

UPDATE brands SET
  audience = '{Women}',
  fiber_types = '{Tencel Lyocell,Organic Cotton}',
  categories = '{Underwear,Loungewear}'
WHERE slug = 'woron';
