-- ============================================
-- EnviroFlow Controller Health Scoring System
-- Migration: 20260124_add_controller_health.sql
-- Adds health scoring table and related functions
-- ============================================

-- ============================================
-- STEP 1: CREATE CONTROLLER_HEALTH TABLE
-- ============================================

CREATE TABLE controller_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  metrics_snapshot JSONB NOT NULL DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Ensure only one health record per controller per calculation
  CONSTRAINT controller_health_unique_latest UNIQUE (controller_id, calculated_at)
);

-- Indexes for performance
CREATE INDEX idx_controller_health_controller_id ON controller_health(controller_id);
CREATE INDEX idx_controller_health_calculated_at ON controller_health(calculated_at DESC);
CREATE INDEX idx_controller_health_score ON controller_health(score);

-- Composite index for latest score queries
CREATE INDEX idx_controller_health_latest ON controller_health(controller_id, calculated_at DESC);

-- ============================================
-- STEP 2: ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE controller_health ENABLE ROW LEVEL SECURITY;

-- Users can only view health scores for their own controllers
CREATE POLICY controller_health_select_policy ON controller_health
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = controller_health.controller_id
        AND controllers.user_id = auth.uid()
    )
  );

-- Only the system (service role) can insert health scores
CREATE POLICY controller_health_insert_policy ON controller_health
  FOR INSERT
  WITH CHECK (true); -- Service role will bypass RLS anyway

-- Only the system can update health scores
CREATE POLICY controller_health_update_policy ON controller_health
  FOR UPDATE
  USING (true); -- Service role only

-- Only the system can delete old health scores
CREATE POLICY controller_health_delete_policy ON controller_health
  FOR DELETE
  USING (true); -- Service role only

-- ============================================
-- STEP 3: HELPER FUNCTION - GET LATEST HEALTH
-- ============================================

CREATE OR REPLACE FUNCTION get_latest_controller_health(p_controller_id UUID)
RETURNS TABLE (
  score INTEGER,
  metrics_snapshot JSONB,
  calculated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ch.score,
    ch.metrics_snapshot,
    ch.calculated_at
  FROM controller_health ch
  WHERE ch.controller_id = p_controller_id
  ORDER BY ch.calculated_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- STEP 4: HELPER FUNCTION - DETECT SCORE DROP
-- ============================================

CREATE OR REPLACE FUNCTION detect_health_score_drop(
  p_controller_id UUID,
  p_threshold INTEGER DEFAULT 20
)
RETURNS TABLE (
  dropped BOOLEAN,
  current_score INTEGER,
  previous_score INTEGER,
  drop_amount INTEGER,
  calculated_at TIMESTAMPTZ
) AS $$
DECLARE
  v_current_score INTEGER;
  v_previous_score INTEGER;
  v_drop_amount INTEGER;
  v_calculated_at TIMESTAMPTZ;
BEGIN
  -- Get the two most recent health scores
  SELECT ch.score, ch.calculated_at
  INTO v_current_score, v_calculated_at
  FROM controller_health ch
  WHERE ch.controller_id = p_controller_id
  ORDER BY ch.calculated_at DESC
  LIMIT 1;

  SELECT ch.score
  INTO v_previous_score
  FROM controller_health ch
  WHERE ch.controller_id = p_controller_id
    AND ch.calculated_at < v_calculated_at
  ORDER BY ch.calculated_at DESC
  LIMIT 1;

  -- Calculate drop
  IF v_current_score IS NOT NULL AND v_previous_score IS NOT NULL THEN
    v_drop_amount := v_previous_score - v_current_score;

    RETURN QUERY SELECT
      (v_drop_amount > p_threshold) AS dropped,
      v_current_score AS current_score,
      v_previous_score AS previous_score,
      v_drop_amount AS drop_amount,
      v_calculated_at AS calculated_at;
  ELSE
    -- Not enough data to detect a drop
    RETURN QUERY SELECT
      FALSE AS dropped,
      v_current_score AS current_score,
      NULL::INTEGER AS previous_score,
      NULL::INTEGER AS drop_amount,
      v_calculated_at AS calculated_at;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- STEP 5: CLEANUP FUNCTION FOR OLD HEALTH DATA
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_controller_health()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Keep only the last 7 days of health scores
  -- This allows trend analysis while preventing unbounded growth
  WITH deleted AS (
    DELETE FROM controller_health
    WHERE calculated_at < NOW() - INTERVAL '7 days'
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 6: ADD TO REALTIME PUBLICATION
-- ============================================

-- Enable realtime updates for health scores
ALTER PUBLICATION supabase_realtime ADD TABLE controller_health;

-- ============================================
-- STEP 7: COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE controller_health IS 'Health scores for controllers, calculated hourly by cron job';
COMMENT ON COLUMN controller_health.score IS 'Health score from 0-100 based on uptime, sensor freshness, error rate, and sync lag';
COMMENT ON COLUMN controller_health.metrics_snapshot IS 'JSON snapshot of metrics used to calculate the score';
COMMENT ON COLUMN controller_health.calculated_at IS 'When this health score was calculated';

COMMENT ON FUNCTION get_latest_controller_health IS 'Returns the most recent health score for a controller';
COMMENT ON FUNCTION detect_health_score_drop IS 'Detects if controller health dropped by threshold (default 20 points) since last check';
COMMENT ON FUNCTION cleanup_old_controller_health IS 'Removes health scores older than 7 days';
