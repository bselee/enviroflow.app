-- ============================================
-- EnviroFlow Complete Database Schema
-- Migration: 20260121_complete_schema.sql
-- Production-ready schema with complete RLS policies
-- ============================================
--
-- IMPORTANT: This migration is designed to be run on a fresh database.
-- If you have existing tables, they will be dropped and recreated.
-- All data will be lost. Use with caution in production.
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
-- ============================================

-- ============================================
-- STEP 1: DROP EXISTING OBJECTS
-- Order matters due to dependencies
-- ============================================

-- Remove from realtime publication first (ignore errors if not exists)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS controllers;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS rooms;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS workflows;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS activity_logs;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS sensor_readings;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS ai_insights;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Realtime publication cleanup completed (some tables may not exist)';
END $$;

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS ai_insights CASCADE;
DROP TABLE IF EXISTS workflow_templates CASCADE;
DROP TABLE IF EXISTS growth_stages CASCADE;
DROP TABLE IF EXISTS push_tokens CASCADE;
DROP TABLE IF EXISTS dimmer_schedules CASCADE;
DROP TABLE IF EXISTS sunrise_sunset_cache CASCADE;
DROP TABLE IF EXISTS manual_sensor_data CASCADE;
DROP TABLE IF EXISTS sensor_readings CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;
DROP TABLE IF EXISTS controllers CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_activity_logs() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_sensor_readings() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_manual_sensor_data() CASCADE;

-- ============================================
-- STEP 2: CREATE EXTENSION DEPENDENCIES
-- (These are typically pre-enabled in Supabase)
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- STEP 3: CREATE REUSABLE FUNCTIONS
-- ============================================

-- Trigger function for updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 4: CREATE ALL TABLES
-- ============================================

-- ============================================
-- ROOMS TABLE
-- Logical grouping of controllers (e.g., Veg Room, Flower Room)
-- ============================================
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  current_stage TEXT,
  stage_started_at TIMESTAMPTZ,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT rooms_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- Indexes for performance
CREATE INDEX idx_rooms_user_id ON rooms(user_id);
CREATE INDEX idx_rooms_user_created ON rooms(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rooms"
  ON rooms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rooms"
  ON rooms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rooms"
  ON rooms FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own rooms"
  ON rooms FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER tr_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CONTROLLERS TABLE
-- Hardware controllers (AC Infinity, Inkbird, CSV uploads, etc.)
-- SECURITY NOTE: credentials column stores encrypted API keys/passwords
-- ============================================
CREATE TABLE controllers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand TEXT NOT NULL CHECK (brand IN ('ac_infinity', 'inkbird', 'govee', 'csv_upload', 'mqtt', 'custom')),
  name TEXT NOT NULL,
  -- IMPORTANT: credentials should be encrypted before storage
  -- Use pgcrypto functions: pgp_sym_encrypt(data, key) / pgp_sym_decrypt(data, key)
  credentials JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error', 'initializing')),
  last_seen TIMESTAMPTZ,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  controller_id TEXT, -- External brand-specific controller ID
  model TEXT,
  firmware_version TEXT,
  capabilities JSONB DEFAULT '{}',
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT controllers_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT controllers_unique_user_controller UNIQUE(user_id, controller_id)
);

-- Indexes for performance
CREATE INDEX idx_controllers_user_id ON controllers(user_id);
CREATE INDEX idx_controllers_user_status ON controllers(user_id, status);
CREATE INDEX idx_controllers_brand ON controllers(brand);
CREATE INDEX idx_controllers_room_id ON controllers(room_id);
CREATE INDEX idx_controllers_last_seen ON controllers(last_seen DESC) WHERE status = 'online';

-- RLS Policies
ALTER TABLE controllers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own controllers"
  ON controllers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own controllers"
  ON controllers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own controllers"
  ON controllers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own controllers"
  ON controllers FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER tr_controllers_updated_at
  BEFORE UPDATE ON controllers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- WORKFLOWS TABLE
-- Automation workflow definitions with React Flow nodes/edges
-- ============================================
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT false,
  trigger_state TEXT DEFAULT 'ARMED' CHECK (trigger_state IN ('ARMED', 'FIRED', 'RESET')),
  last_executed TIMESTAMPTZ,
  last_error TEXT,
  run_count INTEGER DEFAULT 0,
  dry_run_enabled BOOLEAN DEFAULT false,
  growth_stage TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT workflows_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- Indexes for performance
CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_user_active ON workflows(user_id, is_active);
CREATE INDEX idx_workflows_active_armed ON workflows(is_active, trigger_state) WHERE is_active = true;
CREATE INDEX idx_workflows_room_id ON workflows(room_id);
CREATE INDEX idx_workflows_last_executed ON workflows(last_executed DESC);

-- RLS Policies
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workflows"
  ON workflows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workflows"
  ON workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflows"
  ON workflows FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workflows"
  ON workflows FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER tr_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DIMMER SCHEDULES TABLE
-- Sunrise/sunset lighting schedules for gradual dimming
-- ============================================
CREATE TABLE dimmer_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  port INTEGER NOT NULL,
  sunrise_time TIME,
  sunset_time TIME,
  min_level INTEGER DEFAULT 0 CHECK (min_level >= 0 AND min_level <= 100),
  max_level INTEGER DEFAULT 100 CHECK (max_level >= 0 AND max_level <= 100),
  schedule_type TEXT DEFAULT 'sunrise' CHECK (schedule_type IN ('sunrise', 'sunset', 'custom', 'dli_curve')),
  duration_minutes INTEGER DEFAULT 30,
  curve TEXT DEFAULT 'sigmoid' CHECK (curve IN ('linear', 'sigmoid', 'exponential', 'logarithmic')),
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT dimmer_min_max_valid CHECK (min_level <= max_level)
);

-- Indexes for performance
CREATE INDEX idx_dimmer_schedules_controller ON dimmer_schedules(controller_id);
CREATE INDEX idx_dimmer_schedules_workflow ON dimmer_schedules(workflow_id);
CREATE INDEX idx_dimmer_schedules_active ON dimmer_schedules(is_active) WHERE is_active = true;
CREATE INDEX idx_dimmer_schedules_room ON dimmer_schedules(room_id);

-- RLS Policies
ALTER TABLE dimmer_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dimmer_schedules via controller"
  ON dimmer_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = dimmer_schedules.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own dimmer_schedules"
  ON dimmer_schedules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = dimmer_schedules.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own dimmer_schedules"
  ON dimmer_schedules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = dimmer_schedules.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own dimmer_schedules"
  ON dimmer_schedules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = dimmer_schedules.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER tr_dimmer_schedules_updated_at
  BEFORE UPDATE ON dimmer_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ACTIVITY LOGS TABLE
-- Execution history for workflows and actions
-- RETENTION: 90 days (cleaned by cleanup_old_activity_logs function)
-- ============================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  result TEXT CHECK (result IN ('success', 'failed', 'skipped', 'dry_run')),
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT activity_logs_action_type_not_empty CHECK (LENGTH(TRIM(action_type)) > 0)
);

-- Indexes for performance (critical for 90-day retention queries)
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_workflow ON activity_logs(workflow_id, created_at DESC);
CREATE INDEX idx_activity_logs_room ON activity_logs(room_id, created_at DESC);
CREATE INDEX idx_activity_logs_controller ON activity_logs(controller_id, created_at DESC);
CREATE INDEX idx_activity_logs_user_type ON activity_logs(user_id, action_type, created_at DESC);

-- RLS Policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity_logs"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert activity_logs"
  ON activity_logs FOR INSERT
  WITH CHECK (true); -- Cron jobs use service_role to bypass RLS

-- ============================================
-- SENSOR READINGS TABLE
-- Cached sensor data from controllers
-- RETENTION: 30 days (cleaned by cleanup_old_sensor_readings function)
-- ============================================
CREATE TABLE sensor_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  sensor_type TEXT NOT NULL CHECK (sensor_type IN ('temperature', 'humidity', 'vpd', 'co2', 'light', 'ph', 'ec', 'pressure', 'water_level')),
  value DECIMAL(10, 4) NOT NULL,
  unit TEXT NOT NULL,
  port INTEGER,
  is_stale BOOLEAN DEFAULT false,
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT sensor_readings_unit_not_empty CHECK (LENGTH(TRIM(unit)) > 0)
);

