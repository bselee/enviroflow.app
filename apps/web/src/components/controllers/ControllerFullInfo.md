# ControllerFullInfo Component

A comprehensive device information panel that displays all available AC Infinity controller data including metadata, active modes, port details, sensor capabilities, and real-time status.

## Features

- **Controller Metadata Display**
  - Model name and device type
  - Firmware version
  - MAC address with copy-to-clipboard
  - Last online time (relative format)
  - Online/offline status indicator

- **Active Modes/Schedules**
  - Lists all available modes from `devModeSettingList`
  - Highlights currently active mode(s)
  - Shows mode ID and name

- **Port/Device Details**
  - Port number and custom name
  - Device type (fan, light, outlet, etc.)
  - Current ON/OFF state
  - Current level percentage for dimmable devices
  - Dimming support indicator
  - Load type and external port info

- **Sensor Capabilities**
  - All available sensor types
  - Sensor port assignments
  - Unit of measurement
  - Icon-based visual organization

- **UI Features**
  - Collapsible sections for each category
  - Dark mode compatible
  - Responsive layout (mobile-friendly)
  - Auto-refresh capability
  - Clean card-based design with shadcn/ui components

## Installation

The component is already integrated into the project. All required shadcn/ui components are available:
- `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
- `Button`
- `Badge`
- `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`
- `Alert`, `AlertDescription`
- `Separator`

## API Endpoint

The component fetches data from:
```
GET /api/controllers/[id]/full-info
```

### Response Format

```typescript
{
  success: boolean
  controllerId: string
  controllerName: string
  metadata: {
    brand: string
    model?: string
    firmwareVersion?: string
    macAddress?: string
    lastOnlineTime?: string
    deviceType?: number
    status?: 'online' | 'offline' | 'error' | 'initializing'
    capabilities?: {
      sensors: Array<{
        port: number
        name?: string
        type: string
        unit: string
      }>
      devices: Array<{
        port: number
        name?: string
        type: string
        supportsDimming: boolean
        currentLevel?: number
        isOn?: boolean
        loadType?: number
        externalPort?: number
      }>
      supportsDimming?: boolean
      supportsScheduling?: boolean
      maxPorts?: number
    }
    modes?: Array<{
      modeId: number
      modeName: string
      isActive: boolean
    }>
  }
  timestamp: string
  error?: string
}
```

## Usage

### Basic Usage

```tsx
import { ControllerFullInfo } from '@/components/controllers/ControllerFullInfo'

function MyComponent() {
  return (
    <ControllerFullInfo
      controllerId="abc123-def456-ghi789"
      controllerName="Grow Tent Controller"
    />
  )
}
```

### With Close Callback

```tsx
import { ControllerFullInfo } from '@/components/controllers/ControllerFullInfo'

function MyComponent() {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <ControllerFullInfo
      controllerId="abc123-def456-ghi789"
      controllerName="Grow Tent Controller"
      onClose={() => setShowInfo(false)}
    />
  )
}
```

### In a Modal Dialog

```tsx
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import { ControllerFullInfo } from '@/components/controllers/ControllerFullInfo'

function ControllerInfoDialog({ controllerId, controllerName }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Info className="w-4 h-4 mr-2" />
          View Full Info
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <ControllerFullInfo
          controllerId={controllerId}
          controllerName={controllerName}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
```

### In a Side Sheet

```tsx
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import { ControllerFullInfo } from '@/components/controllers/ControllerFullInfo'

function ControllerInfoSheet({ controllerId, controllerName }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Info className="w-4 h-4 mr-2" />
          Device Info
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <ControllerFullInfo
          controllerId={controllerId}
          controllerName={controllerName}
          onClose={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `controllerId` | `string` | Yes | UUID of the controller to display information for |
| `controllerName` | `string` | Yes | Display name of the controller |
| `onClose` | `() => void` | No | Callback function when close button is clicked |

## Component Structure

```
ControllerFullInfo
├── Header
│   ├── Title (with icon)
│   ├── Description
│   └── Action buttons (Refresh, Close)
├── Controller Metadata (Collapsible)
│   ├── Online Status
│   ├── Model
│   ├── Firmware Version
│   ├── MAC Address (with copy button)
│   ├── Device Type Code
│   └── Last Seen
├── Active Modes (Collapsible)
│   └── List of modes with active indicators
├── Ports & Devices (Collapsible)
│   └── Device cards
│       ├── Port number and name
│       ├── Device type icon
│       ├── ON/OFF status
│       ├── Current level
│       ├── Dimming support
│       ├── Load type
│       └── External port
├── Sensors (Collapsible)
│   └── Sensor cards
│       ├── Sensor type icon
│       ├── Sensor name
│       ├── Port number
│       └── Unit of measurement
├── Capabilities Summary
│   ├── Max ports
│   ├── Dimming support
│   ├── Scheduling support
│   └── Total devices
└── Footer
    └── Last updated timestamp
```

## State Management

The component manages its own state for:
- Loading state during API fetch
- Error state for failed requests
- Collapsible section states (open/closed)
- Data from the API

## Error Handling

The component gracefully handles:
- Network errors
- Invalid controller IDs
- Missing credentials
- Offline controllers
- API failures

Error states display user-friendly messages with retry options.

## Styling

The component uses:
- Tailwind CSS utility classes
- shadcn/ui design tokens
- Dark mode compatible colors
- Responsive breakpoints (mobile-first)

## Performance Considerations

- Data is fetched only when the component mounts
- Manual refresh available via refresh button
- No automatic polling (to reduce API calls)
- Collapsible sections reduce initial render overhead
- Efficient icon lookup with Record types

## Browser Support

Compatible with all modern browsers that support:
- ES6+ JavaScript
- CSS Grid and Flexbox
- Fetch API

## Accessibility

- Semantic HTML structure
- Keyboard navigation support
- ARIA labels for interactive elements
- Screen reader friendly
- Focus management for modals/dialogs

## Related Components

- `ControllerDevicesPanel` - Device control interface
- `ControllerSensorPreview` - Real-time sensor readings
- `ControllerStatusIndicator` - Simple status badge
- `ControllerDiagnosticsPanel` - Connection diagnostics

## Testing

To test the component:

1. Ensure you have a valid controller in the database
2. Navigate to a page where the component is rendered
3. Verify all sections display correct information
4. Test collapsible sections open/close
5. Test copy-to-clipboard for MAC address
6. Test refresh functionality
7. Test with offline controller
8. Test with controller in error state

## Troubleshooting

### Component shows "Controller not found"
- Verify the controller ID exists in the database
- Check user has access to the controller
- Ensure proper authentication

### Data not loading
- Check browser console for API errors
- Verify `/api/controllers/[id]/full-info` endpoint is accessible
- Check network requests in browser DevTools

### MAC address not copying
- Ensure browser supports Clipboard API
- Check for HTTPS (required for clipboard access)
- Verify browser permissions

### Collapsible sections not working
- Ensure Radix UI Collapsible is installed
- Check for JavaScript errors in console
- Verify component is client-side ("use client" directive)

## Future Enhancements

Potential improvements:
- [ ] Auto-refresh with configurable interval
- [ ] Export full info to PDF
- [ ] Historical firmware version tracking
- [ ] Device usage statistics
- [ ] Mode change history
- [ ] Port configuration editor
- [ ] Sensor calibration interface
- [ ] Real-time status updates via WebSocket
