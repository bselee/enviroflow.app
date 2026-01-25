# Dashboard Debug Logging - Sensor Data Flow Tracing

## Problem
Dashboard shows "waiting for data" even after controller is added and assigned to room.

## Solution
Added comprehensive logging to trace the entire data flow from controller addition through sensor polling to database insertion.

## Logging Added

### 1. Controller Addition API (`/apps/web/src/app/api/controllers/route.ts`)

**Location**: POST /api/controllers endpoint, after database insert (lines 870-903)

**Logs Added**:
- Controller details before polling (name, brand, controller_id, database id)
- Credential format verification (type, length)
- Poll result status and readings count
- Success/failure indicators with emojis (✅/⚠️/❌)

**What to Watch For**:
- Verify credentials are encrypted strings (not objects)
- Check that pollController is called with correct data structure
- Monitor poll result for success/failure

### 2. Poll Controller Function (`/apps/web/src/lib/poll-sensors.ts`)

**Logs Added**:

#### Entry Point (lines 149-157)
- Controller name, brand, IDs
- Credentials type and length
- User ID

#### Credential Decryption (lines 176-192)
- Decryption attempt and result
- Decrypted credential keys (without values)
- Encryption errors with details

#### Adapter Connection (lines 217-247)
- Adapter initialization
- Credential building
- Connection attempt and result
- Connection success/failure with controller ID

#### Sensor Reading (lines 252-264)
- Read sensor attempt
- Number of readings returned
- Sensor types and values
- Individual reading validation

#### Database Insert (lines 302-320)
- Number of readings to insert
- Sample reading structure
- Insert success/failure
- Database error details (message, code, hint)

#### Status Update (lines 323-333)
- Controller status update attempt
- Update success/failure

#### Cleanup (lines 368-374)
- Disconnect attempt
- Disconnect result

### 3. AC Infinity Adapter (`/apps/automation-engine/lib/adapters/ACInfinityAdapter.ts`)

**Location**: readSensors method (lines 522-707)

**Logs Added**:
- Token validation
- API fetch attempt and result
- Response code and structure
- Final reading count with types and values

## How to Use This Logging

### During Controller Addition

1. **Check Console Logs** in deployment (Vercel logs) or local dev console

2. **Look for the sequence**:
   ```
   [Controllers POST] ========== STARTING INITIAL SENSOR POLL ==========
   [pollController] ========== START POLLING ==========
   [ACInfinityAdapter] ========== readSensors START ==========
   ```

3. **Verify each step**:
   - ✅ Credentials decrypt successfully
   - ✅ Adapter connects
   - ✅ Sensors read successfully
   - ✅ Readings inserted into database
   - ✅ Controller status updated

### Common Issues to Watch For

#### Issue 1: Credential Format Problem
```
[pollController] Credentials type: object
```
**Expected**: `string` (encrypted credentials)
**Fix**: Verify encryption is happening in POST /api/controllers

#### Issue 2: Decryption Failure
```
[pollController] ❌ Encryption error: Credentials cannot be decrypted
```
**Cause**: ENCRYPTION_KEY mismatch or invalid encrypted data
**Fix**: Verify ENCRYPTION_KEY is consistent across restarts

#### Issue 3: No Readings Returned
```
[ACInfinityAdapter] ========== readSensors COMPLETE: 0 readings ==========
```
**Cause**: Controller has no sensors or API returned no data
**Fix**: Check controller capabilities, verify device has sensors

#### Issue 4: Database Insert Failure
```
[pollController] ❌ Failed to insert readings: column "user_id" does not exist
```
**Cause**: Table schema mismatch
**Fix**: Removed user_id from insert (sensor_readings table doesn't have it)

#### Issue 5: Invalid Sensor Types
```
[pollController] ⚠️ Invalid sensor reading: co2 = 50000
```
**Cause**: Sensor value outside valid range
**Fix**: Check sensor validation ranges in SENSOR_VALIDATIONS

## Key Data Points to Capture

When reporting issues, include these log lines:

1. Controller data structure:
   ```
   [Controllers POST] Calling pollController with data: {...}
   ```

2. Decrypted credential keys:
   ```
   [pollController] Decrypted credential keys: type, email, password
   ```

3. Connection result:
   ```
   [pollController] Connection result: {success, controllerId, ...}
   ```

4. Sensor readings:
   ```
   [pollController] Sensor types: temperature, humidity
   [pollController] Sensor values: temperature=72.5F, humidity=65.0%
   ```

5. Database insert result:
   ```
   [pollController] ✅ Successfully inserted 2 readings
   ```

## Expected Flow (Happy Path)

```
[Controllers POST] ========== STARTING INITIAL SENSOR POLL ==========
[Controllers POST] Controller name: My AC Controller
[Controllers POST] Controller brand: ac_infinity
[Controllers POST] Has credentials: true
[Controllers POST] Credentials type: string

[pollController] ========== START POLLING ==========
[pollController] Brand: ac_infinity
[pollController] ✅ Credentials decrypted successfully
[pollController] Decrypted credential keys: type, email, password

[pollController] Connecting to ac_infinity controller...
[ACInfinityAdapter] Attempting login...
[ACInfinityAdapter] Login successful
[pollController] ✅ Connected successfully

[ACInfinityAdapter] ========== readSensors START ==========
[ACInfinityAdapter] Token valid, fetching device settings...
[ACInfinityAdapter] Found device-level temperature sensor
[ACInfinityAdapter] Found device-level humidity sensor
[ACInfinityAdapter] ========== readSensors COMPLETE: 2 readings ==========

[pollController] ✅ Read 2 sensor readings
[pollController] Sensor types: temperature, humidity
[pollController] Valid readings count: 2

[pollController] Inserting 2 readings into database...
[pollController] ✅ Successfully inserted 2 readings
[pollController] ✅ Controller status updated to online

[Controllers POST] ✅ Initial sensor data fetched successfully: 2 readings
```

## Next Steps

1. Add a controller through the UI
2. Monitor logs in real-time (Vercel dashboard or local console)
3. Follow the data flow through each step
4. Identify where the flow breaks
5. Report findings with specific log snippets

## Cleanup

After debugging is complete, consider removing some of the more verbose logging (especially in production) or adding a DEBUG flag to control log verbosity.
