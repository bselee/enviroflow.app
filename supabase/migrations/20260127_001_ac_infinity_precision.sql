-- ============================================
-- AC Infinity Scientific-Precision Control System
-- Migration: 20260127_001_ac_infinity_precision.sql
--
-- Adds tables for:
-- - Per-port device states (controller_ports)
-- - Automation mode configurations (controller_modes)
-- - Command audit trail (command_history)
-- - Raw API response capture (api_captures)
-- ============================================

-- Enable required extensions

-- ============================================
-- CONTROLLER PORTS TABLE
-- Per-port device states captured during polling
-- ============================================
CREATE TABLE IF NOT EXISTS controller_ports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  port_number INTEGER NOT NULL CHECK (port_number >= 1 AND port_number <= 8),
  port_name TEXT,
  device_type TEXT CHECK (device_type IN ('fan', 'light', 'heater', 'cooler', 'humidifier', 'dehumidifier', 'outlet', 'pump', 'valve', 'sensor')),
  load_type INTEGER, -- Raw AC Infinity: 0=fan, 128=light, etc.
  is_connected BOOLEAN DEFAULT false,
  is_on BOOLEAN DEFAULT false,
  power_level INTEGER DEFAULT 0 CHECK (power_level >= 0 AND power_level <= 10),
  current_mode INTEGER DEFAULT 0, -- 0=OFF, 1=ON, 2=AUTO, 3=TIMER, 4=CYCLE, 5=SCHEDULE, 6=VPD
  supports_dimming BOOLEAN DEFAULT false,
  is_online BOOLEAN DEFAULT true,
  port_type INTEGER, -- Raw AC Infinity port type code
  dev_type INTEGER, -- Raw AC Infinity device type code
  external_port INTEGER, -- Physical port mapping
  is_supported BOOLEAN DEFAULT true,
  surplus INTEGER, -- Current level/value from API
  speak INTEGER, -- Fan speed from API (0-10)
  last_state_change TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT controller_ports_unique UNIQUE(controller_id, port_number)
);

-- Indexes for controller_ports
CREATE INDEX IF NOT EXISTS idx_controller_ports_controller ON controller_ports(controller_id);
CREATE INDEX IF NOT EXISTS idx_controller_ports_device_type ON controller_ports(device_type);
CREATE INDEX IF NOT EXISTS idx_controller_ports_is_on ON controller_ports(is_on) WHERE is_on = true;

-- RLS for controller_ports
ALTER TABLE controller_ports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own controller_ports via controller"
  ON controller_ports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = controller_ports.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage controller_ports"
  ON controller_ports FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER tr_controller_ports_updated_at
  BEFORE UPDATE ON controller_ports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CONTROLLER MODES TABLE
-- Automation mode configurations per port
-- ============================================
CREATE TABLE IF NOT EXISTS controller_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  port_number INTEGER NOT NULL CHECK (port_number >= 0 AND port_number <= 8),
  mode_id INTEGER NOT NULL CHECK (mode_id >= 0 AND mode_id <= 6),
  mode_name TEXT, -- OFF, ON, AUTO, TIMER, CYCLE, SCHEDULE, VPD
  is_active BOOLEAN DEFAULT false,

  -- Temperature triggers (stored in Fahrenheit)
  temp_trigger_high DECIMAL(5, 2),
  temp_trigger_low DECIMAL(5, 2),

  -- Humidity triggers (percentage)
  humidity_trigger_high DECIMAL(5, 2),
  humidity_trigger_low DECIMAL(5, 2),

  -- VPD triggers (kPa)
  vpd_trigger_high DECIMAL(4, 3),
  vpd_trigger_low DECIMAL(4, 3),

  -- Device behavior settings
  device_behavior TEXT CHECK (device_behavior IN ('cooling', 'heating', 'humidify', 'dehumidify')),

  -- Level settings
  max_level INTEGER CHECK (max_level >= 0 AND max_level <= 10),
  min_level INTEGER CHECK (min_level >= 0 AND min_level <= 10),

  -- Transition settings
  transition_enabled BOOLEAN DEFAULT false,
  transition_speed INTEGER,

  -- Buffer settings
  buffer_enabled BOOLEAN DEFAULT false,
  buffer_value DECIMAL(5, 2),

  -- Timer mode settings
  timer_type TEXT CHECK (timer_type IN ('on', 'off')),
  timer_duration INTEGER, -- seconds

  -- Cycle mode settings
  cycle_on_duration INTEGER, -- seconds
  cycle_off_duration INTEGER, -- seconds

  -- Schedule mode settings
  schedule_start_time TIME,
  schedule_end_time TIME,
  schedule_days INTEGER, -- bitmask (bit 0 = Sunday)

  -- Leaf temperature offset for VPD
  leaf_temp_offset DECIMAL(4, 2),

  -- Raw settings from API (for audit)
  raw_settings JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT controller_modes_unique UNIQUE(controller_id, port_number, mode_id)
);

