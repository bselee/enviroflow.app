# EnviroFlow Backend Deployment Guide

## Prerequisites

- Supabase CLI installed (`brew install supabase/tap/supabase`)
- Supabase project created at https://supabase.com
- Node.js 18+ installed

## Local Development

### 1. Start Local Supabase

```bash
cd apps/automation-engine
npm run dev  # or: supabase start
```

This starts:
- PostgreSQL on port 54322
- API Gateway on port 54321
- Studio on port 54323 (http://localhost:54323)
- Email testing on port 54324

### 2. Apply Migrations

```bash
supabase db reset  # Applies migrations and seed data
```

### 3. Test Edge Functions Locally

```bash
npm run functions:serve
```

Then test:
```bash
curl -X POST http://localhost:54321/functions/v1/workflow-executor \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Production Deployment

### 1. Link Project

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### 2. Deploy Database Schema

```bash
npm run db:push
```

### 3. Set Environment Secrets

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

### 4. Deploy Edge Functions

```bash
npm run deploy
# or individually:
npm run deploy:workflow-executor
npm run deploy:sunrise-sunset
npm run deploy:health-check
```

### 5. Configure Cron Jobs

In Supabase Dashboard → Database → Extensions:
1. Enable `pg_cron` extension

Then in SQL Editor, run:

```sql
-- Workflow Executor (every 60 seconds)
SELECT cron.schedule(
  'workflow-executor',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/workflow-executor',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb
  )
  $$
);

-- Sunrise/Sunset (every 60 seconds)
SELECT cron.schedule(
  'sunrise-sunset',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sunrise-sunset',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb
  )
  $$
);

-- Health Check (every 5 minutes)
SELECT cron.schedule(
  'health-check',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/health-check',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb
  )
  $$
);

-- Cleanup old activity logs (daily at 3 AM UTC)
SELECT cron.schedule(
  'cleanup-logs',
  '0 3 * * *',
  $$SELECT cleanup_old_activity_logs()$$
);

-- Cleanup old sensor readings (daily at 3:30 AM UTC)
SELECT cron.schedule(
  'cleanup-sensors',
  '30 3 * * *',
  $$SELECT cleanup_old_sensor_readings(7)$$  -- Keep 7 days
);
```

### Verify Cron Jobs

```sql
SELECT * FROM cron.job;
```

## API Endpoints

### Edge Functions

| Function | URL | Schedule | Purpose |
|----------|-----|----------|---------|
| workflow-executor | `/functions/v1/workflow-executor` | Every 1 min | Execute active workflows |
| sunrise-sunset | `/functions/v1/sunrise-sunset` | Every 1 min | Handle lighting automation |
| health-check | `/functions/v1/health-check` | Every 5 min | Check controller status |

### Supabase Tables

| Table | Description | RLS |
|-------|-------------|-----|
| controllers | Connected devices | User owns |
| workflows | Automation workflows | User owns |
| workflow_rooms | Workflow-controller mapping | Via workflow |
| activity_logs | Execution history | User owns |
| sensor_readings | Sensor data cache | Via controller |
| dimmer_configs | Sunrise/sunset settings | Via workflow |

## Troubleshooting

### Check Function Logs

```bash
supabase functions logs workflow-executor
```

### Check Cron Job History

```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### Manual Function Invocation

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/workflow-executor \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Security Notes

1. **Never commit credentials** - Use environment variables/secrets
2. **Encryption key** - Store securely, required for credential encryption
3. **Service role key** - Only used in Edge Functions, never expose to client
4. **RLS policies** - All tables have Row Level Security enabled
