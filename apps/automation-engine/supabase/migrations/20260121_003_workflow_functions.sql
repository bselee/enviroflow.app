-- ============================================================================
-- Migration: 20260121_workflow_functions.sql
-- Purpose: Add atomic increment function for workflow run tracking
-- ============================================================================
--
-- PROBLEM SOLVED:
-- The workflow executor previously used a read-modify-write pattern to update
-- run_count, which is not atomic:
--
--   1. SELECT run_count FROM workflows WHERE id = $1
--   2. UPDATE workflows SET run_count = (old_value + 1) WHERE id = $1
--
-- If two workflow executions happen concurrently (e.g., multiple cron workers),
-- both could read the same run_count value and write back the same incremented
-- value, effectively losing a count.
--
-- SOLUTION:
-- Use a PostgreSQL function that performs the increment atomically using
-- a single UPDATE statement. PostgreSQL's UPDATE is atomic within a single
-- statement, so concurrent calls will each see the effect of previous writes.
--
-- ============================================================================

-- Drop existing function if it exists (for idempotency)
DROP FUNCTION IF EXISTS increment_workflow_run(UUID, TIMESTAMPTZ);

/**
 * Atomically increment a workflow's run_count and update last_run timestamp.
 *
 * This function performs both updates in a single atomic operation, preventing
 * race conditions that could occur with separate read-modify-write patterns.
 *
 * @param p_workflow_id - UUID of the workflow to update
 * @param p_last_run - Timestamp of the run (defaults to NOW() if not provided)
 * @returns void
 *
 * Usage from Supabase client:
 *   await supabase.rpc('increment_workflow_run', {
 *     p_workflow_id: workflowId,
 *     p_last_run: new Date().toISOString()
 *   })
 *
 * Security:
 * - This function is marked as SECURITY DEFINER to bypass RLS when called
 *   from the service role. The workflow executor uses the service role key,
 *   so this is appropriate for cron-triggered operations.
 * - The function only modifies the specific workflow row identified by ID.
 */
CREATE OR REPLACE FUNCTION increment_workflow_run(
  p_workflow_id UUID,
  p_last_run TIMESTAMPTZ DEFAULT NOW()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE workflows
  SET
    run_count = COALESCE(run_count, 0) + 1,
    last_run = p_last_run,
    updated_at = NOW()
  WHERE id = p_workflow_id;

  -- Optionally raise a notice if no rows were updated (workflow not found)
  -- This is for debugging; in production, silent failure is acceptable
  IF NOT FOUND THEN
    RAISE WARNING 'increment_workflow_run: No workflow found with id %', p_workflow_id;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users and service role
-- The service role (used by cron) needs this permission
GRANT EXECUTE ON FUNCTION increment_workflow_run(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_workflow_run(UUID, TIMESTAMPTZ) TO service_role;

-- Add a comment for documentation
COMMENT ON FUNCTION increment_workflow_run(UUID, TIMESTAMPTZ) IS
  'Atomically increments workflow run_count and updates last_run timestamp. '
  'Used by the workflow executor cron job to prevent race conditions.';
