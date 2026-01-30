-- Schema Sync Migration
-- Adds missing columns to existing tables
-- Safe to run multiple times (uses IF NOT EXISTS patterns)

-- ============================================
-- WORKFLOWS TABLE - Add missing columns
-- ============================================

-- Add trigger_state column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'trigger_state'
  ) THEN
    ALTER TABLE workflows
    ADD COLUMN trigger_state TEXT DEFAULT 'ARMED'
    CHECK (trigger_state IN ('ARMED', 'FIRED', 'RESET'));

    COMMENT ON COLUMN workflows.trigger_state IS 'State of trigger-based workflows: ARMED (ready), FIRED (triggered), RESET (cooldown)';
  END IF;
END $$;

-- Add last_executed column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'last_executed'
  ) THEN
    ALTER TABLE workflows ADD COLUMN last_executed TIMESTAMPTZ;
  END IF;
END $$;

-- Add last_error column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'last_error'
  ) THEN
    ALTER TABLE workflows ADD COLUMN last_error TEXT;
  END IF;
END $$;

-- Add run_count column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'run_count'
  ) THEN
    ALTER TABLE workflows ADD COLUMN run_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add dry_run_enabled column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'dry_run_enabled'
  ) THEN
    ALTER TABLE workflows ADD COLUMN dry_run_enabled BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add growth_stage column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'growth_stage'
  ) THEN
    ALTER TABLE workflows ADD COLUMN growth_stage TEXT;
  END IF;
END $$;

-- Create index for last_executed if not exists
CREATE INDEX IF NOT EXISTS idx_workflows_last_executed ON workflows(last_executed DESC);

-- Create index for active armed workflows if not exists
CREATE INDEX IF NOT EXISTS idx_workflows_active_armed ON workflows(is_active, trigger_state) WHERE is_active = true;

-- ============================================
-- SENSOR_READINGS TABLE - Verify structure
-- ============================================

-- Ensure sensor_readings has correct structure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sensor_readings' AND column_name = 'is_stale'
  ) THEN
    ALTER TABLE sensor_readings ADD COLUMN is_stale BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Ensure port column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sensor_readings' AND column_name = 'port'
  ) THEN
    ALTER TABLE sensor_readings ADD COLUMN port INTEGER;
  END IF;
END $$;

-- ============================================
-- CONTROLLERS TABLE - Ensure all columns exist
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'controllers' AND column_name = 'firmware_version'
  ) THEN
    ALTER TABLE controllers ADD COLUMN firmware_version TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'controllers' AND column_name = 'model'
  ) THEN
    ALTER TABLE controllers ADD COLUMN model TEXT;
  END IF;
END $$;

-- ============================================
-- RLS POLICIES - Ensure they exist
-- ============================================

-- sensor_readings INSERT policy for service role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sensor_readings'
    AND policyname = 'Service role can insert sensor_readings'
  ) THEN
    CREATE POLICY "Service role can insert sensor_readings"
      ON sensor_readings FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- sensor_readings SELECT policy via controller ownership
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sensor_readings'
    AND policyname = 'Users can view own sensor_readings via controller'
  ) THEN
    CREATE POLICY "Users can view own sensor_readings via controller"
      ON sensor_readings FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM controllers
          WHERE controllers.id = sensor_readings.controller_id
          AND controllers.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Run this to verify the schema is correct:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'workflows'
-- ORDER BY ordinal_position;

-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'sensor_readings'
-- ORDER BY ordinal_position;
