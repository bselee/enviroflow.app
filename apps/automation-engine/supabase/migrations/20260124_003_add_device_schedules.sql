-- ============================================
-- Device Schedules Migration
-- Migration: 20260124_add_device_schedules.sql
-- Adds support for time-based device scheduling
-- ============================================

-- ============================================
-- DEVICE SCHEDULES TABLE
-- Time-based automation for device control
-- Supports daily/weekly schedules, sunrise/sunset, and cron expressions
-- ============================================
CREATE TABLE IF NOT EXISTS device_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,

  -- Schedule metadata
  name TEXT NOT NULL,
  description TEXT,
  device_port INTEGER NOT NULL,

  -- Trigger configuration
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('time', 'sunrise', 'sunset', 'cron')),

  -- Schedule definition (JSONB for flexibility)
  schedule JSONB NOT NULL DEFAULT '{}',
  -- Example structure:
  -- {
  --   "days": [0,1,2,3,4,5,6],       // 0=Sunday, 6=Saturday
  --   "start_time": "08:00",          // HH:MM format
  --   "end_time": "20:00",            // Optional, for duration-based schedules
  --   "action": "on",                 // "on", "off", "set_level"
  --   "level": 75,                    // 0-100 for dimming, optional
  --   "cron": "0 8 * * *",            // Cron expression if trigger_type is 'cron'
  --   "offset_minutes": 30            // Offset from sunrise/sunset if applicable
  -- }

  -- Control
  is_active BOOLEAN DEFAULT true,

  -- Execution tracking
  last_executed TIMESTAMPTZ,
  next_execution TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  last_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT device_schedules_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT device_schedules_port_positive CHECK (device_port > 0)
);

-- Indexes for performance
CREATE INDEX idx_device_schedules_user ON device_schedules(user_id);
CREATE INDEX idx_device_schedules_controller ON device_schedules(controller_id);
CREATE INDEX idx_device_schedules_room ON device_schedules(room_id);
CREATE INDEX idx_device_schedules_active ON device_schedules(is_active) WHERE is_active = true;
CREATE INDEX idx_device_schedules_next_execution ON device_schedules(next_execution) WHERE is_active = true;
CREATE INDEX idx_device_schedules_trigger_type ON device_schedules(trigger_type);

-- RLS Policies
ALTER TABLE device_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device_schedules via controller"
  ON device_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = device_schedules.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own device_schedules"
  ON device_schedules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = device_schedules.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own device_schedules"
  ON device_schedules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = device_schedules.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own device_schedules"
  ON device_schedules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = device_schedules.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER tr_device_schedules_updated_at
  BEFORE UPDATE ON device_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTION: Calculate next execution time
-- ============================================
CREATE OR REPLACE FUNCTION calculate_next_execution(
  schedule_id UUID
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  schedule_record RECORD;
  next_time TIMESTAMPTZ;
  schedule_data JSONB;
  start_time TEXT;
  current_day INTEGER;
  schedule_days INTEGER[];
  next_day INTEGER;
  days_until_next INTEGER;
BEGIN
  -- Get schedule record
  SELECT * INTO schedule_record
  FROM device_schedules
  WHERE id = schedule_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  schedule_data := schedule_record.schedule;

  -- Handle different trigger types
  CASE schedule_record.trigger_type
    WHEN 'time' THEN
      -- Time-based schedule
      start_time := schedule_data->>'start_time';
      schedule_days := ARRAY(SELECT jsonb_array_elements_text(schedule_data->'days')::INTEGER);
      current_day := EXTRACT(DOW FROM NOW());

      -- Find next matching day
      next_day := NULL;
      FOR i IN 0..6 LOOP
        IF ((current_day + i) % 7) = ANY(schedule_days) THEN
          next_day := (current_day + i) % 7;
          days_until_next := i;
          EXIT;
        END IF;
      END LOOP;

      IF next_day IS NULL THEN
        RETURN NULL;
      END IF;

      -- Calculate next execution time
      next_time := (CURRENT_DATE + days_until_next * INTERVAL '1 day' + start_time::TIME)::TIMESTAMPTZ;

      -- If time has passed today and it's today's schedule, move to next week
      IF days_until_next = 0 AND next_time < NOW() THEN
        next_time := next_time + INTERVAL '7 days';
      END IF;

      RETURN next_time;

    WHEN 'cron' THEN
      -- For cron expressions, we'd need a cron parser
      -- For now, return NULL and handle in application code
      RETURN NULL;

    WHEN 'sunrise', 'sunset' THEN
      -- For sunrise/sunset, we need room location data
      -- Return NULL and handle in application code with sunrise/sunset API
      RETURN NULL;

    ELSE
      RETURN NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE device_schedules;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT ALL ON device_schedules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON device_schedules TO authenticated;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'device_schedules'
  ) THEN
    RAISE NOTICE 'Device schedules table created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create device_schedules table';
  END IF;
END $$;
