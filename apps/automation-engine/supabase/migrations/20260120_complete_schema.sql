-- ============================================
-- EnviroFlow Complete Database Schema
-- Based on MVP Spec v2.0
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CONTROLLERS TABLE (brand-agnostic)
-- Supports: AC Infinity, Inkbird, Govee, CSV Upload
-- ============================================
CREATE TABLE IF NOT EXISTS controllers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand TEXT NOT NULL CHECK (brand IN ('ac_infinity', 'inkbird', 'govee', 'csv_upload', 'mqtt', 'custom')),
  controller_id TEXT NOT NULL,
  name TEXT NOT NULL,
  -- Credentials stored encrypted (use Supabase Vault in production)
  credentials JSONB NOT NULL DEFAULT '{}',
  -- Device capabilities (sensors, outputs, dimmers)
  capabilities JSONB DEFAULT '{}',
  -- Status
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ,
  last_error TEXT,
  -- Metadata
  firmware_version TEXT,
  model TEXT,
  room_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, controller_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_controllers_user_id ON controllers(user_id);
CREATE INDEX IF NOT EXISTS idx_controllers_user_online ON controllers(user_id, is_online);
CREATE INDEX IF NOT EXISTS idx_controllers_brand ON controllers(brand);

-- RLS
ALTER TABLE controllers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own controllers" ON controllers
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- ROOMS TABLE (logical grouping)
-- ============================================
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- Room settings (temp targets, humidity targets, etc.)
  settings JSONB DEFAULT '{}',
  -- Current growth stage
  current_stage TEXT,
  stage_started_at TIMESTAMPTZ,
  -- Location for sunrise/sunset calculations
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_user_id ON rooms(user_id);

-- RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own rooms" ON rooms
  FOR ALL USING (auth.uid() = user_id);

-- Add foreign key to controllers after rooms table exists
ALTER TABLE controllers 
  ADD CONSTRAINT fk_controllers_room 
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;

-- ============================================
-- WORKFLOWS TABLE
-- Stores React Flow nodes/edges
-- ============================================
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- React Flow data
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  -- Workflow state
  is_active BOOLEAN DEFAULT false,
  last_run TIMESTAMPTZ,
  last_error TEXT,
  run_count INTEGER DEFAULT 0,
  -- Dry-run settings
  dry_run_enabled BOOLEAN DEFAULT false,
  -- Growth stage association
  growth_stage TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_user_active ON workflows(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflows_stage ON workflows(growth_stage);

-- RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own workflows" ON workflows
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- ACTIVITY LOGS (with audit trail)
-- 90-day retention
-- ============================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE SET NULL,
  -- Action details
  action_type TEXT NOT NULL,
  action_data JSONB DEFAULT '{}',
  result TEXT CHECK (result IN ('success', 'failed', 'skipped', 'dry_run')),
  error_message TEXT,
  -- Audit fields
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_workflow ON activity_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_room ON activity_logs(room_id);

-- RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own activity_logs" ON activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity_logs" ON activity_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- AUDIT LOGS (security/compliance - GDPR)
-- 1-year retention
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own audit_logs" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- SENSOR READINGS CACHE (for performance)
-- 30-day retention
-- ============================================
CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  -- Sensor data
  port INTEGER,
  sensor_type TEXT NOT NULL CHECK (sensor_type IN ('temperature', 'humidity', 'vpd', 'co2', 'light', 'ph', 'ec')),
  value DECIMAL(10, 4) NOT NULL,
  unit TEXT NOT NULL,
  -- Status
  is_stale BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (critical for performance)
CREATE INDEX IF NOT EXISTS idx_sensor_readings_controller_timestamp 
  ON sensor_readings(controller_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_user_type 
  ON sensor_readings(user_id, sensor_type, timestamp DESC);

-- RLS
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sensor_readings" ON sensor_readings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert sensor_readings" ON sensor_readings
  FOR INSERT WITH CHECK (true);

-- ============================================
-- MANUAL SENSOR DATA (CSV uploads)
-- 90-day retention
-- ============================================
CREATE TABLE IF NOT EXISTS manual_sensor_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE,
  -- CSV data stored as JSONB array
  data JSONB NOT NULL,
  -- File metadata
  filename TEXT,
  row_count INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE manual_sensor_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own manual_sensor_data" ON manual_sensor_data
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- SUNRISE/SUNSET CACHE
-- Daily cache for light automation
-- ============================================
CREATE TABLE IF NOT EXISTS sunrise_sunset_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  sunrise_time TIME NOT NULL,
  sunset_time TIME NOT NULL,
  solar_noon TIME,
  day_length_hours DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(room_id, date)
);

-- RLS
ALTER TABLE sunrise_sunset_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read sunrise_sunset via room" ON sunrise_sunset_cache
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rooms WHERE rooms.id = sunrise_sunset_cache.room_id AND rooms.user_id = auth.uid()
    )
  );

