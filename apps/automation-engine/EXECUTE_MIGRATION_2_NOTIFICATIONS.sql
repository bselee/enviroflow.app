-- ============================================
-- EnviroFlow Notifications Schema Extension
-- Migration: 20260121_notifications.sql
-- Adds in-app notifications table for MVP fallback
-- ============================================
--
-- This migration adds:
-- 1. notifications table for storing in-app notifications
-- 2. Triggers for automatic cleanup (30-day retention)
-- 3. Index for efficient querying of unread notifications
-- 4. RLS policies for secure access
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
-- ============================================

-- ============================================
-- STEP 1: CREATE NOTIFICATIONS TABLE
-- Stores in-app notifications as fallback for push delivery failures
-- or for users without push tokens registered
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Notification content
  title TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Category for styling and filtering
  -- alert: Critical alerts (red)
  -- warning: Non-critical warnings (amber)
  -- info: Informational updates (blue)
  -- success: Confirmation of actions (green)
  category TEXT DEFAULT 'info' CHECK (category IN ('alert', 'warning', 'info', 'success')),

  -- Additional data payload (workflow context, action URLs, etc.)
  data JSONB DEFAULT '{}',

  -- Read status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Source tracking (optional)
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

  -- Constraints
  CONSTRAINT notifications_title_not_empty CHECK (LENGTH(TRIM(title)) > 0),
  CONSTRAINT notifications_body_not_empty CHECK (LENGTH(TRIM(body)) > 0)
);

-- Add comment for documentation
COMMENT ON TABLE notifications IS 'In-app notifications for users. Used as fallback when push delivery fails or for users without push tokens.';
COMMENT ON COLUMN notifications.category IS 'Notification type: alert (critical), warning, info, success';
COMMENT ON COLUMN notifications.data IS 'Additional JSON payload: workflowName, actionType, actionUrl, etc.';
COMMENT ON COLUMN notifications.expires_at IS '30-day TTL for automatic cleanup';

-- ============================================
-- STEP 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Primary query pattern: Get unread notifications for a user
CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE is_read = false;

-- Query for all notifications (read and unread) for a user
CREATE INDEX idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- Query for notifications by category
CREATE INDEX idx_notifications_user_category
  ON notifications(user_id, category, created_at DESC);

-- Index for cleanup queries (expired notifications)
CREATE INDEX idx_notifications_expires
  ON notifications(expires_at)
  WHERE expires_at IS NOT NULL;

-- Index for workflow-related notifications
CREATE INDEX idx_notifications_workflow
  ON notifications(workflow_id, created_at DESC)
  WHERE workflow_id IS NOT NULL;

-- ============================================
-- STEP 3: ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert notifications (for workflow executor)
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 4: CLEANUP FUNCTION FOR EXPIRED NOTIFICATIONS
-- ============================================

-- Function to clean up expired notifications (30-day retention)
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE expires_at < NOW()
     OR created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log cleanup result
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Cleaned up % expired notifications', deleted_count;
  END IF;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_notifications IS 'Removes notifications older than 30 days or past their expires_at date';

-- ============================================
-- STEP 5: TRIGGER FOR AUTO-UPDATING read_at
-- ============================================

-- Function to set read_at timestamp when is_read changes to true
CREATE OR REPLACE FUNCTION set_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-setting read_at
CREATE TRIGGER tr_notifications_read_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  WHEN (NEW.is_read IS DISTINCT FROM OLD.is_read)
  EXECUTE FUNCTION set_notification_read_at();

-- ============================================
-- STEP 6: HELPER FUNCTIONS FOR NOTIFICATION OPERATIONS
-- ============================================

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = true, read_at = NOW()
  WHERE user_id = target_user_id AND is_read = false;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_all_notifications_read IS 'Marks all unread notifications as read for a given user';

-- Function to get unread notification count for a user
CREATE OR REPLACE FUNCTION get_unread_notification_count(target_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE user_id = target_user_id AND is_read = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_unread_notification_count IS 'Returns the count of unread notifications for a given user';

-- ============================================
-- STEP 7: ENABLE REALTIME FOR NOTIFICATIONS
-- ============================================

-- Add notifications to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================
-- STEP 8: GRANT PERMISSIONS
-- ============================================

-- Ensure service_role has full access
GRANT ALL ON notifications TO service_role;

-- Ensure authenticated users have access (RLS applies)
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;

-- ============================================
-- STEP 9: VERIFICATION
-- ============================================

DO $$
BEGIN
  -- Verify table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    RAISE EXCEPTION 'Table notifications was not created';
  END IF;

  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'notifications' AND rowsecurity = true
  ) THEN
    RAISE WARNING 'RLS may not be enabled on notifications table';
  END IF;

  RAISE NOTICE 'Notifications table created successfully with RLS and realtime enabled';
END $$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

SELECT
  'Notifications schema migration completed!' AS status,
  NOW() AS completed_at;
