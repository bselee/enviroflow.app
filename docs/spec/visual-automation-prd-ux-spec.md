I would like to review and explore the automatin programming and scheduling features. When a user adds a controller, any sensors and connected, controlled devices are able to be added to an automation flow to be used as triggerrs or a trggered device. When a user adds a sensor (create add sensor only flow) then it would be available as a trigger for users in automation work flow creation. Please clearly plan out# UX Specification: EnviroFlow Visual Automation

**Source PRD:** `visual-automation-prd.md`
**Autonomy Level:** L5 - Execute (with L4 decision logic)
**Primary Data Sources:** Supabase (workflows, activity_logs, controllers), AC Infinity Cloud API (live sensors + device control), MQTT brokers (cross-manufacturer sensors)

---

## Pass 1: Mental Model

**Autonomy level:** L5 - Execute
**User role at this level:** Supervisor — monitors autonomous execution, intervenes when needed

**Primary user intent:** "I want my grow environment to automatically respond to conditions without me constantly checking, but I need to stay in control and understand what's happening."

**Existing mental model (from current tools):**

| Tool | What Users Expect | How EnviroFlow Differs |
|------|-------------------|----------------------|
| AC Infinity App | Per-device modes (AUTO, VPD, TIMER). Simple threshold → action. | EnviroFlow adds cross-device logic, delays, variables, multi-step flows |
| Home Assistant | When/And/Then automations. Device state visibility. | Similar structure but visual canvas instead of YAML, simpler setup |
| Node-RED | Drag-and-drop nodes, wires, debug/trace. | Same paradigm, but domain-specific nodes (Sensor, Dimmer, Mode) |
| Spreadsheets | IF(temp > 82, "fan on", "fan off"). Predictable. | Same logic, but automated execution instead of reference |

**Likely misconceptions:**

1. **"Real-time execution"** — Users expect instant response when sensor crosses threshold. Reality: 1-minute cron cycle means up to 60-second delay.
   - *Mitigation:* Show "Checks every 60 seconds" in trigger node. First-time tooltip on activation.

2. **"Unlimited commands"** — Users may create many sensor-triggered workflows. Reality: ~30 commands/min per user, ~60 reads/min per AC Infinity account.
   - *Mitigation:* ✅ Implemented: RateLimitIndicator shows rate limit when approaching limits. Warning during workflow activation if combined active workflows could exceed.

3. **"Workflows are independent"** — Users won't realize two workflows targeting the same port conflict. Reality: Conflicting workflows block each other.
   - *Mitigation:* ✅ Implemented: Pre-activation conflict check. Red "Conflict" badge. ✅ Implemented: Clear resolution flow via ConflictResolutionModal.

4. **"Delay pauses everything"** — Users may think a delay node stops all workflows. Reality: Only that workflow's execution path pauses; others continue.
   - *Mitigation:* Delay node tooltip: "This workflow waits here. Other workflows continue normally."

5. **"The sensor value is live"** — Users see a number in the properties panel and assume it's real-time. Reality: Sensors update every 15 seconds via polling.
   - *Mitigation:* Show "as of X seconds ago" next to sensor values.

6. **"EnviroFlow replaces AC Infinity modes"** — Users may think workflows override AC Infinity native programming. Reality: Both can run simultaneously, potentially conflicting.
   - *Mitigation:* ✅ Implemented: Show current AC Infinity mode on device nodes. Warn if workflow targets a port with an active native mode.

**Key unlock: Cross-controller automation (F10)**

Users from AC Infinity app expect per-controller sensor→device pairing. EnviroFlow enables: Controller 1 sensor → Controller 2 device action.

**UX signal:** Device tree shows ALL controllers as drag targets regardless of sensor source.

**First-use tooltip:** "Connect any sensor to any device across all your controllers."

**Autonomy-specific concerns:**

| Concern | User Thinking | UX Response |
|---------|---------------|-------------|
| Trust | "How do I know it ran?" | ✅ Implemented: Activity log with timestamps, execution trace |
| Control | "What if it goes wrong at 2am?" | 🎯 Designed: Push notifications on failure, emergency pause |
| Predictability | "What will this workflow do?" | ✅ Implemented: Dry-run/test button (DryRunPreview), execution preview |
| Accountability | "Why did my fan turn off?" | ✅ Implemented: Execution history showing which node, which sensor value, which rule |
| Intervention | "I need to stop this NOW" | ✅ Implemented: Pause workflow button, always accessible |
| Coexistence | "Will this fight with my AC Infinity settings?" | ✅ Implemented: Native mode visibility, conflict warnings |

**UX principle to reinforce:** The system executes autonomously within user-defined boundaries. Users are supervisors, not operators. Every autonomous action must be: (1) visible after the fact, (2) explainable with specific data, (3) stoppable at the workflow level.

---

## Pass 2: Information Architecture

**All user-visible concepts:**

| Concept | Category | Data Source | Refresh Rate |
|---------|----------|-------------|--------------|
| Workflow definition | Entity | Supabase `workflows` | On save/load |
| Workflow status | Status | Supabase `workflows.is_active` + conflict check | On load + mutation |
| Node configuration | Entity | Supabase `workflows.nodes` JSONB | On save/load |
| Edge connections | Entity | Supabase `workflows.edges` JSONB | On save/load |
| Controller list | Entity | Supabase `controllers` | On page load |
| Controller ports | Entity | `/api/controllers/[id]/capabilities` | On page load + 5-min cache |
| Port current state (ON/OFF, level) | Metric | AC Infinity API via capabilities | On load + 30s polling |
| Native AC Infinity mode | Metric | AC Infinity API via `/api/controllers/[id]/modes` | On load + 30s polling |
| Live sensor readings | Metric | AC Infinity API via `/api/sensors/live` | 15s polling |
| Execution history | Log | Supabase `activity_logs` | On demand + after execution |
| Delay countdown | Metric | Calculated from `resume_after` timestamp | Every second (client-side) |
| Rate limit usage | Metric | In-memory rate limiter | Real-time (per request) |
| Workflow conflicts | Alert | Calculated from active workflow port targets | On workflow activation |
| Templates (built-in) | Entity | ✅ Implemented: Static JSON bundled with app | Static |
| Templates (personal) | Entity | 🔄 Planned: Supabase (future) | On demand |
| MQTT broker connection | Status | 🔄 Planned: MQTT adapter | On connect + heartbeat |
| MQTT topic subscriptions | Entity | 🔄 Planned: Workflow config | On save/load |
| Hysteresis state | Status | Runtime execution state | Per execution cycle |
| Debounce cooldown | Status | Runtime execution state | Per execution cycle |
| Variable values | Metric | Supabase `workflow_variables` | On read/write |

**Grouped structure:**

### Node Palette (workflow builder floating overlay)

✅ **Implementation note:** Palette is rendered as a floating Panel positioned "top-left" on the canvas, NOT as a fixed left column.

