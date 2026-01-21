# EnviroFlow Quick Migration Guide

## ⚠️ CRITICAL WARNING
**These migrations will DROP all existing tables and data. Only proceed if:**
- This is a fresh database installation, OR
- You have backed up all important data, OR
- You are comfortable losing all existing data

---

## 🚀 Quick Start (3 Steps)

### Step 1: Execute Complete Schema (Destructive)
1. Open: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
2. Copy **entire contents** of: `EXECUTE_MIGRATION_1_COMPLETE_SCHEMA.sql`
3. Paste into SQL Editor
4. Click **"Run"** button
5. Wait for completion (should take 10-15 seconds)

**Expected Output**: `EnviroFlow schema migration completed successfully!`

---

### Step 2: Execute Notifications Table
1. In same SQL Editor tab, clear previous query
2. Copy **entire contents** of: `EXECUTE_MIGRATION_2_NOTIFICATIONS.sql`
3. Paste into SQL Editor
4. Click **"Run"** button
5. Wait for completion (should take 5 seconds)

**Expected Output**: `Notifications schema migration completed!`

---

### Step 3: Execute Workflow Functions
1. In same SQL Editor tab, clear previous query
2. Copy **entire contents** of: `EXECUTE_MIGRATION_3_WORKFLOW_FUNCTIONS.sql`
3. Paste into SQL Editor
4. Click **"Run"** button
5. Wait for completion (should take 2 seconds)

**Expected Output**: Function created successfully (no error messages)

---

## ✅ Verification (1 Step)

### Verify All Migrations Succeeded
1. In same SQL Editor tab, clear previous query
2. Copy **entire contents** of: `VERIFY_MIGRATIONS.sql`
3. Paste into SQL Editor
4. Click **"Run"** button
5. Scroll to bottom and check **FINAL SUMMARY REPORT**

**Expected Output**:
```
╔══════════════════════════════════════════════════════════════╗
║          ENVIROFLOW MIGRATION VERIFICATION REPORT           ║
╠══════════════════════════════════════════════════════════════╣
║ Tables Created:              14 / 14                        ║
║ Functions Created:            9 / 9                         ║
║ Realtime Tables:              7 / 7                         ║
║ Growth Stages Seeded:         5 / 5                         ║
║ RLS Enabled Tables:          14 / 14                        ║
╠══════════════════════════════════════════════════════════════╣
║ Status: ✅ ALL MIGRATIONS SUCCESSFUL                         ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 📋 Migration Files Reference

| File | Purpose | Data Loss Risk |
|------|---------|----------------|
| `EXECUTE_MIGRATION_1_COMPLETE_SCHEMA.sql` | Creates 14 tables, RLS policies, indexes | **HIGH - Drops all tables** |
| `EXECUTE_MIGRATION_2_NOTIFICATIONS.sql` | Adds notifications table | **NONE - Safe** |
| `EXECUTE_MIGRATION_3_WORKFLOW_FUNCTIONS.sql` | Adds workflow increment function | **NONE - Safe** |
| `VERIFY_MIGRATIONS.sql` | Verification queries | **NONE - Read-only** |

---

## 🗄️ Database Schema Overview

### Core Tables (14 total)
1. **rooms** - Logical grouping (Veg Room, Flower Room)
2. **controllers** - Hardware devices (AC Infinity, Inkbird, CSV)
3. **workflows** - Automation definitions (React Flow nodes/edges)
4. **dimmer_schedules** - Sunrise/sunset lighting
5. **activity_logs** - Execution history (90-day retention)
6. **sensor_readings** - Cached sensor data (30-day retention)
7. **ai_insights** - Grok AI analysis
8. **growth_stages** - Plant stage definitions (Seedling → Late Flower)
9. **push_tokens** - Mobile notifications
10. **notifications** - In-app notifications (30-day retention)
11. **sunrise_sunset_cache** - Cached sunrise/sunset times
12. **manual_sensor_data** - CSV uploads (90-day retention)
13. **audit_logs** - System audit trail
14. **workflow_templates** - Shareable templates

### Functions (9 total)
1. `update_updated_at_column()` - Trigger for updated_at
2. `cleanup_old_activity_logs()` - 90-day retention
3. `cleanup_old_sensor_readings()` - 30-day retention
4. `cleanup_old_manual_sensor_data()` - 90-day retention
5. `cleanup_expired_notifications()` - 30-day retention
6. `set_notification_read_at()` - Auto-set read timestamp
7. `mark_all_notifications_read(user_id)` - Bulk mark as read
8. `get_unread_notification_count(user_id)` - Unread count
9. `increment_workflow_run(workflow_id, last_run)` - Atomic increment

---

## 🔒 Security Features

### Row Level Security (RLS)
- **Enabled on ALL 14 tables**
- Users can only access their own data
- Service role bypasses RLS for cron jobs

### RLS Policy Patterns
- **SELECT**: `auth.uid() = user_id`
- **INSERT**: `WITH CHECK (auth.uid() = user_id)`
- **UPDATE**: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
- **DELETE**: `USING (auth.uid() = user_id)`

### Special Policies
- **Service role policies**: Allow cron jobs to insert activity_logs, sensor_readings, notifications
- **Growth stages**: Read-only for authenticated users, writable by service_role only
- **Workflow templates**: Public templates visible to all, own templates editable

---

## 🔄 Realtime Configuration

### Tables with Realtime Enabled (7)
1. `controllers` - Live status updates
2. `rooms` - Room changes
3. `workflows` - Workflow execution
4. `activity_logs` - Live activity feed
5. `sensor_readings` - Real-time sensor data
6. `ai_insights` - AI analysis results
7. `notifications` - Instant notifications

### Frontend Integration
```typescript
// Subscribe to controller status changes
supabase
  .channel('controllers')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'controllers',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    console.log('Controller updated:', payload.new);
  })
  .subscribe();
