# Proactive Alerts System

**Status:** Production Ready
**Version:** 1.0
**Last Updated:** 2026-01-24

## Overview

The Proactive Alerts System monitors controller health and connection status, automatically notifying users when issues are detected. Alerts are created based on configurable thresholds and include quick actions for remediation.

## Features

### Alert Triggers

1. **Offline Controller** (`offline`)
   - Triggers when: Controller offline > 30 minutes
   - Metadata: `offline_duration_minutes`, `last_seen`
   - Quick Action: "Reconnect Now"

2. **Failed Commands** (`failed_commands`)
   - Triggers when: 3+ consecutive failed commands in last hour
   - Metadata: `failed_command_count`
   - Quick Action: "View Diagnostics"

3. **Low Health Score** (`low_health`)
   - Triggers when: Health score < 50
   - Metadata: `health_score`
   - Quick Action: "View Diagnostics"

### Alert Lifecycle

```
[Created] → [Active] → [Acknowledged/Snoozed/Resolved]
              ↓              ↓
           [Notification]  [Auto-resolve when condition improves]
```

- **Active**: New alert, visible in dashboard
- **Acknowledged**: User has seen it but not resolved
- **Snoozed**: Temporarily hidden for 12/24/48 hours
- **Resolved**: Condition improved (auto) or user manually resolved

### Duplicate Suppression

- Maximum 1 alert per controller per type per hour
- Prevents notification spam
- Implemented via `has_recent_alert()` function

### Auto-Resolution

Alerts automatically resolve when conditions improve:
- **Offline**: Controller comes back online
- **Failed Commands**: Recent failures drop below 3
- **Low Health**: Health score rises above 50

### Snooze Period Reactivation

- Snoozed alerts automatically reactivate when snooze period expires
- Checked every 5 minutes by cron job
- User receives new notification when reactivated

## Database Schema

### Tables

**alerts**
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  controller_id UUID REFERENCES controllers(id),
  alert_type TEXT CHECK (alert_type IN ('offline', 'failed_commands', 'low_health')),
  message TEXT NOT NULL,
  status TEXT CHECK (status IN ('active', 'acknowledged', 'snoozed', 'resolved')),
  snoozed_until TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);
```

### Functions

- `has_recent_alert(controller_id, alert_type, threshold_hours)` - Duplicate suppression
- `get_active_alerts(controller_id)` - Get all active alerts
- `get_expired_snooze_alerts()` - Get alerts to reactivate
- `auto_resolve_alerts(controller_id, alert_type)` - Resolve alerts when condition improves
- `snooze_alert(alert_id, snooze_hours)` - Snooze for 12/24/48 hours
- `acknowledge_alert(alert_id)` - Mark as acknowledged
- `cleanup_old_alerts()` - Remove alerts older than 30 days

## API Endpoints

### GET /api/alerts

List all alerts for authenticated user.

**Query Parameters:**
- `status`: Filter by status (active, acknowledged, snoozed, resolved)
- `controller_id`: Filter by controller
- `alert_type`: Filter by type (offline, failed_commands, low_health)

**Response:**
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

### POST /api/alerts/[id]/acknowledge

Acknowledge an alert.

**Response:**
```json
{
  "success": true,
  "message": "Alert acknowledged"
}
```

### POST /api/alerts/[id]/snooze

Snooze an alert.

**Request Body:**
```json
{
  "hours": 12 | 24 | 48
}
```

**Response:**
```json
{
  "success": true,
  "message": "Alert snoozed for 12 hours",
  "snooze_until": "2026-01-25T12:00:00Z"
}
```

### POST /api/alerts/[id]/resolve

Manually resolve an alert.

**Response:**
```json
{
  "success": true,
  "message": "Alert resolved"
}
```

## Cron Job

### Schedule

Runs every 5 minutes via Vercel Cron:

```json
{
  "path": "/api/cron/check-alerts",
  "schedule": "*/5 * * * *"
}
```

### Execution Flow

1. Reactivate snoozed alerts (snooze period expired)
2. Fetch all controllers
3. For each controller:
   - Auto-resolve improved conditions
   - Check new alert conditions
   - Create alerts (with duplicate suppression)
   - Send notifications (push + in-app)
4. Return statistics

### Example Response

```json
{
  "message": "Checked 10 controllers",
  "results": {
    "checked": 10,
    "success": 9,
    "failed": 1,
    "alertsCreated": 3,
    "alertsResolved": 2,
    "alertsReactivated": 1
  },
  "details": [...],
  "duration": 1234
}
```

## UI Components

### AlertBanner

Displays active alerts at the top of the dashboard.

**Location:** `src/components/dashboard/AlertBanner.tsx`

**Features:**
- Real-time updates via Supabase subscriptions
- Color-coded by alert type (red=offline/low_health, amber=failed_commands)
- Quick actions: Acknowledge, Snooze, Reconnect, View Diagnostics
- Local dismiss (temporary hide without changing database)
- Compact view for multiple alerts

**Usage:**
```tsx
import { AlertBanner } from '@/components/dashboard/AlertBanner'