| Concept | Visibility | Rationale |
|---------|------------|-----------|
| **Triggers** (Schedule, Sensor, Manual) | Primary — always visible | Entry point for all workflows |
| **Sensors** (Sensor node) | Primary — always visible | Most common condition source |
| **Logic** (Condition AND/OR) | Primary — always visible | Core building blocks |
| **Actions** (Device Control, Dimmer) | Primary — always visible | Main output mechanism |
| **Flow Control** (Delay, Debounce, Variable) | Secondary | Advanced users; not every workflow needs these |
| **Device Programming** (Mode, Verified Action, Port Condition) | Secondary | Power user / AC Infinity-specific features |
| **Notifications** (Notification node) | Primary | Alert delivery mechanism |

### Device Tree (within Node Palette)

✅ **Implemented:** Device tree shows live controller/port data

**Note:** Port state [ON 80%] shown in palette for workflow context. Native mode programming (AUTO/VPD/TIMER/CYCLE/SCHEDULE) is on the Controllers page ONLY, not in the workflow builder.

| Concept | Visibility | Rationale |
|---------|------------|-----------|
| Controller name + online/offline indicator | Primary | Must know status before dragging |
| Port list (nested under controller) | Primary | What users actually drag to canvas |
| Port device type icon + name | Primary | Quick identification |
| Port current state [ON 80%] / [OFF] | Primary | ✅ Implemented: Context for workflow building |
| Built-in sensor (Temp/Humidity/VPD) | Primary | Common trigger source |
| Controller offline = dimmed, not draggable | Primary | Prevents building flows against unreachable devices |

### Canvas (workflow builder center)

✅ **Implemented:** React Flow canvas with snap-to-grid, mini-map

| Concept | Visibility | Rationale |
|---------|------------|-----------|
| Placed nodes with type-specific styling | Primary | Core editing surface |
| Edge connections between nodes | Primary | Defines flow |
| Node selection highlight | Primary | Shows what's being edited |
| Snap-to-grid (16px) | Hidden (automatic behavior) | ✅ Implemented: Clean alignment without user effort |
| Zoom controls + mini-map | Secondary (corner controls) | ✅ Implemented: Large workflow navigation |

### Properties Panel (workflow builder — rendered in page, not within WorkflowBuilder)

✅ **Implementation note:** Properties panel is rendered as a sibling to the canvas in the page component, appearing as a right-side panel when a node is selected.

| Concept | Visibility | Rationale |
|---------|------------|-----------|
| Selected node's configuration form | Primary | Main editing surface for node settings |
| Sensor threshold + operator | Primary | Core condition config |
| Hysteresis settings (trigger + re-arm) | Primary (when sensor node selected) | ✅ Implemented: Prevents flapping — must be easy to configure |
| Live sensor reading | Secondary (below config) | Debugging aid, not primary input |
| "Last updated X seconds ago" | Secondary (inline) | Builds trust in sensor data |

### Activity Panel (workflow builder bottom or tab)

✅ **Implemented:** Activity log entries stored in `activity_logs` table

| Concept | Visibility | Rationale |
|---------|------------|-----------|
| Recent execution entries | Primary | Trust-building — "yes, it's working" |
| Execution status (success/failed/skipped) | Primary | Quick health check |
| Timestamp | Primary | Recency context |
| Execution node trace (expandable) | Secondary | Debugging — which nodes ran, with what values |
| Error messages | Primary (when error exists) | Requires immediate attention |

### Controllers Page (native mode display)

✅ **Implemented:** Mode programming panel exists as DeviceModeProgramming component

| Concept | Visibility | Rationale |
|---------|------------|-----------|
| Mode badge (AUTO/VPD/TIMER/CYCLE/SCHEDULE) | Primary | Quick identification of current programming |
| Mode-specific summary | Primary | "75-85°F, 50-65% RH" at a glance |
| "Program Mode" action | Secondary (menu item) | Not frequent; available when needed |
| Color-coded mode badges | Primary | Visual differentiation: AUTO=Blue, VPD=Purple, TIMER=Amber, CYCLE=Cyan, SCHEDULE=Green |

### Template Gallery

✅ **Implemented:** Built-in templates exist, gallery component exists

🔄 **Planned:** Personal templates, full mapping wizard

| Concept | Visibility | Rationale |
|---------|------------|-----------|
| Template name + description | Primary | What this template does |
| Template preview (node graph) | Primary | Visual understanding before applying |
| "Built-in" vs "Personal" filter | Primary | Two distinct sources |
| Device mapping requirements | Secondary (shown on select) | What devices the template needs |

**Cross-source relationships:**

| Relationship | Sources Involved | Conflict Potential |
|--------------|------------------|-------------------|
| Sensor threshold vs live reading | AC Infinity API + Workflow config | Low — display only |
| Port state vs action target | AC Infinity API + Action node config | Medium — stale state possible (30s lag) |
| Multiple workflows → same port | Supabase workflows (computed) | High — ✅ Implemented: explicit conflict detection required |
| Native AC Infinity mode vs workflow action | AC Infinity API + Workflow config | High — both can control the same port |
| Template devices vs user devices | Template JSON + User's controllers | High — 🎯 Designed: mapping wizard required |
| MQTT topic vs sensor type | 🔄 Planned: MQTT broker + Workflow config | Low — user explicitly maps |

**Data provenance decisions:**

- **Show source label:** Sensor readings (AC Infinity badge), 🔄 Planned: MQTT sensors (MQTT badge)
- **Show last-updated timestamp:** All sensor readings in properties panel, execution log entries
- **Show confidence/state indicator:** Hysteresis state ("Triggered"/"Re-armed" badge), Debounce state ("Cooling down"/"Ready")

---

## Pass 3: Affordances

### User Actions

| Action | Consequence Level | Visual/Interaction Signal |
|--------|-------------------|---------------------------|
| Drag node from palette to canvas | Safe | ✅ Implemented: Drag cursor, drop preview shadow, snap to grid |
| Drag port from device tree to canvas | Safe | ✅ Implemented: Same as above; creates pre-configured action/sensor node |
| Connect nodes with edge | Safe | ✅ Implemented: Draggable handle, animated connection preview, snap to valid targets |
| Edit node properties | Safe | ✅ Implemented: Form inputs in properties panel, changes saved on blur/enter |
| Delete node (draft workflow) | Safe | X button on hover, no confirmation needed |
| Delete node (active workflow) | Consequential | 🎯 Designed: X button + warning "This workflow is active" |
| Save workflow | Safe | ✅ Implemented: Standard button, toast confirmation |
| Name/rename workflow | Safe | ✅ Implemented: Inline text field |
| Duplicate workflow | Safe | ✅ Implemented: Creates new draft copy with " (Copy)" suffix |
| **Activate workflow** | **Consequential** | ✅ Implemented: Toggle switch → green "Active" state. ✅ Implemented: Pre-activation conflict check. Toast: "Workflow activated — checking every 60 seconds" |
| Pause workflow | Safe | ✅ Implemented: Toggle switch → paused state. Immediate stop of execution. |
| **Manual trigger ("Run Now")** | **Consequential** | ✅ Implemented: ManualTriggerButton - distinct button (not the toggle). Shows "Running..." then result toast. |
| **Delete workflow** | **Destructive** | ✅ Implemented: DeleteWorkflowDialog - Menu item (not primary button). Confirmation modal with workflow name. |
| Pause active delay | Consequential | 🎯 Designed: Pause icon on delay node countdown. Extends wait indefinitely until resumed. |
| **Resolve conflict** | **Consequential** | ✅ Implemented: ConflictResolutionModal - Modal with side-by-side comparison. Choose which workflow keeps Active. |
| Export workflow as JSON | Safe | ✅ Implemented: Download button, instant download |
| Import workflow from JSON | Safe (creates draft) | ✅ Implemented: File picker → validation → creates inactive draft |
| Apply template | Consequential | 🎯 Designed: Multi-step wizard: preview → device mapping → create draft |
| Save workflow as template | Safe | ✅ Implemented: SaveAsTemplateDialog - Menu item → name/description dialog → saved to personal templates |
| Export template as JSON | Safe | 🎯 Designed: Download from template card |
| Import template from JSON | Safe | 🎯 Designed: File picker → validation → added to personal templates |
| **Program AC Infinity mode** | **Consequential** | ✅ Implemented: Opens mode config panel. Changes sent to AC Infinity API immediately. Confirmation toast with undo (5s window). |

