# Type Audit Report: Optional Fields Analysis

Generated: 2026-01-25
Updated: 2026-01-25

## Summary

~~The codebase has **23 optional fields** that are frequently used without null guards.~~

**FIXED:** High-risk fields have been made required. See "Completed Fixes" below.

---

## Completed Fixes

| Field | Change | Commit |
|-------|--------|--------|
| `ControllerCapabilities.sensors` | Made required (was `SensorType[]?`) | 3bdc7eb |
| `ControllerCapabilities.devices` | Made required (was `DeviceType[]?`) | 3bdc7eb |
| `ActivityLog.created_at` | Made required (was `string?`) | 3bdc7eb |
| `DeviceScheduleConfig.action` | Made required (was optional) | f891302 |
| `DeviceScheduleConfig.days` | Made required (was `number[]?`) | This commit |

Redundant fallbacks removed from:
- `WeeklyCalendarGrid.tsx`
- `ScheduleModal.tsx`
- `use-schedules.ts`

---

## ~~HIGH RISK~~ RESOLVED - Previously Should be Required

These fields have database defaults or are always present in practice, but are typed as optional.

### 1. ActivityLog.created_at / timestamp (lines 569-571)

```typescript
// Current (WRONG)
created_at?: string;
timestamp?: string;

// Recommended
created_at: string;  // DB has DEFAULT now()
// Remove timestamp alias entirely, or:
timestamp: string;
```

**Impact:** `use-activity-logs.ts`, any component displaying activity timestamps
**Fix:** Make required, DB always provides value

---

### 2. SensorReading.timestamp (line 429)

```typescript
// Current
timestamp?: string;  // "Computed field for backwards compatibility"

// Recommended
// Either remove and use recorded_at, or make required:
recorded_at: string;  // This is the primary field (line 427)
```

**Impact:** Charts, sensor displays
**Fix:** Use `recorded_at` (which is required) instead of `timestamp`

---

### 3. DeviceScheduleConfig.days (line 757)

```typescript
// Current
days?: number[];

// Recommended - depends on trigger_type
// For time triggers: should be required
// For cron triggers: not used
```

**Impact:** Schedule execution logic, calendar views
**Fix:** Add runtime guard or make required for time-based triggers

---

### 4. DeviceScheduleConfig.start_time (line 759)

```typescript
// Current
start_time?: string;

// Recommended for time-based schedules
start_time: string;
```

**Impact:** Schedule execution, time display
**Fix:** Make required (schedules without start_time are invalid)

---

### 5. ControllerCapabilities.sensors / devices (lines 105-106)

```typescript
// Current
sensors?: SensorType[];
devices?: DeviceType[];

// Recommended
sensors: SensorType[];  // Default to []
devices: DeviceType[];  // Default to []
```

**Impact:** Capability checks throughout UI
**Fix:** Initialize with empty arrays in data layer

---

## MEDIUM RISK - Needs Data Layer Defaults

These are correctly optional in the type, but consuming code often forgets to check.

### 6. Controller.credentials (line 154)

```typescript
credentials?: Record<string, unknown>;
```

**Status:** Correctly optional (some brands don't need credentials)
**Fix:** Always check before accessing in encryption/decryption code

---

### 7. Join result fields

```typescript
// ControllerWithRoom (line 170)
room?: { id: string; name: string } | null;

// WorkflowWithRoom (line 378)
room?: { id: string; name: string } | null;

// ActivityLog (lines 573-577)
workflow?: { name: string } | null;
room?: { name: string } | null;
controller?: { name: string } | null;
```

**Status:** Correctly optional (joins may not return data)
**Fix:** Use optional chaining (`?.`) or provide defaults at data layer

---

### 8. RoomSettings fields (lines 247-253)

```typescript
target_temp_min?: number;
target_temp_max?: number;
target_humidity_min?: number;
// etc.
```

**Status:** Correctly optional (not all rooms have targets)
**Fix:** UI should show "Not set" or use sensible defaults

---

## LOW RISK - Legitimately Optional

These are correctly typed as optional. No changes needed.

| Field | Type | Reason |
|-------|------|--------|
| `Controller.last_seen` | `string \| null` | May never have connected |
| `Controller.last_error` | `string \| null` | May have no errors |
| `Controller.firmware_version` | `string \| null` | Not all controllers report this |
| `Controller.model` | `string \| null` | Not all controllers report this |
| `Workflow.description` | `string \| null` | Descriptions are optional |
| `Workflow.last_executed` | `string \| null` | May never have run |
| `Room.description` | `string \| null` | Descriptions are optional |
| `DeviceSchedule.description` | `string \| null` | Descriptions are optional |
| `GrowthStage.description` | `string \| null` | Descriptions are optional |

---

## Recommended Actions

### Option A: Make Fields Required (Cleanest)

1. Update database schema to add `NOT NULL` constraints with defaults
2. Update types to remove `?`
3. This ensures type safety at compile time

```sql
-- Example migration
ALTER TABLE activity_logs
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now();
```

### Option B: Normalize at Data Layer (Pragmatic)

Create transformer functions that ensure required fields:

```typescript
// lib/transformers.ts
export function normalizeActivityLog(raw: RawActivityLog): ActivityLog {
  return {
    ...raw,
    created_at: raw.created_at || new Date().toISOString(),
    timestamp: raw.timestamp || raw.created_at || new Date().toISOString(),
  };
}

export function normalizeScheduleConfig(raw: Partial<DeviceScheduleConfig>): DeviceScheduleConfig {
  return {
    action: raw.action || 'on',
    days: raw.days || [],
    start_time: raw.start_time || '00:00',
    ...raw,
  };
}
```

### Option C: Separate DTO vs Domain Types (Most Robust)

```typescript
// Raw from database (allows undefined)
interface ActivityLogDTO {
  id: string;
  created_at?: string;
  timestamp?: string;
  // ...
}

// Normalized for UI (all required fields present)
interface ActivityLog {
  id: string;
  created_at: string;
  timestamp: string;
  // ...
}

// Transform in API route or hook
function toActivityLog(dto: ActivityLogDTO): ActivityLog {
  return {
    ...dto,
    created_at: dto.created_at || new Date().toISOString(),
    timestamp: dto.timestamp || dto.created_at || new Date().toISOString(),
  };
}
```

---

## Quick Wins (Can Fix Now)

These require minimal changes:

1. **ControllerCapabilities**: Change `sensors?` and `devices?` to required with default `[]`
2. **DeviceScheduleConfig.action**: Already fixed - made required
3. **ActivityLog timestamps**: Add normalization in `use-activity-logs.ts` (already done)

---

## Files Most Affected

| File | Issues | Priority |
|------|--------|----------|
| `src/hooks/use-activity-logs.ts` | timestamp undefined | Fixed |
| `src/components/schedules/*.tsx` | action, days, start_time | High |
| `src/components/controllers/*.tsx` | capabilities.sensors/devices | Medium |
| `src/components/dashboard/*.tsx` | various sensor readings | Medium |
| `src/lib/schedule-executor.ts` | schedule config fields | High |

---

## Next Steps

1. Decide on approach (A, B, or C above)
2. Start with HIGH RISK fields
3. Add runtime validation for remaining optional fields
4. Consider adding Zod schemas for API responses to catch issues early
