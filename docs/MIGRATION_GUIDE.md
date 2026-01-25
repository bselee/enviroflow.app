# EnviroFlow Migration Guide

This guide helps you upgrade from earlier versions of EnviroFlow to version 2.0.

## Table of Contents

1. [Overview](#overview)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Migration Steps](#migration-steps)
4. [Database Migrations](#database-migrations)
5. [Configuration Changes](#configuration-changes)
6. [Breaking Changes](#breaking-changes)
7. [Post-Migration Verification](#post-migration-verification)
8. [Rollback Procedure](#rollback-procedure)
9. [Troubleshooting](#troubleshooting)

## Overview

EnviroFlow 2.0 introduces significant new features and improvements:

- Enhanced onboarding and UX
- Multi-brand controller support (Govee, MQTT, Ecowitt)
- Advanced analytics and scheduling
- Improved error handling and health monitoring
- Better performance and reliability

**Compatibility:**
- Version 2.0 is **fully backward compatible** with 1.x data
- Existing controllers, rooms, and workflows continue to work
- No data loss during upgrade

**Estimated Migration Time:**
- Small installations (1-10 controllers): 15-30 minutes
- Medium installations (10-50 controllers): 30-60 minutes
- Large installations (50+ controllers): 1-2 hours

## Pre-Migration Checklist

Before upgrading, complete these steps:

### 1. Backup Your Data

**Database Backup:**

```bash
# Supabase: Use dashboard to create backup
# Go to Database > Backups > Create Backup

# Or export via pg_dump
pg_dump -h db.YOUR_PROJECT.supabase.co \
        -U postgres \
        -d postgres \
        -F c \
        -f enviroflow_backup_$(date +%Y%m%d).dump
```

**Workflow Export:**

```sql
-- Export all workflows to JSON
COPY (
  SELECT json_agg(row_to_json(workflows))
  FROM workflows
) TO '/tmp/workflows_backup.json';
```

**Environment Variables:**

```bash
# Backup .env.local
cp apps/web/.env.local apps/web/.env.local.backup
```

### 2. Document Current State

**Record Current Version:**

```bash
# Check package.json version
cat apps/web/package.json | grep version
```

**List Controllers:**

```sql
-- Document connected controllers
SELECT id, name, brand, type, is_online
FROM controllers
ORDER BY name;
```

**List Active Workflows:**

```sql
-- Document active workflows
SELECT id, name, is_active, room_id
FROM workflows
WHERE is_active = true;
```

### 3. Verify System Health

**Check Database:**

```sql
-- Verify no corrupted data
SELECT count(*) FROM controllers;
SELECT count(*) FROM sensor_readings;
SELECT count(*) FROM workflows;
SELECT count(*) FROM rooms;
```

**Check Disk Space:**

```bash
# Ensure sufficient disk space (10GB+ recommended)
df -h
```

### 4. Plan Downtime

**Maintenance Window:**
- Schedule upgrade during low-usage period
- Notify users of brief downtime (5-15 minutes)
- Disable cron jobs temporarily

**Disable Cron Jobs:**

```bash
# Vercel: Remove cron config temporarily
# Or comment out in vercel.json

# Self-hosted: Disable cron
crontab -l > crontab_backup.txt
crontab -r
```

## Migration Steps

### Step 1: Update Code

**Pull Latest Code:**

```bash
cd /path/to/enviroflow
git fetch origin
git checkout main
git pull origin main
```

**Install New Dependencies:**

```bash
# Install updated packages
npm install

# Rebuild
npm run build
```

### Step 2: Update Environment Variables

**Add New Required Variables:**

```bash
# Edit apps/web/.env.local

# ENCRYPTION_KEY - CRITICAL: Must be 64 hex characters
# If not already set, generate:
openssl rand -hex 32

# Add to .env.local:
ENCRYPTION_KEY=your_64_character_hex_string

# Optional new variables for 2.0 features:
XAI_API_KEY=xai-your-key  # For AI-powered features
GOVEE_API_KEY=your-govee-api-key  # For Govee integration
```

**Verify All Required Variables:**

```bash
# Required variables check
grep -E "(SUPABASE_URL|SUPABASE_ANON_KEY|ENCRYPTION_KEY)" apps/web/.env.local
```

### Step 3: Run Database Migrations

**Apply Migrations in Order:**

Navigate to Supabase SQL Editor: `https://supabase.com/dashboard/project/YOUR_PROJECT/sql`

**Migration 1: Ecowitt Sensor Types**

```sql
-- Run: apps/automation-engine/supabase/migrations/20260124_add_ecowitt_sensor_types.sql

-- This adds support for Ecowitt weather station sensor types
-- Safe to run even if you don't use Ecowitt devices
```

**Verify Migration:**

```sql
-- Check if new sensor types exist
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'sensor_type'
ORDER BY enumlabel;

-- Should include: wind_speed, wind_direction, rain_rate, uv_index, etc.
```

### Step 4: Update Controller Credentials

**Re-encrypt Existing Credentials:**

Version 2.0 uses improved credential encryption. If you have existing controllers:

1. **Test Existing Controllers**
   - Go to Controllers page
   - Click "Test Connection" on each controller
   - If test fails, proceed to step 2

2. **Re-enter Credentials (if needed)**
   - Click "Edit" on controller
   - Re-enter credentials
   - Save

**Bulk Controller Test:**

```typescript
// Run this script to test all controllers
// apps/web/scripts/test-all-controllers.ts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testAllControllers() {
  const { data: controllers } = await supabase
    .from('controllers')
    .select('id, name');

  for (const controller of controllers || []) {
    const response = await fetch(`/api/controllers/${controller.id}/test`);
    const result = await response.json();
    console.log(`${controller.name}: ${result.success ? 'OK' : 'FAILED'}`);
  }
}

testAllControllers();
```

### Step 5: Deploy Application

**For Vercel Deployment:**

```bash
# Deploy to production
vercel deploy --prod

# Verify deployment
curl https://enviroflow.app/api/health
```

**For Self-Hosted:**

```bash
# Restart application
pm2 restart enviroflow

# Or if using systemd
sudo systemctl restart enviroflow
```

**Re-enable Cron Jobs:**

```bash
# Vercel: Add back to vercel.json
{
  "crons": [
    {
      "path": "/api/cron/workflows",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/poll-sensors",
      "schedule": "*/5 * * * *"
    }
  ]
}

# Self-hosted: Restore crontab
crontab crontab_backup.txt
```

### Step 6: Verify Upgrade

**Check Application:**

1. Visit your EnviroFlow URL
2. Login with existing credentials
3. Verify dashboard loads

**Check Controllers:**

1. Go to Controllers page
2. Verify all controllers show correct status
3. Test connection on a few controllers

**Check Workflows:**

1. Go to Workflows page
2. Verify all workflows are listed
3. Check active workflows are still active

**Check Data:**

1. Go to Dashboard
2. Verify sensor data is displaying
3. Check charts and analytics load

## Database Migrations

### Migration 1: Ecowitt Sensor Types

**File:** `apps/automation-engine/supabase/migrations/20260124_add_ecowitt_sensor_types.sql`

**Purpose:** Adds sensor types for Ecowitt weather stations

**Changes:**
- Adds `wind_speed`, `wind_direction`, `wind_gust`, `rain_rate`, `rain_daily`, `rain_event`, `uv_index`, `solar_radiation`, `soil_moisture`, `soil_temperature`, `lightning_distance`, `lightning_count`, `pm25`, `pm10`, `leak_detection` to `sensor_type` enum

**Impact:** None on existing data. Safe to run.

**Rollback:**

```sql
-- To rollback, remove new enum values (only if absolutely necessary)
-- WARNING: This will fail if any sensor_readings use these types

ALTER TYPE sensor_type RENAME TO sensor_type_old;

CREATE TYPE sensor_type AS ENUM (
  'temperature',
  'humidity',
  'vpd',
  'co2',
  'light',
  'ph',
  'ec',
  'water_level',
  'soil_moisture',
  'pressure'
);

ALTER TABLE sensor_readings ALTER COLUMN sensor_type TYPE sensor_type USING sensor_type::text::sensor_type;

DROP TYPE sensor_type_old;
```

## Configuration Changes

### Environment Variables

**New Required:**
- `ENCRYPTION_KEY` - 64-character hex string (generate with `openssl rand -hex 32`)

**New Optional:**
- `XAI_API_KEY` - For AI-powered schedule recommendations
- `GOVEE_API_KEY` - For Govee device integration

**Deprecated:**
- None

**Removed:**
- None

### Configuration Files

**next.config.js:**

No breaking changes. Recommended optimizations:

```javascript
// Optional performance improvements
module.exports = {
  swcMinify: true,
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['recharts', '@xyflow/react'],
  },
};
```

**vercel.json:**

Cron schedule unchanged:

```json
{
  "crons": [
    {
      "path": "/api/cron/workflows",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/poll-sensors",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## Breaking Changes

**Good news:** Version 2.0 has **no breaking changes** for existing installations.

All changes are **additive**:
- New features don't affect existing functionality
- Database schema changes are backward compatible
- API endpoints remain unchanged
- Data formats are compatible

**Controller Credential Re-encryption:**

While not technically breaking, some controllers may need credential re-entry due to improved encryption. This is a one-time operation and only affects a small percentage of installations.

## Post-Migration Verification

### Automated Health Check

**Run Health Check Script:**

```bash
# Create health check script
cat > check-health.sh <<'EOF'
#!/bin/bash

echo "=== EnviroFlow 2.0 Health Check ==="

# Check application
echo -n "Application: "
curl -s https://enviroflow.app/api/health | jq -r '.healthy' && echo "OK" || echo "FAILED"

# Check database
echo -n "Database: "
psql $DATABASE_URL -c "SELECT 1;" > /dev/null && echo "OK" || echo "FAILED"

# Check controllers
echo -n "Controllers: "
OFFLINE=$(psql $DATABASE_URL -t -c "SELECT count(*) FROM controllers WHERE is_online = false;")
echo "$OFFLINE offline"

# Check workflows
echo -n "Active Workflows: "
ACTIVE=$(psql $DATABASE_URL -t -c "SELECT count(*) FROM workflows WHERE is_active = true;")
echo "$ACTIVE active"

# Check sensor data
echo -n "Recent Sensor Readings: "
RECENT=$(psql $DATABASE_URL -t -c "SELECT count(*) FROM sensor_readings WHERE created_at > NOW() - INTERVAL '1 hour';")
echo "$RECENT in last hour"

echo "=== Health Check Complete ==="
EOF

chmod +x check-health.sh
./check-health.sh
```

### Manual Verification

**1. Test Controller Operations:**

- [ ] Add a new controller (any brand)
- [ ] Test connection on existing controller
- [ ] Read sensor data
- [ ] Delete test controller

**2. Test Workflow Operations:**

- [ ] Create a new workflow
- [ ] Edit existing workflow
- [ ] Activate/deactivate workflow
- [ ] Verify workflow executes (check activity logs)
- [ ] Delete test workflow

**3. Test New Features:**

- [ ] Access onboarding tour (logout and create new account)
- [ ] View controller health scores
- [ ] Try bulk operations (select multiple controllers)
- [ ] Export data (CSV/JSON)
- [ ] View analytics with custom date range

**4. Test Integrations:**

- [ ] Ecowitt webhook (if using Ecowitt)
- [ ] Govee API (if using Govee)
- [ ] MQTT connection (if using MQTT)

## Rollback Procedure

If you encounter critical issues, rollback to version 1.x:

### Step 1: Stop Application

```bash
# Vercel: Deploy previous version
vercel rollback

# Self-hosted:
pm2 stop enviroflow
```

### Step 2: Restore Code

```bash
# Checkout previous version
git log --oneline  # Find previous version commit
git checkout <previous-commit-hash>

# Rebuild
npm install
npm run build
```

### Step 3: Restore Database

```bash
# Restore from backup
pg_restore -h db.YOUR_PROJECT.supabase.co \
           -U postgres \
           -d postgres \
           -c \
           enviroflow_backup_20260124.dump
```

### Step 4: Restore Configuration

```bash
# Restore .env.local
cp apps/web/.env.local.backup apps/web/.env.local
```

### Step 5: Restart Application

```bash
# Vercel: Deploy
vercel deploy --prod

# Self-hosted:
pm2 restart enviroflow
```

### Step 6: Verify Rollback

```bash
# Check version
curl https://enviroflow.app/api/health

# Test critical functions
# - Login
# - View dashboard
# - Test controller
```

## Troubleshooting

### Issue: Application won't start

**Symptoms:** Server crashes on startup

**Possible Causes:**
1. Missing `ENCRYPTION_KEY`
2. Invalid environment variables
3. Database connection failure

**Diagnosis:**

```bash
# Check logs
vercel logs  # For Vercel
pm2 logs enviroflow  # For self-hosted

# Common errors:
# - "ENCRYPTION_KEY must be 64 characters"
# - "Cannot connect to database"
```

**Fix:**

```bash
# Verify ENCRYPTION_KEY
echo $ENCRYPTION_KEY | wc -c  # Should output 65 (64 chars + newline)

# Verify database connection
psql $DATABASE_URL -c "SELECT 1;"

# Restart with debug logging
LOG_LEVEL=debug npm run start
```

### Issue: Controllers showing offline

**Symptoms:** All or some controllers marked offline after upgrade

**Diagnosis:**

```sql
-- Check controller status
SELECT id, name, brand, is_online, last_seen
FROM controllers
WHERE is_online = false;
```

**Fix:**

1. **Test Connection:**
   - Go to Controllers page
   - Click "Test Connection" on each offline controller
   - Check error messages

2. **Re-enter Credentials:**
   - If encryption error, re-enter credentials
   - Save and test again

3. **Check Adapter:**
   ```bash
   # Verify adapter files exist
   ls apps/automation-engine/lib/adapters/
   # Should include: ACInfinityAdapter.ts, GoveeAdapter.ts, etc.
   ```

### Issue: Workflows not executing

**Symptoms:** Workflows marked active but not triggering

**Diagnosis:**

```sql
-- Check recent workflow executions
SELECT workflow_id, status, error_message, created_at
FROM activity_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;
```

**Fix:**

1. **Check Cron Jobs:**
   ```bash
   # Verify cron endpoint responds
   curl "https://enviroflow.app/api/cron/workflows?secret=YOUR_SECRET"
   ```

2. **Check Workflow Configuration:**
   - View workflow in UI
   - Ensure nodes and edges are valid
   - Check sensor thresholds are reachable

3. **Enable Debug Logging:**
   ```bash
   # In .env.local
   LOG_LEVEL=debug
   ```

### Issue: Database migration failed

**Symptoms:** Migration script errors

**Diagnosis:**

```sql
-- Check if migration was partially applied
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'sensor_type';
```

**Fix:**

1. **Rollback Partial Migration:**
   ```sql
   -- Only if migration was interrupted
   -- See "Database Migrations > Rollback" above
   ```

2. **Re-run Migration:**
   - Copy migration SQL
   - Run in Supabase SQL Editor
   - Verify completion

## Getting Help

If you encounter issues during migration:

**Before Contacting Support:**

1. Check this guide
2. Review error logs
3. Search [GitHub Issues](https://github.com/yourusername/enviroflow/issues)
4. Try [Community Forum](https://community.enviroflow.app)

**Contact Support:**

- **Email:** support@enviroflow.app
- **Include:**
  - Version upgrading from and to
  - Error messages (logs)
  - Steps already attempted
  - Database size (number of controllers, workflows)

**Emergency Rollback:**

If you need immediate rollback assistance:
- **Priority Email:** urgent@enviroflow.app
- **Include:** "URGENT: Rollback Needed" in subject

## Post-Migration Best Practices

After successful migration:

1. **Update Documentation**
   - Document any custom configurations
   - Update team procedures

2. **Monitor Performance**
   - Watch error rates first 24 hours
   - Check database performance
   - Monitor API response times

3. **User Training**
   - Show users new features
   - Update user documentation
   - Provide onboarding tour link

4. **Cleanup**
   - Remove backup files after 30 days
   - Archive old logs
   - Update bookmarks/shortcuts

## Summary

**Migration Difficulty:** Easy
**Estimated Time:** 15-60 minutes
**Downtime:** 5-15 minutes
**Breaking Changes:** None
**Data Loss Risk:** None (with backups)
**Rollback Capability:** Full

**Success Checklist:**

- [ ] Backup completed
- [ ] Code updated
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Application deployed
- [ ] Cron jobs re-enabled
- [ ] Controllers tested
- [ ] Workflows verified
- [ ] New features accessible
- [ ] Monitoring enabled

Congratulations on upgrading to EnviroFlow 2.0! Enjoy the new features.