### System Actions (L5 autonomy visibility)

| System Action | User Visibility | Override Affordance |
|---------------|-----------------|---------------------|
| Cron evaluates workflow | ✅ Implemented: Activity log entry with timestamp | Pause workflow to prevent future evaluations |
| Sensor threshold crossed | ✅ Implemented: Sensor node shows "Triggered" badge in execution trace | Wait for hysteresis re-arm, or pause workflow |
| Command sent to device | ✅ Implemented: Activity log: "Set Port 1 to Speed 8" with timestamp | No undo (committed). Can send counter-command manually. |
| Delay countdown started | ✅ Implemented: Timer on delay node: "Resuming in 4:32" | 🎯 Designed: Click to pause or cancel delay |
| Rate limit hit | 🎯 Designed: Toast: "Commands queued" + indicator with queue count | Wait for reset (shows countdown) |
| Workflow blocked by conflict | ✅ Implemented: Red "Conflict" badge + notification | 🎯 Designed: Resolve via conflict modal |
| Verified action failed | 🎯 Designed: Activity log with failure + auto-rollback note | Automatic rollback if configured; manual retry available |
| Execution halted mid-flow | 🎯 Designed: Push notification + "Failed" badge | View error, edit workflow, manual retry |
| Debounce cooldown active | ✅ Implemented: "Cooling down" indicator on debounce node | Wait for cooldown to expire |
| Multi-action execution | 🎯 Designed: "Sending 2 of 5 commands..." progress | Auto-throttle 1s between commands |

**Affordance rules:**

1. **Green "Active" badge** → ✅ Implemented: workflow executes automatically on cron
2. **Yellow "Paused" badge** → ✅ Implemented: workflow will not execute
3. **Red "Conflict" badge** → ✅ Implemented: both conflicting workflows are blocked from executing
4. **System-initiated actions** use a clock/cron icon; **user-initiated actions** show user context
5. **Consequential actions** (activate, manual trigger, program mode) require single click + clear visual feedback (not a modal, but a distinct state change)
6. **Destructive actions** (delete) require explicit confirmation with the workflow name typed or displayed

**Reversibility signals:**

| State | Reversible? | Signal |
|-------|-------------|--------|
| Draft workflow (unsaved) | Yes | "Unsaved changes" dot indicator |
| Saved workflow (inactive) | Yes | Can edit freely, no consequences |
| Active workflow | Partial | 🎯 Designed: Auto-pause for editing; changes take effect on next cron cycle |
| Command sent to device | No | "Sent at HH:MM" in log. No undo button. Can send counter-command. |
| Delay in progress | Yes | 🎯 Designed: Pause/cancel button on delay node |
| AC Infinity mode programmed | Partial | ✅ Implemented: 5-second undo toast after mode change |
| Conflict blocking | Yes | 🎯 Designed: Resolve by choosing which workflow to keep active |

---

## Pass 4: Cognitive Load

**Volume context:**
- Expected: 10-50 workflows per user, 5-20 active simultaneously
- Each workflow: 3-10 nodes typically
- Executions: potentially hundreds/day with many sensor triggers
- AC Infinity modes: 5 mode types × N ports to potentially configure

**Friction points:**

| Moment | Type | Location | Simplification |
|--------|------|----------|----------------|
| Choosing which node type | Choice | Node palette | ✅ Implemented: Category grouping with icons. Tooltip descriptions on hover. 🎯 Designed: Search box for 12+ nodes. |
| Configuring sensor threshold | Choice | Properties panel | 🎯 Designed: Show current reading next to threshold input. Suggest common values based on sensor type. |
| Understanding hysteresis vs debounce | Uncertainty | Sensor/Debounce node config | 🎯 Designed: Inline help: "**Hysteresis** = sensor oscillates around threshold (temp bouncing 81-83°F around 82°F trigger). Use to prevent flapping. **Debounce** = trigger fires correctly but too frequently (sensor crosses threshold every cron cycle). Use for cooldown periods." Side-by-side comparison diagram. |
| Configuring hysteresis band | Uncertainty | Sensor node properties | ✅ Implemented: `resetThreshold` field. 🎯 Designed: Visual mini-diagram showing trigger zone and re-arm zone with current reading marker |
| MQTT topic syntax | Uncertainty | 🔄 Planned: MQTT trigger config | Input with examples: "home/sensor/#", validation on blur, "Test Connection" button |
| JSONPath payload conditions | Uncertainty | 🔄 Planned: MQTT trigger config | Example payloads from last received message, visual JSONPath builder |
| Mapping template devices | Choice | 🎯 Designed: Template wizard | Smart auto-match by device type + room, show "3 of 4 matched" confidence, manual override for unmatched |
| AC Infinity mode programming | Choice | ✅ Implemented: Mode config panel | Pre-fill with current values. Group by mode type. Show what each setting does. |
| Trusting workflow execution | Trust | Before/after activation | 🎯 Designed: "Test Run" button for dry-run. Execution preview showing expected behavior. |
| Understanding rate limits | Uncertainty | During heavy usage | 🎯 Designed: Proactive warning at 70% capacity. Show "24/30 commands used, resets in 45s" |
| Debugging why workflow didn't fire | Uncertainty | After expected execution | ✅ Implemented: Activity log shows "Skipped: temperature 78°F below threshold 82°F" |
| Many workflows, which ones matter? | Volume | Workflow list | ✅ Implemented: Filter by: Active/Paused/Failed. Sort by: Last run, Name, Room. Search. |
| Resolving conflicts | Choice | Conflict alert | 🎯 Designed: Side-by-side comparison of conflicting workflows. Clear "Keep this one" / "Keep other" buttons. |
| Delay node + cron interaction | Uncertainty | During delay | ✅ Implemented: Help text: "Workflow pauses here. Resumes on the first cron cycle after the timer completes (~60s precision)." |

**Defaults introduced:**

