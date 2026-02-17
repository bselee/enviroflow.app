-- Migration: Atomic workflow action dedupe locks
-- Purpose: prevent duplicate device commands from concurrent cron invocations

CREATE TABLE IF NOT EXISTS workflow_action_locks (
  lock_key TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_action_locks_expires_at
  ON workflow_action_locks(expires_at);

-- Acquire lock if key is new OR existing lock has expired.
-- Returns true when caller acquires the lock, false otherwise.
CREATE OR REPLACE FUNCTION acquire_workflow_action_lock(
  p_lock_key TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  acquired BOOLEAN := FALSE;
BEGIN
  INSERT INTO workflow_action_locks (lock_key, expires_at, updated_at)
  VALUES (p_lock_key, p_expires_at, NOW())
  ON CONFLICT (lock_key)
  DO UPDATE SET
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW()
  WHERE workflow_action_locks.expires_at <= NOW();

  GET DIAGNOSTICS acquired = ROW_COUNT;
  RETURN acquired;
END;
$$;

GRANT EXECUTE ON FUNCTION acquire_workflow_action_lock(TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION acquire_workflow_action_lock(TEXT, TIMESTAMPTZ) TO service_role;

-- Optional cleanup helper to prevent unbounded growth
CREATE OR REPLACE FUNCTION cleanup_workflow_action_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM workflow_action_locks
  WHERE expires_at <= NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_workflow_action_locks() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_workflow_action_locks() TO service_role;
