# Device Mode Programming

Production-quality device mode programming interface with circular mode selector, real-time sensor gauges, and comprehensive configuration panels.

## Components

### DeviceModeProgramming (Main Component)

The main orchestrator component that integrates all sub-components into a cohesive programming interface.

**File:** `DeviceModeProgramming.tsx`

**Features:**
- Circular mode selector with visual feedback
- Real-time sensor gauge displays
- Mode-specific configuration panels
- Unsaved changes warning
- Responsive layout (desktop side-by-side, mobile tabs)
- Keyboard shortcuts (Esc to close, Ctrl+S to save)
- Loading/error states
- Optimistic updates with rollback

**Props:**
```typescript
interface DeviceModeProgrammingProps {
  controllerId: string        // Controller ID
  port: number | 'all'        // Port number or 'all' for master control
  deviceType: string          // Device type (fan, light, etc.)
  deviceName: string          // Human-readable device name
  onClose?: () => void        // Optional close callback
  className?: string          // Additional CSS classes
}
```

**Usage:**
```tsx
import { DeviceModeProgramming } from '@/components/controllers'

<DeviceModeProgramming
  controllerId="controller-123"
  port={1}
  deviceType="fan"
  deviceName="Exhaust Fan"
  onClose={() => setDialogOpen(false)}
/>
```

### ModeSelector

Beautiful circular mode selector wheel inspired by AC Infinity's mobile app.

**File:** `modes/ModeSelector.tsx`

**Features:**
- 7 modes: OFF, ON, AUTO, VPD, TIMER, CYCLE, SCHEDULE
- Animated transitions
- Color-coded mode indicators
- Live sensor readings in center
- Keyboard navigation (arrow keys)
- ARIA accessibility

**Props:**
```typescript
interface ModeSelectorProps {
  currentMode: DeviceMode
  onModeChange: (mode: DeviceMode) => void
  temperature?: number        // Current temp (°F or °C)
  humidity?: number           // Current humidity (%)
  vpd?: number                // Current VPD (kPa)
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  temperatureUnit?: '°F' | '°C'
  className?: string
}
```

### ModeConfigPanel

Dynamic configuration panel that renders appropriate controls based on selected mode.

**File:** `modes/ModeConfigPanel.tsx`

**Mode-Specific Settings:**

**OFF Mode:**
- No configuration needed

**ON Mode:**
- Speed level (0-10)

**AUTO Mode:**
- Device behavior (cooling/heating/humidify/dehumidify)
- Temperature triggers (high/low)
- Humidity triggers (high/low)
- Speed range (max/min levels)
- Smooth transition toggle

**VPD Mode:**
- VPD triggers (high/low)
- Leaf temperature offset
- Speed range (max/min levels)

**TIMER Mode:**
- Timer type (on/off after timer)
- Duration (seconds)

**CYCLE Mode:**
- ON duration (seconds)
- OFF duration (seconds)
- Speed level (0-10)

**SCHEDULE Mode:**
- Start/end time
- Active days (7-day selector)
- Speed level (0-10)

**Props:**
```typescript
interface ModeConfigPanelProps {
  mode: ControllerModeType
  config: ModeConfiguration
  onChange: (config: Partial<ModeConfiguration>) => void
  className?: string
}
```

### SensorGauge

Circular gauge for displaying individual sensor readings.

**File:** `gauges/SensorGauge.tsx`

**Features:**
- Animated needle
- Color-coded ranges (green/yellow/red)
- Target range awareness
- Smooth transitions
- Responsive sizing

**Props:**
```typescript
interface SensorGaugeProps {
  label: string
  value: number
  unit: string
  min: number
  max: number
  targetMin?: number
  targetMax?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}
```

### SensorGaugePanel

Grid display of multiple sensor gauges.

**File:** `gauges/SensorGaugePanel.tsx`

**Features:**
- Automatically selects relevant sensors
- Priority sorting (temp, humidity, VPD, CO2)
- Responsive grid layout
- Empty state handling

**Props:**
```typescript
interface SensorGaugePanelProps {
  readings: SensorReading[]
  className?: string
}
```

## Hook: useDeviceMode

Custom hook for managing device mode state and operations.

**File:** `hooks/use-device-mode.ts`

**Features:**
- Fetches current mode configuration
- Real-time sensor reading updates via Supabase
- Mode update with optimistic UI
- Loading/error state management
- Cleanup on unmount

**Return Value:**
```typescript
interface UseDeviceModeReturn {
  modeState: DeviceModeState | null
  sensorReadings: SensorReading[]
  isLoading: boolean
  error: string | null
  updateMode: (mode: ModeConfiguration) => Promise<DeviceModeResult>
  refreshMode: () => Promise<void>
  refreshSensors: () => Promise<void>
}
```

