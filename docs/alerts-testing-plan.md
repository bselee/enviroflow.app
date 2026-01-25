# Alert System Testing Plan

## TASK-011: Proactive Alerts for Connection Issues

**Test Date:** 2026-01-24
**Tester:** [Your Name]
**Status:** Ready for Testing

---

## Pre-Testing Checklist

- [ ] Database migration run successfully (`20260124_add_alerts_system.sql`)
- [ ] Application deployed to Vercel
- [ ] Cron job configured and running (`/api/cron/check-alerts` every 5 minutes)
- [ ] Test user account created
- [ ] At least 2 test controllers registered

---

## Test Cases

### TC-001: Offline Alert Creation

**Objective:** Verify alert is created when controller is offline > 30 minutes

**Prerequisites:**
- Have a controller registered
- Controller has `last_seen` > 30 minutes ago

**Steps:**
1. Update controller `last_seen` to 40 minutes ago:
   ```sql
   UPDATE controllers
   SET last_seen = NOW() - INTERVAL '40 minutes'
   WHERE id = '[test-controller-id]';
   ```
2. Wait 5 minutes for cron job to run
3. Check `/api/alerts` endpoint
4. Verify alert appears in dashboard AlertBanner

**Expected Result:**
- Alert created with type `offline`
- Message: "[Controller Name] has been offline for 40 minutes"
- Status: `active`
- Notification sent to user

**Pass/Fail:** [ ]

---

### TC-002: Failed Commands Alert Creation

**Objective:** Verify alert is created when 3+ commands fail in last hour

**Prerequisites:**
- Have a controller registered

**Steps:**
1. Create 3 failed activity logs:
   ```sql
   INSERT INTO activity_logs (user_id, controller_id, action_type, result, created_at)
   VALUES
     ('[user-id]', '[controller-id]', 'device_control', 'failed', NOW() - INTERVAL '10 minutes'),
     ('[user-id]', '[controller-id]', 'device_control', 'failed', NOW() - INTERVAL '20 minutes'),
     ('[user-id]', '[controller-id]', 'device_control', 'failed', NOW() - INTERVAL '30 minutes');
   ```
2. Wait 5 minutes for cron job
3. Check alerts

**Expected Result:**
- Alert created with type `failed_commands`
- Message: "[Controller Name] has 3 failed commands in the last hour"
- Metadata includes `failed_command_count: 3`

**Pass/Fail:** [ ]

---

### TC-003: Low Health Alert Creation

**Objective:** Verify alert is created when health score < 50

**Prerequisites:**
- Have a controller registered

**Steps:**
1. Insert low health score:
   ```sql
   INSERT INTO controller_health (controller_id, score, metrics_snapshot, calculated_at)
   VALUES ('[controller-id]', 40, '{"uptime": 50, "sensor_freshness": 30}', NOW());
   ```
2. Wait 5 minutes for cron job
3. Check alerts

**Expected Result:**
- Alert created with type `low_health`
- Message: "[Controller Name] health score is critically low (40/100)"
- Metadata includes `health_score: 40`

**Pass/Fail:** [ ]

---

### TC-004: Duplicate Suppression

**Objective:** Verify duplicate alerts are not created within 1 hour

**Prerequisites:**
- Have an active `offline` alert created within last hour

**Steps:**
1. Verify alert exists in database
2. Wait 5 minutes for cron job to run again
3. Check alerts count

**Expected Result:**
- Only 1 alert exists (duplicate suppressed)
- Cron log shows "Duplicate alert suppressed"

**Pass/Fail:** [ ]

---

### TC-005: Auto-Resolve Offline Alert

**Objective:** Verify offline alerts auto-resolve when controller comes back online

**Prerequisites:**
- Have an active `offline` alert

**Steps:**
1. Update controller to bring it online:
   ```sql
   UPDATE controllers
   SET last_seen = NOW(), status = 'online'
   WHERE id = '[controller-id]';
   ```
2. Wait 5 minutes for cron job
3. Check alert status

