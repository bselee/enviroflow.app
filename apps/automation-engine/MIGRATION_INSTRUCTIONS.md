# EnviroFlow Database Migration Instructions

**CRITICAL WARNING**: These migrations will DROP and recreate all tables, destroying existing data.

## Migration Order

Execute these migrations in the Supabase SQL Editor in the following order:

### 1. Complete Schema Migration (DESTRUCTIVE)
**File**: `20260121_complete_schema.sql`
**URL**: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql

**What it does**:
- Drops ALL existing tables (ai_insights, workflow_templates, growth_stages, push_tokens, etc.)
- Drops ALL existing functions
- Recreates complete schema with 14 tables
- Sets up RLS policies for all tables
- Creates indexes for performance
- Seeds 5 default growth stages
- Enables realtime for 6 tables

**Tables Created**:
1. rooms - Logical grouping of controllers
2. controllers - Hardware controller configurations
3. workflows - Automation workflow definitions
4. dimmer_schedules - Sunrise/sunset lighting schedules
5. activity_logs - Execution history (90-day retention)
6. sensor_readings - Cached sensor data (30-day retention)
7. ai_insights - Grok AI analysis results
8. growth_stages - Plant growth stage definitions
9. push_tokens - Mobile push notification tokens
10. sunrise_sunset_cache - Cached sunrise/sunset calculations
11. manual_sensor_data - CSV upload data
12. audit_logs - System-wide audit trail
13. workflow_templates - Shareable workflow templates

**To Execute**:
```sql
-- Copy entire contents of: apps/automation-engine/supabase/migrations/20260121_complete_schema.sql
-- Paste into Supabase SQL Editor
-- Click "Run" button
```

---

### 2. Notifications Table (Safe - No Data Loss)
**File**: `20260121_notifications.sql`
**URL**: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql

**What it does**:
- Creates `notifications` table (IF NOT EXISTS guard)
- Sets up RLS policies
- Creates indexes for performance
- Adds cleanup function for 30-day retention
- Enables realtime updates
- Creates helper functions:
  - `cleanup_expired_notifications()` - Removes old notifications
  - `mark_all_notifications_read(user_id)` - Marks all as read
  - `get_unread_notification_count(user_id)` - Returns unread count

**To Execute**:
```sql
-- Copy entire contents of: apps/automation-engine/supabase/migrations/20260121_notifications.sql
-- Paste into Supabase SQL Editor
-- Click "Run" button
```

---

### 3. Workflow Functions (Safe - Atomic Increment)
**File**: `20260121_workflow_functions.sql`
**URL**: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql

**What it does**:
- Creates `increment_workflow_run(workflow_id, last_run)` function
- Prevents race conditions in workflow run counting
- Atomic increment for concurrent execution safety

**To Execute**:
```sql
-- Copy entire contents of: apps/automation-engine/supabase/migrations/20260121_workflow_functions.sql
-- Paste into Supabase SQL Editor
-- Click "Run" button
```

---

## Verification Queries

After running all migrations, execute these queries to verify success:

### 1. Check All Tables Exist (Expected: 14 tables)
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected Output** (14 tables):
- activity_logs
- ai_insights
- audit_logs
- controllers
- dimmer_schedules
- growth_stages
- manual_sensor_data
- notifications
- push_tokens
- rooms
- sensor_readings
- sunrise_sunset_cache
- workflow_templates
- workflows

---

### 2. Verify RLS Enabled on All Tables
```sql
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;
```

**Expected**: All tables should show `rls_enabled = true`

---

### 3. Verify Functions Created
```sql
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

**Expected Functions**:
- cleanup_expired_notifications
- cleanup_old_activity_logs
- cleanup_old_manual_sensor_data
- cleanup_old_sensor_readings
- get_unread_notification_count
- increment_workflow_run
- mark_all_notifications_read
- set_notification_read_at
- update_updated_at_column

---

### 4. Verify Realtime Publications
```sql
SELECT
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

**Expected Tables** (7 tables with realtime):
- activity_logs
- ai_insights
- controllers
- notifications
- rooms
- sensor_readings
- workflows

---

### 5. Verify Growth Stages Seeded (Expected: 5 rows)
```sql
SELECT
  name,
  stage_order,
  duration_days,
  light_hours
FROM growth_stages
ORDER BY stage_order;
```

**Expected Output**:
1. Seedling (order 1, 14 days, 18 hours)
2. Vegetative (order 2, 30 days, 18 hours)
3. Early Flower (order 3, 14 days, 12 hours)
4. Mid Flower (order 4, 21 days, 12 hours)
5. Late Flower (order 5, 14 days, 12 hours)

---

### 6. Verify Indexes Created
```sql
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Expected**: 50+ indexes for performance optimization

---

## Post-Migration Steps

### 1. Regenerate TypeScript Types
```bash
cd apps/automation-engine
supabase gen types typescript --local > ../../types/supabase.ts
```

**NOTE**: Since Supabase CLI is not installed, you can generate types via the Supabase Dashboard:
1. Navigate to: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/api
2. Click "Types" tab
3. Copy the generated TypeScript types
4. Replace contents of `apps/web/types/supabase.ts`

---

### 2. Update Environment Variables
Ensure these are set in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vhlnnfmuhttjpwyobklu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROK_API_KEY=xai-...
NEXT_PUBLIC_APP_URL=https://enviroflow.app
CRON_SECRET=your-secret-for-vercel-cron
```

---

### 3. Test Database Access
```bash
cd apps/web
npm run dev
```

Navigate to http://localhost:3000 and verify:
- User authentication works
- Dashboard loads without errors
- Controllers page displays
- Automations page displays

---

## Rollback Plan

If migrations fail or cause issues:

1. **Option A**: Re-run `20260121_complete_schema.sql` (it's idempotent)
2. **Option B**: Drop all tables manually and start over:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO postgres;
   GRANT ALL ON SCHEMA public TO public;
   ```

---

## Migration Checklist

- [ ] Backup existing data (if any)
- [ ] Execute `20260121_complete_schema.sql` in Supabase SQL Editor
- [ ] Execute `20260121_notifications.sql` in Supabase SQL Editor
- [ ] Execute `20260121_workflow_functions.sql` in Supabase SQL Editor
- [ ] Run verification query #1 (Check all tables exist)
- [ ] Run verification query #2 (Verify RLS enabled)
- [ ] Run verification query #3 (Verify functions created)
- [ ] Run verification query #4 (Verify realtime publications)
- [ ] Run verification query #5 (Verify growth stages seeded)
- [ ] Regenerate TypeScript types
- [ ] Test frontend application
- [ ] Verify cron workflows execute successfully

---

## Support

If migrations fail, check:
1. Supabase service status: https://status.supabase.com
2. Database logs: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/logs/postgres-logs
3. SQL Editor errors (check syntax and permissions)

---

**Database Architect Sign-Off**: These migrations have been reviewed for:
- ✅ Sequential migration numbering (20260121_xxx)
- ✅ Proper RLS policies on all user-facing tables
- ✅ Appropriate indexes for performance
- ✅ 30-day and 90-day retention policies
- ✅ Realtime publication configuration
- ✅ Service role permissions for cron jobs
- ⚠️ **DESTRUCTIVE** - Will drop all existing tables
