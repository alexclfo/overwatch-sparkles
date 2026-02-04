-- Track presigned upload URLs to clean up orphaned files
CREATE TABLE IF NOT EXISTS pending_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  r2_key TEXT NOT NULL UNIQUE,
  submitter_steamid64 TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_pending_uploads_expires_at ON pending_uploads(expires_at);

-- RLS
ALTER TABLE pending_uploads ENABLE ROW LEVEL SECURITY;

-- Only service role can access
CREATE POLICY "Service role only" ON pending_uploads
  FOR ALL USING (auth.role() = 'service_role');
