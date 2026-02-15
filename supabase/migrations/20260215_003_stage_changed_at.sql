-- Add stage_changed_at column to grow_cycles for accurate stage day counting
-- This tracks when the current_stage was last changed, so "Day X of <stage>" is accurate

ALTER TABLE grow_cycles
ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ;

-- Backfill existing rows: set stage_changed_at = updated_at (best approximation)
UPDATE grow_cycles
SET stage_changed_at = updated_at
WHERE stage_changed_at IS NULL;

COMMENT ON COLUMN grow_cycles.stage_changed_at IS 'Timestamp when current_stage was last changed. Used for accurate stage day counting.';
