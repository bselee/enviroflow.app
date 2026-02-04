-- Migration: Add standalone sensors table for sensor-only devices
-- Allows sensors to exist independently of controllers (Inkbird probes, Govee sensors, manual entry)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create sensors table
-- ============================================
CREATE TABLE IF NOT EXISTS sensors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sensor_type TEXT NOT NULL CHECK (sensor_type IN (
    'temperature', 'humidity', 'vpd', 'co2', 'light', 'ph', 'ec',
    'pressure', 'soil_moisture', 'wind_speed', 'pm25', 'water_level',
    'uv', 'solar_radiation', 'rain'
  )),
  source_type TEXT NOT NULL CHECK (source_type IN ('cloud_api', 'manual', 'controller')),
  brand TEXT,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE SET NULL,
  controller_port INTEGER,
  unit TEXT NOT NULL DEFAULT '',
  current_value DECIMAL(10, 4),
  last_reading_at TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT true,
  connection_config JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  show_on_dashboard BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT sensors_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT sensors_controller_link CHECK (
    (source_type = 'controller' AND controller_id IS NOT NULL)
    OR source_type != 'controller'
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sensors_user_id ON sensors(user_id);
CREATE INDEX IF NOT EXISTS idx_sensors_room_id ON sensors(room_id) WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sensors_source_type ON sensors(user_id, source_type);
CREATE INDEX IF NOT EXISTS idx_sensors_controller_id ON sensors(controller_id) WHERE controller_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sensors_dashboard ON sensors(user_id, show_on_dashboard) WHERE show_on_dashboard = true;

-- Updated timestamp trigger (reuse existing function if available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE TRIGGER tr_sensors_updated_at
      BEFORE UPDATE ON sensors
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- 2. RLS for sensors table
-- ============================================
ALTER TABLE sensors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sensors"
  ON sensors FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sensors"
  ON sensors FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sensors"
  ON sensors FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sensors"
  ON sensors FOR DELETE USING (auth.uid() = user_id);

-- 3. Add sensor_id to sensor_readings, make controller_id nullable
-- ============================================
DO $$
BEGIN
  -- Add sensor_id column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sensor_readings' AND column_name = 'sensor_id'
  ) THEN
    ALTER TABLE sensor_readings ADD COLUMN sensor_id UUID REFERENCES sensors(id) ON DELETE SET NULL;
    CREATE INDEX idx_sensor_readings_sensor_id ON sensor_readings(sensor_id, recorded_at DESC)
      WHERE sensor_id IS NOT NULL;
  END IF;

  -- Make controller_id nullable (was NOT NULL)
  ALTER TABLE sensor_readings ALTER COLUMN controller_id DROP NOT NULL;
END
$$;

-- Add CHECK constraint: at least one of controller_id or sensor_id must be set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sensor_readings_has_source'
  ) THEN
    ALTER TABLE sensor_readings ADD CONSTRAINT sensor_readings_has_source
      CHECK (controller_id IS NOT NULL OR sensor_id IS NOT NULL);
  END IF;
END
$$;

-- 4. RLS policy for sensor_readings accessed via standalone sensor ownership
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sensor_readings' AND policyname = 'Users can view sensor_readings via sensor'
  ) THEN
    CREATE POLICY "Users can view sensor_readings via sensor"
      ON sensor_readings FOR SELECT
      USING (
        sensor_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM sensors
          WHERE sensors.id = sensor_readings.sensor_id
          AND sensors.user_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- 5. Realtime for sensors table - DISABLED
-- Per project architecture (CLAUDE.md): sensor data should NOT use Supabase
-- Realtime subscriptions. Live sensor data uses Direct API Polling instead.
-- ============================================
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_publication_tables
--     WHERE pubname = 'supabase_realtime' AND tablename = 'sensors'
--   ) THEN
--     ALTER PUBLICATION supabase_realtime ADD TABLE sensors;
--   END IF;
-- END
-- $$;

COMMENT ON TABLE sensors IS 'Standalone sensors that exist independently of controllers. Used for sensor-only devices (Inkbird probes, Govee sensors) and manual data entry.';
COMMENT ON COLUMN sensors.source_type IS 'cloud_api = polled from brand cloud API, manual = user-submitted readings, controller = linked to existing controller';
COMMENT ON COLUMN sensors.connection_config IS 'Source-specific config. cloud_api: {email, password(encrypted), deviceId, apiEndpoint}. manual: {}. controller: {}';
COMMENT ON COLUMN sensors.show_on_dashboard IS 'Whether to include this sensor in dashboard live sensor display';