| Default | Rationale | Override Visibility |
|---------|-----------|---------------------|
| Hysteresis enabled (5-unit band below trigger) | ✅ Implemented: Prevents flapping; most sensor triggers need this | Toggle + custom value in sensor node properties |
| Delay unit = minutes | ✅ Implemented: Most delays are 1-30 minutes | Dropdown selector: seconds, minutes, hours |
| Debounce cooldown = 60 seconds | ✅ Implemented: Reasonable default for most triggers | Number input in debounce node |
| Notification channel = push | 🎯 Designed: Universally available | Multi-select: push, email, SMS |
| Verified action retries = 3 | 🎯 Designed: Balances reliability and speed | Number input |
| Workflow starts as Draft (inactive) | ✅ Implemented: Prevents accidental autonomous execution | Must explicitly toggle Active |
| Template auto-match by type + room | 🎯 Designed: Reduces manual mapping effort | Manual override available for each device |

**Batch handling strategy:**

- **Review individually:** New workflow creation, conflict resolution, mode programming
- **Review by exception:** Active workflows list (filter to "Failed" or "Blocked" status)
- **Auto-process:** 🎯 Designed: Template device mapping (auto-matched devices don't need review)

**Trust-building elements:**

| System Action | Trust Signal |
|---------------|--------------|
| Sensor threshold evaluation | "Current: 78°F. Threshold: 82°F. Status: Below threshold." |
| Hysteresis state | ✅ Implemented: Plain text "Reset at: 77°F". 🎯 Designed: Mini-diagram: "Trigger at 82°F ▲ / Re-arm at 77°F ▼. Currently: re-armed." |
| Workflow execution | ✅ Implemented: Activity log: "12:34:05 — Sensor checked: 84°F > 82°F → Triggered → Set Fan Speed 8 → Success" |
| Template device matching | 🎯 Designed: "3 of 4 devices auto-matched (by type + room). 1 needs manual selection." |
| Delay countdown | ✅ Implemented: Live timer: "Resuming in 4:32 (~12:38 PM)" |
| Rate limit status | 🎯 Designed: "24/30 commands used this minute. Resets in 45s." |
| Dry-run result | 🎯 Designed: "Test complete: Would set Port 1 to Speed 8 (not actually sent)" |

---

## Pass 5: State Design

### Workflow States (lifecycle)

✅ **Implemented:** `is_active` boolean toggle (Active/Inactive only)

🎯 **Designed:** Execution states beyond Active/Inactive (Executing, Failed, Blocked, Draft states in UI)

| State | User Sees | User Understands | User Can Do | Auto-transition? |
|-------|-----------|------------------|-------------|------------------|
| Draft (new/unsaved) | Gray "Draft" badge | Not saved, not executing | Edit, save | No |
| Inactive (saved) | No badge or subtle "Inactive" | ✅ Implemented: Saved but won't execute | Edit, activate, delete, duplicate, export | No |
| Active | Green "Active" badge | ✅ Implemented: Executing on cron every 60s | Pause, view activity, 🎯 Designed: edit (auto-pauses) | No |
| Executing | 🎯 Designed: Green pulsing animation on card | Cron is evaluating this workflow right now | View progress, stop (if delay/queue) | Yes → Success or Failed |
| Success (last run) | ✅ Implemented: Green checkmark in activity log | Last execution completed normally | View trace | No |
| Failed (last run) | ✅ Implemented: Red X in activity log + notification | Last execution had errors | View error, edit, retry | No |
| Blocked (conflict) | ✅ Implemented: Red "Conflict" badge (detection only) | 🎯 Designed: Two workflows target same port; neither executes | Resolve conflict | No (requires user action) |
| Sensor Error | 🎯 Designed: Yellow "Sensor Error" badge | Sensor unreachable, workflow auto-paused | View error, check connection, resume when sensor recovers | No |

**Auto-pause behavior (ALIGNED WITH PRD):**

PRD states: "Auto-pause during edit, require re-activate."

🎯 **Designed:** Editing an active workflow AUTO-PAUSES it. User sees: "Workflow paused for editing. Re-activate when done." (Yellow banner at top of builder canvas, dismisses only when user re-activates or navigates away).

### Node States (canvas editing)

✅ **Implemented:** 10 node types registered: trigger, sensor, condition, action, dimmer, notification, mode, delay, variable, debounce

**Note:** VerifiedActionNode and PortConditionNode exist but are NOT registered in nodeTypes.

| State | User Sees | User Understands | User Can Do |
|-------|-----------|------------------|-------------|
| Default | Normal node styling | Configured and ready | Edit properties, connect |
| Selected | Color-matched ring/glow | Currently being edited | Edit in properties panel |
| Unconfigured | 🎯 Designed: Orange warning dot | Needs configuration before workflow can save | Click to configure |
| Validation error | 🎯 Designed: Red border + error icon | Invalid configuration (e.g., threshold not a number) | Fix in properties panel |
| Connected | Filled handles (source/target) | Wired into the flow | Add more connections |
| Disconnected | 🎯 Designed: Hollow handles + subtle warning | Won't execute (not in flow) | Connect to other nodes, or delete |
| Hover | Header bar appears with delete X | Can be removed | Click X to delete |

### Node States (execution visualization)

🎯 **Designed:** Execution visualization on nodes (no pulsing, checkmarks, timers during execution currently implemented)

| State | User Sees | User Understands |
|-------|-----------|------------------|
| Pending | Dim/gray node | Execution hasn't reached this node yet |
| Evaluating | Pulsing border | Currently being processed |
| Passed (condition true) | Green checkmark overlay | Condition evaluated true, flow continues |
| Failed (condition false) | Red X overlay | Condition evaluated false, flow stopped/branched |
| Executed (action sent) | Green checkmark + "Sent" label | Command was sent to device |
| Skipped | Gray skip icon | Branch not taken (e.g., false path of condition) |
| Error | Red warning triangle | Execution failed at this node (API error, timeout, etc.) |
| Waiting (delay) | Countdown timer overlay | Paused here, will resume after timer |

### Delay Node States

✅ **Implemented:** DelayNode with configurable duration (seconds/minutes/hours)

🎯 **Designed:** Countdown timer UI, pause/cancel buttons

**Backend state mapping to PRD state machine:**

| UI State | Backend State | Description |
|----------|---------------|-------------|
| Configured | PENDING | Not yet reached in execution |
| Waiting | WAITING | `resume_after` timestamp stored |
| Ready | READY | Timer elapsed, awaiting cron |
| Executed | EXECUTED | Downstream nodes processed |
| Paused | WAITING+manual_flag | User intervention |

| State | User Sees | User Understands | User Can Do |
|-------|-----------|------------------|-------------|
| Configured | Duration text "5 minutes" | How long it will wait when reached | Edit duration |
| Waiting | 🎯 Designed: Countdown "3:42 remaining" + estimated resume time | Actively waiting | Pause, cancel |
| Paused (by user) | 🎯 Designed: "Paused" badge, timer frozen | Delay suspended until user resumes | Resume or cancel |
| Ready | 🎯 Designed: "Ready — resuming on next check" | Timer finished, waiting for next cron cycle | Wait (auto-transitions) |
| Executed | Checkmark + "Waited 5 minutes" | Delay completed, downstream nodes processed | View timing in log |

### Debounce Node States

✅ **Implemented:** DebounceNode with cooldown duration config

| State | User Sees | User Understands | User Can Do |
|-------|-----------|------------------|-------------|
| Ready | "Ready" — no cooldown active | Will pass through next trigger | Configure cooldown |
| Cooling down | "Cooldown: 45s remaining" | Recently triggered, blocking re-triggers | Wait |
| Blocked | "Blocked — cooldown active" | Trigger attempted during cooldown, ignored | Wait for cooldown |

### Rate Limit States

✅ **Implemented:** Rate limit library exists (`rate-limit.ts`) with sliding window algorithm

🎯 **Designed:** Rate limit enforcement in control routes (library exists but not wired to routes), rate limit warning UI

| State | User Sees | User Understands | User Can Do |
|-------|-----------|------------------|-------------|
| Healthy (<70%) | No indicator | Plenty of capacity | Proceed normally |
| Warning (70-99%) | ✅ Implemented: RateLimitIndicator - Yellow indicator "21/30 commands" | Approaching limit | Reduce activity or wait |
| Limited (100%) | ✅ Implemented: RateLimitIndicator - Red indicator "30/30 — commands queued" | Commands delayed until reset | Wait, view queue |
| Reset | Brief green flash, counter resets | Limit window refreshed | Proceed |

### Controller States (device tree)

✅ **Implemented:** Device tree shows controller online/offline status

| State | User Sees | User Understands | User Can Do |
|-------|-----------|------------------|-------------|
| Online | Green dot, normal styling, draggable | Controller reachable, ports available | Drag ports to canvas |
| Offline | Gray dot, dimmed text, not draggable | Controller not responding | Tooltip: "Controller offline — check connection" |
| Error | Red dot, warning icon | Connection issue | View error details |

### Data Freshness States

| Data Element | Fresh (<15s) | Stale (15s-5m) | Unavailable |
|--------------|-------------|----------------|-------------|
| Sensor reading (properties panel) | Normal display | Yellow "2:34 ago" timestamp | "Last known: 78°F" + red "Stale" badge |
| Port state (device tree) | "[ON 80%]" | "[ON 80%] ?" with tooltip | "[Unknown]" dimmed |
| Activity log entries | Normal display | Normal (historical) | "Failed to load" + retry link |
| MQTT sensor data | 🔄 Planned: Normal display | Yellow "No data in Xs" | "Disconnected" + reconnect prompt |

### Conflict States

✅ **Implemented:** Conflict detection hook exists, red warning badge shows on conflicts

🎯 **Designed:** Conflict resolution modal

| State | User Sees | User Understands | User Can Do |
|-------|-----------|------------------|-------------|
| No conflict | Nothing | All workflows are independent | Proceed |
| Conflict detected (on activation) | 🎯 Designed: Modal: "Conflict: This workflow and 'VPD Control' both target Port 2 on Controller 1" | Can't have both active | Choose: keep this, keep other, or cancel activation |
| Conflict blocking (both somehow active) | ✅ Implemented: Red "Conflict" badge on both workflow cards | Neither will execute until resolved | Pause one to unblock the other |
| Conflict resolved | Toast: "Conflict resolved — [Workflow name] is now active" | One workflow active, other paused | Normal operation |

### Native Mode States (Controllers page)

✅ **Implemented:** ModeNode exists for workflows, DeviceModeProgramming panel exists

🎯 **Designed:** Mode programming panel on Controllers page (ModeNode exists for workflows, but no dedicated Controllers page panel)

| State | User Sees | User Understands | User Can Do |
|-------|-----------|------------------|-------------|
| Mode loaded | Color badge: "AUTO 75-85°F" | Current AC Infinity programming | Open mode config to change |
| Mode updating | Spinner on badge | Change being sent to AC Infinity | Wait |
| Mode updated | Updated badge + success toast (5s undo) | ✅ Implemented: Programming changed | Undo within 5 seconds |
| Mode update failed | Error toast + previous mode restored | Change failed | Retry or check connection |
| No mode data | Gray "Unknown" badge | Can't read mode from controller | Check controller connection |

---

## Pass 6: Flow Integrity

**Flow risks:**

| Risk | Where | Mitigation |
|------|-------|------------|
| User activates conflicting workflows | Activation toggle | ✅ Implemented: Pre-activation conflict check scans all active workflows for port overlap. 🎯 Designed: Modal with resolution options. |
| User edits active workflow | Edit action on active workflow | 🎯 Designed: Auto-pause banner: "Workflow auto-paused for editing. Re-activate when you're done." (Yellow bg-warning/10 bar at top of builder canvas, dismisses only when user re-activates) |
| User doesn't understand 1-min cron delay | First activation | 🎯 Designed: Onboarding tooltip: "Workflows check conditions every 60 seconds." Activation toast includes this info. |
| User creates unconnected nodes | Save button | ✅ Implemented: Validation warning: "X nodes are not connected to the flow and won't execute." Allow save anyway (they may be in-progress). |
| User forgets hysteresis, sensor flaps | Sensor threshold config | ✅ Implemented: Hysteresis enabled by default with resetThreshold field. 🎯 Designed: Toggle clearly labeled. Visual diagram in properties. |
| User confuses hysteresis and debounce | Both available as nodes | 🎯 Designed: Inline help text with use-case examples. Palette descriptions clarify use case. |
| Rate limit hit unexpectedly | High-activity period | 🎯 Designed: Proactive warning at 70%. Queue visibility. Toast with reset countdown. |
| Delay node confuses workflow timing | After creating delay | ✅ Implemented: Help text: "Workflow pauses here. Resumes on the next cron check after timer expires (~60s precision)." |
| Template doesn't match user's devices | Template import | 🎯 Designed: Device mapping wizard shows auto-matched + unmatched. Can't proceed with unmatched devices. |
| MQTT topic wrong, no data arrives | 🔄 Planned: MQTT trigger config | "Test Connection" button. Show last received message. Validation on subscription. |
| Native mode conflicts with workflow | Both controlling same port | ✅ Implemented: Workflow device node shows current native mode badge. Warning: "This port is programmed to AUTO mode on the controller." |
| User returns after time away | Stale state | 🎯 Designed: Auto-refresh activity log on page focus. "Updated X seconds ago" indicator. Push notifications for failures. |
| Workflow fails overnight, user unaware | Overnight execution | 🎯 Designed: Push notification on failure. "Failed" badge persists on workflow card until acknowledged. |

**Intervention points (L5 autonomy):**

| Automation Step | Can User Intervene? | How | Window |
|-----------------|---------------------|-----|--------|
| Cron trigger evaluation | No | Already evaluated | Instantaneous |
| Sensor threshold check | No | Already evaluated | Instantaneous |
| Condition evaluation | No | Already evaluated | Instantaneous |
| Pre-delay (before delay node reached) | Yes | Pause workflow | Any time before execution reaches delay |
| During delay countdown | Yes | 🎯 Designed: Pause/cancel on delay node | Duration of the delay |
| Pre-action (before command sent) | Limited | Stop execution if caught | ~1 second window |
| Post-action (command sent) | No | Command committed to AC Infinity | Already sent |
| During verification retries | Yes | 🎯 Designed: Cancel retries | During retry attempts (~3-9 seconds) |
| Rate-limited command queue | Yes | 🎯 Designed: View queue, remove pending | Until command dequeued and sent |
| Debounce cooldown | No | Automatic timer | Cooldown period |

**Re-entry handling:**

| If User Returns During... | They See... | They Can... |
|---------------------------|-------------|-------------|
| Active delay countdown | ✅ Implemented: Timer on delay node: "2:18 remaining" + estimated resume time | 🎯 Designed: Pause, cancel, or wait |
| Rate-limited queue | 🎯 Designed: Indicator: "3 commands queued, next in 12s" | Wait, or view queue details |
| Conflict blocking | ✅ Implemented: Red "Conflict" badge on affected workflows + 🎯 Designed: banner alert | 🎯 Designed: Resolve conflict |
| Post-execution (success) | ✅ Implemented: Latest activity log entry with green checkmark | View execution trace |
| Post-execution (failure) | ✅ Implemented: Red "Failed" badge on workflow card + notification badge | View error, edit workflow, retry |
| MQTT disconnected | 🔄 Planned: "MQTT Disconnected" on relevant trigger nodes | Check broker connection |
| Overnight failures | 🎯 Designed: Notification badge with count + failed workflow badges | Review failures, fix, re-enable |

**Template Application Flow (F7 - 3-step wizard):**

🎯 **Designed:**

**Step 1: Template Gallery**
- Browse templates (built-in + personal)
- Select template → Preview modal showing node graph
- "Apply Template" button

**Step 2: Device Mapping Wizard**
- Auto-match by device type + room
- Show "3 of 4 devices auto-matched" confidence indicator
- Manual override dropdown for unmatched devices
- Table format: Template Device | Type | Auto-Match | Your Device
- "Swap" button to override auto-match

**Step 3: Create Workflow**
- "Create Workflow" button
- New inactive draft workflow with mapped devices
- Opens in builder for further customization

**Visibility decisions:**

**Must be visible at all times:**
- ✅ Implemented: Workflow status badge (Active/Paused/Blocked/Failed with `is_active` boolean)
- ✅ Implemented: Delay countdown timer (when active)
- ✅ Implemented: Conflict indicators (red badge)
- 🎯 Designed: Rate limit warnings (when >70%)
- Last execution time + status on workflow cards
- Error messages and failure reasons

**Can be implied (don't need persistent UI):**
- Successful routine executions (logged but not announced)
- Node connection validity (validated on save, not continuously)
- Cron timing (every 60 seconds is background behavior)
- Healthy rate limit status (<70%)

**Must be hidden until needed (progressive disclosure):**
- Detailed execution trace (expandable in activity log)
- Rate limit numbers (only show when warning)
- Template source JSON (only for export)
- Raw AC Infinity API responses
- 🔄 Planned: MQTT raw payloads (show parsed values)
- Variable values (show in variable node, not globally)

**UX constraints for visual phase (non-negotiable):**

1. Conflict resolution is a **modal**, not inline — consequences too high for casual dismiss
2. Rate limit indicator **cannot be dismissed** once triggered — must remain visible until reset
3. Delay countdown is **client-side real-time** — not server-polled
4. Workflow status badge colors are **fixed semantic colors** — ✅ Implemented: Green=active, Yellow=paused, Red=blocked/failed (using `bg-success/10`, `bg-warning/10`, `bg-destructive/10` Tailwind classes)
5. Activity feed must support **filtering by status and workflow** — volume can be high
6. Template wizard is **multi-step** — device mapping is too complex for a single dialog
7. Hysteresis must include a **visual diagram** — ✅ Implemented: Plain text "Reset at: X". 🎯 Designed: Visual diagram insufficient with text alone
8. Controller offline **blocks port dragging** — grayed out with tooltip
9. Node validation errors **surface before save** — red borders + summary count
10. Native AC Infinity mode badge is **read-only on the workflow canvas** — editable only on Controllers page

---

## Visual Specifications

### Screen Inventory

| Screen | Route | Purpose |
|--------|-------|---------|
| Automations List | `/automations` | Browse, filter, manage all workflows |
| Workflow Builder | `/automations/builder/[id]` | ✅ Implemented: Create/edit workflow on canvas |
| Template Gallery | 🎯 Designed: Modal from Automations List | Browse built-in + personal templates |
| Template Wizard | 🎯 Designed: Multi-step modal | Map template devices → user devices |
| Conflict Resolution | 🎯 Designed: Modal from activation | Choose which workflow to keep active |
| Execution Detail | 🎯 Designed: Slide-over from activity log | Full trace of a workflow run |
| Mode Programming | ✅ Implemented: Panel on Controllers page | Configure AC Infinity native modes |

### Layout Specifications

**Current Implementation vs. Designed Spec:**

✅ **Implemented:** Floating palette overlay + canvas + properties panel (rendered in page, not fixed column)

🎯 **Designed:** Three-column layout specification below is the TARGET design, not current implementation.

| Breakpoint | Layout | Implementation Status |
|------------|--------|---------------------|
| Desktop (>1024px) | 🎯 Designed: Three-column: Palette (250px fixed left) / Canvas (flex center) / Properties (300px fixed right) | ✅ Current: Floating palette (Panel position="top-left") + Canvas (flex-1) + Properties (sibling in page, right side when node selected) |
| Tablet (768-1024px) | 🎯 Designed: Two-column: Palette (drawer, toggle) / Canvas (full) / Properties (slide-over from right) | 🎯 Zero responsive breakpoints implemented |
| Mobile (<768px) | 🎯 Designed: Single column: Workflow list only, "Edit on desktop" prompt for builder | 🎯 Zero responsive breakpoints implemented |

### Component Specifications

**Device Tree Palette:**

✅ **Implemented:** Device tree with live controller/port data showing [ON 80%] state

- Collapsible accordion sections per controller
- Green/gray/red dot for online/offline/error status
- Nested port list: icon + name + state badge "[ON 80%]"
- Built-in sensor entries: Temp/Humidity/VPD per controller
- Drag handle cursor on hover (online controllers only)
- Offline controllers: dimmed, cursor: not-allowed, tooltip explains

**Workflow Status Badge:**

✅ **Implemented:** Semantic color classes exist in Tailwind config

- Green `bg-success/10 text-success` — "Active"
- Yellow `bg-warning/10 text-warning` — "Paused"
- Red `bg-destructive/10 text-destructive` — "Conflict" or "Failed" (🎯 Designed: pulsing for conflict)
- Gray `bg-muted text-muted-foreground` — "Draft" or "Inactive"

**Delay Node (enhanced):**

✅ **Implemented:** DelayNode with duration config

🎯 **Designed:** Visual enhancements below

- Default: Shows configured duration "5 minutes"
- Waiting: Large countdown timer centered "3:42" + estimated resume "~12:38 PM"
- Pause/Cancel buttons visible only during countdown
- Completed: Past tense "Waited 5 minutes" with checkmark

**Debounce Node:**

✅ **Implemented:** DebounceNode with cooldown config

🎯 **Designed:** Visual enhancements below

- Default: Shows cooldown duration "60s cooldown"
- Cooling down: Countdown "45s remaining" with subtle pulse
- Ready: "Ready" label, no countdown

**Variable Node:**

✅ **Implemented:** VariableNode with set/get/increment/decrement operations, workflow and global scope

🎯 **Designed:** Visual specifications below

- **Canvas display:** Variable name + current value + scope badge (Workflow/Global)
- **Properties:** Operation selector (Set/Get/Increment/Decrement), variable name, value type (number/string/boolean), scope toggle

**Hysteresis Visualizer (in sensor node properties):**

✅ **Implemented:** SensorNode has hysteresis config with resetThreshold field (PLAIN TEXT "Reset at: X", no visual diagram)

🎯 **Designed:** Visual diagram below

- Horizontal range showing trigger point (red line) and re-arm point (green line)
- Current sensor value as a marker/arrow on the range
- Color zones: Green (below re-arm), Yellow (between re-arm and trigger), Red (above trigger)
- Labels: "Re-arm: 77°F" and "Trigger: 82°F" and "Current: 78°F"
- State label: "Currently: re-armed" or "Currently: triggered"

**Conflict Alert Banner:**

✅ **Implemented:** Conflict detection hook exists, red warning badge shows on conflicts

🎯 **Designed:** Banner UI below

- Red banner at top of builder when editing a conflicting workflow
- Text: "This workflow conflicts with [other workflow name] on [Port X, Controller Y]"
- "Resolve" button opens conflict resolution modal
- Cannot be dismissed while conflict exists

**Auto-Pause Banner:**

🎯 **Designed:**

- Yellow bg-warning/10 bar at top of builder canvas
- Text: "Workflow auto-paused for editing. Re-activate when you're done."
- "Re-activate" button on right
- Dismisses only when user explicitly re-activates or navigates away

**Rate Limit Indicator:**

✅ **Implemented:** Rate limit library exists (`rate-limit.ts`) with sliding window algorithm

🎯 **Designed:** UI below (library exists but not wired to routes)

- Appears only when usage > 70%
- Horizontal progress bar with "21/30 commands"
- Red fill when at 100%: "30/30 — 3 commands queued"
- Countdown to reset: "Resets in 45s"
- Position: Bottom-right toast area or status bar

**Execution Trace (expandable in activity log):**

✅ **Implemented:** Activity log entries stored in `activity_logs` table

🎯 **Designed:** Visual enhancements below

- Timeline/list view of node execution steps
- Each step: timestamp, node name, node type icon, result (checkmark/X/skip)
- Expandable detail: sensor value at evaluation, threshold compared against, command sent
- Duration per step shown inline
- Failed step highlighted with red background

**Template Device Mapper (wizard step):**

✅ **Implemented:** Built-in templates exist, TemplateGallery component exists

🎯 **Designed:** Device mapping wizard below (template system is 🔄 Planned in PRD)

- Table: Template Device | Type | Auto-Match | Your Device
- Auto-matched rows: green checkmark, pre-filled dropdown
- Unmatched rows: yellow warning, empty dropdown requiring selection
- Header: "3 of 4 devices auto-matched"
- Dropdowns show only compatible devices (same type)
- "Swap" button to override auto-match

**MQTT Trigger Config (in properties panel):**

🔄 **Planned:** MQTT trigger wiring (F8 in PRD)

- Broker URL input with "Test Connection" button
- Topic input with wildcard syntax help: "# = all, + = single level"
- "Last received" preview showing recent MQTT message
- JSONPath condition builder: path input + operator + value
- Example: `$.temperature` `>` `82`

**Native Mode Badge (Controllers page):**

✅ **Implemented:** ModeNode exists, DeviceModeProgramming panel exists

🎯 **Designed:** Mode programming panel on Controllers page (ModeNode exists for workflows, but no dedicated Controllers page panel UI specified)

- Colored pill badge on device cards
- AUTO=Blue, VPD=Purple, TIMER=Amber, CYCLE=Cyan, SCHEDULE=Green
- Badge text: mode name + key parameter summary
- Example: `VPD 0.8-1.2 kPa` or `AUTO 75-85°F`
- Click opens mode programming panel

**Mode Programming Panel:**

✅ **Implemented:** DeviceModeProgramming component exists

🎯 **Designed:** UX specifications below

- Slide-over or modal on Controllers page
- Mode selector: OFF | AUTO | VPD | TIMER | CYCLE | SCHEDULE
- Per-mode config forms:
  - **AUTO:** temp/humidity triggers + levels
  - **VPD:** VPD thresholds + levels
  - **TIMER:** on/off duration
  - **CYCLE:** repeating intervals
  - **SCHEDULE:** day/time picker
- Save sends to AC Infinity API immediately
- 5-second undo toast

**Test Run Button:**

🎯 **Designed:**

- Location: Builder toolbar, next to Save button
- Opens "Test Run" dialog
- For sensor triggers: input mock sensor value
- Shows execution trace preview without sending commands
- Result: "Would set Port 1 to Speed 8 (not sent)"

### Typography Hierarchy

🎯 **Designed:**

- **H1:** Page titles (Automations, Controllers)
- **H2:** Section headers (Active Workflows, Templates)
- **H3:** Card titles (workflow names)
- **Body:** Standard content
- **Caption:** Timestamps, metadata, freshness indicators
- **Mono:** Sensor values, thresholds, MQTT topics

### Spacing System

🎯 **Designed:**

- **Component padding:** 16px (cards, panels)
- **Section gap:** 24px
- **Element gap:** 8px (form fields, list items)
- **Canvas grid:** ✅ Implemented: 16px snap

### Error Message Patterns

🎯 **Designed:**

- **Toast:** Transient feedback (save success, activation confirmation)
- **Banner:** Persistent warnings (active workflow editing, conflict blocking)
- **Inline:** Field validation (threshold not a number, name required)
- **Push notification:** Off-screen events (overnight failure, rate limit hit)

### Data Display Patterns

**Source indicators:**

✅ **Implemented:** AC Infinity as primary data source

🎯 **Designed:**

- AC Infinity: Small blue badge icon on sensor/device data
- 🔄 Planned: MQTT: Small purple badge icon on MQTT sensor data
- Calculated: Small gray badge on derived values (VPD computed from temp+humidity)

**Freshness indicators:**

🎯 **Designed:**

- "Live" (no indicator) for data < 15s old
- "Xs ago" gray text for data 15-60s old
- Yellow "Stale — X:XX ago" for data > 60s old
- Red "Unavailable" for data > 5 minutes old or connection lost

**Confidence indicators:**

✅ **Implemented:** Hysteresis state tracking

🎯 **Designed:**

- Sensor node: threshold state badge "Below threshold" / "Above threshold" / "Triggered" / "Re-armed"
- Execution preview: "Will trigger if sensor reaches X"
- Template match: "Auto-matched by type + room" or "Manual selection required"

### Interaction Specifications

**Drag and drop (node creation):**

✅ **Implemented:**

- Source: Palette items (node types) or device tree items (ports/sensors)
- Target: Canvas
- Feedback: Ghost preview at cursor position, snap to grid on drop
- Port drag creates pre-configured node: dragging "Port 1: Exhaust Fan" creates an ActionNode pre-filled with that controller + port

**Edge creation:**

✅ **Implemented:**

- Click source handle → drag to target handle
- Animated dashed line preview during drag
- Valid targets highlighted (glow effect)
- Invalid connections silently rejected (output→output, creating cycle)

**Node selection:**

✅ **Implemented:**

- Single click: Select, show properties panel
- Shift+click: Add to multi-selection
- Drag box on canvas: Multi-select
- Backspace/Delete: Delete selected node(s)
- Escape: Deselect all

**Canvas navigation:**

✅ **Implemented:**

- Pan: Click+drag on canvas background, or two-finger trackpad
- Zoom: Scroll wheel or pinch gesture
- Fit view: Button in bottom-left controls
- Mini-map: Toggle in bottom-right corner

### Responsive Considerations

🎯 **Designed:** Zero responsive breakpoints implemented

| Breakpoint | Layout | Notes |
|------------|--------|-------|
| Desktop (>1024px) | Three-column: Palette (250px) / Canvas (flex) / Properties (300px) | Activity log as collapsible bottom panel |
| Tablet (768-1024px) | Two-column: Palette (drawer, toggle) / Canvas (full) | Properties as slide-over from right edge |
| Mobile (<768px) | Single column: Workflow list only | "Edit on desktop" prompt for builder. Activity log viewable. |

---

## PRD Feature Coverage Matrix

| PRD Feature | Pass 1 | Pass 2 | Pass 3 | Pass 4 | Pass 5 | Pass 6 | Visual Spec | Implementation Status |
|-------------|--------|--------|--------|--------|--------|--------|-------------|---------------------|
| F1 - Canvas | - | Node Palette, Canvas groups | Drag/connect actions | Node choice friction | Node editing states | - | Palette, canvas layout | ✅ Implemented: React Flow canvas, snap-to-grid, mini-map |
| F2 - Device nodes | Mental model: device tree | Device Tree group | Port drag affordance | - | Controller online/offline states | Native mode conflict risk | Device Tree Palette component | ✅ Implemented: Device tree with live [ON 80%] state |
| F3 - Delay node | Misconception: "pauses everything" | - | Pause/cancel affordance | Delay+cron confusion | Delay states (5 states) | Intervention during delay | Delay Node component | ✅ Implemented: DelayNode with duration config. 🎯 Designed: Countdown timer UI |
| F4 - Variables | - | Properties panel | Safe editing | - | - | - | Variable Node specs | ✅ Implemented: VariableNode with set/get/increment/decrement, workflow/global scope |
| F5 - Save workflows | - | - | Safe action | - | Draft/Inactive states | - | - | ✅ Implemented: Save to Supabase workflows table |
| F6 - Duplicate | - | - | Safe action | - | - | - | - | 🎯 Designed: One-click copy |
| F7 - Templates | - | Template Gallery group | Apply = consequential | Device mapping friction | - | Template mapping flow risk | Template Wizard, Device Mapper | ✅ Implemented: Built-in templates, TemplateGallery. 🔄 Planned: Personal templates, full mapping wizard (PRD) |
| F8 - MQTT triggers | - | MQTT Config group | - | Topic syntax friction | MQTT data freshness | MQTT disconnect risk | MQTT Trigger Config | 🔄 Planned: MQTT trigger wiring (PRD F8) |
| F9 - Hysteresis | Misconception: sensor flapping | - | - | Hysteresis understanding | Hysteresis state (Triggered/Re-armed) | Forgetting hysteresis risk | Hysteresis Visualizer | ✅ Implemented: SensorNode with resetThreshold field (plain text). 🎯 Designed: Visual diagram |
| F10 - Cross-controller | Core value prop unlock | Cross-source relationships | - | - | - | - | - | ✅ Implemented: Any sensor can trigger any device across all controllers |
| F11 - Conflict detection | Misconception: independent workflows | Cross-source relationships | Resolve = consequential | Conflict resolution friction | Conflict states (4 states) | Pre-activation check risk | Conflict Alert Banner | ✅ Implemented: Conflict detection hook, red badge. 🎯 Designed: Resolution modal |
| F12 - Debounce | - | - | - | Hysteresis vs debounce confusion | Debounce states (3 states) | - | Debounce Node component | ✅ Implemented: DebounceNode with cooldown config |
| F13 - Mode display | Misconception: replaces AC Infinity | Controllers Page group | Read-only on canvas | - | Native Mode states | Mode conflicts with workflow | Native Mode Badge | ✅ Implemented: ModeNode exists, mode programming panel exists |
| F14 - Mode programming | - | Controllers Page group | Consequential action | Mode option complexity | Mode update states | - | Mode Programming panel | ✅ Implemented: DeviceModeProgramming panel with full AC Infinity mode access |

**Legend:**
- ✅ Implemented: Exists in codebase today
- 🎯 Designed: UX specified in this document, not yet built
- 🔄 Planned: In PRD roadmap, minimal UX detail in this spec

---

## Summary

This UX specification defines the complete user experience for EnviroFlow's visual automation system, covering:

1. **10 node types** (✅ implemented: trigger, sensor, condition, action, dimmer, notification, mode, delay, variable, debounce)
2. **Device tree palette** with live controller/port state (✅ implemented: [ON 80%] display)
3. **Cross-controller automation** (✅ implemented: any sensor → any device)
4. **Hysteresis on sensor triggers** (✅ implemented: resetThreshold field; 🎯 designed: visual diagram)
5. **Delay nodes** with pause/resume (✅ implemented: duration config; 🎯 designed: countdown timer UI)
6. **Variable nodes** for workflow state (✅ implemented: set/get/increment/decrement, workflow/global scope)
7. **Debounce nodes** for cooldown periods (✅ implemented: cooldown config)
8. **Conflict detection** for same-port workflows (✅ implemented: detection hook, red badge; 🎯 designed: resolution modal)
9. **Native AC Infinity mode programming** (✅ implemented: ModeNode, DeviceModeProgramming panel)
10. **Template system** (✅ implemented: built-in templates; 🔄 planned: personal templates, full mapping wizard)
11. **MQTT sensor triggers** (🔄 planned: F8 in PRD)

**Key UX principles:**
- L5 autonomy with supervisor control
- Every action explainable with specific data
- Trust-building through activity logs and execution traces
- Conflict prevention over conflict resolution
- Progressive disclosure for advanced features
- Direct API polling for sensor data (NOT Supabase Realtime subscriptions)

**Current implementation gaps:**
- Rate limit UI (library exists, not wired to routes)
- Conflict resolution modal (detection exists, no resolution flow)
- Responsive breakpoints (zero implemented)
- Dry-run/test button
- Full template mapping wizard (built-in templates exist)
- MQTT trigger support (planned)

**Sensor polling rate:** 15 seconds (not 15-30s)

**Cron execution rate:** 60 seconds (1-minute cycle)