**Expected Result:**
- Alert status changed to `resolved`
- `resolved_at` timestamp set
- Alert no longer appears in AlertBanner

**Pass/Fail:** [ ]

---

### TC-006: Auto-Resolve Failed Commands Alert

**Objective:** Verify failed_commands alerts auto-resolve when failures drop below 3

**Prerequisites:**
- Have an active `failed_commands` alert

**Steps:**
1. Delete 1 failed activity log to bring count below 3
2. Wait 5 minutes for cron job
3. Check alert status

**Expected Result:**
- Alert auto-resolved
- No longer appears in active alerts

**Pass/Fail:** [ ]

---

### TC-007: Auto-Resolve Low Health Alert

**Objective:** Verify low_health alerts auto-resolve when score improves

**Prerequisites:**
- Have an active `low_health` alert

**Steps:**
1. Insert improved health score:
   ```sql
   INSERT INTO controller_health (controller_id, score, calculated_at)
   VALUES ('[controller-id]', 75, NOW());
   ```
2. Wait 5 minutes for cron job
3. Check alert status

**Expected Result:**
- Alert auto-resolved
- No longer appears in active alerts

**Pass/Fail:** [ ]

---

### TC-008: Acknowledge Alert

**Objective:** Verify user can acknowledge an alert

**Prerequisites:**
- Have an active alert

**Steps:**
1. Click "Acknowledge" button in AlertBanner
2. Verify API call to `/api/alerts/[id]/acknowledge`
3. Check alert status in database

**Expected Result:**
- Alert status changed to `acknowledged`
- `acknowledged_at` timestamp set
- Alert disappears from AlertBanner

**Pass/Fail:** [ ]

---

### TC-009: Snooze Alert (12 hours)

**Objective:** Verify user can snooze an alert for 12 hours

**Prerequisites:**
- Have an active alert

**Steps:**
1. Click snooze dropdown in AlertBanner
2. Select "Snooze 12 hours"
3. Verify API call to `/api/alerts/[id]/snooze`
4. Check alert status in database

**Expected Result:**
- Alert status changed to `snoozed`
- `snoozed_until` set to 12 hours from now
- Alert disappears from AlertBanner

**Pass/Fail:** [ ]

---

### TC-010: Snooze Alert (24 hours)

**Objective:** Verify user can snooze an alert for 24 hours

**Steps:** Same as TC-009 but select "Snooze 24 hours"

**Expected Result:**
- `snoozed_until` set to 24 hours from now

**Pass/Fail:** [ ]

---

### TC-011: Snooze Alert (48 hours)

**Objective:** Verify user can snooze an alert for 48 hours

**Steps:** Same as TC-009 but select "Snooze 48 hours"

**Expected Result:**
- `snoozed_until` set to 48 hours from now

**Pass/Fail:** [ ]

---

### TC-012: Reactivate Snoozed Alert

**Objective:** Verify snoozed alerts reactivate when snooze period expires

**Prerequisites:**
- Have a snoozed alert

**Steps:**
1. Update `snoozed_until` to past time:
   ```sql
   UPDATE alerts
   SET snoozed_until = NOW() - INTERVAL '1 minute'
   WHERE id = '[alert-id]';
   ```
2. Wait 5 minutes for cron job
3. Check alert status and AlertBanner

**Expected Result:**
- Alert status changed back to `active`
- `snoozed_until` set to NULL
- Alert reappears in AlertBanner
- New notification sent

**Pass/Fail:** [ ]

---

### TC-013: Quick Action - Reconnect (Offline)

**Objective:** Verify "Reconnect" button works for offline alerts

**Prerequisites:**
- Have an active `offline` alert

**Steps:**
1. Click "Reconnect" button in AlertBanner
2. Verify navigation to controller detail page

**Expected Result:**
- Redirected to `/dashboard/controllers/[id]`

**Pass/Fail:** [ ]

---

### TC-014: Quick Action - View Diagnostics (Failed Commands)

**Objective:** Verify "View Diagnostics" button works for failed_commands alerts

**Prerequisites:**
- Have an active `failed_commands` alert

