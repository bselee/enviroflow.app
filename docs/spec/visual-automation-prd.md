# EnviroFlow Visual Automation PRD

---

## 1. One-Sentence Problem

> **Growers** struggle to **create complex, multi-step automations** for their AC Infinity controllers because **the current workflow builder lacks delays, variables, and reusable flows**, resulting in **manual intervention, suboptimal environments, and missed grow stage transitions**.

---

## 2. Demo Goal (What Success Looks Like)

**Success:** A user drags an AC Infinity controller from a device palette onto the canvas, connects it to a temperature sensor node, adds conditional logic (if temp > 82°F AND humidity > 70%), chains a delay (wait 5 min), then triggers exhaust fan to speed 8. Saves as "Heat Spike Response" for reuse.

**Outcome communicated:** "EnviroFlow lets you visually program your grow environment like Node-RED—no code, full control."

### 2.1 Non-Goals

- Native Zigbee coordinator support (use Zigbee2MQTT bridge)
- Real-time sub-second execution (1-min cron is acceptable)
- Mobile app (web responsive is sufficient)
- Multi-user collaboration on same workflow
- Workflow marketplace/sharing platform

### 2.2 Autonomy Target

| Level | Mode | Description |
|-------|------|-------------|
| L4 | Decide | Auto-execute within user-defined rules |
| L5 | Execute | Send commands to AC Infinity devices |

**This feature targets: L5 - Execute** (with L4 decision logic)

### 2.3 Demo Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Workflow creation time | < 3 min for basic flow | Stopwatch during demo |
| Node types available | 10+ draggable nodes | Count in palette |
| AC Infinity commands executed | 100% success rate | Activity log verification |
| Flow reuse | Save → Load → Execute works | Demo walkthrough |

---

## 3. Target User (Role-Based)

| Attribute | Value |
|-----------|-------|
| Role / Context | Home cultivator with 1-4 AC Infinity controllers |
| Skill Level | Intermediate - comfortable with apps, not code |
| Key Constraint | Time - wants set-and-forget automation |
| Current Tools | AC Infinity app (limited), manual adjustments, maybe Home Assistant |

---

## 4. Core Use Cases

### 4.1 Happy Path (Primary Flow)

**Start condition:**
> User has 1+ AC Infinity controllers connected with sensors reading data

**Steps:**

1. User opens Automations page, clicks "New Workflow"
2. Drags "Sensor" node onto canvas, configures: Controller 1 → Temperature → threshold > 82°F
3. Drags "Delay" node, connects from sensor, sets 5 minutes
4. Drags "Device" node (AC Infinity Exhaust Fan), connects from delay
5. Configures action: Set Speed → 8
6. Names workflow "Heat Spike Response"
7. Clicks Save → Toggle Active
8. System executes when conditions met, logs activity

**End condition:**
> Workflow saved, active, and executes automatically when temp exceeds 82°F for 5+ minutes

### 4.2 Critical Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Controller offline when workflow triggers | Skip action, log warning, continue to next node, retry on next cycle |
| Sensor returns null/error | Condition evaluates as false, workflow pauses, notification sent |
| User edits active workflow | Auto-pause during edit, require re-activate to prevent partial execution |
| Two workflows conflict (same device) | Block both workflows, alert user to resolve |
| Rate limit hit on AC Infinity API | Queue commands, execute on next available slot, warn user |
| Sensor oscillates around threshold | Hysteresis prevents rapid re-triggering |
| Multi-action workflow hits rate limit | 1s throttle, visible progress |
| Workflow fails mid-execution | Halt, preserve state, push notification |

---

## 5. Functional Decisions (What It Must Do)

