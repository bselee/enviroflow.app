# EnviroFlow Automation Engine

Backend automation engine for EnviroFlow environmental monitoring and control platform.

---

## Directory Structure

```
apps/automation-engine/
├── EXECUTE_MIGRATION_1_COMPLETE_SCHEMA.sql   # Execute this first
├── EXECUTE_MIGRATION_2_NOTIFICATIONS.sql     # Execute this second
├── EXECUTE_MIGRATION_3_WORKFLOW_FUNCTIONS.sql # Execute this third
├── VERIFY_MIGRATIONS.sql                      # Verify migrations succeeded
│
├── MIGRATION_SUMMARY.md                       # Executive summary
├── QUICK_MIGRATION_GUIDE.md                   # Quick reference (start here!)
├── MIGRATION_INSTRUCTIONS.md                  # Detailed instructions
│
├── lib/
│   └── adapters/                              # Hardware controller adapters
│       ├── types.ts                           # TypeScript interfaces
│       ├── index.ts                           # Factory & exports
│       ├── ACInfinityAdapter.ts               # AC Infinity Controller 69, UIS
│       ├── InkbirdAdapter.ts                  # Inkbird ITC-308, ITC-310T, IHC-200
│       └── CSVUploadAdapter.ts                # Manual CSV data uploads
│
├── supabase/
│   ├── config.toml                            # Supabase CLI config
│   └── migrations/                            # SQL migration files
│       ├── 20260121_complete_schema.sql       # Main schema (14 tables)
│       ├── 20260121_notifications.sql         # Notifications table
│       └── 20260121_workflow_functions.sql    # Atomic increment function
│
└── scripts/                                   # Migration scripts (not currently used)
```

---

## Quick Start: Run Migrations

### Prerequisites
- Access to Supabase SQL Editor: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
- Supabase credentials configured in `apps/web/.env.local`

### Step 1: Read Quick Guide
Open and read: **`QUICK_MIGRATION_GUIDE.md`**

### Step 2: Execute Migrations (3 files)
1. Copy `EXECUTE_MIGRATION_1_COMPLETE_SCHEMA.sql` → Paste in SQL Editor → Run
2. Copy `EXECUTE_MIGRATION_2_NOTIFICATIONS.sql` → Paste in SQL Editor → Run
3. Copy `EXECUTE_MIGRATION_3_WORKFLOW_FUNCTIONS.sql` → Paste in SQL Editor → Run

### Step 3: Verify Success
Copy `VERIFY_MIGRATIONS.sql` → Paste in SQL Editor → Run

Expected output at bottom:
```
✅ ALL MIGRATIONS SUCCESSFUL
```

---

## What Gets Created

### Database Schema
- **14 tables**: rooms, controllers, workflows, dimmer_schedules, activity_logs, sensor_readings, ai_insights, growth_stages, push_tokens, notifications, sunrise_sunset_cache, manual_sensor_data, audit_logs, workflow_templates
- **9 functions**: Cleanup functions, helper functions, atomic increment
- **50+ indexes**: Performance-optimized queries
- **50+ RLS policies**: Secure multi-tenant data access
- **7 realtime tables**: Live updates for controllers, workflows, sensors, etc.

### Controller Adapters
Hardware abstraction layer for:
- **AC Infinity** (40% market share): Controller 69, UIS platform
- **Inkbird** (25% market share): ITC-308, ITC-310T, IHC-200
- **CSV Upload**: Manual data for any brand

---

## Controller Adapter Pattern

All adapters implement the `ControllerAdapter` interface:

```typescript
interface ControllerAdapter {
  connect(credentials: any): Promise<ConnectionResult>;
  readSensors(controllerId: string): Promise<SensorReading[]>;
  controlDevice(controllerId: string, port: number, command: DeviceCommand): Promise<CommandResult>;
  getStatus(controllerId: string): Promise<ControllerStatus>;
  disconnect(controllerId: string): Promise<void>;
}
```

### Usage Example
```typescript
import { createAdapter } from './lib/adapters';

// Create adapter for AC Infinity
const adapter = createAdapter('ac_infinity');

// Connect with credentials
await adapter.connect({
  email: 'user@example.com',
  password: 'password123'
});

// Read sensors
const readings = await adapter.readSensors('controller-id');

// Control device
await adapter.controlDevice('controller-id', 1, {
  action: 'set_speed',
  value: 75
});
```

---

## Migration Files Explained

### `EXECUTE_MIGRATION_1_COMPLETE_SCHEMA.sql` (29 KB)
**DESTRUCTIVE**: Drops and recreates all tables.

Creates:
- 14 tables with RLS policies
- Indexes for performance
- Triggers for auto-updated timestamps
- Cleanup functions for data retention
- Realtime publication configuration
- Seeded growth stages (5 rows)

### `EXECUTE_MIGRATION_2_NOTIFICATIONS.sql` (8.2 KB)
**SAFE**: Creates notifications table if not exists.

Creates:
- `notifications` table for in-app notifications
- Indexes for query performance
- RLS policies for secure access
- Cleanup function (30-day retention)
- Helper functions (mark as read, get count)
- Realtime configuration

### `EXECUTE_MIGRATION_3_WORKFLOW_FUNCTIONS.sql` (3.2 KB)
**SAFE**: Creates atomic increment function.

Creates:
- `increment_workflow_run()` function
- Prevents race conditions in concurrent workflow execution
- Atomic update of run_count and last_run timestamp

---

## Verification Queries