-- Indexes for controller_modes
CREATE INDEX IF NOT EXISTS idx_controller_modes_controller ON controller_modes(controller_id);
CREATE INDEX IF NOT EXISTS idx_controller_modes_active ON controller_modes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_controller_modes_port ON controller_modes(controller_id, port_number);

-- RLS for controller_modes
ALTER TABLE controller_modes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own controller_modes via controller"
  ON controller_modes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = controller_modes.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage controller_modes"
  ON controller_modes FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER tr_controller_modes_updated_at
  BEFORE UPDATE ON controller_modes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMAND HISTORY TABLE
-- Full command audit trail with before/after states
-- ============================================
CREATE TABLE IF NOT EXISTS command_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id TEXT UNIQUE NOT NULL, -- UUID generated by client
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  port INTEGER NOT NULL,
  command_type TEXT NOT NULL CHECK (command_type IN ('turn_on', 'turn_off', 'set_level', 'set_mode', 'toggle', 'increase', 'decrease')),
  target_value INTEGER, -- Target level (0-10 or 0-100)

  -- State snapshots
  state_before JSONB NOT NULL, -- { port, level, isOn, mode, capturedAt }
  state_after JSONB, -- Same structure, captured after command

  -- Execution results
  success BOOLEAN DEFAULT false,
  error_message TEXT,

  -- Verification results
  verification_passed BOOLEAN,
  verification_attempts INTEGER DEFAULT 0,

  -- Rollback tracking
  rollback_attempted BOOLEAN DEFAULT false,
  rollback_success BOOLEAN,

  -- Timing metrics
  execution_duration_ms INTEGER,
  verification_duration_ms INTEGER,
  total_duration_ms INTEGER,
  api_call_count INTEGER DEFAULT 1,

  -- Context
  source TEXT CHECK (source IN ('user', 'workflow', 'schedule', 'api')) DEFAULT 'user',
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,

  executed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Indexes for command_history
CREATE INDEX IF NOT EXISTS idx_command_history_controller ON command_history(controller_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_history_user ON command_history(user_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_history_success ON command_history(success);
CREATE INDEX IF NOT EXISTS idx_command_history_executed ON command_history(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_history_verification ON command_history(verification_passed);

-- RLS for command_history
ALTER TABLE command_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own command_history via controller"
  ON command_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = command_history.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage command_history"
  ON command_history FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- API CAPTURES TABLE
-- Raw API response audit (7-day retention)
-- ============================================
CREATE TABLE IF NOT EXISTS api_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  response_hash TEXT, -- SHA256 hash of response for dedup

  -- Raw data from API
  raw_sensor_data JSONB, -- Full sensor data from API
  raw_port_data JSONB, -- Full port data from API
  raw_mode_data JSONB, -- Full mode settings from API

  -- Parsed summary
  sensor_count INTEGER DEFAULT 0,
  port_count INTEGER DEFAULT 0,
  mode_count INTEGER DEFAULT 0,

  -- Performance metrics
  latency_ms INTEGER,
  response_size_bytes INTEGER,

  -- Success tracking
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  captured_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for api_captures
CREATE INDEX IF NOT EXISTS idx_api_captures_controller ON api_captures(controller_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_captures_captured ON api_captures(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_captures_hash ON api_captures(response_hash);

-- RLS for api_captures
ALTER TABLE api_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api_captures via controller"
  ON api_captures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = api_captures.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage api_captures"
  ON api_captures FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- DATA RETENTION CLEANUP FUNCTIONS
-- ============================================

-- Cleanup old API captures (7-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_api_captures()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM api_captures WHERE captured_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old command history (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_command_history()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM command_history WHERE executed_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANTS
-- ============================================

GRANT ALL ON controller_ports TO service_role;
GRANT ALL ON controller_modes TO service_role;
GRANT ALL ON command_history TO service_role;
GRANT ALL ON api_captures TO service_role;

GRANT SELECT ON controller_ports TO authenticated;
GRANT SELECT ON controller_modes TO authenticated;
GRANT SELECT ON command_history TO authenticated;
GRANT SELECT ON api_captures TO authenticated;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'AC Infinity Precision Control tables created successfully';
  RAISE NOTICE '- controller_ports: Per-port device states';
  RAISE NOTICE '- controller_modes: Automation configurations';
  RAISE NOTICE '- command_history: Full command audit trail';
  RAISE NOTICE '- api_captures: Raw API response audit (7-day retention)';
END $$;
