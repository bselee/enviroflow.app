-- Migration: Add Ecowitt sensor types
-- Date: 2026-01-24
-- Description: Add sensor types required by Ecowitt weather sensors (wind_speed, pm25, uv, solar_radiation, rain)

-- Add Ecowitt sensor types to sensor_readings check constraint
ALTER TABLE sensor_readings DROP CONSTRAINT IF EXISTS sensor_readings_sensor_type_check;
ALTER TABLE sensor_readings ADD CONSTRAINT sensor_readings_sensor_type_check
  CHECK (sensor_type IN (
    'temperature', 'humidity', 'vpd', 'co2', 'light', 'ph', 'ec',
    'pressure', 'water_level', 'soil_moisture', 'wind_speed', 'pm25',
    'uv', 'solar_radiation', 'rain'
  ));

-- Add valve/pump device types to controllers capabilities if constraint exists
-- Note: capabilities is a JSONB field, so device types are not constrained at DB level
-- This comment documents the expected device types for Ecowitt IoT devices:
-- - valve (WFC01 water valves)
-- - pump (future support)
-- - outlet (AC1100 smart plugs)
