# EnviroFlow Database Setup Guide

This guide explains how to set up and run database migrations for the EnviroFlow platform.

## Prerequisites

- Access to the Supabase project dashboard
- Supabase project URL: `https://vhlnnfmuhttjpwyobklu.supabase.co`

## Migration Files

All migration files are located in:
```
apps/automation-engine/supabase/migrations/
```

### Available Migrations

| File | Description | Status |
|------|-------------|--------|
| `20260121_complete_schema.sql` | **Primary schema** - Complete database with all tables, RLS policies, and functions | Required |
| `20260121_notifications.sql` | In-app notifications table (extends base schema) | Required |

### Legacy/Superseded Migrations (Do Not Run)

These files are kept for reference but have been superseded by the 20260121 migrations:

| File | Notes |
|------|-------|
| `20260120_complete_schema.sql` | Superseded by 20260121_complete_schema.sql |
| `20260120_reset_and_create.sql` | Superseded by 20260121_complete_schema.sql |
| `20260120_ai_analysis_tables.sql` | Now included in complete schema |

## Running Migrations

### Step 1: Open Supabase SQL Editor

Navigate to:
```
https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
```

Or access via:
1. Go to https://supabase.com/dashboard
2. Select the EnviroFlow project (`vhlnnfmuhttjpwyobklu`)
3. Click "SQL Editor" in the left sidebar

### Step 2: Run the Complete Schema Migration

1. Open the file: `apps/automation-engine/supabase/migrations/20260121_complete_schema.sql`
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Click "Run" (or press Cmd/Ctrl + Enter)

**Expected Output:**
```
status                                          | completed_at                  | total_tables | growth_stages_seeded
------------------------------------------------|-------------------------------|--------------|---------------------
EnviroFlow schema migration completed successfully! | 2026-01-21 12:00:00.000000+00 | 13           | 5
```

### Step 3: Run the Notifications Migration

1. Open the file: `apps/automation-engine/supabase/migrations/20260121_notifications.sql`
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Click "Run"

**Expected Output:**
```
status                                    | completed_at
------------------------------------------|------------------------------
Notifications schema migration completed! | 2026-01-21 12:00:00.000000+00
```

## Post-Migration Verification

### Verify Tables Were Created

Run this query in the SQL Editor to confirm all tables exist:

```sql
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;
```

**Expected Tables (14 total):**
- `activity_logs`
- `ai_insights`
- `audit_logs`
- `controllers`
- `dimmer_schedules`
- `growth_stages`
- `manual_sensor_data`
- `notifications`
- `push_tokens`
- `rooms`
- `sensor_readings`
- `sunrise_sunset_cache`
- `workflow_templates`
- `workflows`

All tables should show `rls_enabled = true`.

### Verify Growth Stages Seeded

```sql
SELECT name, stage_order, light_hours, vpd_min, vpd_max
FROM growth_stages
ORDER BY stage_order;
```

**Expected Output (5 rows):**
| name | stage_order | light_hours | vpd_min | vpd_max |
|------|-------------|-------------|---------|---------|
| Seedling | 1 | 18 | 0.40 | 0.80 |
| Vegetative | 2 | 18 | 0.80 | 1.20 |
| Early Flower | 3 | 12 | 1.00 | 1.40 |
| Mid Flower | 4 | 12 | 1.20 | 1.60 |
| Late Flower | 5 | 12 | 1.00 | 1.40 |

### Verify Realtime is Enabled

```sql
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

**Expected Tables in Realtime Publication:**
- `controllers`
- `rooms`
- `workflows`
- `activity_logs`
- `sensor_readings`
- `ai_insights`
- `notifications`

### Verify Functions Exist

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

**Expected Functions:**
- `cleanup_expired_notifications`
- `cleanup_old_activity_logs`
- `cleanup_old_manual_sensor_data`
- `cleanup_old_sensor_readings`
- `get_unread_notification_count`
- `mark_all_notifications_read`
- `set_notification_read_at`
- `update_updated_at_column`

## Troubleshooting

### "Table already exists" Error

The `20260121_complete_schema.sql` migration is designed to drop and recreate all tables. If you still encounter this error:

1. The migration may have partially failed
2. Run this cleanup query first:
   ```sql
   DROP TABLE IF EXISTS notifications CASCADE;
   DROP TABLE IF EXISTS ai_insights CASCADE;
   DROP TABLE IF EXISTS workflow_templates CASCADE;
   -- ... (continue for all tables)
   ```
3. Re-run the complete schema migration

### "Publication does not exist" Error

This is usually safe to ignore. The migration handles this gracefully.

### "Permission denied" Error

Ensure you are using an account with sufficient privileges. The Supabase dashboard SQL Editor uses the `postgres` role by default, which has full access.

### Data Loss Warning

Running the complete schema migration will **DROP ALL EXISTING TABLES AND DATA**. This is intentional for fresh setups. For production environments with existing data, you must:

1. Back up your data first
2. Consider using incremental migrations instead
3. Never run the complete schema on a populated production database

## Data Retention Policies

The schema includes automatic cleanup functions for data retention:

| Table | Retention | Function |
|-------|-----------|----------|
| `activity_logs` | 90 days | `cleanup_old_activity_logs()` |
| `sensor_readings` | 30 days | `cleanup_old_sensor_readings()` |
| `manual_sensor_data` | 90 days | `cleanup_old_manual_sensor_data()` |
| `notifications` | 30 days | `cleanup_expired_notifications()` |

These functions can be scheduled via Supabase cron jobs or called manually:

```sql
SELECT cleanup_old_activity_logs();
SELECT cleanup_old_sensor_readings();
SELECT cleanup_old_manual_sensor_data();
SELECT cleanup_expired_notifications();
```

## Next Steps

After running migrations:

1. Configure environment variables in `apps/web/.env.local` (see `CLAUDE.md`)
2. Start the development server: `cd apps/web && npm run dev`
3. Create a user account via the signup page
4. Add your first controller
