-- ============================================================================
-- Migration: Auto-Log Trigger for Device State Changes
-- Purpose: Automatically log state changes when controller_ports is updated
-- ============================================================================

-- Drop existing trigger and function if they exist (for idempotency)
DROP TRIGGER IF EXISTS tr_log_device_state_change ON controller_ports;
DROP FUNCTION IF EXISTS log_device_state_change();

-- Create the trigger function
CREATE OR REPLACE FUNCTION log_device_state_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if the state actually changed (on/off or power level when on)
  IF (OLD.is_on IS DISTINCT FROM NEW.is_on) OR
     (NEW.is_on = true AND OLD.power_level IS DISTINCT FROM NEW.power_level) THEN

    INSERT INTO device_state_log (
      controller_id,
      port_number,
      device_name,
      state,
      speed,
      trigger,
      recorded_at
    ) VALUES (
      NEW.controller_id,
      NEW.port_number,
      COALESCE(NEW.port_name, 'Port ' || NEW.port_number),
      NEW.is_on,
      -- Convert 0-10 scale to 0-100%
      CASE
        WHEN NEW.is_on THEN COALESCE(NEW.power_level, 0) * 10
        ELSE 0
      END,
      -- Determine trigger source based on current_mode
      CASE NEW.current_mode
        WHEN 0 THEN 'manual'   -- OFF mode
        WHEN 1 THEN 'manual'   -- ON mode
        WHEN 2 THEN 'auto'     -- AUTO mode
        WHEN 3 THEN 'timer'    -- TIMER mode
        WHEN 4 THEN 'cycle'    -- CYCLE mode
        WHEN 5 THEN 'schedule' -- SCHEDULE mode
        WHEN 6 THEN 'vpd'      -- VPD mode
        WHEN 7 THEN 'auto'     -- ADVANCE mode
        ELSE 'system'
      END,
      NOW()
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on controller_ports
CREATE TRIGGER tr_log_device_state_change
  AFTER UPDATE ON controller_ports
  FOR EACH ROW
  EXECUTE FUNCTION log_device_state_change();

-- Add comment for documentation
COMMENT ON FUNCTION log_device_state_change IS
'Trigger function that logs device state changes to device_state_log.
Fires on controller_ports UPDATE when is_on or power_level changes.
Maps AC Infinity mode codes to trigger sources:
  0=OFF(manual), 1=ON(manual), 2=AUTO, 3=TIMER, 4=CYCLE, 5=SCHEDULE, 6=VPD, 7=ADVANCE';

-- ============================================================================
-- Optional: Backfill function to populate initial state from controller_ports
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_device_state_log()
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  -- Insert current state for all ports that don't have a log entry yet
  WITH latest_states AS (
    SELECT DISTINCT ON (controller_id, port_number)
      controller_id, port_number
    FROM device_state_log
  )
  INSERT INTO device_state_log (
    controller_id,
    port_number,
    device_name,
    state,
    speed,
    trigger,
    recorded_at
  )
  SELECT
    cp.controller_id,
    cp.port_number,
    COALESCE(cp.port_name, 'Port ' || cp.port_number),
    cp.is_on,
    CASE WHEN cp.is_on THEN COALESCE(cp.power_level, 0) * 10 ELSE 0 END,
    'system',
    COALESCE(cp.last_state_change, cp.updated_at, NOW())
  FROM controller_ports cp
  LEFT JOIN latest_states ls
    ON ls.controller_id = cp.controller_id
    AND ls.port_number = cp.port_number
  WHERE ls.controller_id IS NULL
    AND cp.is_connected = true;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION backfill_device_state_log() TO service_role;

COMMENT ON FUNCTION backfill_device_state_log IS
'One-time function to populate device_state_log with current port states.
Run after migration to establish baseline state for existing devices.
Usage: SELECT backfill_device_state_log();';
