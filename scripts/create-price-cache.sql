-- Create item price cache table for consistent inventory pricing
CREATE TABLE IF NOT EXISTS item_price_cache (
  market_hash_name TEXT PRIMARY KEY,
  price_cents INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_cache_updated ON item_price_cache(updated_at);
