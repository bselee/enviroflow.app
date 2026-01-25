# Mode Selector Component

A beautiful circular mode selector component for AC Infinity controller programming, inspired by the AC Infinity mobile app design.

## Features

- **7 Operating Modes**: OFF, ON, AUTO, VPD, TIMER, CYCLE, SCHEDULE
- **Circular Wheel Design**: Intuitive pie-slice segments around a central display
- **Live Sensor Readings**: Center shows temperature, humidity, and VPD
- **Active Mode Highlighting**: Glow effects and color coding for current mode
- **Animated Transitions**: Smooth 300ms CSS transitions between states
- **Full Accessibility**: Keyboard navigation with arrow keys, ARIA labels, and focus management
- **Responsive Sizes**: Three size variants (sm, md, lg)
- **Dark Mode Compatible**: Uses shadcn/ui design tokens
- **Touch & Click**: Works on desktop and mobile devices

## Installation

The component is already set up and ready to use. It's located in:

```
/workspaces/enviroflow.app/apps/web/src/components/controllers/modes/
```

## Usage

### Basic Example

```tsx
import { ModeSelector } from "@/components/controllers/modes";
import { useState } from "react";

function ControllerPanel() {
  const [mode, setMode] = useState<DeviceMode>("auto");

  return (
    <ModeSelector
      currentMode={mode}
      onModeChange={setMode}
      temperature={72}
      humidity={55}
      vpd={1.2}
    />
  );
}
```

### With All Props

```tsx
<ModeSelector
  currentMode="auto"
  onModeChange={(mode) => console.log("Mode changed:", mode)}
  temperature={72}
  humidity={55}
  vpd={1.2}
  disabled={false}
  size="md"
  temperatureUnit="°F"
  className="my-custom-class"
/>
```

### Size Variants

```tsx
{/* Small - 192px (48 * 4) */}
<ModeSelector size="sm" currentMode="off" onModeChange={handleChange} />

{/* Medium - 288px (72 * 4) - Default */}
<ModeSelector size="md" currentMode="auto" onModeChange={handleChange} />

{/* Large - 384px (96 * 4) */}
<ModeSelector size="lg" currentMode="schedule" onModeChange={handleChange} />
```

### Without Sensor Data

```tsx
{/* Shows "No sensor data" in center */}
<ModeSelector
  currentMode="on"
  onModeChange={handleChange}
/>
```

## API Reference

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `currentMode` | `DeviceMode` | Required | Current active mode |
| `onModeChange` | `(mode: DeviceMode) => void` | Required | Callback when mode changes |
| `temperature` | `number` | `undefined` | Temperature reading in °F or °C |
| `humidity` | `number` | `undefined` | Humidity reading in % |
| `vpd` | `number` | `undefined` | VPD reading in kPa |
| `disabled` | `boolean` | `false` | Disable all mode selections |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Component size |
| `temperatureUnit` | `'°F' \| '°C'` | `'°F'` | Temperature unit for display |
| `className` | `string` | `undefined` | Additional CSS classes |

### Types

```typescript
type DeviceMode = "off" | "on" | "auto" | "vpd" | "timer" | "cycle" | "schedule";

interface ModeSelectorProps {
  currentMode: DeviceMode;
  onModeChange: (mode: DeviceMode) => void;
  temperature?: number;
  humidity?: number;
  vpd?: number;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  temperatureUnit?: "°F" | "°C";
  className?: string;
}
```

## Mode Descriptions

| Mode | Color | Description | Use Case |
|------|-------|-------------|----------|
| **OFF** | Gray | Device disabled | Power off the device |
| **ON** | Green | Continuous operation | Run at constant speed/level |
| **AUTO** | Blue | Temperature/humidity triggers | Maintain target temp/humidity |
| **VPD** | Purple | Vapor pressure deficit control | Optimize plant transpiration |
| **TIMER** | Orange | Countdown timer | Run for specific duration |
| **CYCLE** | Cyan | Repeating on/off cycles | Intermittent operation |
| **SCHEDULE** | Yellow | Daily time-based schedule | Run at specific times |

## Keyboard Navigation