```

---

## 📊 Performance Optimizations

### Indexes Created (50+ total)
- **Foreign keys**: All foreign key columns indexed
- **User queries**: `user_id` columns indexed on all user-owned tables
- **Time-series**: `created_at DESC`, `recorded_at DESC` for logs/readings
- **Composite**: Multi-column indexes for common query patterns
- **Partial**: Conditional indexes (e.g., `WHERE is_active = true`)

### Query Performance Targets
- **P95 latency**: < 500ms for all queries
- **Dashboard load**: < 2 seconds
- **Sensor data fetch**: < 100ms
- **Workflow execution**: < 5 seconds

---

## 🧪 Testing Migrations Locally (Optional)

If Supabase CLI becomes available:

```bash
# Start local Supabase
supabase start

# Run migrations
supabase db reset

# Generate TypeScript types
supabase gen types typescript --local > types/supabase.ts

# Stop local Supabase
supabase stop
```

---

## 🆘 Troubleshooting

### Migration Fails with "relation does not exist"
**Solution**: Run migrations in exact order (1 → 2 → 3)

### Migration Fails with "permission denied"
**Solution**: Ensure you're logged in as database owner or service role

### Verification Shows Missing Tables/Functions
**Solution**: Re-run the specific migration that failed

### "publication supabase_realtime does not exist"
**Solution**: Realtime is disabled. Enable in Supabase Dashboard → Database → Publications

### RLS Verification Shows "RLS Disabled" for Some Tables
**Solution**: Re-run migration 1 (complete schema) which enables RLS

---

## 📞 Support Contacts

- **Supabase Dashboard**: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu
- **Supabase Status**: https://status.supabase.com
- **Database Logs**: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/logs/postgres-logs
- **SQL Editor**: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql

---

## ✅ Post-Migration Checklist

After successful migration:

- [ ] Verify all 14 tables created
- [ ] Verify all 9 functions created
- [ ] Verify 7 realtime tables configured
- [ ] Verify 5 growth stages seeded
- [ ] Verify RLS enabled on all tables
- [ ] Test user authentication (signup/login)
- [ ] Test dashboard page loads
- [ ] Test controllers page loads
- [ ] Test automations page loads
- [ ] Verify cron workflow executor runs (check activity_logs)
- [ ] Verify AI insights API works (if Grok API key configured)

---

## 🎯 Next Steps

1. **Frontend Testing**: Start Next.js dev server (`npm run dev`)
2. **Create Test User**: Sign up at http://localhost:3000/signup
3. **Add Test Controller**: Navigate to /controllers and add a CSV controller
4. **Create Test Workflow**: Navigate to /automations and create a simple workflow
5. **Monitor Execution**: Check activity_logs table for workflow runs

---

**Database Architect Approval**: ✅ Migrations reviewed and approved for production deployment.

**Last Updated**: 2026-01-21
**Migration Version**: v2.0 (Complete Schema with Notifications)
