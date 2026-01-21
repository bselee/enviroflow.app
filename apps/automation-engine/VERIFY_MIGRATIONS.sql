-- ============================================================================
-- EnviroFlow Migration Verification Suite
-- Run this in Supabase SQL Editor after executing all migrations
-- ============================================================================

-- ============================================================================
-- VERIFICATION 1: Check All Tables Exist (Expected: 14 tables)
-- ============================================================================
SELECT
  '1. TABLE COUNT VERIFICATION' AS test_name,
  COUNT(*) AS actual_count,
  14 AS expected_count,
  CASE
    WHEN COUNT(*) = 14 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing tables'
  END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- List all tables with row counts
SELECT
  '1a. ALL TABLES LIST' AS test_name,
  table_name,
  (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE columns.table_name = tables.table_name
      AND columns.table_schema = 'public'
  ) AS column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================================
-- VERIFICATION 2: Verify RLS Enabled on All Tables
-- ============================================================================
SELECT
  '2. RLS VERIFICATION' AS test_name,
  tablename,
  rowsecurity AS rls_enabled,
  CASE
    WHEN rowsecurity = true THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled'
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;

-- Summary of RLS status
SELECT
  '2a. RLS SUMMARY' AS test_name,
  COUNT(*) AS total_tables,
  SUM(CASE WHEN rowsecurity = true THEN 1 ELSE 0 END) AS tables_with_rls,
  CASE
    WHEN COUNT(*) = SUM(CASE WHEN rowsecurity = true THEN 1 ELSE 0 END)
    THEN '✅ ALL TABLES HAVE RLS'
    ELSE '❌ SOME TABLES MISSING RLS'
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%';

-- ============================================================================
-- VERIFICATION 3: Verify Functions Created (Expected: 9 functions)
-- ============================================================================
SELECT
  '3. FUNCTION COUNT VERIFICATION' AS test_name,
  COUNT(*) AS actual_count,
  9 AS expected_count,
  CASE
    WHEN COUNT(*) >= 9 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing functions'
  END AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION';

-- List all functions
SELECT
  '3a. ALL FUNCTIONS LIST' AS test_name,
  routine_name AS function_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- ============================================================================
-- VERIFICATION 4: Verify Realtime Publications (Expected: 7 tables)
-- ============================================================================
SELECT
  '4. REALTIME VERIFICATION' AS test_name,
  COUNT(*) AS actual_count,
  7 AS expected_count,
  CASE
    WHEN COUNT(*) = 7 THEN '✅ PASS'
    ELSE '⚠️ WARNING - Check realtime configuration'
  END AS status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- List all realtime-enabled tables
SELECT
  '4a. REALTIME TABLES LIST' AS test_name,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- ============================================================================
-- VERIFICATION 5: Verify Growth Stages Seeded (Expected: 5 rows)
-- ============================================================================
SELECT
  '5. GROWTH STAGES VERIFICATION' AS test_name,
  COUNT(*) AS actual_count,
  5 AS expected_count,
  CASE
    WHEN COUNT(*) = 5 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing growth stages'
  END AS status
FROM growth_stages;

-- List all growth stages
SELECT
  '5a. GROWTH STAGES LIST' AS test_name,
  name,
  stage_order,
  duration_days,
  light_hours,
  vpd_min,
  vpd_max,
  temp_min,
  temp_max,
  humidity_min,
  humidity_max
FROM growth_stages
ORDER BY stage_order;

-- ============================================================================
-- VERIFICATION 6: Verify Indexes Created (Expected: 50+ indexes)
-- ============================================================================
SELECT
  '6. INDEX COUNT VERIFICATION' AS test_name,
  COUNT(*) AS actual_count,
  50 AS expected_minimum,
  CASE
    WHEN COUNT(*) >= 50 THEN '✅ PASS'
    ELSE '⚠️ WARNING - Fewer indexes than expected'
  END AS status
FROM pg_indexes
WHERE schemaname = 'public';

-- List indexes by table
SELECT
  '6a. INDEXES BY TABLE' AS test_name,
  tablename,
  COUNT(*) AS index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- VERIFICATION 7: Verify Triggers Created
-- ============================================================================
SELECT
  '7. TRIGGERS VERIFICATION' AS test_name,
  trigger_name,
  event_object_table AS table_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- VERIFICATION 8: Verify Foreign Key Constraints
-- ============================================================================
SELECT
  '8. FOREIGN KEYS VERIFICATION' AS test_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- VERIFICATION 9: Verify Check Constraints
