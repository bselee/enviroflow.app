-- ============================================================
-- EnviroFlow Consolidated Migration Script
-- Generated: 2026-01-30
--
-- Run this script in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
--
-- This script is IDEMPOTENT - safe to run multiple times
-- ============================================================

-- ============================================================
-- MIGRATION 1: AC Infinity Precision Control (20260127)
-- ============================================================

-- CONTROLLER PORTS TABLE
CREATE TABLE IF NOT EXISTS controller_ports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  port_number INTEGER NOT NULL CHECK (port_number >= 1 AND port_number <= 8),
  port_name TEXT,
  device_type TEXT CHECK (device_type IN ('fan', 'light', 'heater', 'cooler', 'humidifier', 'dehumidifier', 'outlet', 'pump', 'valve', 'sensor')),
  load_type INTEGER,
  is_connected BOOLEAN DEFAULT false,
  is_on BOOLEAN DEFAULT false,
  power_level INTEGER DEFAULT 0 CHECK (power_level >= 0 AND power_level <= 10),
  current_mode INTEGER DEFAULT 0,
  supports_dimming BOOLEAN DEFAULT false,
  is_online BOOLEAN DEFAULT true,
  port_type INTEGER,
  dev_type INTEGER,
  external_port INTEGER,
  is_supported BOOLEAN DEFAULT true,
  surplus INTEGER,
  speak INTEGER,
  last_state_change TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT controller_ports_unique UNIQUE(controller_id, port_number)
);

CREATE INDEX IF NOT EXISTS idx_controller_ports_controller ON controller_ports(controller_id);
CREATE INDEX IF NOT EXISTS idx_controller_ports_device_type ON controller_ports(device_type);
CREATE INDEX IF NOT EXISTS idx_controller_ports_is_on ON controller_ports(is_on) WHERE is_on = true;

ALTER TABLE controller_ports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'controller_ports' AND policyname = 'Users can view own controller_ports via controller') THEN
    CREATE POLICY "Users can view own controller_ports via controller"
      ON controller_ports FOR SELECT
      USING (EXISTS (SELECT 1 FROM controllers WHERE controllers.id = controller_ports.controller_id AND controllers.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'controller_ports' AND policyname = 'Service role can manage controller_ports') THEN
    CREATE POLICY "Service role can manage controller_ports"
      ON controller_ports FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- CONTROLLER MODES TABLE
CREATE TABLE IF NOT EXISTS controller_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  port_number INTEGER NOT NULL CHECK (port_number >= 0 AND port_number <= 8),
  mode_id INTEGER NOT NULL CHECK (mode_id >= 0 AND mode_id <= 6),
  mode_name TEXT,
  is_active BOOLEAN DEFAULT false,
  temp_trigger_high DECIMAL(5, 2),
  temp_trigger_low DECIMAL(5, 2),
  humidity_trigger_high DECIMAL(5, 2),
  humidity_trigger_low DECIMAL(5, 2),
  vpd_trigger_high DECIMAL(4, 3),
  vpd_trigger_low DECIMAL(4, 3),
  device_behavior TEXT CHECK (device_behavior IN ('cooling', 'heating', 'humidify', 'dehumidify')),
  max_level INTEGER CHECK (max_level >= 0 AND max_level <= 10),
  min_level INTEGER CHECK (min_level >= 0 AND min_level <= 10),
  transition_enabled BOOLEAN DEFAULT false,
  transition_speed INTEGER,
  buffer_enabled BOOLEAN DEFAULT false,
  buffer_value DECIMAL(5, 2),
  timer_type TEXT CHECK (timer_type IN ('on', 'off')),
  timer_duration INTEGER,
  cycle_on_duration INTEGER,
  cycle_off_duration INTEGER,
  schedule_start_time TIME,
  schedule_end_time TIME,
  schedule_days INTEGER,
  leaf_temp_offset DECIMAL(4, 2),
  raw_settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT controller_modes_unique UNIQUE(controller_id, port_number, mode_id)
);

CREATE INDEX IF NOT EXISTS idx_controller_modes_controller ON controller_modes(controller_id);
CREATE INDEX IF NOT EXISTS idx_controller_modes_active ON controller_modes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_controller_modes_port ON controller_modes(controller_id, port_number);

