# Dashboard Sensor Data Issue - Root Cause Analysis and Fix

## Problem Statement
Dashboard is not showing sensor data even though the sensor polling cron job reports success with readings being collected.

## Investigation Timeline

### Evidence Collected
1. Sensor polling endpoint `/api/cron/poll-sensors` returns success: "Polled 2 controllers, success: 2, totalReadings: 4"
2. Database schema shows `sensor_readings` table has `recorded_at` column (not `timestamp`)
3. Schema cache was reloaded successfully
4. Dashboard hooks are correctly querying `sensor_readings` with `recorded_at` column

## Root Cause

**Schema Mismatch Between Code and Database**

The cron job at `/apps/web/src/app/api/cron/poll-sensors/route.ts` (line 420-429) was attempting to insert a `user_id` column into the `sensor_readings` table, but this column does not exist in the database schema.

### Code (BEFORE FIX)
```typescript
const readingsToInsert = validReadings.map(reading => ({
  controller_id: dbControllerId,
  user_id,  // ← THIS COLUMN DOESN'T EXIST IN sensor_readings TABLE
  port: reading.port,
  sensor_type: reading.type,
  value: reading.value,
  unit: reading.unit,
  is_stale: false,
  recorded_at: now
}))
```

### Actual Database Schema
```sql
CREATE TABLE sensor_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  sensor_type TEXT NOT NULL CHECK (sensor_type IN ('temperature', 'humidity', 'vpd', 'co2', 'light', 'ph', 'ec', 'pressure', 'water_level')),
  value DECIMAL(10, 4) NOT NULL,
  unit TEXT NOT NULL,
  port INTEGER,
  is_stale BOOLEAN DEFAULT false,
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- NO user_id COLUMN
  CONSTRAINT sensor_readings_unit_not_empty CHECK (LENGTH(TRIM(unit)) > 0)
);
```

### Why This Failed Silently

The Supabase insert was failing due to the unknown column, but the error was only being logged (line 436):

```typescript
if (insertError) {
  log('error', `Failed to insert readings for ${name}`, { error: insertError.message })
}
```

The function continued execution and returned success status because:
1. Controller connection was successful
2. Sensor reading was successful
3. Only the database insert failed (caught and logged)
4. No readings appeared in the database
5. Dashboard queries returned empty results

## The Fix

**Remove `user_id` from the insert statement** because:

1. The `sensor_readings` table doesn't have a `user_id` column
2. User ownership is established through `controller_id` → `controllers.user_id` relationship
3. RLS (Row Level Security) policies handle access control via table join:

```sql
CREATE POLICY "Users can view own sensor_readings via controller"
  ON sensor_readings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM controllers
      WHERE controllers.id = sensor_readings.controller_id
      AND controllers.user_id = auth.uid()
    )
  );
```

### Code (AFTER FIX)
```typescript
const readingsToInsert = validReadings.map(reading => ({
  controller_id: dbControllerId,
  // user_id removed - not in schema, handled via controller relationship
  port: reading.port,
  sensor_type: reading.type,
  value: reading.value,
  unit: reading.unit,
  is_stale: false,
  recorded_at: now
}))
```

## Files Modified
- `/workspaces/enviroflow.app/apps/web/src/app/api/cron/poll-sensors/route.ts` (line 422)

## Verification Steps

After deploying the fix:

1. Trigger sensor polling: `curl https://enviroflow.app/api/cron/poll-sensors`
2. Check Supabase logs for insert errors (should be gone)
3. Query sensor_readings table directly to verify data insertion
4. Check dashboard to confirm sensor data is displaying
5. Verify realtime updates are working (new readings appear live)

## Related Files in Data Flow

### Insertion
- `/apps/web/src/app/api/cron/poll-sensors/route.ts` - Polls controllers and inserts readings

### Query/Display
- `/apps/web/src/hooks/use-dashboard-data.ts` - Fetches sensor readings with time range filter
- `/apps/web/src/hooks/use-sensor-readings.ts` - Fetches readings for specific controllers
- `/apps/web/src/components/dashboard/RoomCard.tsx` - Displays sensor data with charts

### Database Schema
- `/apps/automation-engine/supabase/migrations/20260121_complete_schema.sql` - Complete schema definition

## Additional Checks Performed

1. Verified no other code locations insert into `sensor_readings`
2. Confirmed `DBController` interface correctly includes `user_id` (from controllers table)
3. Confirmed dashboard hooks use correct column names (`recorded_at` not `timestamp`)
4. Confirmed RLS policies are properly configured for user data isolation
5. Build successful with no TypeScript errors

## Deployment Required

This fix requires deployment to production to take effect. The issue persists in production until the updated code is deployed.