-- ============================================================================
SELECT
  '9. CHECK CONSTRAINTS VERIFICATION' AS test_name,
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints AS tc
JOIN information_schema.check_constraints AS cc
  ON tc.constraint_name = cc.constraint_name
  AND tc.constraint_schema = cc.constraint_schema
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================================
-- VERIFICATION 10: Verify RLS Policies Count
-- ============================================================================
SELECT
  '10. RLS POLICIES VERIFICATION' AS test_name,
  schemaname,
  tablename,
  COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Summary of RLS policies
SELECT
  '10a. RLS POLICIES SUMMARY' AS test_name,
  COUNT(*) AS total_policies,
  COUNT(DISTINCT tablename) AS tables_with_policies,
  CASE
    WHEN COUNT(*) >= 50 THEN '✅ COMPREHENSIVE COVERAGE'
    ELSE '⚠️ VERIFY POLICY COVERAGE'
  END AS status
FROM pg_policies
WHERE schemaname = 'public';

-- ============================================================================
-- VERIFICATION 11: Test Sample Queries (Query Performance Check)
-- ============================================================================

-- Test rooms query
EXPLAIN ANALYZE
SELECT id, name, user_id, created_at
FROM rooms
WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid
LIMIT 10;

-- Test controllers query with join
EXPLAIN ANALYZE
SELECT c.id, c.name, c.brand, c.status, r.name AS room_name
FROM controllers c
LEFT JOIN rooms r ON c.room_id = r.id
WHERE c.user_id = '00000000-0000-0000-0000-000000000000'::uuid
LIMIT 10;

-- Test workflows query
EXPLAIN ANALYZE
SELECT id, name, is_active, last_executed
FROM workflows
WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND is_active = true
ORDER BY last_executed DESC
LIMIT 10;

-- ============================================================================
-- VERIFICATION 12: Test RPC Functions
-- ============================================================================

-- Test increment_workflow_run function (will fail if no workflow exists)
-- Comment out if no test data exists yet
-- SELECT increment_workflow_run('00000000-0000-0000-0000-000000000000'::uuid, NOW());

-- Test get_unread_notification_count function
SELECT get_unread_notification_count('00000000-0000-0000-0000-000000000000'::uuid) AS unread_count;

-- ============================================================================
-- FINAL SUMMARY REPORT
-- ============================================================================
SELECT
  '╔══════════════════════════════════════════════════════════════╗' AS summary
UNION ALL
SELECT '║          ENVIROFLOW MIGRATION VERIFICATION REPORT           ║'
UNION ALL
SELECT '╠══════════════════════════════════════════════════════════════╣'
UNION ALL
SELECT '║ Migration Date: ' || NOW()::TEXT || '                          ║'
UNION ALL
SELECT '╠══════════════════════════════════════════════════════════════╣'
UNION ALL
SELECT '║ Tables Created:              ' || LPAD((SELECT COUNT(*)::TEXT FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'), 2) || ' / 14                     ║'
UNION ALL
SELECT '║ Functions Created:           ' || LPAD((SELECT COUNT(*)::TEXT FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'), 2) || ' / 9                      ║'
UNION ALL
SELECT '║ Realtime Tables:             ' || LPAD((SELECT COUNT(*)::TEXT FROM pg_publication_tables WHERE pubname = 'supabase_realtime'), 2) || ' / 7                      ║'
UNION ALL
SELECT '║ Growth Stages Seeded:        ' || LPAD((SELECT COUNT(*)::TEXT FROM growth_stages), 2) || ' / 5                      ║'
UNION ALL
SELECT '║ RLS Enabled Tables:          ' || LPAD((SELECT COUNT(*)::TEXT FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true), 2) || ' / 14                     ║'
UNION ALL
SELECT '║ Total Indexes:               ' || LPAD((SELECT COUNT(*)::TEXT FROM pg_indexes WHERE schemaname = 'public'), 2) || '                           ║'
UNION ALL
SELECT '║ Total RLS Policies:          ' || LPAD((SELECT COUNT(*)::TEXT FROM pg_policies WHERE schemaname = 'public'), 2) || '                           ║'
UNION ALL
SELECT '╠══════════════════════════════════════════════════════════════╣'
UNION ALL
SELECT '║ Status: ' ||
  CASE
    WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') = 14
     AND (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION') >= 9
     AND (SELECT COUNT(*) FROM growth_stages) = 5
    THEN '✅ ALL MIGRATIONS SUCCESSFUL                      ║'
    ELSE '❌ MIGRATION VERIFICATION FAILED - CHECK LOGS      ║'
  END
UNION ALL
SELECT '╚══════════════════════════════════════════════════════════════╝';

-- ============================================================================
-- END OF VERIFICATION SUITE
-- ============================================================================