-- Indexes for performance (critical for 30-day retention and chart queries)
CREATE INDEX idx_sensor_readings_controller_recorded ON sensor_readings(controller_id, recorded_at DESC);
CREATE INDEX idx_sensor_readings_controller_type ON sensor_readings(controller_id, sensor_type, recorded_at DESC);
CREATE INDEX idx_sensor_readings_recorded ON sensor_readings(recorded_at DESC);

-- RLS Policies
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sensor_readings via controller"
  ON sensor_readings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = sensor_readings.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert sensor_readings"
  ON sensor_readings FOR INSERT
  WITH CHECK (true); -- Cron jobs use service_role to bypass RLS

-- ============================================
-- AI INSIGHTS TABLE
-- Grok AI analysis results
-- ============================================
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  insight_text TEXT NOT NULL,
  recommendations JSONB DEFAULT '[]',
  data_type TEXT,
  confidence DECIMAL(3, 2),
  sensor_data JSONB,
  model_used TEXT DEFAULT 'grok-2-1212',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT ai_insights_query_not_empty CHECK (LENGTH(TRIM(query)) > 0),
  CONSTRAINT ai_insights_insight_not_empty CHECK (LENGTH(TRIM(insight_text)) > 0)
);

-- Indexes for performance
CREATE INDEX idx_ai_insights_user ON ai_insights(user_id, created_at DESC);
CREATE INDEX idx_ai_insights_room ON ai_insights(room_id, created_at DESC);
CREATE INDEX idx_ai_insights_created ON ai_insights(created_at DESC);

-- RLS Policies
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai_insights"
  ON ai_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai_insights"
  ON ai_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai_insights"
  ON ai_insights FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- GROWTH STAGES TABLE
-- Plant growth stage definitions with target environmental ranges
-- ============================================
CREATE TABLE growth_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  vpd_min DECIMAL(4, 2),
  vpd_max DECIMAL(4, 2),
  temp_min DECIMAL(5, 2),
  temp_max DECIMAL(5, 2),
  humidity_min DECIMAL(5, 2),
  humidity_max DECIMAL(5, 2),
  description TEXT,
  stage_order INTEGER,
  duration_days INTEGER,
  light_hours INTEGER DEFAULT 18,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT growth_stages_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT growth_stages_vpd_valid CHECK (vpd_min IS NULL OR vpd_max IS NULL OR vpd_min <= vpd_max),
  CONSTRAINT growth_stages_temp_valid CHECK (temp_min IS NULL OR temp_max IS NULL OR temp_min <= temp_max),
  CONSTRAINT growth_stages_humidity_valid CHECK (humidity_min IS NULL OR humidity_max IS NULL OR humidity_min <= humidity_max)
);

-- Indexes for performance
CREATE INDEX idx_growth_stages_name ON growth_stages(name);
CREATE INDEX idx_growth_stages_order ON growth_stages(stage_order);

-- RLS Policies (growth stages are system-wide, read-only for all authenticated users)
ALTER TABLE growth_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view growth_stages"
  ON growth_stages FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage growth_stages"
  ON growth_stages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- PUSH TOKENS TABLE
-- Mobile push notification tokens (iOS/Android/Web)
-- ============================================
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT push_tokens_token_not_empty CHECK (LENGTH(TRIM(token)) > 0),
  CONSTRAINT push_tokens_unique_user_token UNIQUE(user_id, token)
);

-- Indexes for performance
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push_tokens"
  ON push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push_tokens"
  ON push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push_tokens"
  ON push_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push_tokens"
  ON push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER tr_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ADDITIONAL SUPPORTING TABLES
-- ============================================

-- SUNRISE/SUNSET CACHE
CREATE TABLE sunrise_sunset_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  sunrise_time TIME NOT NULL,
  sunset_time TIME NOT NULL,
  solar_noon TIME,
  day_length_hours DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT sunrise_sunset_unique_room_date UNIQUE(room_id, date)
);

CREATE INDEX idx_sunrise_sunset_room_date ON sunrise_sunset_cache(room_id, date DESC);

ALTER TABLE sunrise_sunset_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sunrise_sunset via room"
  ON sunrise_sunset_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = sunrise_sunset_cache.room_id
      AND rooms.user_id = auth.uid()
    )
  );

