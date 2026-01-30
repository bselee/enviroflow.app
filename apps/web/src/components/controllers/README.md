# Controller Device Visualization Components

## Overview

Two new components provide a visual representation of controllers and their connected devices with animated wire connections:

1. **ConnectedDeviceCard** - Individual device card with controls
2. **ControllerDeviceTree** - Complete visualization with controller and devices connected by animated wires

## Components

### ConnectedDeviceCard

Individual card for each device (fan, light, outlet, heater, humidifier, etc.).

**Features:**
- Device icon with color-coded status
- Real-time state indicator (on/off)
- Quick toggle button
- Three-dot menu with full controls:
  - Turn On
  - Turn Off
  - Set Level (for dimmable devices)
- Inline brightness slider for dimmable devices when active
- Current state badge
- Wire connection point for visual linking

**Props:**
```typescript
interface ConnectedDeviceCardProps {
  device: DeviceState           // Device state from use-device-control hook
  onControl: (port, action, value?) => Promise<{ success, error? }>
  disabled?: boolean            // Disable all controls
  wireId: string               // ID for SVG wire connection point
}
```

**Example Usage:**
```tsx
<ConnectedDeviceCard
  device={device}
  onControl={handleControl}
  wireId={`device-wire-${controllerId}-${device.port}`}
/>
```

### ControllerDeviceTree

Complete visualization showing a controller card at the top with device cards below, connected by animated SVG wires.

**Features:**
- Controller status card with health indicator
- Animated SVG wires connecting controller to devices
- Wire color/animation based on device state:
  - Green gradient with glow for active devices
  - Gray gradient for inactive devices
  - Pulsing animation on active wires
- Responsive grid layout (1 column mobile, 2 tablet, 3 desktop)
- Auto-refresh capability
- Integrated device controls
- Loading and error states

**Props:**
```typescript
interface ControllerDeviceTreeProps {
  controller: ControllerWithRoom
  onViewDiagnostics?: (controller) => void
  onAssignRoom?: (controller) => void
  onDelete?: (id: string) => void
  autoRefresh?: boolean        // Default: false
  refreshInterval?: number     // Default: 30000ms (30 seconds)
}
```

**Example Usage:**
```tsx
import { ControllerDeviceTree } from '@/components/controllers/ControllerDeviceTree'

export function DeviceTreeView() {
  const handleDiagnostics = (controller) => {
    // Show diagnostics panel
  }

  const handleAssignRoom = (controller) => {
    // Show room assignment dialog
  }

  const handleDelete = (id) => {
    // Delete controller
  }

  return (
    <ControllerDeviceTree
      controller={controller}
      onViewDiagnostics={handleDiagnostics}
      onAssignRoom={handleAssignRoom}
      onDelete={handleDelete}
      autoRefresh={true}
      refreshInterval={30000}
    />
  )
}
```

## Styling

### Device Icon Colors (when active)

| Device Type | Color |
|------------|-------|
| Fan | Blue (`text-blue-500`) |
| Light | Yellow (`text-yellow-500`) |
| Heater | Red (`text-red-500`) |
| Cooler | Cyan (`text-cyan-500`) |
| Humidifier | Blue 400 (`text-blue-400`) |
| Dehumidifier | Orange 400 (`text-orange-400`) |
| Default | Green (`text-green-500`) |

### Wire Colors

- **Active (On)**: Green gradient with glow effect and pulse animation
- **Inactive (Off)**: Gray gradient, semi-transparent

### Connection Points

Each component includes invisible connection points for SVG path rendering:
- Controller: Bottom center
- Devices: Top center

The wires use cubic Bezier curves for smooth, natural-looking connections.

## Technical Details

### Wire Calculation

The `ControllerDeviceTree` component:
1. Measures controller and device positions using refs
2. Calculates connection points (bottom center of controller, top center of each device)
3. Generates curved SVG paths using cubic Bezier curves
4. Updates paths on window resize or device list changes

### State Management

Both components use optimistic UI updates:
1. Update local state immediately for responsive feel
2. Send API request to backend
3. Revert local state if API call fails
4. Refresh device list after successful control command

### Accessibility

