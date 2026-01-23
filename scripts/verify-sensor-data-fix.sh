#!/bin/bash
# Script to verify the sensor data fix is working
# Run this after deploying the fix to production

set -e

BASE_URL="${BASE_URL:-https://enviroflow.app}"
echo "Testing sensor data flow on $BASE_URL"
echo "========================================"

# 1. Trigger sensor polling
echo "1. Triggering sensor poll..."
POLL_RESULT=$(curl -s "$BASE_URL/api/cron/poll-sensors" -H "Content-Type: application/json")
echo "$POLL_RESULT" | jq '.'

# Extract success count
SUCCESS_COUNT=$(echo "$POLL_RESULT" | jq -r '.results.success // 0')
TOTAL_READINGS=$(echo "$POLL_RESULT" | jq -r '.results.totalReadings // 0')

echo ""
echo "Results:"
echo "  - Successful controllers: $SUCCESS_COUNT"
echo "  - Total readings collected: $TOTAL_READINGS"

if [ "$TOTAL_READINGS" -gt 0 ]; then
    echo "  ✓ Sensor polling is working"
else
    echo "  ✗ No readings collected"
    exit 1
fi

echo ""
echo "2. Next steps to verify the fix:"
echo "   a. Check Supabase dashboard → Database → sensor_readings table"
echo "   b. Verify rows exist with recent recorded_at timestamps"
echo "   c. Verify NO 'unknown column' errors in Supabase logs"
echo "   d. Log into dashboard and verify sensor data is visible"
echo "   e. Verify temperature/humidity/VPD values are displayed on room cards"
echo ""
echo "3. SQL query to check recent readings:"
echo "   SELECT controller_id, sensor_type, value, unit, recorded_at"
echo "   FROM sensor_readings"
echo "   WHERE recorded_at > NOW() - INTERVAL '10 minutes'"
echo "   ORDER BY recorded_at DESC"
echo "   LIMIT 20;"
echo ""
echo "4. Expected columns in sensor_readings:"
echo "   - id (UUID)"
echo "   - controller_id (UUID)"
echo "   - sensor_type (TEXT)"
echo "   - value (DECIMAL)"
echo "   - unit (TEXT)"
echo "   - port (INTEGER)"
echo "   - is_stale (BOOLEAN)"
echo "   - recorded_at (TIMESTAMPTZ)"
echo "   - NO user_id column (this was the bug)"
echo ""
