-- EnviroFlow Initial Database Schema
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CONTROLLERS TABLE
-- ============================================
CREATE TABLE controllers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,                    -- 'ac_infinity', 'inkbird', 'generic_wifi'
  controller_id TEXT NOT NULL,            -- Brand-specific device ID
  name TEXT NOT NULL,
  credentials JSONB NOT NULL,             -- Encrypted credentials
  capabilities JSONB,                     -- Ports, sensors, features
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, controller_id)
);

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
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own controllers"
  ON controllers FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_controllers_user_id ON controllers(user_id);
CREATE INDEX idx_controllers_online ON controllers(is_online);
CREATE INDEX idx_controllers_brand ON controllers(brand);

-- ============================================
-- WORKFLOWS TABLE
-- ============================================
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,   -- React Flow nodes
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,   -- React Flow edges
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workflows"
  ON workflows FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_active ON workflows(is_active);

-- ============================================
-- WORKFLOW ROOM MAPPINGS
-- ============================================
CREATE TABLE workflow_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(workflow_id, controller_id)
);

-- RLS Policies
ALTER TABLE workflow_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workflow_rooms"
  ON workflow_rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = workflow_rooms.workflow_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own workflow_rooms"
  ON workflow_rooms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = workflow_rooms.workflow_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own workflow_rooms"
  ON workflow_rooms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = workflow_rooms.workflow_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own workflow_rooms"
  ON workflow_rooms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = workflow_rooms.workflow_id
      AND w.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_workflow_rooms_workflow ON workflow_rooms(workflow_id);
CREATE INDEX idx_workflow_rooms_controller ON workflow_rooms(controller_id);

-- ============================================
-- ACTIVITY LOGS TABLE (90-day retention)
-- ============================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE SET NULL,
  action TEXT NOT NULL,                   -- 'workflow_executed', 'device_controlled', etc.
  result TEXT NOT NULL,                   -- 'success', 'failed', 'skipped'
  metadata JSONB,                         -- Additional context
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity_logs"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity_logs"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX idx_activity_logs_workflow_id ON activity_logs(workflow_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);

-- ============================================
-- SENSOR READINGS TABLE
-- ============================================
CREATE TABLE sensor_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE,
  sensor_type TEXT NOT NULL,              -- 'temperature', 'humidity', 'vpd', etc.
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,                     -- 'F', 'C', '%', 'kPa', etc.
  port INTEGER,                           -- Physical port number (if applicable)
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (allow read via controller ownership)
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sensor readings for own controllers"
  ON sensor_readings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM controllers c
      WHERE c.id = sensor_readings.controller_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sensor readings for own controllers"
  ON sensor_readings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM controllers c
      WHERE c.id = sensor_readings.controller_id
      AND c.user_id = auth.uid()
    )
  );

-- Indexes for fast queries
CREATE INDEX idx_sensor_readings_controller_timestamp
  ON sensor_readings(controller_id, timestamp DESC);
CREATE INDEX idx_sensor_readings_type ON sensor_readings(sensor_type);

-- ============================================
-- DIMMER CONFIGS TABLE (Sunrise/Sunset)
-- ============================================
CREATE TABLE dimmer_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE,
  dimmer_port INTEGER NOT NULL,
  sunrise_time TIME NOT NULL,             -- e.g., '06:00:00'
  sunrise_duration INTEGER DEFAULT 30,    -- minutes
  sunrise_curve TEXT DEFAULT 'sigmoid',   -- 'linear', 'sigmoid', 'exponential'
  sunset_time TIME NOT NULL,              -- e.g., '20:00:00'
  sunset_duration INTEGER DEFAULT 30,
  sunset_curve TEXT DEFAULT 'sigmoid',
  target_intensity INTEGER DEFAULT 100,   -- 0-100%
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE dimmer_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dimmer_configs"
  ON dimmer_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = dimmer_configs.workflow_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own dimmer_configs"
  ON dimmer_configs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = dimmer_configs.workflow_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own dimmer_configs"
  ON dimmer_configs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = dimmer_configs.workflow_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own dimmer_configs"
  ON dimmer_configs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = dimmer_configs.workflow_id
      AND w.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_dimmer_configs_workflow ON dimmer_configs(workflow_id);
CREATE INDEX idx_dimmer_configs_controller ON dimmer_configs(controller_id);
CREATE INDEX idx_dimmer_configs_active ON dimmer_configs(is_active);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_controllers_updated_at
  BEFORE UPDATE ON controllers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dimmer_configs_updated_at
  BEFORE UPDATE ON dimmer_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to cleanup old activity logs (>90 days)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM activity_logs
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old sensor readings (>7 days by default)
CREATE OR REPLACE FUNCTION cleanup_old_sensor_readings(days_to_keep INTEGER DEFAULT 7)
RETURNS void AS $$
BEGIN
  DELETE FROM sensor_readings
  WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SERVICE ROLE POLICIES (for Edge Functions)
-- ============================================

-- Allow service role to insert activity logs for any user
CREATE POLICY "Service role can insert activity_logs"
  ON activity_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow service role to update controller status
CREATE POLICY "Service role can update controllers"
  ON controllers FOR UPDATE
  TO service_role
  USING (true);

-- Allow service role to insert sensor readings
CREATE POLICY "Service role can insert sensor_readings"
  ON sensor_readings FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow service role to read all data for workflow execution
CREATE POLICY "Service role can read workflows"
  ON workflows FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can read controllers"
  ON controllers FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can read workflow_rooms"
  ON workflow_rooms FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can read dimmer_configs"
  ON dimmer_configs FOR SELECT
  TO service_role
  USING (true);
