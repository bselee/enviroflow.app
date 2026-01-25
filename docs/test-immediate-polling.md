# Test Plan: Immediate Sensor Polling

## Test Environment Setup
1. Ensure `.env.local` has valid credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ENCRYPTION_KEY` (64 hex characters)
2. Run development server: `npm run dev`
3. Open browser console to view logs

## Test Case 1: AC Infinity Controller
**Objective**: Verify immediate data fetch for AC Infinity controllers

### Steps:
1. Navigate to `/controllers`
2. Click "Add Controller"
3. Select "AC Infinity"
4. Enter valid credentials:
   - Email: `your-ac-infinity-email`
   - Password: `your-ac-infinity-password`
5. Assign to a room
6. Click "Add Controller"

### Expected Results:
- ✅ Controller appears in list immediately with status "online"
- ✅ Dashboard shows sensor data within 2-3 seconds (no "waiting for data")
- ✅ Console logs show: `[Controllers POST] Initial sensor data fetched successfully: X readings`
- ✅ Database `sensor_readings` table has new entries
- ✅ Dashboard updates in realtime via Supabase subscription

### Verification Queries:
```sql
-- Check controller was created
SELECT id, name, brand, status, last_seen
FROM controllers
WHERE brand = 'ac_infinity'
ORDER BY created_at DESC LIMIT 1;

-- Check sensor readings were inserted
SELECT controller_id, sensor_type, value, unit, recorded_at
FROM sensor_readings
WHERE controller_id = '<controller-id-from-above>'
ORDER BY recorded_at DESC;

-- Verify readings were created within seconds of controller creation
SELECT
  c.name,
  c.created_at as controller_created,
  MIN(sr.recorded_at) as first_reading,
  EXTRACT(EPOCH FROM (MIN(sr.recorded_at) - c.created_at)) as delay_seconds
FROM controllers c
LEFT JOIN sensor_readings sr ON c.id = sr.controller_id
WHERE c.id = '<controller-id>'
GROUP BY c.name, c.created_at;
-- Should show delay_seconds < 5
```

---

## Test Case 2: Ecowitt Gateway (TCP)
**Objective**: Verify immediate data fetch for Ecowitt gateways

### Steps:
1. Navigate to `/controllers`
2. Click "Add Controller"
3. Select "Ecowitt"
4. Choose connection method: "TCP"
5. Enter gateway IP: `192.168.1.XXX`
6. Enter MAC address (optional)
7. Click "Add Controller"

### Expected Results:
- ✅ Controller appears with status "online"
- ✅ Sensor data appears immediately (temperature, humidity, pressure, etc.)
- ✅ Console shows successful polling
- ✅ VPD calculated if temp + humidity available

---

## Test Case 3: CSV Upload (Skip Polling)
**Objective**: Verify CSV controllers skip immediate polling

### Steps:
1. Add controller with brand "CSV Upload"
2. Click "Add Controller"

### Expected Results:
- ✅ Controller created successfully
- ✅ Status is "offline" (expected for CSV)
- ✅ No polling attempt logged
- ✅ Console shows: "CSV controllers do not support polling"

---

## Test Case 4: Invalid Credentials
**Objective**: Verify error handling for invalid credentials

### Steps:
1. Add AC Infinity controller with wrong password
2. Click "Add Controller"

### Expected Results:
- ❌ Controller creation fails with clear error message
- ✅ User sees: "Invalid email or password..."
- ✅ No database record created
- ✅ Console logs connection failure

---

## Test Case 5: Connection Succeeds, Polling Fails
**Objective**: Verify graceful handling when initial polling fails

### Setup:
Temporarily break the adapter's `readSensors()` method (for testing only)

### Expected Results:
- ✅ Controller is created successfully
- ✅ Status is "online" (connection succeeded)
- ⚠️ Console shows polling error
- ✅ Cron job will retry polling later
- ✅ User can still use controller

---

## Test Case 6: Multiple Controllers Rapidly
**Objective**: Verify concurrent polling doesn't cause issues

### Steps:
1. Add 3 controllers in quick succession (within 10 seconds)
2. Observe console logs
3. Check database

### Expected Results:
- ✅ All 3 controllers created
- ✅ All 3 fetch sensor data independently
- ✅ No race conditions or conflicts
- ✅ All sensor readings stored correctly

---

## Test Case 7: Realtime Dashboard Update
**Objective**: Verify dashboard updates without page refresh

### Steps:
1. Open dashboard in one browser tab
2. Open `/controllers` in another tab
3. Add a new controller
4. Immediately switch to dashboard tab (DO NOT refresh)

### Expected Results:
- ✅ Dashboard shows new controller's data within 5 seconds
- ✅ No page refresh required
- ✅ Charts update automatically
- ✅ Sensor cards populate

---

## Test Case 8: VPD Auto-Calculation
**Objective**: Verify VPD is calculated when not provided by adapter

### Setup:
Use a controller that reports temp + humidity but not VPD (most Ecowitt gateways)

### Expected Results:
- ✅ Sensor readings include: temperature, humidity, AND vpd
- ✅ VPD value is reasonable (0-5 kPa)
- ✅ VPD formula used: `VPD = SVP × (1 - RH/100)`
- ✅ Console shows: "Found X sensor values"

### Verification:
```sql
-- Check VPD was calculated
SELECT controller_id, sensor_type, value, unit, recorded_at
FROM sensor_readings
WHERE controller_id = '<controller-id>'
  AND sensor_type IN ('temperature', 'humidity', 'vpd')