- **Tab**: Focus the component
- **Arrow Keys**: Navigate between modes (Up/Down/Left/Right)
- **Enter/Space**: Select focused mode
- **Tab**: Move to next focusable element

## Accessibility Features

- Full ARIA support with `role="radiogroup"` and `role="radio"`
- Each segment has descriptive `aria-label`
- Active mode indicated with `aria-checked="true"`
- Keyboard navigation with visual focus indicators
- Disabled state prevents interaction and updates aria attributes
- Screen reader friendly with proper labeling

## Styling & Customization

The component uses Tailwind CSS and shadcn/ui design tokens. It automatically adapts to your theme's dark/light mode.

### Custom Colors

To customize mode colors, edit the `MODE_CONFIGS` object in `ModeSelector.tsx`:

```typescript
const MODE_CONFIGS: Record<DeviceMode, ModeConfig> = {
  auto: {
    id: "auto",
    label: "AUTO",
    icon: Thermometer,
    color: "text-blue-500",      // Text color
    bgColor: "bg-blue-500/10",    // Background fill
    hoverColor: "hover:bg-blue-500/20",
    glowColor: "rgba(59, 130, 246, 0.5)", // Glow effect
    description: "Temperature/humidity triggers",
  },
  // ... other modes
};
```

### Animation Customization

Transitions are controlled via Tailwind classes:

```tsx
className="transition-all duration-300"
```

To adjust, modify the `duration-*` values throughout the component.

## Integration with AC Infinity Controllers

### Example: Device Control Panel

```tsx
import { ModeSelector } from "@/components/controllers/modes";
import { useController } from "@/hooks/useController";

function DeviceControlPanel({ controllerId, devicePort }: Props) {
  const { controller, updateDeviceMode } = useController(controllerId);
  const device = controller.devices[devicePort];

  const handleModeChange = async (mode: DeviceMode) => {
    await updateDeviceMode(devicePort, mode);
  };

  return (
    <div className="p-6">
      <ModeSelector
        currentMode={device.mode}
        onModeChange={handleModeChange}
        temperature={controller.sensors.temperature}
        humidity={controller.sensors.humidity}
        vpd={controller.sensors.vpd}
        size="lg"
      />
    </div>
  );
}
```

### Example: Modal/Dialog

```tsx
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModeSelector } from "@/components/controllers/modes";

function ModeSelectionDialog({ open, onClose, device }: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-2xl font-bold">Select Operating Mode</h2>
          <ModeSelector
            currentMode={device.mode}
            onModeChange={device.setMode}
            temperature={device.temperature}
            humidity={device.humidity}
            size="lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## Interactive Example

To see the component in action, check out the example file:

```
/workspaces/enviroflow.app/apps/web/src/components/controllers/modes/ModeSelector.example.tsx
```

This example includes:
- Live mode switching
- Interactive sensor value sliders
- Size variant comparison
- All mode states showcase
- Disabled state demo

## Browser Support

Works in all modern browsers that support:
- SVG rendering
- CSS transforms
- CSS transitions
- ES6+ JavaScript

## Performance

- Lightweight: < 5KB gzipped
- No external dependencies beyond React and Lucide icons
- Optimized re-renders with React hooks
- CSS-based animations (no JavaScript animation loops)
- Minimal DOM updates on interaction

## Troubleshooting

### Mode segments not clickable

Ensure the component is not inside a `pointer-events-none` container.

### Keyboard navigation not working

Check that the component or its parent is not disabled and that focus is reaching the SVG elements.

### Glow effects not visible

Verify that your browser supports SVG filters and gradients. Some older browsers may not render the glow effects.

### Center text not aligned

The center content uses absolute positioning. Ensure the parent container has proper dimensions.

## Future Enhancements

Potential improvements for future versions:

- [ ] Custom mode definitions via props
- [ ] Animation presets (spring, bounce, etc.)
- [ ] RTL (right-to-left) language support
- [ ] Haptic feedback on mobile devices
- [ ] Sound effects on mode change
- [ ] Multi-language labels
- [ ] Export mode history
- [ ] Integration with workflow builder

## License

This component is part of the EnviroFlow project and follows the project's license terms.

## Credits

Design inspired by the AC Infinity mobile app. Implemented with shadcn/ui, Tailwind CSS, and Lucide icons.
