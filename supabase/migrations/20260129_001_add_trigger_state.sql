-- Add missing trigger_state column to workflows table
-- This column tracks the state of trigger-based workflows

-- Add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflows' AND column_name = 'trigger_state'
  ) THEN
    ALTER TABLE workflows
    ADD COLUMN trigger_state TEXT DEFAULT 'ARMED'
    CHECK (trigger_state IN ('ARMED', 'FIRED', 'RESET'));

    COMMENT ON COLUMN workflows.trigger_state IS 'State of trigger-based workflows: ARMED (ready), FIRED (triggered), RESET (cooldown)';
  END IF;
END $$;

-- Add index for efficient querying of active armed workflows
CREATE INDEX IF NOT EXISTS idx_workflows_active_armed
ON workflows(is_active, trigger_state)
WHERE is_active = true;
