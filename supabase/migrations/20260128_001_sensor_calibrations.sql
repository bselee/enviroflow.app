-- ============================================
-- Sensor Calibrations Table
-- Enables per-sensor calibration with offset/scale corrections
-- Lab-Grade Accuracy Implementation Phase 1
-- ============================================

-- Create sensor calibrations table
CREATE TABLE IF NOT EXISTS sensor_calibrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  sensor_type TEXT NOT NULL,
  port INTEGER DEFAULT 0,

  -- Corrections: corrected = raw * scale + offset
  offset_correction DECIMAL(10, 4) DEFAULT 0,
  scale_correction DECIMAL(6, 4) DEFAULT 1.0,

  -- Reference (audit trail)
  reference_instrument TEXT,
  reference_reading DECIMAL(10, 4),
  raw_reading_at_calibration DECIMAL(10, 4),

  -- Validity
  calibrated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,

  calibrated_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: only one active calibration per sensor
  CONSTRAINT sensor_calibrations_unique
    UNIQUE(controller_id, sensor_type, port)
);

-- Index for efficient active calibration lookups
CREATE INDEX IF NOT EXISTS idx_sensor_calibrations_active
  ON sensor_calibrations(controller_id, sensor_type, is_active)
  WHERE is_active = true;

-- Index for controller-based queries
CREATE INDEX IF NOT EXISTS idx_sensor_calibrations_controller
  ON sensor_calibrations(controller_id);

