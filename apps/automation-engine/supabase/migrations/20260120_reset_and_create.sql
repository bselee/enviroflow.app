-- ============================================
-- EnviroFlow Database RESET & CREATE
-- Run this if you get errors about existing tables/columns
-- https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
-- ============================================

-- ============================================
-- STEP 1: DROP EXISTING TABLES (if any)
-- Order matters due to foreign key constraints
-- ============================================

-- First, remove from realtime publication (ignore errors if not exists)
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE controllers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE workflows;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE activity_logs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE sensor_readings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE ai_insights;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop tables in reverse dependency order
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

-- Drop the trigger function if it exists
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_activity_logs() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_sensor_readings() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_manual_sensor_data() CASCADE;

-- ============================================
-- STEP 2: Extensions already enabled on Supabase
-- (uuid-ossp and pgcrypto are pre-installed)
-- ============================================

-- ============================================
-- STEP 3: CREATE ALL TABLES
-- ============================================

-- ============================================
-- ROOMS TABLE (create first - no dependencies)
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rooms_user_id ON rooms(user_id);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own rooms" ON rooms
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- CONTROLLERS TABLE
-- ============================================
CREATE TABLE controllers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand TEXT NOT NULL CHECK (brand IN ('ac_infinity', 'inkbird', 'govee', 'csv_upload', 'mqtt', 'custom')),
  controller_id TEXT NOT NULL,
  name TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',
  capabilities JSONB DEFAULT '{}',
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ,
  last_error TEXT,
  firmware_version TEXT,
  model TEXT,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, controller_id)
);

CREATE INDEX idx_controllers_user_id ON controllers(user_id);
CREATE INDEX idx_controllers_user_online ON controllers(user_id, is_online);
CREATE INDEX idx_controllers_brand ON controllers(brand);

ALTER TABLE controllers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own controllers" ON controllers
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- WORKFLOWS TABLE
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
  last_run TIMESTAMPTZ,
  last_error TEXT,
  run_count INTEGER DEFAULT 0,
  dry_run_enabled BOOLEAN DEFAULT false,
  growth_stage TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_user_active ON workflows(user_id, is_active);
CREATE INDEX idx_workflows_active ON workflows(is_active) WHERE is_active = true;
CREATE INDEX idx_workflows_stage ON workflows(growth_stage);

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own workflows" ON workflows
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- ACTIVITY LOGS
-- ============================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_data JSONB DEFAULT '{}',
  result TEXT CHECK (result IN ('success', 'failed', 'skipped', 'dry_run')),
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX idx_activity_logs_workflow ON activity_logs(workflow_id);
CREATE INDEX idx_activity_logs_room ON activity_logs(room_id);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own activity_logs" ON activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity_logs" ON activity_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- AUDIT LOGS
-- ============================================
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
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own audit_logs" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- SENSOR READINGS
-- ============================================
CREATE TABLE sensor_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  port INTEGER,
  sensor_type TEXT NOT NULL CHECK (sensor_type IN ('temperature', 'humidity', 'vpd', 'co2', 'light', 'ph', 'ec')),
  value DECIMAL(10, 4) NOT NULL,
  unit TEXT NOT NULL,
  is_stale BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sensor_readings_controller_timestamp ON sensor_readings(controller_id, timestamp DESC);
CREATE INDEX idx_sensor_readings_user_type ON sensor_readings(user_id, sensor_type, timestamp DESC);

ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sensor_readings" ON sensor_readings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert sensor_readings" ON sensor_readings
  FOR INSERT WITH CHECK (true);

-- ============================================
-- MANUAL SENSOR DATA
-- ============================================
CREATE TABLE manual_sensor_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  filename TEXT,
  row_count INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE manual_sensor_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own manual_sensor_data" ON manual_sensor_data
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- SUNRISE/SUNSET CACHE
-- ============================================
CREATE TABLE sunrise_sunset_cache (
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

ALTER TABLE sunrise_sunset_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read sunrise_sunset via room" ON sunrise_sunset_cache
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rooms WHERE rooms.id = sunrise_sunset_cache.room_id AND rooms.user_id = auth.uid()
    )
  );

-- ============================================
-- DIMMER SCHEDULES
-- ============================================
CREATE TABLE dimmer_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  port INTEGER NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('sunrise', 'sunset', 'custom', 'dli_curve')),
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER DEFAULT 30,
  start_intensity INTEGER DEFAULT 0 CHECK (start_intensity >= 0 AND start_intensity <= 100),
  target_intensity INTEGER DEFAULT 100 CHECK (target_intensity >= 0 AND target_intensity <= 100),
  curve TEXT DEFAULT 'sigmoid' CHECK (curve IN ('linear', 'sigmoid', 'exponential', 'logarithmic')),
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dimmer_schedules_user ON dimmer_schedules(user_id);
CREATE INDEX idx_dimmer_schedules_active ON dimmer_schedules(is_active) WHERE is_active = true;

ALTER TABLE dimmer_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own dimmer_schedules" ON dimmer_schedules
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- PUSH TOKENS
-- ============================================
CREATE TABLE push_tokens (
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

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own push_tokens" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- GROWTH STAGES
-- ============================================
CREATE TABLE growth_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  stage_order INTEGER NOT NULL,
  duration_days INTEGER,
  target_temp_min DECIMAL(5, 2),
  target_temp_max DECIMAL(5, 2),
  target_humidity_min DECIMAL(5, 2),
  target_humidity_max DECIMAL(5, 2),
  target_vpd_min DECIMAL(4, 2),
  target_vpd_max DECIMAL(4, 2),
  light_hours INTEGER DEFAULT 18,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_growth_stages_user ON growth_stages(user_id);

ALTER TABLE growth_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own growth_stages" ON growth_stages
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- WORKFLOW TEMPLATES
-- ============================================
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_templates_public ON workflow_templates(is_public) WHERE is_public = true;
CREATE INDEX idx_workflow_templates_category ON workflow_templates(category);

ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own templates" ON workflow_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read public templates" ON workflow_templates
  FOR SELECT USING (is_public = true);

-- ============================================
-- AI INSIGHTS
-- ============================================
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  insight TEXT NOT NULL,
  recommendations JSONB DEFAULT '[]',
  data_type TEXT,
  confidence DECIMAL(3, 2),
  sensor_data JSONB,
  model_used TEXT DEFAULT 'grok-2-1212',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_insights_user ON ai_insights(user_id);
CREATE INDEX idx_ai_insights_room ON ai_insights(room_id);
CREATE INDEX idx_ai_insights_created ON ai_insights(created_at DESC);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own ai_insights" ON ai_insights
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- STEP 4: CREATE TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
-- STEP 5: ENABLE REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE controllers;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE workflows;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE sensor_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_insights;

-- ============================================
-- STEP 6: CLEANUP FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM activity_logs WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_sensor_readings()
RETURNS void AS $$
BEGIN
  DELETE FROM sensor_readings WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_manual_sensor_data()
RETURNS void AS $$
BEGIN
  DELETE FROM manual_sensor_data WHERE uploaded_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DONE! Run this in Supabase SQL Editor
-- ============================================
SELECT 'EnviroFlow schema created successfully!' as status;
