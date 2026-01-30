# Device Mode Programming - Component Architecture

## Component Hierarchy

```
DeviceModeProgramming (Main Container)
│
├─── Header Section
│    ├─── Title + Port Info
│    └─── Unsaved Changes Badge
│
├─── Desktop Layout (lg breakpoint+)
│    │
│    ├─── Left Column
│    │    │
│    │    ├─── Card: Mode Selector
│    │    │    └─── ModeSelector
│    │    │         ├─── Circular SVG Wheel
│    │    │         ├─── Mode Segments (7 modes)
│    │    │         └─── Center Display (sensor readings)
│    │    │
│    │    └─── Card: Current Conditions
│    │         └─── SensorGaugePanel
│    │              └─── SensorGauge[] (temp, humidity, vpd, co2)
│    │
│    └─── Right Column
│         │
│         ├─── ModeConfigPanel (dynamic based on mode)
│         │    ├─── OFFConfig
│         │    ├─── ONConfig
│         │    ├─── AUTOConfig
│         │    ├─── VPDConfig
│         │    ├─── TIMERConfig
│         │    ├─── CYCLEConfig
│         │    └─── SCHEDULEConfig
│         │
│         └─── Action Buttons
│              ├─── Save Button
│              └─── Reset Button
│
└─── Mobile Layout (< lg breakpoint)
     │
     ├─── Tabs
     │    ├─── Mode Tab → ModeSelector
     │    ├─── Settings Tab → ModeConfigPanel
     │    └─── Sensors Tab → SensorGaugePanel
     │
     └─── Action Buttons (sticky)
          ├─── Save Button
          └─── Reset Button
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    DeviceModeProgramming                    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                useDeviceMode Hook                     │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  API: /api/controllers/:id/ports/:port/mode   │  │  │
│  │  │  • GET: Fetch current mode config             │  │  │
│  │  │  • PUT: Update mode config                    │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  API: /api/controllers/:id/sensors            │  │  │
│  │  │  • GET: Fetch sensor readings                 │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Supabase Realtime: sensor_readings           │  │  │
│  │  │  • Subscribe to INSERT events                 │  │  │
│  │  │  • Update readings in real-time               │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                 │
│                           ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Component State                     │  │
│  │  • modeState (from server)                           │  │
│  │  • sensorReadings (real-time)                        │  │
│  │  • selectedMode (local draft)                        │  │
│  │  • draftConfig (local draft)                         │  │
│  │  • hasUnsavedChanges (comparison)                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                 │
│         ┌─────────────────┴─────────────────┐              │
│         ▼                                   ▼              │
│  ┌─────────────┐                    ┌──────────────┐       │
│  │ ModeSelector│                    │ModeConfigPanel│      │
│  │  (display)  │                    │  (edit draft)│       │
│  └─────────────┘                    └──────────────┘       │
│         │                                   │              │
│         └───────────────┬───────────────────┘              │
│                         ▼                                  │
│                  ┌─────────────┐                           │
│                  │ Save Button │                           │
│                  └─────────────┘                           │
│                         │                                  │
│                         ▼                                  │
│              PUT /api/.../mode                             │
│                         │                                  │
│                         ▼                                  │
│              Update local state                            │
│              (optimistic update)                           │
└─────────────────────────────────────────────────────────────┘
```

## API Requirements

### GET /api/controllers/:controllerId/ports/:port/mode

Fetch current mode configuration for a port.

**Success Response (200):**
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

### PUT /api/controllers/:controllerId/ports/:port/mode

Update mode configuration for a port.

**Request Body:**
```json
{
  "port": 1,
  "mode": {
    "mode": "auto",
    "tempTriggerHigh": 82,
    "tempTriggerLow": 72
  }
}
```