-- MANUAL SENSOR DATA (CSV uploads)
CREATE TABLE manual_sensor_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  filename TEXT,
  row_count INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_manual_sensor_data_user ON manual_sensor_data(user_id, uploaded_at DESC);
CREATE INDEX idx_manual_sensor_data_controller ON manual_sensor_data(controller_id, uploaded_at DESC);

ALTER TABLE manual_sensor_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own manual_sensor_data"
  ON manual_sensor_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own manual_sensor_data"
  ON manual_sensor_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own manual_sensor_data"
  ON manual_sensor_data FOR DELETE
  USING (auth.uid() = user_id);

-- AUDIT LOGS (system-wide audit trail)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit_logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- WORKFLOW TEMPLATES (shareable/public workflow templates)
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  category TEXT,
  tags TEXT[],
  is_public BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT workflow_templates_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE INDEX idx_workflow_templates_public ON workflow_templates(is_public) WHERE is_public = true;
CREATE INDEX idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX idx_workflow_templates_user ON workflow_templates(user_id);

ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates"
  ON workflow_templates FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own templates"
  ON workflow_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON workflow_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON workflow_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER tr_workflow_templates_updated_at
  BEFORE UPDATE ON workflow_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 5: DATA RETENTION CLEANUP FUNCTIONS
-- ============================================

-- Cleanup old activity logs (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old sensor readings (30-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_sensor_readings()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sensor_readings WHERE recorded_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old manual sensor data (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_manual_sensor_data()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM manual_sensor_data WHERE uploaded_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 6: ENABLE REALTIME PUBLICATION
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE controllers;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE workflows;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE sensor_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_insights;

-- ============================================
-- STEP 7: GRANT PERMISSIONS
-- Ensure service_role can bypass RLS for cron jobs
-- ============================================

-- Grant service_role full access (bypasses RLS)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant authenticated users basic access (RLS applies)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- STEP 8: INSERT DEFAULT GROWTH STAGES
-- ============================================

INSERT INTO growth_stages (name, vpd_min, vpd_max, temp_min, temp_max, humidity_min, humidity_max, stage_order, duration_days, light_hours, description)
VALUES
  ('Seedling', 0.4, 0.8, 20.0, 25.0, 65.0, 75.0, 1, 14, 18, 'Early growth stage with high humidity needs'),
  ('Vegetative', 0.8, 1.2, 22.0, 28.0, 55.0, 70.0, 2, 30, 18, 'Rapid growth stage with moderate VPD'),
  ('Early Flower', 1.0, 1.4, 20.0, 26.0, 50.0, 60.0, 3, 14, 12, 'Transition to flowering with increased VPD'),
  ('Mid Flower', 1.2, 1.6, 20.0, 26.0, 45.0, 55.0, 4, 21, 12, 'Peak flowering with higher VPD'),
  ('Late Flower', 1.0, 1.4, 18.0, 24.0, 40.0, 50.0, 5, 14, 12, 'Final maturation with controlled humidity')
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 9: VERIFICATION QUERIES
-- ============================================

-- Verify all tables exist
DO $$
DECLARE
  table_count INTEGER;
  expected_tables TEXT[] := ARRAY[
    'rooms', 'controllers', 'workflows', 'dimmer_schedules',
    'activity_logs', 'sensor_readings', 'ai_insights', 'growth_stages',
    'push_tokens', 'sunrise_sunset_cache', 'manual_sensor_data',
    'audit_logs', 'workflow_templates'
  ];
  missing_tables TEXT[];
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name = ANY(expected_tables);

  IF table_count < array_length(expected_tables, 1) THEN
    SELECT array_agg(t) INTO missing_tables
    FROM unnest(expected_tables) t
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    );
    RAISE WARNING 'Missing tables: %', missing_tables;
  ELSE
    RAISE NOTICE 'All % expected tables created successfully', table_count;
  END IF;
END $$;

-- Verify RLS is enabled on all user-facing tables
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

SELECT
  'EnviroFlow schema migration completed successfully!' AS status,
  NOW() AS completed_at,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS total_tables,
  (SELECT COUNT(*) FROM growth_stages) AS growth_stages_seeded;
