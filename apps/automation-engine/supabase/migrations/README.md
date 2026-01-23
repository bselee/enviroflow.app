# Database Migrations

This folder contains SQL migration files for the EnviroFlow database schema.

## Migration Files

### 20260120_complete_schema.sql
- **Status**: Deprecated
- **Description**: Initial complete schema with `is_online` boolean column
- **Note**: This schema is outdated and should not be used for new installations

### 20260121_complete_schema.sql
- **Status**: Current base schema
- **Description**: Updated complete schema with `status` TEXT column
- **Note**: Use this for fresh database installations

### 20260121_notifications.sql
- **Status**: Active
- **Description**: Notification system tables and functions

### 20260123_add_status_column.sql
- **Status**: Required for existing databases
- **Description**: Migrates from `is_online` to `status` column
- **Purpose**: Fixes "column controllers.status does not exist" error

### 20260123_002_fix_sensor_readings_column.sql
- **Status**: Required for production databases
- **Description**: Renames `timestamp` to `recorded_at` in sensor_readings table
- **Purpose**: Fixes "Could not find the 'recorded_at' column of 'sensor_readings' in the schema cache"

## How to Apply Migrations

### For Fresh Installations

Run migrations in this order:
1. `20260121_complete_schema.sql` - Base schema
2. `20260121_notifications.sql` - Notifications (optional)

### For Existing Databases

If you have a database created with `20260120_complete_schema.sql`:
1. Run `20260123_add_status_column.sql` to migrate to the new schema
2. Run `20260123_002_fix_sensor_readings_column.sql` to fix sensor_readings column name
3. Run `20260121_notifications.sql` if you need notifications

## Running Migrations

### Via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
2. Open the SQL Editor
3. Copy and paste the migration SQL
4. Click "Run"

### Via Supabase CLI

```bash
cd apps/automation-engine
supabase db push
```

### Via Direct Database Connection

Use any PostgreSQL client (psql, DBeaver, etc.):

```bash
psql $DATABASE_URL < migrations/20260123_add_status_column.sql
```

## Migration Status

Current production database status:
- **Schema version**: 20260120 (outdated)
- **Required migrations**:
  1. `20260123_add_status_column.sql` - Fixes controllers.status column
  2. `20260123_002_fix_sensor_readings_column.sql` - Fixes sensor_readings.recorded_at column
- **Reason**: Application code expects newer column names

## Troubleshooting

### Error: "column controllers.status does not exist"

**Cause**: Database is using old schema with `is_online` column

**Solution**: Run `20260123_add_status_column.sql` migration

See [/docs/migration-status-column.md](/docs/migration-status-column.md) for detailed instructions.

### Error: "Could not find the 'recorded_at' column of 'sensor_readings' in the schema cache"

**Cause**: Database is using old schema with `timestamp` column instead of `recorded_at`

**Solution**: Run `20260123_002_fix_sensor_readings_column.sql` migration

**Verification**:
```sql
-- Check current column name
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sensor_readings'
  AND column_name IN ('timestamp', 'recorded_at');
```

### Error: "column controllers.is_online does not exist"

**Cause**: You ran the new migration but code is using old column name

**Solution**: Update your code to use `status` instead of `is_online`

## Best Practices

1. **Always backup** before running migrations in production
2. **Test migrations** on a staging database first
3. **Run migrations during low-traffic** periods
4. **Monitor application logs** after migrations
5. **Have a rollback plan** ready

## Schema Change Policy

When making schema changes:

1. Create a new migration file with timestamp: `YYYYMMDD_description.sql`
2. Include both `ALTER` statements and data migration logic
3. Add indexes and constraints after data migration
4. Document the change in this README
5. Update TypeScript types in `/apps/web/src/types/index.ts`
6. Test with the application before deploying

## Support

For migration issues or questions:
- Check the main documentation: `/docs/`
- Review the schema spec: `/docs/spec/EnviroFlow_MVP_Spec_v2.0.md`
- Consult the CLAUDE.md file for database patterns
