# EnviroFlow Project Status

## Visual Automation Implementation (Feb 2026)

### ✅ Completed - New Workflow Nodes
1. **DelayNode** - Pause workflow execution for specified duration
   - File: `/apps/web/src/components/workflow/nodes/DelayNode.tsx`
   - Config: duration (number), unit (seconds/minutes/hours)
   - Visual: Amber border, Timer icon

2. **VariableNode** - Store/retrieve values during workflow
   - File: `/apps/web/src/components/workflow/nodes/VariableNode.tsx`
   - Config: name, scope (workflow/global), operation (set/get/increment/decrement), valueType, value
   - Visual: Violet border, Variable icon

3. **DebounceNode** - Prevent rapid triggering with cooldown
   - File: `/apps/web/src/components/workflow/nodes/DebounceNode.tsx`
   - Config: cooldownSeconds, executeOnLead, executeOnTrail
   - Visual: Slate border, Filter icon

### ✅ Type Definitions Added (types.ts)
- DelayTimeUnit, DelayNodeConfig, DelayNodeData
- VariableScope, VariableOperation, VariableValueType, VariableNodeConfig, VariableNodeData
- DebounceNodeConfig, DebounceNodeData
- SensorThresholdTriggerConfigWithHysteresis (hysteresis support)

### ✅ Integration Complete
- NodePalette.tsx: Added "Flow Control" category with new nodes
- WorkflowBuilder.tsx: Registered new node types in nodeTypes
- NodePropertiesPanel.tsx: Added config panels for Delay, Variable, Debounce
- index.ts: Exported new components and types

### Pending - Next Steps
1. Update workflow execution engine (cron/workflows/route.ts) to handle:
   - Delay state machine with resume_after timestamps
   - Variable storage/retrieval (workflow_variables table)
   - Debounce cooldown tracking
2. Add hysteresis UI to sensor trigger properties
3. Create workflow_variables Supabase table
4. Add device tree hierarchy to NodePalette

---

## Light/Dark Mode Inconsistency Analysis (Feb 2026)

### Issues Found:

1. **Landing page header** (`/apps/web/src/app/page.tsx:9`)
   - Hardcoded `bg-white` - doesn't respect dark mode
   
2. **Login page** (`/apps/web/src/app/login/page.tsx`)
   - Lines 48, 146, 155, 162: Hardcoded `bg-gray-50` without dark mode variant
   
3. **TwoFactorDialog QR code** (`/apps/web/src/components/settings/TwoFactorDialog.tsx:439`)
   - Hardcoded `bg-white` for QR code container (intentional for visibility)
   
4. **Several chart components** need conditional dark styling

### Files with Good Dark Mode Support:
- `PageHeader.tsx` - Uses `bg-background` ✅
- `AppLayout.tsx` - Uses `bg-background` ✅
- `globals.css` - Has proper dark mode CSS variables ✅
- Tailwind config - Proper `darkMode: ["class"]` setup ✅

---

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
