# EnviroFlow Database Migrations

## Naming Convention

Migrations follow the format: `YYYYMMDD_NNN_description.sql`

- `YYYYMMDD` - Date the migration was created
- `NNN` - Sequential number for that date (001, 002, etc.)
- `description` - Brief snake_case description

## Migration Order

Run in alphabetical/chronological order:

| File | Description | Status |
|------|-------------|--------|
| `20260121_001_complete_schema.sql` | Base schema: controllers, rooms, workflows, sensor_readings | ✅ Applied |
| `20260121_002_ai_analysis_tables.sql` | AI insights table for Grok analysis | ✅ Applied |
| `20260121_003_workflow_functions.sql` | Workflow execution helper functions | ✅ Applied |
| `20260121_004_notifications.sql` | Push notification tokens and preferences | ✅ Applied |
| `20260123_001_add_status_column.sql` | Add status column to controllers | ✅ Applied |
| `20260123_002_fix_sensor_readings_column.sql` | Fix sensor_readings column types | ✅ Applied |
| `20260124_001_add_ecowitt_sensor_types.sql` | Add Ecowitt-specific sensor types | ✅ Applied |
| `20260124_002_add_controller_health.sql` | Controller health scoring system | ✅ Applied |
| `20260124_003_add_device_schedules.sql` | Time-based device scheduling | ✅ Applied |
| `20260124_004_add_alerts_system.sql` | Proactive alerting system | ✅ Applied |

## Running Migrations

### Via Supabase Dashboard (Recommended)
1. Go to: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
2. Copy/paste each migration file in order
3. Execute

### Via Supabase CLI
```bash
# Install CLI first (see below)
cd apps/automation-engine
supabase db push
```

### Via Direct Database Connection
```bash
psql $DATABASE_URL < migrations/YYYYMMDD_NNN_description.sql
```

## Creating New Migrations

```bash
cd apps/automation-engine/supabase/migrations

# Get today's date
DATE=$(date +%Y%m%d)

# Find next sequence number for today
EXISTING=$(ls ${DATE}_*.sql 2>/dev/null | wc -l)
NEXT=$(printf "%03d" $((EXISTING + 1)))

# Create migration file
touch "${DATE}_${NEXT}_your_description.sql"
echo "Created: ${DATE}_${NEXT}_your_description.sql"
```

## Troubleshooting

### Common Errors

| Error | Solution |
|-------|----------|
| `column controllers.status does not exist` | Run `20260123_001_add_status_column.sql` |
| `column sensor_readings.recorded_at does not exist` | Run `20260123_002_fix_sensor_readings_column.sql` |
| `table alerts does not exist` | Run `20260124_004_add_alerts_system.sql` |
| `function has_recent_alert does not exist` | Run `20260124_004_add_alerts_system.sql` |

### Verify Schema
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check specific column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'controllers';
```

## Best Practices

1. **Always backup** before running migrations in production
2. **Test migrations** on a staging database first
3. **Run migrations during low-traffic** periods
4. **Use IF NOT EXISTS** / **IF EXISTS** for idempotent migrations
5. **Include verification queries** at the end of migrations
