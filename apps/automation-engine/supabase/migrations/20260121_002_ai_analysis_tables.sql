-- AI Insights table for storing analysis results
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  data_type TEXT NOT NULL,
  analysis TEXT NOT NULL,
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  recommendations JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sensor logs table for environmental data
CREATE TABLE IF NOT EXISTS sensor_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id TEXT NOT NULL,
  data_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation actions table for robotics control
CREATE TABLE IF NOT EXISTS automation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  target_device TEXT NOT NULL,
  parameters JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  triggered_by UUID REFERENCES ai_insights(id),
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sensor_logs_timestamp ON sensor_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_logs_data_type ON sensor_logs(data_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_actions_status ON automation_actions(status);

-- Enable Row Level Security
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_actions ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can read ai_insights" ON ai_insights
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert ai_insights" ON ai_insights
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can read sensor_logs" ON sensor_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert sensor_logs" ON sensor_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can read automation_actions" ON automation_actions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert automation_actions" ON automation_actions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Enable Realtime for AI insights
ALTER PUBLICATION supabase_realtime ADD TABLE ai_insights;
ALTER PUBLICATION supabase_realtime ADD TABLE automation_actions;
