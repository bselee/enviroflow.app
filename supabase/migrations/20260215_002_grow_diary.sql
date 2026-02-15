-- Grow Diary Feature Migration
-- Creates tables for grow cycles, diary entries, and photos

-- =============================================================================
-- Grow Cycles Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS grow_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,

  -- Assignment
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  controller_ids UUID[] DEFAULT '{}',

  -- Tracking
  current_stage TEXT CHECK (current_stage IN (
    'germination', 'seedling', 'vegetative', 'flowering', 'harvest', 'cure'
  )) DEFAULT 'seedling',
  status TEXT CHECK (status IN ('active', 'completed', 'archived')) DEFAULT 'active',

  -- Settings
  enable_device_logging BOOLEAN DEFAULT true,
  enable_sensor_logging BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Diary Entries Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES grow_cycles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Content
  title TEXT,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',

  -- Sensor snapshot at time of entry
  sensor_snapshot JSONB,

  -- Timing
  entry_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Diary Photos Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS diary_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES diary_entries(id) ON DELETE CASCADE NOT NULL,

  -- Storage
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,

  -- Metadata
  filename TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_grow_cycles_user ON grow_cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_grow_cycles_active ON grow_cycles(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_grow_cycles_room ON grow_cycles(room_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_cycle ON diary_entries(cycle_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_diary_entries_user ON diary_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_diary_photos_entry ON diary_photos(entry_id, sort_order);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE grow_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_photos ENABLE ROW LEVEL SECURITY;

-- Grow cycles policies
DROP POLICY IF EXISTS "Users can view own cycles" ON grow_cycles;
CREATE POLICY "Users can view own cycles" ON grow_cycles
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own cycles" ON grow_cycles;
CREATE POLICY "Users can create own cycles" ON grow_cycles
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own cycles" ON grow_cycles;
CREATE POLICY "Users can update own cycles" ON grow_cycles
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own cycles" ON grow_cycles;
CREATE POLICY "Users can delete own cycles" ON grow_cycles
  FOR DELETE USING (user_id = auth.uid());

-- Diary entries policies
DROP POLICY IF EXISTS "Users can view own entries" ON diary_entries;
CREATE POLICY "Users can view own entries" ON diary_entries
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own entries" ON diary_entries;
CREATE POLICY "Users can create own entries" ON diary_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own entries" ON diary_entries;
CREATE POLICY "Users can update own entries" ON diary_entries
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own entries" ON diary_entries;
CREATE POLICY "Users can delete own entries" ON diary_entries
  FOR DELETE USING (user_id = auth.uid());

-- Diary photos policies
DROP POLICY IF EXISTS "Users can view photos for own entries" ON diary_photos;
CREATE POLICY "Users can view photos for own entries" ON diary_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM diary_entries
      WHERE diary_entries.id = diary_photos.entry_id
      AND diary_entries.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create photos for own entries" ON diary_photos;
CREATE POLICY "Users can create photos for own entries" ON diary_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM diary_entries
      WHERE diary_entries.id = diary_photos.entry_id
      AND diary_entries.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update photos for own entries" ON diary_photos;
CREATE POLICY "Users can update photos for own entries" ON diary_photos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM diary_entries
      WHERE diary_entries.id = diary_photos.entry_id
      AND diary_entries.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete photos for own entries" ON diary_photos;
CREATE POLICY "Users can delete photos for own entries" ON diary_photos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM diary_entries
      WHERE diary_entries.id = diary_photos.entry_id
      AND diary_entries.user_id = auth.uid()
    )
  );

-- =============================================================================
-- Updated At Triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION update_grow_cycles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grow_cycles_updated_at ON grow_cycles;
CREATE TRIGGER grow_cycles_updated_at
  BEFORE UPDATE ON grow_cycles
  FOR EACH ROW
  EXECUTE FUNCTION update_grow_cycles_updated_at();

CREATE OR REPLACE FUNCTION update_diary_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS diary_entries_updated_at ON diary_entries;
CREATE TRIGGER diary_entries_updated_at
  BEFORE UPDATE ON diary_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_diary_entries_updated_at();
