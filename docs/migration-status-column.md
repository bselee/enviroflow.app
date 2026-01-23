# Database Migration: Fix `controllers.status` Column

## Issue Summary

The application is experiencing a database error: **"column controllers.status does not exist"**

This error occurs in multiple hooks:
- `useRooms` - when fetching rooms with controllers
- `useDashboardData` - when fetching dashboard data
- `useControllers` - when fetching controllers directly

## Root Cause

The production database schema is based on an older migration (`20260120_complete_schema.sql`) that uses:
- `is_online BOOLEAN` column

However, the application code and newer migration (`20260121_complete_schema.sql`) expect:
- `status TEXT` column with values: 'online', 'offline', 'error', 'initializing'

## Solution

A new migration has been created to resolve this issue:
- **File**: `apps/automation-engine/supabase/migrations/20260123_add_status_column.sql`

This migration will:
1. Add the `status` column with proper constraints
2. Migrate existing `is_online` data to `status` values
3. Drop the deprecated `is_online` column
4. Update indexes for optimal performance

## How to Apply the Migration

### Option 1: Supabase SQL Editor (Recommended)

1. Go to Supabase Dashboard:
   - URL: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql

2. Copy the contents of the migration file:
   ```bash
   cat apps/automation-engine/supabase/migrations/20260123_add_status_column.sql
   ```

3. Paste into the SQL Editor and click "Run"

4. Verify the migration completed successfully by checking the output message

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
cd apps/automation-engine
supabase db push
```

### Option 3: Manual SQL Execution

Connect to your database and run:

```sql
-- Add status column
ALTER TABLE controllers
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline'
CHECK (status IN ('online', 'offline', 'error', 'initializing'));

-- Migrate data
UPDATE controllers
SET status = CASE
  WHEN is_online = true THEN 'online'
  ELSE 'offline'
END
WHERE status = 'offline';

-- Drop old column
ALTER TABLE controllers DROP COLUMN IF EXISTS is_online;

-- Update indexes
DROP INDEX IF EXISTS idx_controllers_user_online;
CREATE INDEX IF NOT EXISTS idx_controllers_user_status ON controllers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_controllers_last_seen ON controllers(last_seen DESC) WHERE status = 'online';
```

## Verification

After applying the migration, verify it worked:

1. Check the column exists:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'controllers'
   AND column_name = 'status';
   ```

2. Check data was migrated:
   ```sql
   SELECT status, COUNT(*)
   FROM controllers
   GROUP BY status;
   ```

3. Test the application:
   - Navigate to the dashboard
   - Check that rooms with controllers load without errors
   - Verify controller status displays correctly

## Affected Files

The following files reference the `status` column and will work correctly after migration:

- `/workspaces/enviroflow.app/apps/web/src/hooks/use-rooms.ts` (line 78)
- `/workspaces/enviroflow.app/apps/web/src/hooks/use-dashboard-data.ts` (line 579, 667, 732, 794)
- `/workspaces/enviroflow.app/apps/web/src/hooks/use-controllers.ts` (line 120)
- `/workspaces/enviroflow.app/apps/web/src/types/index.ts` (line 132, 145)

## Impact

- **Before Migration**: Application throws database errors when fetching controller data
- **After Migration**: All controller queries work correctly with proper status tracking

## Rollback Plan

If you need to rollback this migration:

```sql
-- Add back is_online column
ALTER TABLE controllers ADD COLUMN is_online BOOLEAN DEFAULT false;

-- Migrate status back to is_online
UPDATE controllers SET is_online = (status = 'online');

-- Drop status column
ALTER TABLE controllers DROP COLUMN status;

-- Restore old index
CREATE INDEX idx_controllers_user_online ON controllers(user_id, is_online);
```

⚠️ **Note**: Rollback will lose 'error' and 'initializing' state information.

## Next Steps

After applying this migration, consider:

1. Updating the cron job (`/api/cron/poll-sensors`) to properly update controller status
2. Implementing connection health checks that set appropriate status values
3. Adding retry logic for controllers in 'error' state
4. Creating monitoring alerts for controllers stuck in 'initializing' state