ALTER TABLE controller_modes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'controller_modes' AND policyname = 'Users can view own controller_modes via controller') THEN
    CREATE POLICY "Users can view own controller_modes via controller"
      ON controller_modes FOR SELECT
      USING (EXISTS (SELECT 1 FROM controllers WHERE controllers.id = controller_modes.controller_id AND controllers.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'controller_modes' AND policyname = 'Service role can manage controller_modes') THEN
    CREATE POLICY "Service role can manage controller_modes"
      ON controller_modes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- COMMAND HISTORY TABLE
CREATE TABLE IF NOT EXISTS command_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id TEXT UNIQUE NOT NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  port INTEGER NOT NULL,
  command_type TEXT NOT NULL CHECK (command_type IN ('turn_on', 'turn_off', 'set_level', 'set_mode', 'toggle', 'increase', 'decrease')),
  target_value INTEGER,
  state_before JSONB NOT NULL,
  state_after JSONB,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  verification_passed BOOLEAN,
  verification_attempts INTEGER DEFAULT 0,
  rollback_attempted BOOLEAN DEFAULT false,
  rollback_success BOOLEAN,
  execution_duration_ms INTEGER,
  verification_duration_ms INTEGER,
  total_duration_ms INTEGER,
  api_call_count INTEGER DEFAULT 1,
  source TEXT CHECK (source IN ('user', 'workflow', 'schedule', 'api')) DEFAULT 'user',
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_command_history_controller ON command_history(controller_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_history_user ON command_history(user_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_history_success ON command_history(success);
CREATE INDEX IF NOT EXISTS idx_command_history_executed ON command_history(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_history_verification ON command_history(verification_passed);

ALTER TABLE command_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'command_history' AND policyname = 'Users can view own command_history via controller') THEN
    CREATE POLICY "Users can view own command_history via controller"
      ON command_history FOR SELECT
      USING (EXISTS (SELECT 1 FROM controllers WHERE controllers.id = command_history.controller_id AND controllers.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'command_history' AND policyname = 'Service role can manage command_history') THEN
    CREATE POLICY "Service role can manage command_history"
      ON command_history FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- API CAPTURES TABLE
CREATE TABLE IF NOT EXISTS api_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  response_hash TEXT,
  raw_sensor_data JSONB,
  raw_port_data JSONB,
  raw_mode_data JSONB,
  sensor_count INTEGER DEFAULT 0,
  port_count INTEGER DEFAULT 0,
  mode_count INTEGER DEFAULT 0,
  latency_ms INTEGER,
  response_size_bytes INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_captures_controller ON api_captures(controller_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_captures_captured ON api_captures(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_captures_hash ON api_captures(response_hash);

ALTER TABLE api_captures ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_captures' AND policyname = 'Users can view own api_captures via controller') THEN
    CREATE POLICY "Users can view own api_captures via controller"
      ON api_captures FOR SELECT
      USING (EXISTS (SELECT 1 FROM controllers WHERE controllers.id = api_captures.controller_id AND controllers.user_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_captures' AND policyname = 'Service role can manage api_captures') THEN
    CREATE POLICY "Service role can manage api_captures"
      ON api_captures FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Data retention cleanup functions
CREATE OR REPLACE FUNCTION cleanup_old_api_captures()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM api_captures WHERE captured_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_old_command_history()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM command_history WHERE executed_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants for precision tables
GRANT ALL ON controller_ports TO service_role;
GRANT ALL ON controller_modes TO service_role;
GRANT ALL ON command_history TO service_role;
GRANT ALL ON api_captures TO service_role;
GRANT SELECT ON controller_ports TO authenticated;
GRANT SELECT ON controller_modes TO authenticated;
GRANT SELECT ON command_history TO authenticated;
GRANT SELECT ON api_captures TO authenticated;

-- ============================================================
-- MIGRATION 2: Sensor Calibrations (20260128)
-- ============================================================

CREATE TABLE IF NOT EXISTS sensor_calibrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  sensor_type TEXT NOT NULL,
  port INTEGER DEFAULT 0,
  offset_correction DECIMAL(10, 4) DEFAULT 0,
  scale_correction DECIMAL(6, 4) DEFAULT 1.0,
  reference_instrument TEXT,
  reference_reading DECIMAL(10, 4),
  raw_reading_at_calibration DECIMAL(10, 4),
  calibrated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  calibrated_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sensor_calibrations_unique UNIQUE(controller_id, sensor_type, port)
);

CREATE INDEX IF NOT EXISTS idx_sensor_calibrations_active ON sensor_calibrations(controller_id, sensor_type, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sensor_calibrations_controller ON sensor_calibrations(controller_id);

ALTER TABLE sensor_calibrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sensor_calibrations' AND policyname = 'Users can manage own calibrations') THEN
    CREATE POLICY "Users can manage own calibrations" ON sensor_calibrations
      FOR ALL USING (controller_id IN (SELECT id FROM controllers WHERE user_id = auth.uid()));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sensor_calibration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_id UUID REFERENCES sensor_calibrations(id) ON DELETE SET NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  sensor_type TEXT NOT NULL,
  port INTEGER DEFAULT 0,
  offset_correction DECIMAL(10, 4),
  scale_correction DECIMAL(6, 4),
  reference_instrument TEXT,
  reference_reading DECIMAL(10, 4),
  raw_reading_at_calibration DECIMAL(10, 4),
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deactivated', 'expired')),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_calibration_history_controller ON sensor_calibration_history(controller_id, sensor_type);
CREATE INDEX IF NOT EXISTS idx_calibration_history_calibration ON sensor_calibration_history(calibration_id);

ALTER TABLE sensor_calibration_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sensor_calibration_history' AND policyname = 'Users can view own calibration history') THEN
    CREATE POLICY "Users can view own calibration history" ON sensor_calibration_history
      FOR SELECT USING (controller_id IN (SELECT id FROM controllers WHERE user_id = auth.uid()));
  END IF;
END $$;

-- Calibration functions
CREATE OR REPLACE FUNCTION apply_calibration(
  p_value DECIMAL, p_controller_id UUID, p_sensor_type TEXT, p_port INTEGER DEFAULT 0
) RETURNS DECIMAL AS $$
DECLARE v_calibration RECORD; v_corrected DECIMAL;
BEGIN
  SELECT offset_correction, scale_correction, expires_at INTO v_calibration
  FROM sensor_calibrations
  WHERE controller_id = p_controller_id AND sensor_type = p_sensor_type
    AND COALESCE(port, 0) = COALESCE(p_port, 0) AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1;
  IF NOT FOUND THEN RETURN p_value; END IF;
  v_corrected := p_value * v_calibration.scale_correction + v_calibration.offset_correction;
  RETURN v_corrected;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION upsert_calibration(
  p_controller_id UUID, p_sensor_type TEXT,
  p_reference_reading DECIMAL, p_raw_reading DECIMAL,
  p_port INTEGER DEFAULT 0, p_reference_instrument TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL, p_notes TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS UUID AS $$
DECLARE v_calibration_id UUID; v_offset DECIMAL; v_scale DECIMAL; v_existing RECORD;
BEGIN
  v_offset := p_reference_reading - p_raw_reading; v_scale := 1.0;
  SELECT id, offset_correction, scale_correction INTO v_existing
  FROM sensor_calibrations WHERE controller_id = p_controller_id
    AND sensor_type = p_sensor_type AND COALESCE(port, 0) = COALESCE(p_port, 0);
  IF FOUND THEN
    UPDATE sensor_calibrations SET offset_correction = v_offset, scale_correction = v_scale,
      reference_instrument = p_reference_instrument, reference_reading = p_reference_reading,
      raw_reading_at_calibration = p_raw_reading, calibrated_at = NOW(), expires_at = p_expires_at,
      is_active = true, calibrated_by = p_user_id, notes = p_notes
    WHERE id = v_existing.id RETURNING id INTO v_calibration_id;
    INSERT INTO sensor_calibration_history (calibration_id, controller_id, sensor_type, port,
      offset_correction, scale_correction, reference_instrument, reference_reading,
      raw_reading_at_calibration, action, changed_by, reason)
    VALUES (v_calibration_id, p_controller_id, p_sensor_type, p_port, v_offset, v_scale,
      p_reference_instrument, p_reference_reading, p_raw_reading, 'updated', p_user_id, 'Calibration updated');
  ELSE
    INSERT INTO sensor_calibrations (controller_id, sensor_type, port, offset_correction, scale_correction,
      reference_instrument, reference_reading, raw_reading_at_calibration, expires_at, calibrated_by, notes)
    VALUES (p_controller_id, p_sensor_type, p_port, v_offset, v_scale, p_reference_instrument,
      p_reference_reading, p_raw_reading, p_expires_at, p_user_id, p_notes)
    RETURNING id INTO v_calibration_id;
    INSERT INTO sensor_calibration_history (calibration_id, controller_id, sensor_type, port,
      offset_correction, scale_correction, reference_instrument, reference_reading,
      raw_reading_at_calibration, action, changed_by, reason)
    VALUES (v_calibration_id, p_controller_id, p_sensor_type, p_port, v_offset, v_scale,
      p_reference_instrument, p_reference_reading, p_raw_reading, 'created', p_user_id, 'Initial calibration');
  END IF;
  RETURN v_calibration_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION deactivate_calibration(
  p_calibration_id UUID, p_reason TEXT DEFAULT 'Manual deactivation', p_user_id UUID DEFAULT auth.uid()
) RETURNS BOOLEAN AS $$
DECLARE v_calibration RECORD;
BEGIN
  SELECT * INTO v_calibration FROM sensor_calibrations WHERE id = p_calibration_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE sensor_calibrations SET is_active = false WHERE id = p_calibration_id;
  INSERT INTO sensor_calibration_history (calibration_id, controller_id, sensor_type, port,
    offset_correction, scale_correction, reference_instrument, reference_reading,
    raw_reading_at_calibration, action, changed_by, reason)
  VALUES (p_calibration_id, v_calibration.controller_id, v_calibration.sensor_type, v_calibration.port,
    v_calibration.offset_correction, v_calibration.scale_correction, v_calibration.reference_instrument,
    v_calibration.reference_reading, v_calibration.raw_reading_at_calibration,
    'deactivated', p_user_id, p_reason);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

GRANT SELECT, INSERT, UPDATE, DELETE ON sensor_calibrations TO authenticated;
GRANT SELECT ON sensor_calibration_history TO authenticated;
GRANT EXECUTE ON FUNCTION apply_calibration TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_calibration TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_calibration TO authenticated;

-- ============================================================
-- MIGRATION 3 & 4: Schema Sync (20260129)
-- ============================================================

-- Workflows table columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'trigger_state') THEN
    ALTER TABLE workflows ADD COLUMN trigger_state TEXT DEFAULT 'ARMED' CHECK (trigger_state IN ('ARMED', 'FIRED', 'RESET'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'last_executed') THEN
    ALTER TABLE workflows ADD COLUMN last_executed TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'last_error') THEN
    ALTER TABLE workflows ADD COLUMN last_error TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'run_count') THEN
    ALTER TABLE workflows ADD COLUMN run_count INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'dry_run_enabled') THEN
    ALTER TABLE workflows ADD COLUMN dry_run_enabled BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'growth_stage') THEN
    ALTER TABLE workflows ADD COLUMN growth_stage TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workflows_last_executed ON workflows(last_executed DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_active_armed ON workflows(is_active, trigger_state) WHERE is_active = true;

-- Sensor readings columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'is_stale') THEN
    ALTER TABLE sensor_readings ADD COLUMN is_stale BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'port') THEN
    ALTER TABLE sensor_readings ADD COLUMN port INTEGER;
  END IF;
END $$;

-- Controllers table columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controllers' AND column_name = 'firmware_version') THEN
    ALTER TABLE controllers ADD COLUMN firmware_version TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controllers' AND column_name = 'model') THEN
    ALTER TABLE controllers ADD COLUMN model TEXT;
  END IF;
END $$;

-- RLS for sensor_readings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sensor_readings' AND policyname = 'Service role can insert sensor_readings') THEN
    CREATE POLICY "Service role can insert sensor_readings" ON sensor_readings FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sensor_readings' AND policyname = 'Users can view own sensor_readings via controller') THEN
    CREATE POLICY "Users can view own sensor_readings via controller" ON sensor_readings FOR SELECT
      USING (EXISTS (SELECT 1 FROM controllers WHERE controllers.id = sensor_readings.controller_id AND controllers.user_id = auth.uid()));
  END IF;
END $$;

-- ============================================================
-- MIGRATION 5: Token Cache Columns (20260130)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controllers' AND column_name = 'cached_token') THEN
    ALTER TABLE controllers ADD COLUMN cached_token TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controllers' AND column_name = 'token_expires_at') THEN
    ALTER TABLE controllers ADD COLUMN token_expires_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_controllers_token_expiry ON controllers(token_expires_at) WHERE cached_token IS NOT NULL;

-- ============================================================
-- VERIFICATION
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'EnviroFlow Migration Complete!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created/updated:';
  RAISE NOTICE '  - controller_ports';
  RAISE NOTICE '  - controller_modes';
  RAISE NOTICE '  - command_history';
  RAISE NOTICE '  - api_captures';
  RAISE NOTICE '  - sensor_calibrations';
  RAISE NOTICE '  - sensor_calibration_history';
  RAISE NOTICE '';
  RAISE NOTICE 'Columns added to controllers:';
  RAISE NOTICE '  - cached_token';
  RAISE NOTICE '  - token_expires_at';
  RAISE NOTICE '  - firmware_version';
  RAISE NOTICE '  - model';
  RAISE NOTICE '';
  RAISE NOTICE 'Columns added to workflows:';
  RAISE NOTICE '  - trigger_state';
  RAISE NOTICE '  - last_executed';
  RAISE NOTICE '  - last_error';
  RAISE NOTICE '  - run_count';
  RAISE NOTICE '  - dry_run_enabled';
  RAISE NOTICE '  - growth_stage';
  RAISE NOTICE '';
  RAISE NOTICE 'All RLS policies applied';
  RAISE NOTICE '============================================';
END $$;
