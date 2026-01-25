# Immediate Sensor Polling Fix

## Problem
When a controller was added and assigned to a room, the dashboard showed "waiting for data" instead of immediately displaying sensor readings. Users had to wait up to 5 minutes for the cron job to run before seeing any data.

## Root Cause
The POST /api/controllers endpoint successfully connected and validated controllers, but did NOT fetch any sensor data. Sensor data was only fetched by the periodic cron job at `/api/cron/poll-sensors`, which runs every 5 minutes.

## Solution
Implemented immediate sensor data fetching after a controller is successfully added:

### 1. Created Shared Polling Utility (`apps/web/src/lib/poll-sensors.ts`)
- Extracted sensor polling logic into a reusable `pollController()` function
- Used by both POST /api/controllers and the cron job
- Handles all controller brands (AC Infinity, Inkbird, Ecowitt, etc.)
- Features:
  - Decrypts credentials
  - Connects via appropriate adapter
  - Reads sensor data
  - Validates readings
  - Calculates VPD if temperature and humidity are available
  - Stores readings in sensor_readings table
  - Updates controller status and last_seen timestamp

### 2. Updated POST /api/controllers Route
- Added import for `pollController` utility
- After successful controller creation, triggers immediate sensor fetch using `setImmediate()`
- Runs in the background (non-blocking) so the API response is sent immediately
- Best-effort approach - if polling fails, controller creation still succeeds
- Comprehensive logging for troubleshooting

### 3. Refactored Cron Job
- Updated `/api/cron/poll-sensors` to use the shared `pollController()` function
- Eliminated code duplication
- Ensures consistent polling behavior

## Implementation Details

### Flow
1. User adds controller via UI
2. POST /api/controllers validates credentials and creates database record
3. Immediately after database insert:
   - Response is sent to user (controller appears as "online")
   - Background task triggers sensor data fetch
   - Sensor data is stored in database
4. Dashboard receives realtime update and shows data instantly

### Supported Brands
- ✅ AC Infinity (Controller 69, Controller 67, UIS devices)
- ✅ Inkbird (ITC-308, ITC-310T, IHC-200) - *Note: Currently returns error due to Tuya dependency*
- ✅ Ecowitt (GW1000/GW2000/GW3000, multi-channel sensors)
- ⏭️ CSV Upload (skipped - manual data entry, no polling)

### Error Handling
- Decryption errors: Marks controller as 'error' status
- Connection failures: Marks controller as 'offline'
- Sensor read failures: Logs error, doesn't mark offline (might be transient)
- Invalid readings: Filtered out, logged
- All errors are logged with context for debugging

### Data Validation
- Temperature: -40°F to 212°F
- Humidity: 0% to 100%
- VPD: 0 kPa to 5 kPa
- CO2: 0 ppm to 10,000 ppm
- Light: 0 lux to 200,000 lux
- pH: 0 to 14
- EC: 0 μS/cm to 20 μS/cm

### VPD Calculation
If a controller returns temperature and humidity but not VPD, the system automatically calculates it using the Magnus-Tetens formula:
```
VPD = SVP × (1 - RH/100)
where SVP = 0.6108 × e^((17.27 × T_c) / (T_c + 237.3))
```

## Files Modified
- **Created:** `apps/web/src/lib/poll-sensors.ts` - Shared polling utility
- **Modified:** `apps/web/src/app/api/controllers/route.ts` - Added immediate polling
- **Modified:** `apps/web/src/app/api/cron/poll-sensors/route.ts` - Refactored to use shared utility

## Testing Recommendations
1. **AC Infinity**: Add a Controller 69 with valid credentials, verify data appears immediately
2. **Ecowitt**: Add a GW2000 gateway via TCP/HTTP, verify sensor readings appear
3. **Error Cases**: Test with invalid credentials, verify error handling
4. **Realtime Updates**: Verify dashboard updates without page refresh
5. **Multiple Controllers**: Add multiple controllers in quick succession, verify all fetch data

## Benefits
- ✅ Immediate data visibility - No more "waiting for data"
- ✅ Better UX - Users see results instantly
- ✅ Reduced code duplication - Shared polling logic
- ✅ Consistent behavior - Same polling logic everywhere
- ✅ Robust error handling - Graceful degradation
- ✅ Works for all brands - AC Infinity, Ecowitt, Inkbird (when API available)

## Known Limitations
- **Inkbird**: Currently returns error due to Tuya platform dependency (no direct API available)
- **CSV Upload**: Skipped (manual data entry, no polling)
- **Background fetch**: Uses `setImmediate()` which may not be available in all environments (works in Node.js/Vercel)

## Future Enhancements
1. Add retry logic for failed initial fetches
2. Fetch historical data (past hour/day) on initial connection
3. Support incremental backfill for controllers with large datasets
4. Add progress indicator in UI during initial fetch
5. Implement Tuya API integration for Inkbird support
