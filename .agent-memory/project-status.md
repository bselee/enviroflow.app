# EnviroFlow Project Status

## Last Updated: February 3, 2026 (UI/UX Fixes)

## Current State

### ✅ MAJOR BREAKTHROUGH: Live Data + Ports Working!
- **`/api/sensors/live` endpoint returns ALL data including PORTS**
- Returns 3 AC Infinity devices: Red Room, Lil Dry Guy, Biggie
- Each device has: temperature (°C), humidity (%), VPD (kPa), 4 ports
- Ports include: name, speed (0-100), isOn status

### ✅ Latest Fixes (February 3, 2026)
1. **Temperature Unit Preference**: Fixed display to respect user's F/C preference
   - Added `formatTemperature()` utility that converts from Celsius (API) to user preference
   - Updated `LiveSensorDashboard`, `ControllerTreeItem`, `IntelligentTimeline`
   - Tooltip, stat cards, and legend now all show correct unit

2. **Dashboard Shows All Controllers**: Removed filtering that was hiding some controllers
   - Dashboard now shows ALL live sensors without filtering by registered names

3. **Collapsible Sidebar**: Added desktop collapse feature
   - Click chevron button to collapse to icons-only (w-16)
   - State persisted in localStorage
   - Tooltips show on hover when collapsed
   - Main content area adjusts automatically

### ✅ Timeline Enhanced with Multi-Metric + Historical Data
- **IntelligentTimeline** shows Temp/Humidity/VPD on same chart
- **Extended time ranges**: 1H, 6H, 24H, 1D, 7D, 30D, 60D
- **Controller selector** dropdown to filter by device
- **Port status** display below chart
- **Stat cards** with current + high/low for each metric
- **Historical data from Supabase** for 7D, 30D, 60D ranges
- **Live polling data** for shorter ranges (1H-24H)

### ✅ Data Architecture (Simple & Working)
- **Live Data**: Direct API Polling to AC Infinity Cloud (15s refresh)
- **Historical Data**: Supabase `sensor_readings` table
- **Cron Job**: `/api/cron/save-history` saves readings every 5 minutes
- **NO migration needed** - Supabase already configured and free tier is plenty

### Critical Files Updated (Feb 3, 2026)
1. `/apps/web/src/lib/temperature-utils.ts`
   - Updated to convert from Celsius (API data) to user preference

2. `/apps/web/src/components/LiveSensorDashboard.tsx`
   - Now uses `formatTemperature()` with user preference

3. `/apps/web/src/components/controllers/ControllerTreeItem.tsx`
   - Temperature displays respect user preference

4. `/apps/web/src/components/dashboard/IntelligentTimeline.tsx`
   - StatCard, Tooltip, and Legend use dynamic temp unit

5. `/apps/web/src/components/layout/AppSidebar.tsx`
   - Added collapse/expand functionality with localStorage persistence
   - Shows only centered icons when collapsed

6. `/apps/web/src/components/layout/AppLayout.tsx`
   - Main content padding adjusts based on sidebar collapsed state

### Supabase Setup (Already Working)
- URL: `vhlnnfmuhttjpwyobklu.supabase.co`
- Table: `sensor_readings` (controller_id, sensor_type, value, unit, recorded_at)
- Aggregation: hourly (10d), 4-hourly (30d), daily (60d)

**Phase 1 (Weeks 1-4):** Foundation + Multi-Brand Adapters ← WE ARE HERE
**Phase 2 (Weeks 5-8):** Workflow Builder + Wireless Lighting
**Phase 3 (Weeks 9-10):** Multi-Room + Growth Calendar
**Phase 4 (Weeks 11-16):** Mobile App (React Native)
**Phase 5 (Weeks 17-20):** Polish + Beta
