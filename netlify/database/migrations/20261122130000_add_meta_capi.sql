-- Meta Conversions API: remember when the server-side Purchase was sent so a
-- retry or a page reload cannot send the same purchase twice. The browser pixel
-- uses the same event id ("purchase-<ref>"), so Meta deduplicates anyway.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS meta_capi_at TEXT DEFAULT '';
