# Connection Wire Components

Visual wire connections between controller cards and device cards using SVG.

## Components

### `ConnectionWire`
Low-level SVG component that renders a single wire connection with optional animation.

### `ConnectionWireContainer`
Wrapper component that automatically calculates positions and renders all wires.

### `ControllerCardWrapper` & `DeviceCardWrapper`
Helper components to mark cards for automatic wire rendering.

## Usage

### Basic Setup

```tsx
import {
  ConnectionWireContainer,
  ControllerCardWrapper,
  DeviceCardWrapper,
} from '@/components/controllers/ConnectionWireContainer';

function ControllerView({ controller, devices }) {
  return (
    <ConnectionWireContainer controllerId={controller.id}>
      {/* Controller card */}
      <ControllerCardWrapper controllerId={controller.id}>
        <ControllerCard controller={controller} />
      </ControllerCardWrapper>

      {/* Device cards */}
      <div className="grid grid-cols-2 gap-4 mt-8">
        {devices.map((device) => (
          <DeviceCardWrapper
            key={device.id}
            deviceId={device.id}
            controllerId={controller.id}
            deviceType={device.type} // 'fan', 'light', 'outlet', etc.
            isActive={device.is_on}
          >
            <DeviceCard device={device} />
          </DeviceCardWrapper>
        ))}
      </div>
    </ConnectionWireContainer>
  );
}
```

### Manual Wire Rendering

For custom layouts, use `ConnectionWire` directly:

```tsx
import { ConnectionWire, ConnectionWireFilters } from '@/components/controllers/ConnectionWire';

function CustomLayout() {
  return (
    <div className="relative">
      <svg className="absolute inset-0 pointer-events-none">
        <ConnectionWireFilters />
        <ConnectionWire
          startX={100}
          startY={50}
          endX={300}
          endY={200}
          isActive={true}
          deviceType="fan"
          animated={true}
        />
      </svg>

      <div className="relative z-10">
        {/* Your content */}
      </div>
    </div>
  );
}
```

## Props

### `ConnectionWireContainer`
- `children` - Card components to render
- `controllerId` - ID of the controller
- `className?` - Optional CSS classes

### `ControllerCardWrapper`
- `controllerId` - ID of the controller
- `children` - Controller card component
- `className?` - Optional CSS classes

### `DeviceCardWrapper`
- `deviceId` - ID of the device
- `controllerId` - ID of the parent controller
- `deviceType` - Type of device ('fan', 'light', 'outlet', 'heater', 'humidifier')
- `isActive` - Whether the device is currently on
- `children` - Device card component
- `className?` - Optional CSS classes

### `ConnectionWire`
- `startX` - Starting X coordinate
- `startY` - Starting Y coordinate
- `endX` - Ending X coordinate
- `endY` - Ending Y coordinate
- `isActive` - Whether the device is on (affects color)
- `deviceType` - Device type for color coding
- `animated?` - Enable pulse animation (default: true)

## Device Type Colors

| Device Type | Color | Hex |
|------------|-------|-----|
| Fan | Blue | `#3b82f6` |
| Light | Yellow | `#eab308` |
| Outlet | Green | `#22c55e` |
| Heater | Orange | `#f97316` |
| Humidifier | Cyan | `#06b6d4` |
| Inactive | Gray | `#6b7280` |

## Features

- **Automatic positioning** - Uses ResizeObserver to track card positions
- **Responsive** - Updates on window resize and layout changes
- **Smooth curves** - Bezier curves for natural wire appearance
- **Animated pulses** - Traveling dots when devices are active
- **Color coding** - Different colors per device type
- **Glow effects** - Subtle shadows for active wires
- **Performance** - Memoized components, minimal re-renders

## Implementation Notes

### Data Attributes

The container uses data attributes to identify cards:
- Controller: `data-controller-id`
- Devices: `data-device-id`, `data-device-controller`, `data-device-type`, `data-device-active`

### Z-Index Layering

- SVG overlay: `z-0` (behind)
- Card content: `z-10` (front)

### Position Calculation

Positions are calculated as center points of each card relative to the container. The component:
1. Uses `getBoundingClientRect()` for accurate positions
2. Observes container and all child cards for size changes
3. Updates positions on window resize
4. Debounces updates when children change (50ms delay)

### Animation Performance

- Uses native SVG `<animateMotion>` for smooth path following
- CSS transitions for color changes
- Memoized components prevent unnecessary re-renders

## Troubleshooting

**Wires not appearing:**
- Ensure wrapper components are used correctly
- Check that `controllerId` matches between container and wrappers
- Verify cards have rendered before wires calculate positions

**Incorrect positions:**
- Check that container has `relative` positioning
- Ensure cards aren't positioned `fixed` or `absolute` outside the container
- Verify no transform or translate CSS on parent elements

**Animation not smooth:**
- Reduce number of simultaneous animations
- Check browser performance settings
- Ensure `animated` prop is not toggling rapidly
