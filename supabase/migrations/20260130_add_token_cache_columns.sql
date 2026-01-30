-- Migration: Add token cache columns
ALTER TABLE controllers
  ADD COLUMN cached_token TEXT,
  ADD COLUMN token_expires_at TIMESTAMPTZ;

-- Index for finding tokens that need refresh
CREATE INDEX idx_controllers_token_expiry
  ON controllers(token_expires_at)
  WHERE cached_token IS NOT NULL;