| ID | Function | Notes |
|----|----------|-------|
| F1 | Drag-and-drop node canvas | React Flow based, existing foundation |
| F2 | Device nodes showing connected controllers | Pull from `controllers` table with capabilities |
| F3 | Delay node with configurable wait time | State machine with DB-stored `resume_after` timestamps |
| F4 | Variable node for storing/passing values | Workflow-scoped + global cross-workflow variables |
| F5 | Save workflows with name/description | Existing, enhance with tags/categories |
| F6 | Duplicate existing workflow | One-click copy for iteration |
| F7 | Export/Import workflow as JSON | Backup and sharing |
| F8 | MQTT sensor as trigger source | Topics + wildcards + JSONPath payload conditions |
| F9 | Hysteresis-based sensor triggers | Configurable trigger/re-arm thresholds |
| F10 | Cross-controller sensor→device automation | Any sensor can trigger any device action |
| F11 | Workflow conflict detection | Block + alert on same-port conflicts |

---

## 6. UX Decisions (What the Experience Is Like)

### 6.1 Entry Point

- Sidebar → Automations → "New Workflow" button
- Canvas loads with empty grid, node palette on left

### 6.2 Inputs

| Input | Type | Required | Validation |
|-------|------|----------|------------|
| Workflow name | Text | Yes | 1-50 chars, unique per user |
| Node configuration | Form per node type | Yes | Type-specific (e.g., threshold requires number) |
| Delay duration | Number + unit | If delay node used | > 0, max 24 hours |
| Hysteresis band | Number | If sensor trigger | Re-arm threshold below trigger threshold |

### 6.3 Outputs

| Output | Format | Destination |
|--------|--------|-------------|
| Saved workflow | JSONB (nodes/edges) | Supabase `workflows` table |
| Execution log | Timestamped entries | Activity log panel + `activity_logs` table |
| Export file | JSON | Browser download |
| Conflict alerts | Push notification | User's notification queue |

### 6.4 Feedback & States

| State | UI Treatment |
|-------|--------------|
| Loading | Skeleton canvas with shimmer |
| Success (save) | Toast "Workflow saved" + green checkmark |
| Success (execute) | Activity log entry with timestamp |
| Failure | Toast with error + red highlight on failed node |
| Workflow active | Green "Active" badge on card |
| Workflow paused | Yellow "Paused" badge |
| Workflow blocked (conflict) | Red "Conflict" badge + resolution prompt |
| Delay in progress | Timer countdown on node |
| Rate limited | Progress indicator with queue position |

### 6.5 Errors (Minimum Viable Handling)

| Error Condition | User Experience |
|-----------------|-----------------|
| Invalid node config | Red border + inline message, block save |
| Disconnected nodes | Warning banner "Some nodes not connected" |
| Controller offline | Orange indicator on device node, tooltip explains |
| API rate limited | Toast "Commands queued, executing shortly" + visible progress |
| Workflow conflict | Modal showing conflicting workflows, prompt to resolve |
| Mid-execution failure | Halt workflow, preserve state, push notification with details |

---

## 7. Data & Logic (At a Glance)

### 7.1 Data Source Matrix

| Data Point | Source(s) | Sync Direction | Frequency | Fallback |
|------------|-----------|----------------|-----------|----------|
| Controller list | Supabase `controllers` | Inbound | On page load | Cache last known |
| Sensor readings | AC Infinity API / MQTT | Inbound | 15s polling | Use last value |
| Workflow definitions | Supabase `workflows` | Bidirectional | On save/load | Local draft |
| Execution history | Supabase `activity_logs` | Outbound | On each run | Queue if offline |
| Delay state | Supabase `workflow_executions` | Bidirectional | On delay start/complete | Resume on restart |
| Variable state | Supabase `workflow_variables` | Bidirectional | On read/write | Last known value |

### 7.2 Processing Logic

```
Trigger fires (time/sensor threshold)
  → Check hysteresis: is sensor in "triggered" or "re-armed" state?
  → Load workflow nodes/edges
  → Check for port conflicts with other active workflows
  → If conflict: block execution, alert user
  → Traverse graph following edges
  → For each node:
      - Sensor: Read value, check threshold with hysteresis
      - Condition: Evaluate AND/OR logic
      - Delay: Store resume_after timestamp in DB, exit
      - Device: Send command via adapter (with 1s throttle)
      - Variable: Read/write to workflow context
  → Log execution result
```

### 7.3 Delay Node State Machine

