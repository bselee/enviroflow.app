-- ============================================
-- Migration: Fix sensor_readings column name (timestamp → recorded_at)
-- Date: 2026-01-23
-- Migration Number: 20260123_002
-- Purpose: Rename 'timestamp' to 'recorded_at' to match application schema
--
-- Problem: Production database has 'timestamp' column but code expects 'recorded_at'
-- Error: "Could not find the 'recorded_at' column of 'sensor_readings' in the schema cache"
--
-- This migration handles three scenarios:
-- 1. Column is named 'timestamp' → rename to 'recorded_at'
-- 2. Both columns exist → drop 'timestamp', keep 'recorded_at'
-- 3. Only 'recorded_at' exists → no-op (already correct)
-- ============================================

-- ============================================
-- STEP 1: Detect and rename column
-- ============================================

DO $$
DECLARE
  has_timestamp BOOLEAN;
  has_recorded_at BOOLEAN;
BEGIN
  -- Check if 'timestamp' column exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sensor_readings'
      AND column_name = 'timestamp'
  ) INTO has_timestamp;

  -- Check if 'recorded_at' column exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sensor_readings'
      AND column_name = 'recorded_at'
  ) INTO has_recorded_at;

  -- Scenario 1: Only timestamp exists (expected production state)
  IF has_timestamp AND NOT has_recorded_at THEN
    RAISE NOTICE 'Renaming column: timestamp → recorded_at';
    ALTER TABLE sensor_readings RENAME COLUMN timestamp TO recorded_at;
    RAISE NOTICE 'Column renamed successfully';

  -- Scenario 2: Both columns exist (migration interrupted previously?)
  ELSIF has_timestamp AND has_recorded_at THEN
    RAISE WARNING 'Both timestamp and recorded_at columns exist. Dropping timestamp column.';
    ALTER TABLE sensor_readings DROP COLUMN timestamp;
    RAISE NOTICE 'Duplicate timestamp column dropped';

  -- Scenario 3: Only recorded_at exists (already correct)
  ELSIF has_recorded_at AND NOT has_timestamp THEN
    RAISE NOTICE 'Column already named recorded_at. No action needed.';

  -- Scenario 4: Neither column exists (table structure issue)
  ELSE
    RAISE EXCEPTION 'sensor_readings table missing both timestamp and recorded_at columns. Manual intervention required.';
  END IF;
END $$;

-- ============================================
-- STEP 2: Verify column properties match target schema
-- ============================================

-- Ensure recorded_at has correct type and constraints
DO $$
BEGIN
  -- Set default value if not already set
  ALTER TABLE sensor_readings
    ALTER COLUMN recorded_at SET DEFAULT NOW();

  -- Ensure NOT NULL constraint
  ALTER TABLE sensor_readings
    ALTER COLUMN recorded_at SET NOT NULL;

  RAISE NOTICE 'Column constraints verified: recorded_at NOT NULL DEFAULT NOW()';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not set constraints on recorded_at: %', SQLERRM;
END $$;

-- ============================================
-- STEP 3: Update indexes to use recorded_at
-- ============================================

-- Drop old indexes that reference 'timestamp' (if they exist)
DROP INDEX IF EXISTS idx_sensor_readings_controller_timestamp;
DROP INDEX IF EXISTS idx_sensor_readings_controller_type_timestamp;
DROP INDEX IF EXISTS idx_sensor_readings_timestamp;

-- Create/recreate indexes using 'recorded_at' (IF NOT EXISTS for safety)
CREATE INDEX IF NOT EXISTS idx_sensor_readings_controller_recorded
  ON sensor_readings(controller_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_controller_type
  ON sensor_readings(controller_id, sensor_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded
  ON sensor_readings(recorded_at DESC);

-- ============================================
-- STEP 4: Verification
-- ============================================

DO $$
DECLARE
  column_info RECORD;
  index_count INTEGER;
BEGIN
  -- Verify column exists with correct properties
  SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
  INTO column_info
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'sensor_readings'
    AND column_name = 'recorded_at';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: recorded_at column not found after migration';
  END IF;

  RAISE NOTICE 'Column verification: recorded_at (type: %, nullable: %, default: %)',
    column_info.data_type,
    column_info.is_nullable,
    column_info.column_default;

  -- Verify indexes exist
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'sensor_readings'
    AND indexname LIKE '%recorded%';

  RAISE NOTICE 'Indexes verified: % indexes using recorded_at column', index_count;

  IF index_count < 3 THEN
    RAISE WARNING 'Expected 3 indexes on recorded_at, found %', index_count;
  END IF;
END $$;

-- ============================================
-- STEP 5: Final status report
-- ============================================

SELECT
  'sensor_readings column migration completed successfully!' AS status,
  NOW() AS completed_at,
  (SELECT COUNT(*) FROM sensor_readings) AS total_readings,
  (SELECT COUNT(*) FROM sensor_readings WHERE recorded_at > NOW() - INTERVAL '24 hours') AS readings_last_24h;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
--
-- Next steps:
-- 1. Verify in Supabase dashboard that column is now 'recorded_at'
-- 2. Test sensor reading queries in application
-- 3. Monitor for any RLS policy issues
-- 4. Regenerate TypeScript types:
--    supabase gen types typescript --local > types/supabase.ts
-- ============================================
