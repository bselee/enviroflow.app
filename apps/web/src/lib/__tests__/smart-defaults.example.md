# Smart Defaults Examples

This document demonstrates the smart defaults behavior in the controller setup wizard.

## Scenario 1: AC Infinity Controller 69 (New User, No Rooms)

**User Action:** Selects "AC Infinity" brand

**Smart Defaults Applied:**
1. Controller Name: "AC Infinity Controller 69" (auto-filled)
2. Room: Empty (no pre-selection)
3. Room Creation Prompt: Shows after successful connection
4. Suggested Room Name: "Grow Room" (placeholder in create room input)

**Reason:** AC Infinity Controller 69 has temp + humidity + VPD sensors → indicates grow environment.

---

## Scenario 2: AC Infinity Controller 69 (User Has 1 Room)

**User Setup:**
- Existing room: "Veg Tent A"

**User Action:** Selects "AC Infinity" brand

**Smart Defaults Applied:**
1. Controller Name: "AC Infinity Controller 69"
2. Room: "Veg Tent A" (auto-selected)
3. Timezone: Auto-detected from browser (e.g., "America/Los_Angeles")

**Reason:** User has exactly 1 room → auto-select it for convenience.

---

## Scenario 3: Inkbird ITC-308 (User Has Multiple Rooms)

**User Setup:**
- Existing rooms: "Grow Room", "Climate Zone", "Data Room"

**User Action:** Selects "Inkbird" brand

**Smart Defaults Applied:**
1. Controller Name: "Inkbird Controller"
2. Room: "Climate Zone" (auto-selected if exists)
3. Room Suggestion: "Climate Zone" (shown as hint if not matched)

**Reason:** Inkbird has temp + humidity but no VPD → suggests "Climate Zone".

---

## Scenario 4: CSV Upload (User Has Multiple Rooms)

**User Setup:**
- Existing rooms: "Grow Room", "Data Room"

**User Action:** Selects "CSV Upload" brand

**Smart Defaults Applied:**
1. Controller Name: "CSV Upload Controller"
2. Room: "Data Room" (auto-selected if exists)
3. Room Suggestion: "Data Room"

**Reason:** CSV upload is a manual data source → suggests "Data Room".

---

## Scenario 5: Ecowitt Weather Station

**User Action:** Selects "Ecowitt" brand

**Smart Defaults Applied:**
1. Controller Name: "Ecowitt Controller"
2. Room Suggestion: "Outdoor Station"

**Reason:** Ecowitt is typically used for outdoor weather monitoring.

---

## Scenario 6: Discovered Device (AC Infinity Controller 69 Pro)

**User Action:** Uses Network Discovery, finds "Controller 69 Pro" online

**Smart Defaults Applied:**
1. Controller Name: "Controller 69 Pro" (from discovered device)
2. Model: "Controller 69 Pro"
3. Room: Pre-selected based on user's room count + capabilities
4. Status: "Online" badge shown

**Reason:** Discovered devices provide more metadata → use actual device name.

---

## Scenario 7: Light-Only Controller

**User Setup:**
- Controller with only light sensors

**Smart Defaults Applied:**
1. Room Suggestion: "Grow Room"

**Reason:** Light sensors indicate grow environment.

---

## Room Suggestion Logic

```typescript
// High Confidence (auto-select if room exists)
- Temp + Humidity + VPD → "Grow Room"
- Light sensors → "Grow Room"
- Ecowitt brand → "Outdoor Station"

// Medium Confidence (suggest, don't auto-select)
- Temp + Humidity (no VPD) → "Climate Zone"
- CSV Upload → "Data Room"
- Grow devices (light/fan/humidifier) → "Grow Room"

// Low Confidence (generic fallback)
- Temperature only → "Environment"
- No sensors → "Environment"
```

---

## User Experience Flow

### New User (No Rooms)
1. Select Brand → Name auto-filled
2. Enter Credentials
3. Confirm Name & Room → No room selected
4. Connect → Success
5. **Prompt:** "Create a room now?"
   - Suggested name pre-filled: "Grow Room"
   - User can accept, edit, or skip

### Experienced User (1 Room)
1. Select Brand → Name auto-filled, Room auto-selected
2. Enter Credentials
3. Confirm Name & Room → Both pre-filled
4. Connect → Success (auto-close)

### Power User (Multiple Rooms)
1. Select Brand → Name auto-filled
2. Enter Credentials
3. Confirm Name & Room → Room suggested (if matching), can override
4. Connect → Success (auto-close)

---

## All Defaults Are Overridable

All smart defaults can be changed by the user before submission:
- Controller name: Editable text input
- Room selection: Dropdown with all rooms + "No room" option
- Timezone: Auto-detected but can be manually changed (future enhancement)

---

## Implementation Files

- `/apps/web/src/lib/room-suggestions.ts` - Suggestion logic
- `/apps/web/src/hooks/use-geolocation.ts` - Timezone detection
- `/apps/web/src/components/controllers/AddControllerDialog.tsx` - Integration

---

## Testing

Run tests:
```bash
npm test room-suggestions.test.ts
```

Expected results:
- ✓ AC Infinity → "Grow Room"
- ✓ Inkbird → "Climate Zone"
- ✓ CSV Upload → "Data Room"
- ✓ Ecowitt → "Outdoor Station"
- ✓ Light sensors → "Grow Room"
- ✓ Temp only → "Environment"
