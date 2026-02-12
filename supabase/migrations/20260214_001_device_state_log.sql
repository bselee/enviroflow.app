-- ============================================================================
-- Migration: Device State Log Table
-- Purpose: Track device ON/OFF state changes for activity waveform charts
-- ============================================================================

-- Create the device_state_log table
CREATE TABLE IF NOT EXISTS device_state_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  port_number INTEGER NOT NULL CHECK (port_number >= 1 AND port_number <= 8),
  device_name TEXT NOT NULL,

  -- State information
  state BOOLEAN NOT NULL,  -- true=ON, false=OFF
  speed INTEGER CHECK (speed >= 0 AND speed <= 100),  -- 0-100% (mapped from 0-10 scale)

  -- Trigger source
  trigger TEXT CHECK (trigger IN (
    'auto',      -- AUTO mode trigger
    'manual',    -- User manual control
    'workflow',  -- EnviroFlow workflow action
    'schedule',  -- SCHEDULE mode
    'timer',     -- TIMER mode
    'cycle',     -- CYCLE mode
    'vpd',       -- VPD mode trigger
    'api',       -- Direct API call
    'system'     -- System/polling detected change
  )),

  -- Optional workflow reference
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,

  -- Timestamp
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient queries
-- Primary lookup: all state changes for a controller in time range
CREATE INDEX IF NOT EXISTS idx_device_state_log_controller_time
  ON device_state_log(controller_id, recorded_at DESC);

-- Per-port lookup: state changes for specific device
CREATE INDEX IF NOT EXISTS idx_device_state_log_port
  ON device_state_log(controller_id, port_number, recorded_at DESC);

-- Workflow audit: find all state changes from a workflow
CREATE INDEX IF NOT EXISTS idx_device_state_log_workflow
  ON device_state_log(workflow_id, recorded_at DESC)
  WHERE workflow_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE device_state_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view device_state_log for their own controllers
CREATE POLICY "Users can view own device_state_log"
  ON device_state_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = device_state_log.controller_id
      AND controllers.user_id = auth.uid()
    )
  );

-- RLS Policy: Service role has full access (for cron jobs and API routes)
CREATE POLICY "Service role can manage device_state_log"
  ON device_state_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON device_state_log TO authenticated;
GRANT ALL ON device_state_log TO service_role;

-- Add comment for documentation
COMMENT ON TABLE device_state_log IS
'Event-driven log of device ON/OFF state changes.
Used for rendering device activity waveform charts (AC Infinity style).
State changes are logged via:
1. Auto-trigger on controller_ports updates
2. Manual inserts from device control API routes
3. Workflow execution engine

Data retention: Should match command_history (90 days).';

-- ============================================================================
-- Cleanup function for data retention (90 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_device_state_log()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM device_state_log
  WHERE recorded_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_old_device_state_log() TO service_role;

COMMENT ON FUNCTION cleanup_old_device_state_log IS
'Removes device_state_log entries older than 90 days. Call from cron job.';
