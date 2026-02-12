-- ============================================================================
-- Migration: Server-Side Downsampling RPC for Sensor Readings
-- Purpose: Efficient time-bucketed aggregation for 7D+ chart queries
-- ============================================================================

-- Drop if exists for idempotency
DROP FUNCTION IF EXISTS get_sensor_readings_downsampled(UUID, TIMESTAMPTZ, TEXT);

-- Create the downsampling RPC function
CREATE OR REPLACE FUNCTION get_sensor_readings_downsampled(
  p_controller_id UUID,
  p_since TIMESTAMPTZ,
  p_interval TEXT DEFAULT '5 minutes'
)
RETURNS TABLE (
  bucket TIMESTAMPTZ,
  temperature FLOAT,
  humidity FLOAT,
  vpd FLOAT,
  temp_min FLOAT,
  temp_max FLOAT,
  humidity_min FLOAT,
  humidity_max FLOAT,
  vpd_min FLOAT,
  vpd_max FLOAT,
  reading_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH time_buckets AS (
    -- Generate time series buckets from p_since to now
    SELECT generate_series(
      date_trunc('minute', p_since),
      date_trunc('minute', NOW()),
      p_interval::interval
    ) AS bucket_start
  ),
  readings_pivoted AS (
    -- Pivot sensor readings by type within each bucket
    SELECT
      b.bucket_start,
      -- Temperature aggregations
      AVG(CASE WHEN s.sensor_type = 'temperature' THEN s.value END) as avg_temp,
      MIN(CASE WHEN s.sensor_type = 'temperature' THEN s.value END) as min_temp,
      MAX(CASE WHEN s.sensor_type = 'temperature' THEN s.value END) as max_temp,
      -- Humidity aggregations
      AVG(CASE WHEN s.sensor_type = 'humidity' THEN s.value END) as avg_hum,
      MIN(CASE WHEN s.sensor_type = 'humidity' THEN s.value END) as min_hum,
      MAX(CASE WHEN s.sensor_type = 'humidity' THEN s.value END) as max_hum,
      -- VPD aggregations
      AVG(CASE WHEN s.sensor_type = 'vpd' THEN s.value END) as avg_vpd,
      MIN(CASE WHEN s.sensor_type = 'vpd' THEN s.value END) as min_vpd,
      MAX(CASE WHEN s.sensor_type = 'vpd' THEN s.value END) as max_vpd,
      -- Count
      COUNT(s.id)::INTEGER as cnt
    FROM time_buckets b
    LEFT JOIN sensor_readings s
      ON s.controller_id = p_controller_id
      AND s.recorded_at >= b.bucket_start
      AND s.recorded_at < b.bucket_start + p_interval::interval
    GROUP BY b.bucket_start
  )
  SELECT
    r.bucket_start,
    r.avg_temp::FLOAT,
    r.avg_hum::FLOAT,
    r.avg_vpd::FLOAT,
    r.min_temp::FLOAT,
    r.max_temp::FLOAT,
    r.min_hum::FLOAT,
    r.max_hum::FLOAT,
    r.min_vpd::FLOAT,
    r.max_vpd::FLOAT,
    r.cnt
  FROM readings_pivoted r
  WHERE r.avg_temp IS NOT NULL
     OR r.avg_hum IS NOT NULL
     OR r.avg_vpd IS NOT NULL
  ORDER BY r.bucket_start ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_sensor_readings_downsampled(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sensor_readings_downsampled(UUID, TIMESTAMPTZ, TEXT) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION get_sensor_readings_downsampled IS
'Returns time-bucketed sensor readings for efficient chart rendering.
Usage: SELECT * FROM get_sensor_readings_downsampled(
  ''controller-uuid'',
  NOW() - INTERVAL ''7 days'',
  ''30 minutes''
);
Intervals: 1h=1min, 6h=2min, 24h=5min, 7d=30min, 30d=120min, 60d=240min';
