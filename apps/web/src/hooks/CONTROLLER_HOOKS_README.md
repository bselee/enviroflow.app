# Controller Ports and Modes Hooks

This document describes the `useControllerPorts` and `useControllerModes` hooks for the Precision Control Workflow Builder.

## Overview

These hooks provide real-time access to controller port states and mode configurations for building advanced automation workflows. They follow the established EnviroFlow hook pattern with loading states, error handling, real-time subscriptions, and isMounted protection.

## Table of Contents

- [useControllerPorts](#usecontrollerports)
- [useControllerModes](#usecontrollermodes)
- [Integration Guide](#integration-guide)
- [Database Schema](#database-schema)

---

## useControllerPorts

Fetches port data for a specific controller. Used by workflow builder to populate port dropdowns and display current port states.

### Import

```typescript
import { useControllerPorts } from '@/hooks/use-controller-ports';
```

### Signature

```typescript
function useControllerPorts(options?: UseControllerPortsOptions): UseControllerPortsReturn
```

### Options

```typescript
interface UseControllerPortsOptions {
  controllerId?: string;  // Controller ID to fetch ports for
  enabled?: boolean;      // Whether to enable fetching (default: true)
}
```

### Return Type

```typescript
interface UseControllerPortsReturn {
  ports: ControllerPort[];      // Array of port data
  loading: boolean;              // Loading state
  error: string | null;          // Error message
  refetch: () => Promise<void>;  // Manual refresh function
}
```

### ControllerPort Structure

```typescript
interface ControllerPort {
  id: string;                // UUID
  port_number: number;       // 1-8
  port_name: string | null;  // User-assigned name
  device_type: string | null; // fan, light, heater, etc.
  is_connected: boolean;     // Device connected
  is_on: boolean;            // Device powered on
  power_level: number;       // 0-10
  current_mode: number;      // 0=OFF, 1=ON, 2=AUTO, 3=TIMER, 4=CYCLE, 5=SCHEDULE, 6=VPD
  supports_dimming: boolean; // Variable speed/dimming support
  is_online: boolean;        // Port reporting online
  updated_at: string;        // ISO timestamp
}
```

### Usage Examples

#### Basic Usage

```typescript
const { ports, loading, error } = useControllerPorts({
  controllerId: 'abc-123'
});

if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {error}</div>;

return (
  <select>
    {ports.map(port => (
      <option key={port.id} value={port.port_number}>
        Port {port.port_number}: {port.port_name || 'Unnamed'}
      </option>
    ))}
  </select>
);
```

#### Manual Refresh

```typescript
const { ports, refetch } = useControllerPorts({ controllerId });

// Refresh when panel opens
const handlePanelOpen = () => {
  refetch();
};
```

#### Conditional Fetching

```typescript
const { ports } = useControllerPorts({
  controllerId,
  enabled: isPanelOpen // Only fetch when panel is open
});
```

#### No Controller Selected

```typescript
// Returns empty array when controllerId is undefined
const { ports } = useControllerPorts({});
console.log(ports); // []
```

### Features

- Returns empty array if no controllerId provided
- Real-time subscription to port changes
- Ordered by port number ascending
- isMounted ref prevents state updates after unmount
- Automatic cleanup of subscriptions

---

## useControllerModes

Fetches current mode configurations for a controller's ports. Used by workflow builder to show current state and for verification.

### Import

```typescript
import { useControllerModes } from '@/hooks/use-controller-modes';
```

### Signature

```typescript
function useControllerModes(options?: UseControllerModesOptions): UseControllerModesReturn
```

### Options

```typescript
interface UseControllerModesOptions {
  controllerId?: string;  // Controller ID to fetch modes for
  port?: number;          // Optional: filter to specific port
  enabled?: boolean;      // Whether to enable fetching (default: true)
}
```

### Return Type

```typescript
interface UseControllerModesReturn {
  modes: PortModeConfig[];       // Array of mode configurations
  loading: boolean;              // Loading state
  error: string | null;          // Error message
  refetch: () => Promise<void>;  // Manual refresh function
}
```

### PortModeConfig Structure

```typescript
interface PortModeConfig {
  id: string;                    // UUID
  port_number: number;           // 0-8 (0 for controller-level)
  mode_id: number;               // 0-6
  mode_name: string | null;      // OFF, ON, AUTO, TIMER, CYCLE, SCHEDULE, VPD
  is_active: boolean;            // Currently active mode
  autoConfig?: AutoModeConfig;   // For mode_id 2
  vpdConfig?: VpdModeConfig;     // For mode_id 6
  timerConfig?: TimerModeConfig; // For mode_id 3
  cycleConfig?: CycleModeConfig; // For mode_id 4
  scheduleConfig?: ScheduleModeConfig; // For mode_id 5
  updated_at?: string;           // ISO timestamp
}
```

### Mode Configuration Types

#### AutoModeConfig

```typescript
interface AutoModeConfig {
  tempHighTrigger: number | null;      // Fahrenheit
  tempLowTrigger: number | null;       // Fahrenheit
  humidityHighTrigger: number | null;  // Percentage
  humidityLowTrigger: number | null;   // Percentage
  vpdHighTrigger: number | null;       // kPa
  vpdLowTrigger: number | null;        // kPa
  deviceBehavior: string | null;       // cooling, heating, humidify, dehumidify
  maxLevel: number | null;             // 0-10
  minLevel: number | null;             // 0-10
  transitionEnabled: boolean;
  transitionSpeed: number | null;
  bufferEnabled: boolean;
  bufferValue: number | null;
}
```

#### VpdModeConfig

```typescript
interface VpdModeConfig extends AutoModeConfig {
  leafTempOffset: number | null;  // Fahrenheit offset for VPD calculation
}
```

#### TimerModeConfig

```typescript
interface TimerModeConfig {
  timerType: string | null;      // 'on' or 'off'
  timerDuration: number | null;  // seconds
}
```

#### CycleModeConfig

```typescript
interface CycleModeConfig {
  cycleOnDuration: number | null;   // seconds
  cycleOffDuration: number | null;  // seconds
}
```

#### ScheduleModeConfig

```typescript
interface ScheduleModeConfig {
  scheduleStartTime: string | null;  // HH:MM:SS
  scheduleEndTime: string | null;    // HH:MM:SS
  scheduleDays: number | null;       // bitmask (bit 0 = Sunday)
}
```

### Usage Examples

#### Basic Usage

```typescript
const { modes, loading, error } = useControllerModes({
  controllerId: 'abc-123'
});

// Display all mode configurations
modes.forEach(mode => {
  console.log(`Port ${mode.port_number} - ${mode.mode_name}`, mode.is_active ? '(ACTIVE)' : '');

  if (mode.autoConfig) {
    console.log('Auto triggers:', mode.autoConfig);
  }
});
```

#### Filter by Port

```typescript
// Get modes for a specific port only
const { modes } = useControllerModes({
  controllerId: 'abc-123',
  port: 1  // Only port 1
});
```

#### Get Active Mode

```typescript
const { modes } = useControllerModes({
  controllerId,
  port: portNumber
});

const activeMode = modes.find(m => m.is_active);
if (activeMode?.autoConfig) {
  console.log('Current temp trigger:', activeMode.autoConfig.tempHighTrigger);
}
```

#### Display Mode Settings

```typescript
const { modes } = useControllerModes({ controllerId });

return (
  <div>
    {modes.map(mode => (
      <div key={mode.id}>
        <h4>Port {mode.port_number} - {mode.mode_name}</h4>

        {mode.autoConfig && (
          <div>
            <p>High Temp: {mode.autoConfig.tempHighTrigger}°F</p>
            <p>Low Temp: {mode.autoConfig.tempLowTrigger}°F</p>
            <p>Behavior: {mode.autoConfig.deviceBehavior}</p>
          </div>
        )}

        {mode.timerConfig && (
          <div>
            <p>Type: {mode.timerConfig.timerType}</p>
            <p>Duration: {mode.timerConfig.timerDuration}s</p>
          </div>
        )}
      </div>
    ))}
  </div>
);
```

### Features

- Returns empty array if no controllerId provided
- Optional port filter for specific port modes
- Real-time subscription to mode changes
- Transforms flat DB columns into typed config objects
- Ordered by port number and mode_id
- isMounted ref prevents state updates after unmount
- Automatic cleanup of subscriptions

---

## Integration Guide

### Workflow Builder Integration

```typescript
function WorkflowBuilderNode({ nodeId, data }) {
  const [selectedController, setSelectedController] = useState(data.controllerId);
  const [selectedPort, setSelectedPort] = useState<number>();

  // Fetch ports when controller is selected
  const { ports, loading: portsLoading } = useControllerPorts({
    controllerId: selectedController,
    enabled: !!selectedController
  });

  // Fetch modes when port is selected (to show current state)
  const { modes, loading: modesLoading } = useControllerModes({
    controllerId: selectedController,
    port: selectedPort,
    enabled: !!selectedController && selectedPort !== undefined
  });

  const activeMode = modes.find(m => m.is_active);

  return (
    <div>
      <ControllerSelect
        value={selectedController}
        onChange={setSelectedController}
      />

      <PortSelect
        value={selectedPort}
        onChange={setSelectedPort}
        ports={ports}
        loading={portsLoading}
      />

      {activeMode && (
        <div>
          Current Mode: {activeMode.mode_name}
          {activeMode.autoConfig && (
            <div>Temp: {activeMode.autoConfig.tempHighTrigger}°F</div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Mode Verification Before Control Action

```typescript
function ControlActionNode({ controllerId, port, targetMode }) {
  const { modes } = useControllerModes({ controllerId, port });
  const currentMode = modes.find(m => m.is_active);

  const canExecute = currentMode?.mode_id !== targetMode;

  return (
    <button disabled={!canExecute}>
      Execute Control Action
      {!canExecute && ' (Already in target mode)'}
    </button>
  );
}
```

### Real-time Mode Monitoring

```typescript
function PortMonitor({ controllerId, port }) {
  const { ports } = useControllerPorts({ controllerId });
  const { modes } = useControllerModes({ controllerId, port });

  const portData = ports.find(p => p.port_number === port);
  const activeMode = modes.find(m => m.is_active);

  useEffect(() => {
    if (portData && activeMode) {
      console.log(`Port ${port} changed:`, {
        powerLevel: portData.power_level,
        mode: activeMode.mode_name,
        isOn: portData.is_on
      });
    }
  }, [portData?.power_level, activeMode?.mode_name, portData?.is_on]);

  return (
    <div>
      Port {port}: {portData?.is_on ? 'ON' : 'OFF'}
      Mode: {activeMode?.mode_name}
      Level: {portData?.power_level}/10
    </div>
  );
}
```

---

## Database Schema

### controller_ports

```sql
CREATE TABLE controller_ports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  port_number INTEGER NOT NULL CHECK (port_number >= 1 AND port_number <= 8),
  port_name TEXT,
  device_type TEXT CHECK (device_type IN ('fan', 'light', 'heater', 'cooler', 'humidifier', 'dehumidifier', 'outlet', 'pump', 'valve', 'sensor')),
  load_type INTEGER,
  is_connected BOOLEAN DEFAULT false,
  is_on BOOLEAN DEFAULT false,
  power_level INTEGER DEFAULT 0 CHECK (power_level >= 0 AND power_level <= 10),
  current_mode INTEGER DEFAULT 0,
  supports_dimming BOOLEAN DEFAULT false,
  is_online BOOLEAN DEFAULT true,
  port_type INTEGER,
  dev_type INTEGER,
  external_port INTEGER,
  speak INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(controller_id, port_number)
);
```

### controller_modes

```sql
CREATE TABLE controller_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE NOT NULL,
  port_number INTEGER NOT NULL CHECK (port_number >= 0 AND port_number <= 8),
  mode_id INTEGER NOT NULL CHECK (mode_id >= 0 AND mode_id <= 6),
  mode_name TEXT,
  is_active BOOLEAN DEFAULT false,

  -- Temperature triggers (Fahrenheit)
  temp_trigger_high DECIMAL(5, 2),
  temp_trigger_low DECIMAL(5, 2),

  -- Humidity triggers (percentage)
  humidity_trigger_high DECIMAL(5, 2),
  humidity_trigger_low DECIMAL(5, 2),

  -- VPD triggers (kPa)
  vpd_trigger_high DECIMAL(4, 3),
  vpd_trigger_low DECIMAL(4, 3),

  -- Device behavior
  device_behavior TEXT CHECK (device_behavior IN ('cooling', 'heating', 'humidify', 'dehumidify')),

  -- Level settings
  max_level INTEGER CHECK (max_level >= 0 AND max_level <= 10),
  min_level INTEGER CHECK (min_level >= 0 AND min_level <= 10),

  -- Transition settings
  transition_enabled BOOLEAN DEFAULT false,
  transition_speed INTEGER,

  -- Buffer settings
  buffer_enabled BOOLEAN DEFAULT false,
  buffer_value DECIMAL(5, 2),

  -- Timer mode settings
  timer_type TEXT CHECK (timer_type IN ('on', 'off')),
  timer_duration INTEGER,

  -- Cycle mode settings
  cycle_on_duration INTEGER,
  cycle_off_duration INTEGER,

  -- Schedule mode settings
  schedule_start_time TIME,
  schedule_end_time TIME,
  schedule_days INTEGER,

  -- VPD leaf temperature offset
  leaf_temp_offset DECIMAL(4, 2),

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(controller_id, port_number, mode_id)
);
```

### Mode ID Reference

| mode_id | mode_name | Description |
|---------|-----------|-------------|
| 0 | OFF | Device is off |
| 1 | ON | Device is on at fixed level |
| 2 | AUTO | Automatic control based on temp/humidity triggers |
| 3 | TIMER | Turns on/off after a duration |
| 4 | CYCLE | Repeating on/off cycles |
| 5 | SCHEDULE | Time-based scheduling |
| 6 | VPD | VPD-based control with leaf temp offset |

---

## Testing

See example files:
- `/apps/web/src/hooks/use-controller-ports.example.tsx`
- `/apps/web/src/hooks/use-controller-modes.example.tsx`

Run linting:
```bash
cd apps/web
npx eslint src/hooks/use-controller-ports.ts src/hooks/use-controller-modes.ts
```

---

## Notes

1. Both hooks follow the established pattern from `use-controllers.ts` and `use-dashboard-data.ts`
2. Real-time subscriptions are automatically cleaned up on unmount
3. The `isMounted` ref pattern prevents state updates after component unmount
4. Empty arrays are returned when controllerId is undefined (safe defaults)
5. The `enabled` option allows conditional fetching (useful for performance)
6. Mode configurations are transformed from flat DB columns to typed objects
7. Port 0 in `controller_modes` represents controller-level settings (not port-specific)

---

## Future Enhancements

Potential additions for future iterations:

1. Mutation functions for updating modes (e.g., `setMode`, `updateModeConfig`)
2. Port control actions (e.g., `setPowerLevel`, `togglePort`)
3. Optimistic updates for better UX
4. Batch operations for multiple ports
5. History/changelog tracking
6. Validation helpers for mode transitions
7. Port grouping/tagging support
