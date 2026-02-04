-- Migration: Add execution_state and workflow_variables for visual automation
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add execution_state column to workflows table for delay/debounce state machine
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflows' AND column_name = 'execution_state'
  ) THEN
    ALTER TABLE workflows ADD COLUMN execution_state JSONB DEFAULT NULL;
    COMMENT ON COLUMN workflows.execution_state IS 'State machine for paused workflows (delay nodes, debounce cooldowns). Structure: {paused_at_node, resume_after, context, last_debounce}';
  END IF;
END
$$;

-- 2. Create workflow_variables table for persistent variable storage
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('workflow', 'global')),
  name TEXT NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('number', 'string', 'boolean')),
  value_number DOUBLE PRECISION,
  value_string TEXT,
  value_boolean BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Unique constraint: one variable per name per scope per workflow (or user for global)
  CONSTRAINT workflow_variables_unique_name UNIQUE NULLS NOT DISTINCT (user_id, workflow_id, scope, name)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_workflow_variables_lookup 
  ON workflow_variables(user_id, workflow_id, scope, name);

CREATE INDEX IF NOT EXISTS idx_workflow_variables_global 
  ON workflow_variables(user_id, scope, name) 
  WHERE scope = 'global';

-- RLS Policies
ALTER TABLE workflow_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own variables"
  ON workflow_variables FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own variables"
  ON workflow_variables FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own variables"
  ON workflow_variables FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own variables"
  ON workflow_variables FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Create debounce_state table for tracking cooldowns
-- ============================================
CREATE TABLE IF NOT EXISTS debounce_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE NOT NULL,
  node_id TEXT NOT NULL,
  last_executed_at TIMESTAMPTZ NOT NULL,
  execution_count INTEGER DEFAULT 1,
  
  CONSTRAINT debounce_state_unique UNIQUE (workflow_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_debounce_state_lookup 
  ON debounce_state(workflow_id, node_id);

-- RLS (inherits from workflow ownership)
ALTER TABLE debounce_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage debounce state for their workflows"
  ON debounce_state FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workflows w 
      WHERE w.id = debounce_state.workflow_id 
      AND w.user_id = auth.uid()
    )
  );

-- 4. Add updated_at trigger for workflow_variables
-- ============================================
CREATE OR REPLACE FUNCTION update_workflow_variables_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workflow_variables_timestamp ON workflow_variables;
CREATE TRIGGER update_workflow_variables_timestamp
  BEFORE UPDATE ON workflow_variables
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_variables_timestamp();

-- Success message
SELECT 'Migration complete: execution_state column added, workflow_variables and debounce_state tables created' as status;