-- Enable Row Level Security
ALTER TABLE sensor_calibrations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage calibrations for their own controllers
CREATE POLICY "Users can manage own calibrations" ON sensor_calibrations
  FOR ALL USING (
    controller_id IN (
      SELECT id FROM controllers WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Calibration History Table
-- Tracks historical calibrations for audit/analysis
-- ============================================

CREATE TABLE IF NOT EXISTS sensor_calibration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_id UUID REFERENCES sensor_calibrations(id) ON DELETE SET NULL,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  sensor_type TEXT NOT NULL,
  port INTEGER DEFAULT 0,

  -- Snapshot of calibration settings
  offset_correction DECIMAL(10, 4),
  scale_correction DECIMAL(6, 4),
  reference_instrument TEXT,
  reference_reading DECIMAL(10, 4),
  raw_reading_at_calibration DECIMAL(10, 4),

  -- Change metadata
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deactivated', 'expired')),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Additional context
  reason TEXT,

  CONSTRAINT calibration_history_controller_fk
    FOREIGN KEY (controller_id) REFERENCES controllers(id) ON DELETE CASCADE
);

-- Index for history lookups
CREATE INDEX IF NOT EXISTS idx_calibration_history_controller
  ON sensor_calibration_history(controller_id, sensor_type);

CREATE INDEX IF NOT EXISTS idx_calibration_history_calibration
  ON sensor_calibration_history(calibration_id);

-- Enable RLS on history table
ALTER TABLE sensor_calibration_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy for history
CREATE POLICY "Users can view own calibration history" ON sensor_calibration_history
  FOR SELECT USING (
    controller_id IN (
      SELECT id FROM controllers WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Function: Apply Calibration Correction
-- Used for real-time value correction
-- ============================================

CREATE OR REPLACE FUNCTION apply_calibration(
  p_value DECIMAL,
  p_controller_id UUID,
  p_sensor_type TEXT,
  p_port INTEGER DEFAULT 0
)
RETURNS DECIMAL AS $$
DECLARE
  v_calibration RECORD;
  v_corrected DECIMAL;
BEGIN
  -- Find active calibration
  SELECT offset_correction, scale_correction, expires_at
  INTO v_calibration
  FROM sensor_calibrations
  WHERE controller_id = p_controller_id
    AND sensor_type = p_sensor_type
    AND COALESCE(port, 0) = COALESCE(p_port, 0)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  -- If no calibration found, return original value
  IF NOT FOUND THEN
    RETURN p_value;
  END IF;

  -- Apply correction: corrected = raw * scale + offset
  v_corrected := p_value * v_calibration.scale_correction + v_calibration.offset_correction;

  RETURN v_corrected;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Function: Create or Update Calibration
-- Automatically handles history tracking
-- ============================================

CREATE OR REPLACE FUNCTION upsert_calibration(
  p_controller_id UUID,
  p_sensor_type TEXT,
  p_reference_reading DECIMAL,
  p_raw_reading DECIMAL,
  p_port INTEGER DEFAULT 0,
  p_reference_instrument TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  v_calibration_id UUID;
  v_offset DECIMAL;
  v_scale DECIMAL;
  v_existing RECORD;
BEGIN
  -- Calculate offset (simple offset calibration: corrected = raw + offset)
  -- offset = reference - raw
  v_offset := p_reference_reading - p_raw_reading;
  v_scale := 1.0;

  -- Check for existing calibration
  SELECT id, offset_correction, scale_correction
  INTO v_existing
  FROM sensor_calibrations
  WHERE controller_id = p_controller_id
    AND sensor_type = p_sensor_type
    AND COALESCE(port, 0) = COALESCE(p_port, 0);

  IF FOUND THEN
    -- Update existing calibration
    UPDATE sensor_calibrations
    SET
      offset_correction = v_offset,
      scale_correction = v_scale,
      reference_instrument = p_reference_instrument,
      reference_reading = p_reference_reading,
      raw_reading_at_calibration = p_raw_reading,
      calibrated_at = NOW(),
      expires_at = p_expires_at,
      is_active = true,
      calibrated_by = p_user_id,
      notes = p_notes
    WHERE id = v_existing.id
    RETURNING id INTO v_calibration_id;

    -- Record history
    INSERT INTO sensor_calibration_history (
      calibration_id, controller_id, sensor_type, port,
      offset_correction, scale_correction, reference_instrument,
      reference_reading, raw_reading_at_calibration,
      action, changed_by, reason
    ) VALUES (
      v_calibration_id, p_controller_id, p_sensor_type, p_port,
      v_offset, v_scale, p_reference_instrument,
      p_reference_reading, p_raw_reading,
      'updated', p_user_id, 'Calibration updated'
    );
  ELSE
    -- Insert new calibration
    INSERT INTO sensor_calibrations (
      controller_id, sensor_type, port,
      offset_correction, scale_correction,
      reference_instrument, reference_reading, raw_reading_at_calibration,
      expires_at, calibrated_by, notes
    ) VALUES (
      p_controller_id, p_sensor_type, p_port,
      v_offset, v_scale,
      p_reference_instrument, p_reference_reading, p_raw_reading,
      p_expires_at, p_user_id, p_notes
    )
    RETURNING id INTO v_calibration_id;

    -- Record history
    INSERT INTO sensor_calibration_history (
      calibration_id, controller_id, sensor_type, port,
      offset_correction, scale_correction, reference_instrument,
      reference_reading, raw_reading_at_calibration,
      action, changed_by, reason
    ) VALUES (
      v_calibration_id, p_controller_id, p_sensor_type, p_port,
      v_offset, v_scale, p_reference_instrument,
      p_reference_reading, p_raw_reading,
      'created', p_user_id, 'Initial calibration'
    );
  END IF;

  RETURN v_calibration_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Deactivate Calibration
-- ============================================

CREATE OR REPLACE FUNCTION deactivate_calibration(
  p_calibration_id UUID,
  p_reason TEXT DEFAULT 'Manual deactivation',
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  v_calibration RECORD;
BEGIN
  -- Get calibration details
  SELECT * INTO v_calibration
  FROM sensor_calibrations
  WHERE id = p_calibration_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Deactivate
  UPDATE sensor_calibrations
  SET is_active = false
  WHERE id = p_calibration_id;

  -- Record history
  INSERT INTO sensor_calibration_history (
    calibration_id, controller_id, sensor_type, port,
    offset_correction, scale_correction, reference_instrument,
    reference_reading, raw_reading_at_calibration,
    action, changed_by, reason
  ) VALUES (
    p_calibration_id, v_calibration.controller_id, v_calibration.sensor_type, v_calibration.port,
    v_calibration.offset_correction, v_calibration.scale_correction, v_calibration.reference_instrument,
    v_calibration.reference_reading, v_calibration.raw_reading_at_calibration,
    'deactivated', p_user_id, p_reason
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Grant permissions
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON sensor_calibrations TO authenticated;
GRANT SELECT ON sensor_calibration_history TO authenticated;
GRANT EXECUTE ON FUNCTION apply_calibration TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_calibration TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_calibration TO authenticated;
