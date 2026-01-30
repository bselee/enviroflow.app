# Device Mode Programming - Quick Start Guide

## Installation

No installation needed! All components are ready to use.

## Basic Usage

### 1. Import the Component

```tsx
import { DeviceModeProgramming } from '@/components/controllers'
```

### 2. Add to Your Page/Dialog

```tsx
<DeviceModeProgramming
  controllerId="your-controller-id"
  port={1}
  deviceName="Exhaust Fan"
  onClose={() => setOpen(false)}
/>
```

### 3. Done!

That's it. The component handles everything else:
- Fetches current mode configuration
- Shows real-time sensor readings
- Provides mode-specific settings
- Saves changes to the API

## Common Patterns

### Pattern 1: In a Dialog

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DeviceModeProgramming } from '@/components/controllers'

export function ProgramDeviceDialog({ controllerId, port, deviceName }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Program Device
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Program {deviceName}</DialogTitle>
          </DialogHeader>
          <DeviceModeProgramming
            controllerId={controllerId}
            port={port}
            deviceName={deviceName}
            onClose={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
```

### Pattern 2: Full Page

```tsx
// app/controllers/[id]/program/page.tsx
'use client'

import { useParams } from 'next/navigation'
import { DeviceModeProgramming } from '@/components/controllers'

export default function ProgrammingPage() {
  const params = useParams()
  const controllerId = params.id as string

  return (
    <div className="container py-8">
      <DeviceModeProgramming
        controllerId={controllerId}
        port={1}
        deviceName="Exhaust Fan"
      />
    </div>
  )
}
```

### Pattern 3: With Port Selector

```tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeviceModeProgramming } from '@/components/controllers'

export function MultiPortProgrammer({ controllerId }) {
  const ports = [
    { port: 1, name: 'Exhaust Fan' },
    { port: 2, name: 'Intake Fan' },
    { port: 3, name: 'Humidifier' },
    { port: 4, name: 'Light' },
  ]

  return (
    <Tabs defaultValue="1">
      <TabsList>
        {ports.map((p) => (
          <TabsTrigger key={p.port} value={String(p.port)}>
            Port {p.port}
          </TabsTrigger>
        ))}
      </TabsList>

      {ports.map((p) => (
        <TabsContent key={p.port} value={String(p.port)}>
          <DeviceModeProgramming
            controllerId={controllerId}
            port={p.port}
            deviceName={p.name}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
```

## API Setup Required

Before using the component, you need to create the API endpoint:

```typescript
// app/api/controllers/[id]/ports/[port]/mode/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; port: string } }
) {
  const supabase = createServerClient()

  // TODO: Fetch mode configuration from AC Infinity adapter
  // For now, return mock data:

  return NextResponse.json({
    success: true,
    port: {
      port: Number(params.port),
      portName: `Port ${params.port}`,
      deviceType: 'fan',
      currentMode: {
        mode: 'auto',
        tempTriggerHigh: 80,
        tempTriggerLow: 70,
        maxLevel: 10,
        minLevel: 1,
      },
      supportedModes: ['off', 'on', 'auto', 'vpd', 'timer', 'cycle', 'schedule'],
    },
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; port: string } }
) {
  const body = await request.json()

  // TODO: Send mode update to AC Infinity adapter
  // For now, return success:

  return NextResponse.json({
    success: true,
    port: {
      port: body.port,
      portName: `Port ${body.port}`,
      deviceType: 'fan',
      currentMode: body.mode,
      supportedModes: ['off', 'on', 'auto', 'vpd', 'timer', 'cycle', 'schedule'],
    },
  })
}
```

## Troubleshooting

### Issue: "Port not found" error

**Solution:** Make sure the port number is between 1-4 and the controller has that port configured.

### Issue: Gauges show "--" values

**Solution:** This means no sensor readings are available. Check:
1. Controller is online
2. Sensors are connected
3. `/api/controllers/:id/sensors` endpoint is working
4. Supabase realtime is enabled

### Issue: Save button disabled

**Solution:** The save button is disabled when:
- No changes have been made (hasUnsavedChanges = false)
- Already saving (isSaving = true)
- Port is set to "all" (select a specific port)

### Issue: Component shows loading spinner

**Solution:** The component is fetching data. If it stays loading:
1. Check API endpoint is working
2. Check network requests in DevTools
3. Verify authentication token is valid

## Keyboard Shortcuts

- **Esc** - Close (with confirmation if unsaved)
- **Ctrl+S** / **Cmd+S** - Save changes
- **Arrow Keys** - Navigate mode selector
- **Enter** / **Space** - Select mode

## Examples

See `/src/components/controllers/DeviceModeProgramming.example.tsx` for interactive examples.

## Further Reading

- [Full Documentation](./DEVICE_MODE_PROGRAMMING.md)
- [Architecture Diagram](./ARCHITECTURE.md)
- [Implementation Summary](../../DEVICE_MODE_IMPLEMENTATION_SUMMARY.md)
