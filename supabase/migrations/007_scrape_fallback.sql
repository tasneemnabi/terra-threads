ALTER TABLE brands ADD COLUMN IF NOT EXISTS scrape_fallback boolean NOT NULL DEFAULT false;
UPDATE brands SET scrape_fallback = true WHERE slug = 'nads';
