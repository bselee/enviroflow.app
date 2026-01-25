-- ============================================
-- EnviroFlow Proactive Alerts System
-- Migration: 20260124_add_alerts_system.sql
-- Adds alerts table and functions for controller connection monitoring
-- ============================================

-- ============================================
-- STEP 1: CREATE ALERTS TABLE
-- ============================================

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('offline', 'failed_commands', 'low_health')),
  message TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'snoozed', 'resolved')),
  snoozed_until TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT alerts_message_not_empty CHECK (LENGTH(TRIM(message)) > 0)
);

-- Indexes for performance
CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_controller_id ON alerts(controller_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_user_status ON alerts(user_id, status, created_at DESC);
CREATE INDEX idx_alerts_active ON alerts(user_id, controller_id, alert_type)
  WHERE status IN ('active', 'snoozed');
CREATE INDEX idx_alerts_snoozed_until ON alerts(snoozed_until)
  WHERE status = 'snoozed' AND snoozed_until IS NOT NULL;

-- ============================================
-- STEP 2: ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Users can view their own alerts
CREATE POLICY "Users can view own alerts"
  ON alerts FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert alerts (for cron job)
CREATE POLICY "Service role can insert alerts"
  ON alerts FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS anyway

-- Users can update their own alerts (acknowledge, snooze)
CREATE POLICY "Users can update own alerts"
  ON alerts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own alerts
CREATE POLICY "Users can delete own alerts"
  ON alerts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 3: HELPER FUNCTION - CHECK DUPLICATE ALERTS
-- ============================================

-- Function to check if a similar alert already exists (duplicate suppression)
-- Returns true if an alert was created within the last hour for the same controller and type
CREATE OR REPLACE FUNCTION has_recent_alert(
  p_controller_id UUID,
  p_alert_type TEXT,
  p_threshold_hours INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM alerts
    WHERE controller_id = p_controller_id
      AND alert_type = p_alert_type
      AND status IN ('active', 'snoozed')
      AND created_at > NOW() - (p_threshold_hours || ' hours')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- STEP 4: HELPER FUNCTION - GET ACTIVE ALERTS
-- ============================================

-- Get active alerts for a controller (excluding snoozed)
CREATE OR REPLACE FUNCTION get_active_alerts(p_controller_id UUID)
RETURNS TABLE (
  id UUID,
  alert_type TEXT,
  message TEXT,
  created_at TIMESTAMPTZ,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.alert_type,
    a.message,
    a.created_at,
    a.metadata
  FROM alerts a
  WHERE a.controller_id = p_controller_id
    AND a.status = 'active'
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- STEP 5: HELPER FUNCTION - GET SNOOZED ALERTS TO REACTIVATE
-- ============================================

-- Get alerts that should be reactivated (snooze period expired)
CREATE OR REPLACE FUNCTION get_expired_snooze_alerts()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  controller_id UUID,
  alert_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.user_id,
    a.controller_id,
    a.alert_type
  FROM alerts a
  WHERE a.status = 'snoozed'
    AND a.snoozed_until IS NOT NULL
    AND a.snoozed_until <= NOW();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- STEP 6: HELPER FUNCTION - AUTO-RESOLVE ALERTS
-- ============================================

-- Automatically resolve alerts when conditions improve
CREATE OR REPLACE FUNCTION auto_resolve_alerts(
  p_controller_id UUID,
  p_alert_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE alerts
  SET
    status = 'resolved',
    resolved_at = NOW()
  WHERE controller_id = p_controller_id
    AND alert_type = p_alert_type
    AND status IN ('active', 'snoozed')
    AND resolved_at IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 7: HELPER FUNCTION - SNOOZE ALERT
-- ============================================

-- Snooze an alert for a specified duration
CREATE OR REPLACE FUNCTION snooze_alert(
  p_alert_id UUID,
  p_snooze_hours INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_success BOOLEAN;
BEGIN
  UPDATE alerts
  SET
    status = 'snoozed',
    snoozed_until = NOW() + (p_snooze_hours || ' hours')::INTERVAL
  WHERE id = p_alert_id
    AND status = 'active';

  GET DIAGNOSTICS v_success = FOUND;
  RETURN v_success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 8: HELPER FUNCTION - ACKNOWLEDGE ALERT
-- ============================================

-- Acknowledge an alert (marks as read but keeps active)
CREATE OR REPLACE FUNCTION acknowledge_alert(p_alert_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_success BOOLEAN;
BEGIN
  UPDATE alerts
  SET
    status = 'acknowledged',
    acknowledged_at = NOW()
  WHERE id = p_alert_id
    AND status = 'active';

  GET DIAGNOSTICS v_success = FOUND;
  RETURN v_success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 9: CLEANUP FUNCTION FOR OLD ALERTS
-- ============================================

-- Clean up old resolved/acknowledged alerts (30-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_alerts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM alerts
  WHERE status IN ('resolved', 'acknowledged')
    AND (resolved_at < NOW() - INTERVAL '30 days'
         OR acknowledged_at < NOW() - INTERVAL '30 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 10: ADD TO REALTIME PUBLICATION
-- ============================================

-- Enable realtime updates for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;

-- ============================================
-- STEP 11: GRANT PERMISSIONS
-- ============================================

-- Ensure service_role has full access
GRANT ALL ON alerts TO service_role;

-- Ensure authenticated users have access (RLS applies)
GRANT SELECT, INSERT, UPDATE, DELETE ON alerts TO authenticated;

-- ============================================
-- STEP 12: COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE alerts IS 'Proactive alerts for controller connection issues and health problems';
COMMENT ON COLUMN alerts.alert_type IS 'Type of alert: offline (>30min), failed_commands (3+), low_health (<50 score)';
COMMENT ON COLUMN alerts.status IS 'Alert status: active, acknowledged, snoozed, resolved';
COMMENT ON COLUMN alerts.snoozed_until IS 'When a snoozed alert should reactivate (NULL if not snoozed)';
COMMENT ON COLUMN alerts.metadata IS 'Additional context: health_score, failed_command_count, offline_duration_minutes, etc.';

COMMENT ON FUNCTION has_recent_alert IS 'Duplicate suppression: checks if similar alert exists within threshold';
COMMENT ON FUNCTION get_active_alerts IS 'Returns active alerts for a controller';
COMMENT ON FUNCTION get_expired_snooze_alerts IS 'Returns alerts whose snooze period has expired';
COMMENT ON FUNCTION auto_resolve_alerts IS 'Automatically resolves alerts when conditions improve';
COMMENT ON FUNCTION snooze_alert IS 'Snoozes an alert for specified hours (12, 24, or 48)';
COMMENT ON FUNCTION acknowledge_alert IS 'Marks alert as acknowledged by user';
COMMENT ON FUNCTION cleanup_old_alerts IS 'Removes resolved/acknowledged alerts older than 30 days';

-- ============================================
-- STEP 13: VERIFICATION
-- ============================================

DO $$
BEGIN
  -- Verify table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts') THEN
    RAISE EXCEPTION 'Table alerts was not created';
  END IF;

  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'alerts' AND rowsecurity = true
  ) THEN
    RAISE WARNING 'RLS may not be enabled on alerts table';
  END IF;

  RAISE NOTICE 'Alerts table created successfully with RLS and realtime enabled';
END $$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

SELECT
  'Alerts system migration completed!' AS status,
  NOW() AS completed_at;
