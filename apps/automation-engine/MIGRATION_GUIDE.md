# Database Migration Guide

## Quick Start - Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
2. Copy the SQL from: `apps/automation-engine/supabase/migrations/20260120_ai_analysis_tables.sql`
3. Paste into the SQL Editor
4. Click "Run"

### Option 2: Node.js Script

```bash
cd /workspaces/enviroflow.app
export DB_PASSWORD=your_postgres_password
node apps/automation-engine/scripts/migrate.js
```

### Option 3: Direct psql Connection

```bash
export DATABASE_URL='postgresql://postgres:YOUR_PASSWORD@db.vhlnnfmuhttjpwyobklu.supabase.co:5432/postgres'
cd /workspaces/enviroflow.app/apps/automation-engine
./scripts/migrate.sh
```

## What Gets Created

The migration creates three tables:

### 1. ai_insights
Stores AI analysis results from Grok API
- query, analysis, confidence score
- recommendations (JSONB)
- Realtime enabled

### 2. sensor_logs
Environmental sensor data
- sensor_id, data_type (vpd, temp, humidity, etc.)
- value, unit, timestamp
- Indexed for fast queries

### 3. automation_actions
Robotics control commands
- action_type, target_device
- parameters (JSONB)
- status tracking (pending → completed)
- Links to ai_insights

## Verification

After migration, verify tables:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ai_insights', 'sensor_logs', 'automation_actions');
```

## Next Steps After Migration

1. **Test the API endpoint**:
   ```bash
   curl https://enviroflow.app/api/analyze
   ```

2. **Insert test data**:
   ```sql
   INSERT INTO sensor_logs (sensor_id, data_type, value, unit)
   VALUES ('sensor-1', 'vpd', 1.2, 'kPa');
   ```

3. **Set environment variables** in Vercel:
   - GROK_API_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - DATABASE_URL

4. **Deploy and test**:
   ```bash
   git push origin main
   ```