ORDER BY recorded_at DESC, sensor_type;
-- Should show 3 readings at same timestamp
```

---

## Negative Test Cases

### Test Case 9: Missing Encryption Key
**Setup**: Remove `ENCRYPTION_KEY` from environment

### Expected Results:
- ❌ Controller creation fails
- ✅ Error message: "Server configuration error"
- ✅ No credentials stored unencrypted

### Test Case 10: Database Connection Lost
**Setup**: Temporarily disable Supabase connection

### Expected Results:
- ❌ Controller creation fails
- ✅ Error logged server-side
- ✅ User sees generic error (no sensitive data exposed)

### Test Case 11: Adapter Throws Exception
**Setup**: Mock adapter to throw unexpected error

### Expected Results:
- ✅ Controller creation succeeds
- ⚠️ Polling fails gracefully
- ✅ Error logged with stack trace
- ✅ Cron job will retry later

---

## Performance Tests

### Test Case 12: Large Sensor Dataset
**Objective**: Verify performance with many sensors

### Setup:
Use controller with 8 sensors (Ecowitt with all channels)

### Expected Results:
- ✅ All 8 sensor readings fetched
- ✅ Total time < 10 seconds
- ✅ Database insert succeeds
- ✅ No memory leaks

### Test Case 13: Slow Network
**Setup**: Simulate slow network (Chrome DevTools throttling)

### Expected Results:
- ✅ API response sent before polling completes
- ✅ Polling continues in background
- ✅ Data appears when ready (within timeout)
- ✅ Timeout errors logged if > 100 seconds

---

## Regression Tests

### Test Case 14: Cron Job Still Works
**Objective**: Verify periodic polling unchanged

### Steps:
1. Wait for cron job to run (check logs)
2. Verify it still fetches data every 5 minutes

### Expected Results:
- ✅ Cron job uses same `pollController()` function
- ✅ Behavior identical to before
- ✅ No duplicate data

### Test Case 15: Existing Controllers Unaffected
**Objective**: Verify existing controllers still poll correctly

### Steps:
1. Check existing controllers in database
2. Wait for cron job
3. Verify they still receive data

### Expected Results:
- ✅ Existing controllers unaffected
- ✅ Data continues to flow
- ✅ No errors in logs

---

## Success Criteria
- ✅ All positive test cases pass
- ✅ All negative test cases handle errors gracefully
- ✅ Performance tests complete within timeouts
- ✅ No regression in existing functionality
- ✅ Build succeeds with no errors
- ✅ Linter passes with no new warnings

---

## Monitoring Post-Deployment

### Metrics to Watch:
1. **Initial Fetch Success Rate**: % of controllers that successfully fetch data on first try
2. **Initial Fetch Latency**: Time from controller creation to first sensor reading
3. **Polling Errors**: Count of polling failures (should remain low)
4. **Database Performance**: Sensor readings insert performance

### Logs to Monitor:
```bash
# Successful polls
grep "Initial sensor data fetched successfully" logs

# Failed polls
grep "Initial sensor fetch failed" logs

# Connection errors
grep "Failed to connect" logs
```

### Alerts to Configure:
- Alert if initial fetch success rate < 80%
- Alert if initial fetch latency > 15 seconds (p95)
- Alert if polling error rate > 10%