After running migrations, verify with these queries:

### 1. Check All Tables Exist
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 14
```

### 2. Verify RLS Enabled
```sql
SELECT COUNT(*) FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
-- Expected: 14
```

### 3. Verify Functions Created
```sql
SELECT COUNT(*) FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
-- Expected: 9+
```

### 4. Verify Growth Stages Seeded
```sql
SELECT COUNT(*) FROM growth_stages;
-- Expected: 5
```

---

## Data Retention Policies

| Table | Retention | Cleanup Function |
|-------|-----------|------------------|
| `activity_logs` | 90 days | `cleanup_old_activity_logs()` |
| `sensor_readings` | 30 days | `cleanup_old_sensor_readings()` |
| `manual_sensor_data` | 90 days | `cleanup_old_manual_sensor_data()` |
| `notifications` | 30 days | `cleanup_expired_notifications()` |

**Note**: Cleanup functions should be called via Supabase cron jobs (scheduled in Supabase Dashboard → Database → Cron Jobs).

---

## Performance Targets

| Operation | Target Latency (P95) |
|-----------|---------------------|
| Dashboard load | < 2 seconds |
| Controller list | < 200ms |
| Workflow list | < 200ms |
| Sensor fetch | < 100ms |
| Activity logs | < 300ms |
| Workflow execution | < 5 seconds |

---

## Security

### Row Level Security (RLS)
All tables protected by RLS policies:
- Users can only access their own data
- Service role bypasses RLS for cron jobs
- Growth stages read-only for authenticated users

### Credential Encryption
Controller credentials must be encrypted before storage:
```typescript
// Before inserting into database
const encrypted = await encrypt(credentials, process.env.ENCRYPTION_KEY);
await supabase.from('controllers').insert({ credentials: encrypted });

// When reading from database
const { data } = await supabase.from('controllers').select('credentials');
const decrypted = await decrypt(data.credentials, process.env.ENCRYPTION_KEY);
```

**CRITICAL**: Generate `ENCRYPTION_KEY` and add to `.env.local`:
```bash
openssl rand -hex 32
```

---

## Realtime Subscriptions

Frontend can subscribe to database changes:

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

**Tables with Realtime**:
- controllers
- rooms
- workflows
- activity_logs
- sensor_readings
- ai_insights
- notifications

---

## Workflow Execution Flow

1. **Cron Trigger**: Vercel Cron calls `/api/cron/workflows` every 60 seconds
2. **Fetch Active Workflows**: Query `workflows` table where `is_active = true`
3. **Execute Workflow**: Process nodes/edges from React Flow definition
4. **Read Sensors**: Call adapter `readSensors()` for each trigger node
5. **Evaluate Conditions**: Compare sensor values to workflow thresholds
6. **Execute Actions**: Call adapter `controlDevice()` for action nodes
7. **Log Activity**: Insert into `activity_logs` with result
8. **Increment Run Count**: Call `increment_workflow_run()` RPC
9. **Send Notifications**: Insert into `notifications` table

---

## Environment Variables

Required in `apps/web/.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://vhlnnfmuhttjpwyobklu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Application
NEXT_PUBLIC_APP_URL=https://enviroflow.app

# AI (Optional)
XAI_API_KEY=xai-...

# Encryption (REQUIRED for controller credentials)
ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
```

---

## Troubleshooting

### Migration Fails: "relation already exists"
**Solution**: The complete schema migration has DROP IF EXISTS guards. Re-run it.

### Migration Fails: "permission denied"
**Solution**: Ensure you're logged in as database owner in Supabase Dashboard.

### RLS Blocks Query: "new row violates row-level security policy"
**Solution**: User must be authenticated. Check `auth.uid()` is set.

### Controller Adapter Error: "credentials must be encrypted"
**Solution**: Generate `ENCRYPTION_KEY` and add to `.env.local`.

### Workflow Not Executing
**Solutions**:
1. Check `is_active = true` in workflows table
2. Verify Vercel Cron is configured: `/api/cron/workflows`
3. Check `activity_logs` for errors
4. Verify `SUPABASE_SERVICE_ROLE_KEY` is set

---

## Testing

### Test Controller Adapter Locally
```typescript
import { createAdapter } from './lib/adapters';

// Test AC Infinity adapter
const adapter = createAdapter('ac_infinity');
const result = await adapter.connect({
  email: 'test@example.com',
  password: 'test123'
});
console.log('Connection result:', result);
```

### Test Database Queries
```sql
-- Test RLS policies work
SELECT * FROM controllers WHERE user_id = auth.uid();

-- Test growth stages accessible
SELECT * FROM growth_stages ORDER BY stage_order;

-- Test workflow run increment
SELECT increment_workflow_run('workflow-id-here'::uuid, NOW());
```

---

## Support

- **Supabase Dashboard**: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu
- **Database Logs**: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/logs/postgres-logs
- **SQL Editor**: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
- **Supabase Status**: https://status.supabase.com

---

## Next Steps

1. **Run Migrations**: Follow `QUICK_MIGRATION_GUIDE.md`
2. **Verify Success**: Run `VERIFY_MIGRATIONS.sql`
3. **Add Encryption Key**: Generate and add to `.env.local`
4. **Test Frontend**: Start Next.js dev server (`npm run dev`)
5. **Add Test Data**: Create user, controllers, workflows
6. **Monitor Execution**: Check `activity_logs` table

---

**Database Architect Approval**: ✅ Reviewed and approved for production
**Last Updated**: 2026-01-21
