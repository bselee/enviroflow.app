# Smart Defaults & Room Suggestion

**Status:** ✅ Complete
**Version:** 1.0
**Last Updated:** 2024-01-24

## Overview

Smart Defaults reduces friction during controller setup by automatically pre-filling sensible defaults based on controller capabilities, user context, and intelligent room suggestions.

## Features

### 1. Auto-Generated Controller Names

Controller names are automatically generated using the brand and model:

```typescript
// Examples:
"AC Infinity Controller 69"  // brand + model
"Inkbird Controller"          // brand only (no model)
"CSV Data Source"             // special case
```

**Benefits:**
- Saves typing
- Consistent naming convention
- Can be overridden before submission

### 2. Room Pre-Selection

The wizard intelligently pre-selects or suggests rooms based on:

| User Has | Behavior |
|----------|----------|
| 0 rooms | No selection, shows "Create New" prompt after adding controller |
| 1 room | Auto-selects the only room |
| Multiple rooms | Suggests room based on controller capabilities |

**Room Matching:**
- If a room name matches the suggestion exactly (case-insensitive), it's auto-selected
- Otherwise, suggestion is shown as a hint

### 3. Smart Room Suggestions

Room names are suggested based on controller capabilities:

| Capabilities | Suggested Room | Confidence |
|--------------|----------------|------------|
| Temp + Humidity + VPD | "Grow Room" | High |
| Light sensors | "Grow Room" | High |
| Ecowitt brand | "Outdoor Station" | High |
| Temp + Humidity (no VPD) | "Climate Zone" | Medium |
| CSV Upload | "Data Room" | Medium |
| Grow devices (light/fan) | "Grow Room" | Medium |
| Temperature only | "Environment" | Low |
| No sensors | "Environment" | Low |

### 4. Timezone Auto-Detection

Timezone is automatically detected from the browser using `Intl.DateTimeFormat().resolvedOptions().timeZone`.

**Fallback:** UTC if detection fails
**Future Enhancement:** Geolocation API for coordinates

## Implementation

### Core Files

```
/apps/web/src/lib/room-suggestions.ts
  ├─ suggestRoomName()           # Room suggestion logic
  └─ generateDefaultControllerName()  # Name generation

/apps/web/src/hooks/use-geolocation.ts
  ├─ useGeolocation()             # Timezone & geolocation
  └─ requestLocation()            # Optional location permission

/apps/web/src/components/controllers/AddControllerDialog.tsx
  └─ Integration with wizard
```

### API

#### `suggestRoomName(capabilities, brand?)`

Suggests a room name based on controller capabilities.

```typescript
import { suggestRoomName } from '@/lib/room-suggestions';

const suggestion = suggestRoomName(
  { sensors: ['temperature', 'humidity', 'vpd'] },
  'ac_infinity'
);

// Returns:
{
  name: "Grow Room",
  reason: "VPD monitoring or light sensors detected - indicates grow environment",
  confidence: "high"
}
```

#### `generateDefaultControllerName(brandName, model?)`

Generates a default controller name.

```typescript
import { generateDefaultControllerName } from '@/lib/room-suggestions';

const name = generateDefaultControllerName('AC Infinity', 'Controller 69');
// Returns: "AC Infinity Controller 69"

const name2 = generateDefaultControllerName('Inkbird');
// Returns: "Inkbird Controller"
```

#### `useGeolocation(autoRequest?)`

Hook for timezone detection and geolocation.

```typescript
import { useGeolocation } from '@/hooks/use-geolocation';

function MyComponent() {
  const { timezone, coordinates, requestLocation, isLoading, error } = useGeolocation();

  // Timezone is always available
  console.log(timezone); // "America/Los_Angeles"

  // Coordinates require explicit permission
  return (
    <button onClick={requestLocation}>
      Get Location
    </button>
  );
}
```

## User Experience

### Scenario: New User (No Rooms)

1. Select "AC Infinity" → Name auto-filled to "AC Infinity Controller 69"
2. Enter credentials
3. Name & Room step → Room empty, suggestion shown
4. Connect → Success
5. **Prompt:** "Create a room now?"
   - Pre-filled with: "Grow Room"
   - User can accept, edit, or skip

### Scenario: Experienced User (1 Room)

1. Select "AC Infinity" → Name auto-filled, Room auto-selected
2. Enter credentials
3. Name & Room step → Both pre-filled
4. Connect → Success (auto-close)

### Scenario: Power User (Multiple Rooms)

1. Select "AC Infinity" → Name auto-filled
2. Enter credentials
3. Name & Room step → Room suggested if matching
4. User can override
5. Connect → Success (auto-close)

## Overridable Defaults

All defaults can be changed before submission:

- **Controller Name:** Editable text input
- **Room Selection:** Dropdown with all rooms + "No room" option
- **Timezone:** Auto-detected (future: manual override in settings)

## Testing

### Unit Tests

```bash
npm test room-suggestions.test.ts
```

**Coverage:**
- ✓ AC Infinity → "Grow Room"
- ✓ Inkbird → "Climate Zone"
- ✓ CSV Upload → "Data Room"
- ✓ Ecowitt → "Outdoor Station"
- ✓ Light sensors → "Grow Room"
- ✓ Temperature only → "Environment"
- ✓ Name generation with/without model

### Manual Testing

1. **Test with 0 rooms:**
   - Add controller → No room pre-selected
   - After success → Room creation prompt appears

2. **Test with 1 room:**
   - Add controller → Room auto-selected

3. **Test with multiple rooms:**
   - Add AC Infinity → Should suggest "Grow Room"
   - Add Inkbird → Should suggest "Climate Zone"

4. **Test discovered devices:**
   - Device name should be used as controller name

## Future Enhancements

### Phase 2 (Future)
- [ ] Geolocation API for lat/long coordinates
- [ ] Manual timezone override in room settings
- [ ] User preference: "Always ask for room" vs "Auto-assign"
- [ ] Machine learning: Learn from user's past room assignments
- [ ] Multi-language room suggestions

### Phase 3 (Future)
- [ ] Import room layout from floor plan
- [ ] Suggest room based on sensor values (e.g., high VPD → Grow Room)
- [ ] Bulk import: suggest rooms for multiple controllers at once

## Acceptance Criteria

- [x] Controller name auto-fills with brand + model
- [x] 1 room → pre-select; 0 rooms → create prompt
- [x] Room suggestions based on controller type
- [x] Timezone auto-detects with fallback
- [x] All defaults can be overridden
- [x] Unit tests pass
- [x] Documentation complete

## Related Issues

- Feature request: "Add smart defaults to reduce setup friction"
- UX improvement: "Pre-fill controller name based on discovery"
- Enhancement: "Suggest room names based on capabilities"

## References

- [CLAUDE.md](/workspaces/enviroflow.app/CLAUDE.md) - Project architecture
- [EnviroFlow MVP Spec](/workspaces/enviroflow.app/docs/spec/EnviroFlow_MVP_Spec_v2.0.md)
- [Types Documentation](/workspaces/enviroflow.app/apps/web/src/types/index.ts)
