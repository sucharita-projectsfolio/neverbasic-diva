-- Per-ebook switch for the free sample. Default 1 keeps every existing book
-- exactly as it is today; the owner can turn one off from Admin → Ebooks.
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS sample_enabled INTEGER DEFAULT 1;