**Steps:**
1. Click "View Diagnostics" button in AlertBanner
2. Verify navigation to controller detail page

**Expected Result:**
- Redirected to `/dashboard/controllers/[id]`

**Pass/Fail:** [ ]

---

### TC-015: Quick Action - View Diagnostics (Low Health)

**Objective:** Verify "View Diagnostics" button works for low_health alerts

**Prerequisites:**
- Have an active `low_health` alert

**Steps:**
1. Click "View Diagnostics" button in AlertBanner
2. Verify navigation to controller detail page

**Expected Result:**
- Redirected to `/dashboard/controllers/[id]`

**Pass/Fail:** [ ]

---

### TC-016: Local Dismiss

**Objective:** Verify user can dismiss alert locally (without database change)

**Prerequisites:**
- Have an active alert

**Steps:**
1. Click X (close) button in AlertBanner
2. Refresh page
3. Check if alert reappears

**Expected Result:**
- Alert disappears immediately
- After refresh, alert reappears (local state only)
- Database status unchanged

**Pass/Fail:** [ ]

---

### TC-017: Push Notification Delivery

**Objective:** Verify push notifications are sent when alert is created

**Prerequisites:**
- Have push token registered for test user
- Have test device or browser with notifications enabled

**Steps:**
1. Create alert condition (e.g., offline controller)
2. Wait 5 minutes for cron job
3. Check device/browser for notification

**Expected Result:**
- Push notification received with:
  - Title: "Controller Alert"
  - Body: Alert message
  - Data includes `alert_id`, `controller_id`, `actionUrl`

**Pass/Fail:** [ ]

---

### TC-018: In-App Notification Fallback

**Objective:** Verify in-app notification is created when push delivery fails

**Prerequisites:**
- Have no push token registered for test user

**Steps:**
1. Create alert condition
2. Wait 5 minutes for cron job
3. Check `notifications` table

**Expected Result:**
- In-app notification created in database
- Category matches alert type

**Pass/Fail:** [ ]

---

### TC-019: Real-Time Updates

**Objective:** Verify AlertBanner updates in real-time via Supabase subscription

**Prerequisites:**
- Have dashboard open in browser
- Have AlertBanner visible

**Steps:**
1. In another tab/tool, insert a new alert directly into database:
   ```sql
   INSERT INTO alerts (user_id, controller_id, alert_type, message, status)
   VALUES ('[user-id]', '[controller-id]', 'offline', 'Test alert', 'active');
   ```
2. Watch AlertBanner (do not refresh page)

**Expected Result:**
- Alert appears in banner without page refresh
- Appears within 1-2 seconds

**Pass/Fail:** [ ]

---

### TC-020: Multiple Alerts Display

**Objective:** Verify multiple alerts display correctly in AlertBanner

**Prerequisites:**
- Have 3+ active alerts

**Steps:**
1. Create 3 different alerts (offline, failed_commands, low_health)
2. Open dashboard
3. Check AlertBanner

**Expected Result:**
- All 3 alerts visible
- Correct colors (red for offline/low_health, amber for failed_commands)
- Each has appropriate quick actions

**Pass/Fail:** [ ]

---

### TC-021: GET /api/alerts

**Objective:** Verify alerts API returns correct data

**Steps:**
1. Make GET request to `/api/alerts`
2. Verify response structure

**Expected Result:**
```json
{
  "alerts": [...],
  "stats": {
    "total": 5,
    "active": 2,
    "snoozed": 1,
    "acknowledged": 1,
    "resolved": 1,
    "byType": {
      "offline": 2,
      "failed_commands": 1,
      "low_health": 2
    }
  }
}
```

**Pass/Fail:** [ ]

---

### TC-022: GET /api/alerts?status=active

**Objective:** Verify status filter works

**Steps:**
1. Make GET request to `/api/alerts?status=active`
2. Verify only active alerts returned

**Expected Result:**
- Only alerts with `status='active'` returned

**Pass/Fail:** [ ]

---

### TC-023: GET /api/alerts?controller_id=...