```
States: PENDING → WAITING → READY → EXECUTED

PENDING: Delay node reached, resume_after timestamp stored
WAITING: Current time < resume_after
READY: Current time >= resume_after
EXECUTED: Downstream nodes processed

On cron tick:
  - Query workflow_executions WHERE state = 'WAITING' AND resume_after <= NOW()
  - Resume execution from delay node
```

### 7.4 Output Destinations

| Output | Destination | Persistence |
|--------|-------------|-------------|
| Device commands | AC Infinity API | Logged in activity_logs |
| Workflow state | Supabase workflows | Permanent until deleted |
| Execution state | Supabase workflow_executions | Until workflow completes |
| Notifications | Push/Email | Logged + delivered |

---

## 8. Integration Touchpoints

| System | Interaction Type | Direction | Critical? | Fallback if Unavailable |
|--------|------------------|-----------|-----------|-------------------------|
| AC Infinity API | Read sensors, Write commands | Both | Yes | Cache readings, queue commands |
| Supabase | Read/Write workflows, logs | Both | Yes | Local storage draft mode |
| MQTT Broker | Read sensor events | In | No | Polling-only mode |
| Vercel Cron | Trigger execution + resume delays | Internal | Yes | Manual trigger button |

---

## 9. Device Node UX

### 9.1 Palette Design

Device nodes appear in an **expandable tree** structure:

```
📁 Controllers
  └─ 🌡️ Controller 1 "Tent A"
       ├─ Port 1: Exhaust Fan
       ├─ Port 2: Intake Fan
       ├─ Port 3: Humidifier
       └─ Sensor: Temp/Humidity/VPD
  └─ 🌡️ Controller 2 "Dry Room"
       └─ ...
```

**Interaction:** User drags individual port to canvas, not entire controller.

### 9.2 Node Display

When placed on canvas, device node shows:
- Controller name
- Port number + device type icon
- Current state (if readable)
- Last command sent (if any)

---

## 10. Template System

### 10.1 Built-in Gallery

Pre-configured templates for common scenarios:
- "VPD Control" - Exhaust fan responds to VPD range
- "Lights Out Routine" - Sequence of actions at lights-off time
- "Heat Spike Response" - Emergency cooling when temp exceeds threshold
- "Humidity Control" - Humidifier/dehumidifier coordination

### 10.2 Personal Templates

Users can:
- Save any workflow as personal template
- Export templates as JSON
- Import templates from JSON file

### 10.3 Template Application

When applying template:
1. Show template preview
2. Prompt to map template controllers → user's controllers
3. Create new workflow from template with user's devices

---

## 11. Build Priority

| Priority | Feature | Rationale |
|----------|---------|-----------|
| 1 | F3 - DelayNode | Enables sequenced automations |
| 2 | F9 - Hysteresis on sensor triggers | Prevents flapping |
| 3 | F2 - Device tree in palette | Visual device selection |
| 4 | F11 - Conflict detection | Safety before scaling |
| 5 | F4 - Variable nodes | Complex logic patterns |
| 6 | F8 - MQTT trigger wiring | Cross-manufacturer unlock |
| 7 | F7 - Template system | User retention + sharing |

---

## 12. Core Value Proposition

**EnviroFlow solves what AC Infinity can't: cross-manufacturer sensor triggers controlling AC Infinity devices.**

- **Phase 1:** AC Infinity sensors → AC Infinity device control (prove the workflow builder)
- **Phase 2:** Inkbird/Ecowitt/MQTT sensors → AC Infinity control (the unlock)

---

## Summary

This PRD defines a **Node-RED inspired visual automation builder** for EnviroFlow that:

1. Shows connected AC Infinity devices as draggable nodes in an expandable tree
2. Adds **Delay** and **Variable** nodes for complex flows
3. Implements **hysteresis** on sensor triggers to prevent rapid cycling
4. Detects and **blocks conflicting workflows** targeting the same device port
5. Enables **save/name/duplicate** for reusable automations
6. Provides a **template gallery** with built-in and personal templates
7. Wires **MQTT sensors** as trigger sources for cross-manufacturer automation
8. Exports/imports workflows as JSON

**Build order:** Delay → Hysteresis → Device tree → Conflict detection → Variables → MQTT triggers → Templates
