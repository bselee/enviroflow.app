# EnviroFlow Project Status

## Last Updated: February 2, 2026 (Historical Data Integration)

## Current State

### ✅ MAJOR BREAKTHROUGH: Live Data + Ports Working!
- **`/api/sensors/live` endpoint returns ALL data including PORTS**
- Returns 3 AC Infinity devices: Red Room, Lil Dry Guy, Biggie
- Each device has: temperature (°C), humidity (%), VPD (kPa), 4 ports
- Ports include: name, speed (0-100), isOn status

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

### Critical Files Updated
1. `/apps/web/src/app/dashboard/page.tsx`
   - Uses `useSensorHistory` hook for 7D/30D/60D ranges
   - Uses `useLiveSensors` for 1H-24H ranges
   - Transforms historical data to timeline format

2. `/apps/web/src/components/dashboard/IntelligentTimeline.tsx`
   - Multi-line chart with dual Y-axes
   - Controller selector + time range picker
   - Port status timeline
   - Custom hover tooltip showing all metrics

3. `/apps/web/src/hooks/use-sensor-history.ts`
   - Fetches from `/api/sensors/history`
   - Returns aggregated readings from Supabase

### Supabase Setup (Already Working)
- URL: `vhlnnfmuhttjpwyobklu.supabase.co`
- Table: `sensor_readings` (controller_id, sensor_type, value, unit, recorded_at)
- Aggregation: hourly (10d), 4-hourly (30d), daily (60d)

**Phase 1 (Weeks 1-4):** Foundation + Multi-Brand Adapters ← WE ARE HERE
**Phase 2 (Weeks 5-8):** Workflow Builder + Wireless Lighting
**Phase 3 (Weeks 9-10):** Multi-Room + Growth Calendar
**Phase 4 (Weeks 11-16):** Mobile App (React Native)
**Phase 5 (Weeks 17-20):** Polish + Beta