-- ============================================
-- DIMMER SCHEDULES
-- Sunrise/sunset gradual dimming
-- ============================================
CREATE TABLE IF NOT EXISTS dimmer_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  -- Port/channel config
  port INTEGER NOT NULL,
  -- Schedule type
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('sunrise', 'sunset', 'custom', 'dli_curve')),
  -- Timing
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER DEFAULT 30,
  -- Dimming config
  start_intensity INTEGER DEFAULT 0 CHECK (start_intensity >= 0 AND start_intensity <= 100),
  target_intensity INTEGER DEFAULT 100 CHECK (target_intensity >= 0 AND target_intensity <= 100),
  curve TEXT DEFAULT 'sigmoid' CHECK (curve IN ('linear', 'sigmoid', 'exponential', 'logarithmic')),
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dimmer_schedules_user ON dimmer_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_dimmer_schedules_active ON dimmer_schedules(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE dimmer_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own dimmer_schedules" ON dimmer_schedules
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- PUSH NOTIFICATION TOKENS
-- For mobile app (FCM/APNS)
-- ============================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, token)
);

-- RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own push_tokens" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- GROWTH STAGES
-- Predefined stages for rooms
-- ============================================
CREATE TABLE IF NOT EXISTS growth_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- Stage order
  stage_order INTEGER NOT NULL,
  -- Duration in days
  duration_days INTEGER,
  -- Target conditions
  target_temp_min DECIMAL(5, 2),
  target_temp_max DECIMAL(5, 2),
  target_humidity_min DECIMAL(5, 2),
  target_humidity_max DECIMAL(5, 2),
  target_vpd_min DECIMAL(4, 2),
  target_vpd_max DECIMAL(4, 2),
  -- Light settings
  light_hours INTEGER DEFAULT 18,
  -- Associated workflow
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_growth_stages_user ON growth_stages(user_id);

-- RLS
ALTER TABLE growth_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own growth_stages" ON growth_stages
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- WORKFLOW TEMPLATES
-- Shareable workflow configurations
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- React Flow data
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  -- Template metadata
  category TEXT,
  tags TEXT[],
  is_public BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_templates_public ON workflow_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);

-- RLS
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own templates" ON workflow_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read public templates" ON workflow_templates
  FOR SELECT USING (is_public = true);

-- ============================================
-- AI INSIGHTS (from existing migration)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  -- AI analysis results
  query TEXT NOT NULL,
  insight TEXT NOT NULL,
  recommendations JSONB DEFAULT '[]',
  data_type TEXT,
  confidence DECIMAL(3, 2),
  -- Source data
  sensor_data JSONB,
  model_used TEXT DEFAULT 'grok-2-1212',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_insights_user ON ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_room ON ai_insights(room_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created ON ai_insights(created_at DESC);

-- RLS
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own ai_insights" ON ai_insights
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER tr_controllers_updated_at
  BEFORE UPDATE ON controllers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_dimmer_schedules_updated_at
  BEFORE UPDATE ON dimmer_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_growth_stages_updated_at
  BEFORE UPDATE ON growth_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_workflow_templates_updated_at
  BEFORE UPDATE ON workflow_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE controllers;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE workflows;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE sensor_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_insights;

-- ============================================
-- AUTO-CLEANUP FUNCTIONS (Data Retention)
-- ============================================

-- Function to clean up old activity logs (90 days)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM activity_logs WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old sensor readings (30 days)
CREATE OR REPLACE FUNCTION cleanup_old_sensor_readings()
RETURNS void AS $$
BEGIN
  DELETE FROM sensor_readings WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old manual sensor data (90 days)
CREATE OR REPLACE FUNCTION cleanup_old_manual_sensor_data()
RETURNS void AS $$
BEGIN
  DELETE FROM manual_sensor_data WHERE uploaded_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEED DEFAULT GROWTH STAGES (Example)
-- ============================================
-- Note: Run this after a user signs up, or let users create their own

-- COMMENT: Example stages for cannabis cultivation
-- INSERT INTO growth_stages (user_id, name, stage_order, duration_days, target_temp_min, target_temp_max, target_humidity_min, target_humidity_max, target_vpd_min, target_vpd_max, light_hours)
-- VALUES 
--   (USER_ID_HERE, 'Germination', 1, 7, 70, 80, 70, 80, 0.4, 0.8, 18),
--   (USER_ID_HERE, 'Seedling', 2, 14, 70, 78, 65, 75, 0.4, 0.8, 18),
--   (USER_ID_HERE, 'Vegetative', 3, 28, 70, 85, 40, 70, 0.8, 1.2, 18),
--   (USER_ID_HERE, 'Flower - Early', 4, 21, 68, 80, 40, 50, 1.0, 1.4, 12),
--   (USER_ID_HERE, 'Flower - Mid', 5, 21, 68, 80, 40, 50, 1.2, 1.6, 12),
--   (USER_ID_HERE, 'Flower - Late', 6, 14, 65, 78, 30, 40, 1.4, 1.8, 12),
--   (USER_ID_HERE, 'Flush', 7, 7, 65, 75, 30, 40, 1.4, 1.8, 12);

-- ============================================
-- DONE! Schema v2.0 Complete
-- ============================================