**Objective:** Verify controller_id filter works

**Steps:**
1. Make GET request with controller_id filter
2. Verify only alerts for that controller returned

**Expected Result:**
- Only alerts for specified controller returned

**Pass/Fail:** [ ]

---

### TC-024: Cron Job Execution

**Objective:** Verify cron job runs successfully every 5 minutes

**Steps:**
1. Check Vercel Dashboard > Deployments > Cron
2. Verify `/api/cron/check-alerts` is scheduled
3. Check execution logs

**Expected Result:**
- Cron runs every 5 minutes
- No errors in logs
- Returns statistics in response

**Pass/Fail:** [ ]

---

### TC-025: Alert Cleanup (30-day retention)

**Objective:** Verify old resolved/acknowledged alerts are cleaned up

**Prerequisites:**
- Have resolved/acknowledged alert older than 30 days

**Steps:**
1. Insert old alert:
   ```sql
   INSERT INTO alerts (user_id, controller_id, alert_type, message, status, resolved_at, created_at)
   VALUES ('[user-id]', '[controller-id]', 'offline', 'Old alert', 'resolved', NOW() - INTERVAL '31 days', NOW() - INTERVAL '31 days');
   ```
2. Call cleanup function:
   ```sql
   SELECT cleanup_old_alerts();
   ```
3. Verify alert deleted

**Expected Result:**
- Old alerts removed from database
- Active/snoozed alerts retained

**Pass/Fail:** [ ]

---

## Performance Testing

### PT-001: Large Controller Count

**Objective:** Verify system performance with 100+ controllers

**Steps:**
1. Create 100 test controllers
2. Run cron job
3. Measure execution time

**Expected Result:**
- Completes within 60 seconds
- No timeouts or memory errors

**Pass/Fail:** [ ]

---

### PT-002: Concurrent Alert Processing

**Objective:** Verify system handles multiple alerts being created simultaneously

**Steps:**
1. Create conditions for 10+ alerts at once
2. Run cron job
3. Verify all alerts processed correctly

**Expected Result:**
- All alerts created successfully
- No race conditions or duplicates

**Pass/Fail:** [ ]

---

## Security Testing

### ST-001: Unauthorized Access to Alerts

**Objective:** Verify users can only access their own alerts

**Steps:**
1. Create alert for User A
2. Try to access it as User B via API
3. Verify access denied

**Expected Result:**
- 403 Forbidden error
- No alert data returned

**Pass/Fail:** [ ]

---

### ST-002: RLS Policy Enforcement

**Objective:** Verify Row Level Security prevents cross-user data access

**Steps:**
1. Try to query alerts table directly with User B credentials
2. Verify only User B's alerts returned

**Expected Result:**
- RLS blocks access to other users' alerts
- Only own alerts visible

**Pass/Fail:** [ ]

---

## Regression Testing

### RT-001: Existing Cron Jobs Unaffected

**Objective:** Verify new cron job doesn't interfere with existing jobs

**Steps:**
1. Verify `/api/cron/workflows` still runs every minute
2. Verify `/api/cron/poll-sensors` still runs every 2 minutes
3. Check logs for conflicts

**Expected Result:**
- All cron jobs run on schedule
- No conflicts or errors

**Pass/Fail:** [ ]

---

### RT-002: Controller CRUD Operations

**Objective:** Verify alert system doesn't break controller operations

**Steps:**
1. Create new controller
2. Update controller
3. Delete controller
4. Verify alerts cascade correctly

**Expected Result:**
- All operations work as before
- Alerts deleted when controller deleted (CASCADE)

**Pass/Fail:** [ ]

---

## Test Summary

**Total Test Cases:** 27
**Passed:** [ ]
**Failed:** [ ]
**Blocked:** [ ]
**Not Tested:** [ ]

**Overall Status:** [ ] PASS / [ ] FAIL

---

## Issues Found

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
|    |          |             |        |

---

## Sign-Off

**Tested By:** ___________________
**Date:** ___________________
**Approved By:** ___________________
**Date:** ___________________
