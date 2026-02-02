# EnviroFlow Project Status

## Last Updated: February 2, 2026 (Architecture Unified)

## Current State

### ✅ MAJOR BREAKTHROUGH: API Working!
- **`/api/sensors/live` endpoint is FULLY FUNCTIONAL**
- Returns 3 AC Infinity devices: Red Room, Lil Dry Guy, Biggie
- Temperature, humidity, VPD, port status all working
- Response time: ~250ms

### Critical Files Fixed
1. `/apps/web/src/app/api/sensors/live/route.ts`
   - Fixed `extractSensorData()` to read from `device.deviceInfo.temperature`
   - Fixed `extractPorts()` to read from `device.deviceInfo.ports`

2. `/apps/web/.env.local`
   - Added `AC_INFINITY_EMAIL=bselee@gmail.com`
   - Added `AC_INFINITY_PASSWORD=midFe8-dyqbur-diswan`

### ✅ Architecture Documentation Unified
- Created `/docs/ARCHITECTURE.md` - AUTHORITATIVE guide
- Updated `/CLAUDE.md` - References ARCHITECTURE.md
- Archived conflicting docs with deprecation headers:
  - `docs/spec/Controllers/ha-acinfinity.md`
  - `docs/spec/Controllers/vercel-direct-api.md`
- Created `/docs/MIGRATION_TODO.md` - List of files needing Realtime removal

### Architecture Pattern (CONFIRMED WORKING)
```
Browser → LiveSensorDashboard → fetch('/api/sensors/live') → AC Infinity Cloud
         └─ setInterval(15s) ─┘
```
**NO Supabase Realtime subscriptions for sensors!**

### ✅ Completed
- [x] Vercel deployment at enviroflow.app
- [x] Full UI with shadcn/ui components (50+ components)
- [x] All pages: landing, login, signup, dashboard, automations, controllers, settings
- [x] /api/analyze endpoint (Grok AI integration)
- [x] ai-insights.ts realtime hooks
- [x] **DATABASE MIGRATION** - 20260120_complete_schema.sql
- [x] **CONTROLLER ADAPTERS** - ACInfinityAdapter, InkbirdAdapter, CSVUploadAdapter
- [x] **API ROUTES** - controllers, cron/workflows
- [x] **/api/sensors/live - WORKING!** ✅

### 🔨 Remaining: Display in Browser
- LiveSensorDashboard component exists and uses correct pattern
- API returns data correctly
- Need to verify browser displays data (may be auth redirect)

### 📋 Migration Tasks (see docs/MIGRATION_TODO.md)
- [ ] Remove Realtime subscriptions from useDashboardData.ts
- [ ] Remove Realtime subscriptions from use-sensor-readings.ts
- [ ] Remove Realtime subscriptions from use-rooms.ts

## Important Files Created Today

| File | Purpose |
|------|---------|
| `apps/automation-engine/supabase/migrations/20260120_complete_schema.sql` | Complete database schema (14 tables) |
| `apps/automation-engine/lib/adapters/types.ts` | TypeScript interfaces for adapters |
| `apps/automation-engine/lib/adapters/ACInfinityAdapter.ts` | AC Infinity cloud API adapter |
| `apps/automation-engine/lib/adapters/InkbirdAdapter.ts` | Inkbird cloud API adapter |
| `apps/automation-engine/lib/adapters/CSVUploadAdapter.ts` | Manual CSV data adapter |
| `apps/automation-engine/lib/adapters/index.ts` | Adapter factory & exports |
| `apps/web/src/app/api/controllers/route.ts` | Controller CRUD API |
| `apps/web/src/app/api/controllers/brands/route.ts` | Supported brands API |
| `apps/web/src/app/api/controllers/csv-template/route.ts` | CSV template download |
| `apps/web/src/app/api/cron/workflows/route.ts` | Workflow executor cron |
| `docs/BACKEND_GUIDE.md` | Developer documentation |

## Database Tables in Migration

1. controllers - Hardware controllers (AC Infinity, Inkbird, CSV)
2. rooms - Logical grouping of controllers
3. workflows - Automation workflow definitions
4. activity_logs - Execution history (90-day retention)
5. audit_logs - Security/compliance (1-year retention)
6. sensor_readings - Cached sensor data (30-day retention)
7. manual_sensor_data - CSV uploads (90-day retention)
8. sunrise_sunset_cache - Daily lighting calculations
9. dimmer_schedules - Sunrise/sunset gradual dimming
10. push_tokens - Mobile push notification tokens
11. growth_stages - Plant growth stage definitions
12. workflow_templates - Shareable workflow configs
13. ai_insights - Grok AI analysis results
14. (RLS policies & triggers for all tables)

## Credentials

- **Supabase:** vhlnnfmuhttjpwyobklu.supabase.co
- **Database:** db.vhlnnfmuhttjpwyobklu.supabase.co:5432
- **Dashboard:** https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu

## MVP Spec Reference

Full spec: `/docs/spec/EnviroFlow_MVP_Spec_v2.0.md`

**Phase 1 (Weeks 1-4):** Foundation + Multi-Brand Adapters ← WE ARE HERE
**Phase 2 (Weeks 5-8):** Workflow Builder + Wireless Lighting
**Phase 3 (Weeks 9-10):** Multi-Room + Growth Calendar
**Phase 4 (Weeks 11-16):** Mobile App (React Native)
**Phase 5 (Weeks 17-20):** Polish + Beta
