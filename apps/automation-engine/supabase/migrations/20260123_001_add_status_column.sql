-- ============================================
-- Migration: Add status column to controllers table
-- Date: 2026-01-23
-- Purpose: Replace is_online boolean with status enum for better state tracking
-- ============================================

-- Step 1: Add the new status column with a default value
ALTER TABLE controllers
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline'
CHECK (status IN ('online', 'offline', 'error', 'initializing'));

-- Step 2: Migrate existing data from is_online to status
-- If is_online is true, set status to 'online', otherwise 'offline'
UPDATE controllers
SET status = CASE
  WHEN is_online = true THEN 'online'
  ELSE 'offline'
END
WHERE status = 'offline'; -- Only update rows that still have the default value

-- Step 3: Drop the old is_online column
ALTER TABLE controllers
DROP COLUMN IF EXISTS is_online;

-- Step 4: Update the index that referenced is_online
-- Drop the old index
DROP INDEX IF EXISTS idx_controllers_user_online;

-- Create new index on status
CREATE INDEX IF NOT EXISTS idx_controllers_user_status ON controllers(user_id, status);

-- Step 5: Create index for performance on online controllers
CREATE INDEX IF NOT EXISTS idx_controllers_last_seen
ON controllers(last_seen DESC)
WHERE status = 'online';

-- Step 6: Verify the migration
-- This will return a count of controllers by status
DO $$
DECLARE
  online_count INTEGER;
  offline_count INTEGER;
  error_count INTEGER;
  init_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO online_count FROM controllers WHERE status = 'online';
  SELECT COUNT(*) INTO offline_count FROM controllers WHERE status = 'offline';
  SELECT COUNT(*) INTO error_count FROM controllers WHERE status = 'error';
  SELECT COUNT(*) INTO init_count FROM controllers WHERE status = 'initializing';

  RAISE NOTICE 'Migration complete: % online, % offline, % error, % initializing',
    online_count, offline_count, error_count, init_count;
END $$;