**Usage:**
```tsx
const {
  modeState,
  sensorReadings,
  isLoading,
  error,
  updateMode,
  refreshMode,
  refreshSensors,
} = useDeviceMode(controllerId, port)
```

## API Endpoints Required

The component expects the following API endpoints:

### GET `/api/controllers/:controllerId/ports/:port/mode`

Fetch current mode configuration for a port.

**Response:**
```json
{
  "success": true,
  "port": {
    "port": 1,
    "portName": "Port 1",
    "deviceType": "fan",
    "currentMode": {
      "mode": "auto",
      "tempTriggerHigh": 80,
      "tempTriggerLow": 70,
      "maxLevel": 10,
      "minLevel": 1
    },
    "supportedModes": ["off", "on", "auto", "vpd", "timer", "cycle", "schedule"]
  }
}
```

### PUT `/api/controllers/:controllerId/ports/:port/mode`

Update mode configuration for a port.

**Request:**
```json
{
  "port": 1,
  "mode": {
    "mode": "auto",
    "tempTriggerHigh": 82,
    "tempTriggerLow": 72,
    "maxLevel": 10,
    "minLevel": 2
  }
}
```

**Response:**
```json
{
  "success": true,
  "port": { /* updated port data */ }
}
```

### GET `/api/controllers/:controllerId/sensors`

Fetch current sensor readings.

**Response:**
```json
{
  "success": true,
  "readings": [
    {
      "id": "reading-123",
      "controller_id": "ctrl-123",
      "port": null,
      "sensor_type": "temperature",
      "value": 75.2,
      "unit": "°F",
      "recorded_at": "2026-01-25T20:00:00Z",
      "is_stale": false
    }
  ]
}
```

## Integration Examples

### In a Dialog

```tsx
import { DeviceModeProgramming } from '@/components/controllers'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function ControllerDialog() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Program Device</DialogTitle>
        </DialogHeader>
        <DeviceModeProgramming
          controllerId="ctrl-123"
          port={1}
          deviceType="fan"
          deviceName="Exhaust Fan"
          onClose={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
```

### In a Page

```tsx
import { DeviceModeProgramming } from '@/components/controllers'

export default function ProgrammingPage() {
  return (
    <div className="container py-8">
      <DeviceModeProgramming
        controllerId="ctrl-123"
        port={1}
        deviceType="fan"
        deviceName="Exhaust Fan"
      />
    </div>
  )
}
```

### With Port Selector

```tsx
function DeviceManager() {
  const [selectedPort, setSelectedPort] = useState<number>(1)

  return (
    <div>
      {/* Port selector tabs */}
      <Tabs value={String(selectedPort)} onValueChange={(v) => setSelectedPort(Number(v))}>
        <TabsList>
          {[1, 2, 3, 4].map((port) => (
            <TabsTrigger key={port} value={String(port)}>
              Port {port}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Programming panel */}
      <DeviceModeProgramming
        controllerId="ctrl-123"
        port={selectedPort}
        deviceType="fan"
        deviceName={`Port ${selectedPort}`}
      />
    </div>
  )
}
```

## Keyboard Shortcuts

- **Esc**: Close panel (with unsaved changes warning)
- **Ctrl+S** / **Cmd+S**: Save changes
- **Arrow Keys**: Navigate mode selector (when focused)
- **Enter** / **Space**: Select focused mode

## Accessibility

- Full keyboard navigation
- ARIA labels and roles
- Focus indicators
- Screen reader friendly
- Color-blind friendly (not relying on color alone)

## Mobile Responsiveness

**Desktop (lg+):**
- Side-by-side layout
- Mode selector + gauges on left
- Config panel on right

**Mobile/Tablet:**
- Tabbed layout
- Mode tab
- Settings tab
- Sensors tab
- Sticky save button

## State Management

**Local State:**
- Draft configuration (unsaved changes)
- Selected mode
- Has unsaved changes flag

**Remote State:**
- Fetched via `useDeviceMode` hook
- Optimistic updates on save
- Real-time sensor updates via Supabase

**Change Detection:**
- Deep comparison of config objects
- Warning on close with unsaved changes
- Visual indicator (badge) when changes exist

## Error Handling

- API errors displayed in toast
- Loading states with spinners
- Empty states for missing data
- Graceful degradation for missing sensors
- Network error recovery

## Performance

- Memoized sensor data aggregation
- Debounced config updates (internal)
- Real-time updates without polling
- Cleanup on unmount
- Optimistic UI updates

## Testing

See `DeviceModeProgramming.example.tsx` for interactive examples.

## Future Enhancements

- [ ] Bulk mode programming (apply to all ports)
- [ ] Mode presets/templates
- [ ] Copy/paste configuration between ports
- [ ] Advanced mode (direct API access)
- [ ] Mode scheduling (change modes at specific times)
- [ ] Notification triggers based on mode changes
- [ ] History/audit log of mode changes
