# EnviroFlow Migration TODO

> **Goal**: Remove Supabase Realtime subscriptions for sensor data, replace with Direct API Polling.

## Priority: HIGH - Blocking Data Display

### 1. `useDashboardData.ts`
**Location**: `apps/web/src/hooks/useDashboardData.ts`
**Issue**: Uses Supabase Realtime subscriptions for sensor data
**Fix**: Replace with `setInterval` + `fetch('/api/sensors/live')`
**Status**: ⬜ Not Started

### 2. `use-sensor-readings.ts`
**Location**: `apps/web/src/hooks/use-sensor-readings.ts`
**Issue**: Has Realtime subscriptions (but also has polling fallback)
**Fix**: Remove Realtime code, use polling-only pattern
**Status**: ⬜ Not Started

### 3. `use-rooms.ts`
**Location**: `apps/web/src/hooks/use-rooms.ts`
**Issue**: Uses Realtime subscriptions for room data
**Fix**: Rooms are config data - can use standard fetch, no real-time needed
**Status**: ⬜ Not Started

## Priority: MEDIUM - May Cause Issues

### 4. `SensorRealtimeProvider.tsx`
**Location**: `apps/web/src/components/providers/SensorRealtimeProvider.tsx`
**Issue**: Entire component built around Realtime subscriptions
**Fix**: Rename to `SensorPollingProvider`, implement polling
**Status**: ⬜ Not Started

### 5. Dashboard Pages
**Locations**: 
- `apps/web/src/app/(dashboard)/page.tsx`
- `apps/web/src/app/(dashboard)/dashboard/page.tsx`
**Issue**: May have Realtime dependencies in page components
**Fix**: Audit and remove
**Status**: ⬜ Not Started

## Priority: LOW - Future Cleanup

### 6. Remove unused Supabase Realtime imports
**Issue**: Dead code from abandoned patterns
**Fix**: Search for `.subscribe(` and audit each usage
**Status**: ⬜ Not Started

---

## Working Pattern Reference

The proven working pattern (see `/docs/ARCHITECTURE.md`):

```typescript
// ✅ CORRECT: Direct API Polling
function LiveSensorDashboard() {
  const [sensors, setSensors] = useState([]);
  
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/sensors/live');
      const data = await res.json();
      setSensors(data.sensors);
    };
    
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);
  
  return <div>{/* render sensors */}</div>;
}
```

## Verification

After migration, verify:
1. `curl http://localhost:3000/api/sensors/live` returns data ✅ (Already working)
2. Browser shows sensor data without refresh
3. Data updates every 15-30 seconds automatically
4. No "data appears then disappears" behavior
5. Works even if Supabase has issues