- Connection points use `aria-hidden="true"` to hide from screen readers
- All interactive elements are keyboard accessible
- Status indicators include text labels
- Color is not the only indicator of state (badges and text also used)

## Integration Points

### Required Hook

Both components work with the `useDeviceControl` hook:

```typescript
const { devices, isLoading, error, controlDevice, refreshDevices } = useDeviceControl(controllerId)
```

### API Endpoints

- `GET /api/controllers/[id]/devices` - Fetch device list and states
- `POST /api/controllers/[id]/devices/[port]/control` - Send control commands

### Data Flow

```
ControllerDeviceTree
  ├─ useDeviceControl hook
  │   ├─ GET /api/controllers/{id}/devices
  │   └─ POST /api/controllers/{id}/devices/{port}/control
  │
  ├─ Controller Card (custom in tree)
  │
  ├─ SVG Wire Layer
  │   └─ Animated paths per device
  │
  └─ Device Cards (ConnectedDeviceCard)
      └─ Individual device controls
```

## Performance Considerations

1. **Wire Recalculation**: Debounced on resize, throttled on device updates
2. **SVG Rendering**: Uses CSS transforms for smooth animations
3. **Optimistic Updates**: Immediate UI feedback before API confirmation
4. **Auto-refresh**: Configurable interval, disabled by default

## Future Enhancements

- [ ] Drag-and-drop to reorder devices
- [ ] Grouping devices by type
- [ ] Bulk device control
- [ ] Device scheduling quick actions
- [ ] Historical state visualization on hover
- [ ] Export device tree as image

---

## ControllerFullInfo Component ⭐ NEW

### Overview

Comprehensive device information panel that displays ALL available AC Infinity controller data including metadata, active modes, port details, sensor capabilities, and real-time status.

**Location:** `ControllerFullInfo.tsx`
**Documentation:** [ControllerFullInfo.md](./ControllerFullInfo.md)
**Examples:** [ControllerFullInfo.example.tsx](./ControllerFullInfo.example.tsx)

### Features

- ✅ Controller metadata (model, firmware, MAC address)
- ✅ Online/offline status with last seen time
- ✅ Active modes and schedules list
- ✅ Complete port/device details with current state
- ✅ Sensor capabilities overview
- ✅ Collapsible sections for organized viewing
- ✅ Copy-to-clipboard for MAC address
- ✅ Manual refresh button
- ✅ Dark mode compatible
- ✅ Responsive layout

### Quick Usage

```tsx
import { ControllerFullInfo } from '@/components/controllers/ControllerFullInfo'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'

function ControllerCard({ controller }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <ControllerFullInfo
          controllerId={controller.id}
          controllerName={controller.name}
        />
      </DialogContent>
    </Dialog>
  )
}
```

### Props

```typescript
interface ControllerFullInfoProps {
  controllerId: string    // UUID of the controller
  controllerName: string  // Display name
  onClose?: () => void   // Optional close callback
}
```

### API Endpoint

```
GET /api/controllers/[id]/full-info
```

Returns comprehensive metadata including all controller properties, modes, ports, devices, and sensors.

### Data Displayed

1. **Controller Metadata**
   - Model name and device type
   - Firmware version
   - MAC address (with copy button)
   - Last online time
   - Online status indicator

2. **Active Modes** (from `devModeSettingList`)
   - Mode ID and name
   - Active/inactive status
   - Visual indicators

3. **Port/Device Details**
   - Port number and name
   - Device type (fan, light, outlet, etc.)
   - Current ON/OFF state
   - Current level percentage
   - Dimming support
   - Load type
   - External port info

4. **Sensor Capabilities**
   - Sensor type (temperature, humidity, VPD, etc.)
   - Port assignment
   - Unit of measurement
   - Icon-based display

5. **Capabilities Summary**
   - Max ports
   - Dimming support
   - Scheduling support
   - Total devices

### Integration Examples

See [ControllerFullInfo.example.tsx](./ControllerFullInfo.example.tsx) for:
- Modal dialog implementation
- Side sheet implementation
- Standalone page usage
- Controller card integration
- Dynamic controller ID handling

For complete documentation, see [ControllerFullInfo.md](./ControllerFullInfo.md)
