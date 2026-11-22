-- Reviews can come from a paid order (customer) or from an editorial draft the
-- owner writes/generates from the book itself. Existing rows stay 'customer'.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'customer';