<AlertBanner userId={user.id} />
```

## Notification Delivery

Alerts trigger notifications via the existing push notification service:

- **Push Notifications**: Sent to all registered devices
- **In-App Notifications**: Stored in `notifications` table as fallback
- **Email Digest**: (Future) Daily digest of unresolved alerts

**Notification Content:**
```
Title: "Controller Alert"
Body: "<controller_name> has been offline for 45 minutes"
Category: "alert" | "warning"
Priority: "high"
Data: {
  alert_id,
  alert_type,
  controller_id,
  controller_name,
  actionType: "controller_alert",
  actionUrl: "/dashboard?alert=<id>"
}
```

## Configuration

### Environment Variables

No additional environment variables required. Uses existing:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (optional)

### Thresholds

Defined in `src/lib/alerting.ts`:

```typescript
const OFFLINE_THRESHOLD_MINUTES = 30
const FAILED_COMMAND_THRESHOLD = 3
const LOW_HEALTH_THRESHOLD = 50
const DUPLICATE_SUPPRESSION_HOURS = 1
```

## Testing

### Manual Testing

1. **Offline Alert**
   ```bash
   # Stop a controller and wait 30 minutes
   # Or manually update last_seen in database
   ```

2. **Failed Commands Alert**
   ```bash
   # Create 3 failed activity logs for a controller
   curl -X POST /api/controllers/[id]/control \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"port": 1, "command": "invalid"}'
   ```

3. **Low Health Alert**
   ```bash
   # Insert low health score
   INSERT INTO controller_health (controller_id, score, calculated_at)
   VALUES ('[controller-id]', 40, NOW());
   ```

4. **Snooze/Acknowledge**
   - Create an alert
   - Use AlertBanner to snooze for 12 hours
   - Wait 5 minutes, verify it doesn't reappear
   - Manually update `snoozed_until` to past time
   - Wait 5 minutes, verify it reactivates

### Automated Testing

```bash
# Run cron job manually
curl -X GET http://localhost:3000/api/cron/check-alerts \
  -H "Authorization: Bearer $CRON_SECRET"

# Check alert was created
curl -X GET http://localhost:3000/api/alerts \
  -H "Authorization: Bearer $USER_TOKEN"
```

## Migration Instructions

### Step 1: Run Database Migration

```bash
# In Supabase SQL Editor
# Run: apps/automation-engine/supabase/migrations/20260124_add_alerts_system.sql
```

### Step 2: Deploy Code

```bash
git add .
git commit -m "feat: Add proactive alerts system"
git push origin main
```

### Step 3: Verify Cron Job

- Check Vercel Dashboard > Deployments > Cron
- Verify `/api/cron/check-alerts` is scheduled for `*/5 * * * *`

### Step 4: Test

- Create a test alert condition
- Wait 5 minutes for cron
- Verify alert appears in dashboard
- Test acknowledge/snooze actions

## Monitoring

### Logs

Cron job logs include:
- Controllers checked
- Alerts created/resolved
- Notification delivery status
- Errors encountered

**Example:**
```
[AlertCheckCron][2026-01-24T12:00:00Z] Checking 10 controllers for alerts
[AlertCheckCron][2026-01-24T12:00:01Z] Processed alerts for Controller A: created=1, resolved=0
[AlertCheckCron][2026-01-24T12:00:02Z] Alert check complete: checked=10, created=3, resolved=2
```

### Metrics to Monitor

- Alert creation rate (should be low for healthy systems)
- Auto-resolution rate (high = conditions improving automatically)
- Snooze rate (high = users finding alerts noisy)
- Notification delivery success rate

## Troubleshooting

### Alerts Not Creating

1. Check cron job is running: `Vercel Dashboard > Deployments > Cron`
2. Check database migration applied: `SELECT * FROM alerts LIMIT 1`
3. Check controller thresholds met: `SELECT * FROM controllers WHERE last_seen < NOW() - INTERVAL '30 minutes'`
4. Check duplicate suppression: `SELECT * FROM alerts WHERE created_at > NOW() - INTERVAL '1 hour'`

### Notifications Not Sending

1. Check push tokens exist: `SELECT * FROM push_tokens WHERE user_id = '...'`
2. Check notification service logs
3. Verify `sendPushNotification()` is being called

### Alerts Not Auto-Resolving

1. Check controller status improved: `SELECT * FROM controllers WHERE id = '...'`
2. Check health score: `SELECT * FROM controller_health WHERE controller_id = '...' ORDER BY calculated_at DESC LIMIT 1`
3. Check `auto_resolve_alerts()` function is being called

### Snoozed Alerts Not Reactivating

1. Check `snoozed_until` is in the past: `SELECT * FROM alerts WHERE status = 'snoozed' AND snoozed_until <= NOW()`
2. Check `get_expired_snooze_alerts()` returns results
3. Check cron job is running every 5 minutes

## Future Enhancements

- Email digest for daily/weekly alert summaries
- Slack/Discord webhook integrations
- Alert escalation (reminder after X hours)
- Custom alert thresholds per controller
- Alert history/trends analytics
- Alert templates/presets
- Bulk actions (acknowledge all, snooze all)
