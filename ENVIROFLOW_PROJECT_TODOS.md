# EnviroFlow - Structured Project Todo List
**Date:** January 24, 2026
**Status:** Post-MVP Enhancement Planning
**Version:** 1.0

---

## PROJECT OVERVIEW

**Current State:** MVP complete with core features operational
- 4-step controller onboarding wizard (4 brands live, 2 in development)
- Real-time sensor monitoring via WebSocket with 30s polling fallback
- Device control with rate limiting (10 commands/min)
- Workflow automation with dry-run testing
- AI insights via GROK API

**Objective:** Enhance user experience through controller management improvements, advanced sensor visualization, device scheduling, and expanded integrations.

**Success Metrics:**
1. Reduce controller onboarding time from 8 minutes → 3 minutes (guided tour + smart defaults)
2. Achieve 95% controller connection success rate on first attempt (better error guidance)
3. Expand integrations from 4 to 6 supported brands (Govee, MQTT)
4. Enable bulk operations reducing multi-device management time by 60%
5. Implement device scheduling allowing 100% automation coverage

---

## ARCHITECTURE NOTES

**Key Patterns:**
- Types centralized in `/apps/web/src/types/index.ts`
- Adapters implement `ControllerAdapter` interface in `apps/automation-engine/lib/adapters/`
- Credentials encrypted server-side (AES-256-GCM) before DB storage
- Realtime subscriptions via Supabase (tables: controllers, sensor_readings, automation_actions, ai_insights)
- Custom hooks return `{ data, loading, error, ...mutations }` pattern
- Demo mode fallback when unauthenticated

**Current Adapters:**
- ✓ ACInfinityAdapter (2 connection methods)
- ✓ InkbirdAdapter (cloud API)
- ✓ CSVUploadAdapter (manual data)
- ✓ EcowittAdapter (4 connection methods: push, TCP, HTTP, cloud)
- 🚧 MQTTAdapter (stub exists)
- ❌ GoveeAdapter (coming soon)

---

## DEPENDENCY MAP

### Phase Dependencies

```
FOUNDATION (Phase 1) ════════════════════════════════════════
├─ Onboarding UX (TASK-001 → 003)
├─ Error Guidance (TASK-004 → 008)
└─ Health Monitoring (TASK-009 → 011)
      ↓
PHASE 1 REVIEW (TASK-012) ✓ Checkpoint
      ↓
ENHANCEMENT (Phase 2) ══════════════════════════════════════
├─ Bulk Operations (TASK-013 → 016)
├─ Sensor Analytics (TASK-017 → 021)
└─ Device Scheduling (TASK-022 → 026)
      ↓
PHASE 2 REVIEW (TASK-027) ✓ Checkpoint
      ↓
INTEGRATION (Phase 3) ══════════════════════════════════════
├─ Govee Integration (TASK-028 → 032)
├─ MQTT Framework (TASK-033 → 037)
├─ Home Assistant (TASK-038 → 040)
└─ Discovery Enhancement (TASK-041 → 043)
      ↓
PHASE 3 REVIEW (TASK-044) ✓ Checkpoint
      ↓
LAUNCH (Phase 4) ══════════════════════════════════════════
├─ E2E Testing (TASK-045 → 047)
├─ Performance (TASK-048 → 050)
└─ Documentation (TASK-051 → 053)
      ↓
PHASE 4 REVIEW (TASK-054) ✓ Final Checkpoint
```

**Critical Path:** TASK-001 → TASK-012 → TASK-013 → TASK-027 → TASK-028 → TASK-044 → TASK-054
**Estimated Duration:** 12-16 weeks (with 2-3 person team)

---

## PHASE 1: FOUNDATION - ONBOARDING & ERROR RECOVERY
**Duration:** 3 weeks | **Effort:** 80 hours | **Priority:** P1-Blocking

---

### SECTION 1A: First-Time User Onboarding

**TASK-001: Design Interactive Onboarding Tour Component**
- **Type:** Spec / Code
- **Effort:** 6 hrs
- **Priority:** P1-Blocking
- **Assigned:** coder (with architectural input)
- **Depends On:** None
- **Acceptance Criteria:**
  - [ ] Tour component shows 5 progressive steps: Dashboard Overview → Sensor Monitoring → Device Control → Automation Basics → Next Steps
  - [ ] Persists completion state in localStorage (dismiss, restart available)
  - [ ] Non-intrusive: appears once on first login, can be re-triggered from Help menu
  - [ ] Responsive: works on mobile/tablet (60%+ of onboarding happens mobile)
  - [ ] Analytics: tracks which steps users skip (identify friction)
- **Deliverable:** `/apps/web/src/components/OnboardingTour.tsx` component with state management
- **Resources:**
  - Similar patterns: Vercel, Figma onboarding flows
  - UI Kit: shadcn Popover + custom overlay
  - State: localStorage + context to prevent re-renders
- **Unblocks:** TASK-002, TASK-003

**TASK-002: Implement Contextual Tooltips & Help System**
- **Type:** Code
- **Effort:** 5 hrs
- **Priority:** P1-Blocking
- **Assigned:** coder
- **Depends On:** TASK-001
- **Acceptance Criteria:**
  - [ ] Tooltips on: controller name, credentials fields, room assignment, device ports
  - [ ] Help icon triggers modal with detailed explanation + external link (video/docs)
  - [ ] Tooltips adjust position on mobile to stay visible
  - [ ] Keyboard accessible (Tab through, Enter to expand)
  - [ ] Emoji/icons make content scannable (room 🏠, temp 🌡️)
- **Deliverable:** `TooltipProvider.tsx` context + updated wizard components
- **Resources:**
  - shadcn Tooltip, Popover components
  - Help content centralized in `/apps/web/src/lib/help-content.ts`
- **Unblocks:** TASK-003

**TASK-003: Add Smart Defaults & Room Suggestion**
- **Type:** Code
- **Effort:** 4 hrs
- **Priority:** P1-Blocking
- **Assigned:** coder
- **Depends On:** TASK-002
- **Acceptance Criteria:**
  - [ ] Controller name auto-fills with brand + model (e.g., "AC Infinity Controller 69")
  - [ ] If user has 1 room: pre-select it; if 0 rooms: show "Create New" with guided setup
  - [ ] Smart room suggestion on step 3: if temp/humidity controller → suggest "Grow Room", climate → "Ambient"
  - [ ] Timezone auto-detects from browser geolocation API (with fallback to manual)
  - [ ] All defaults can be overridden before submission
- **Deliverable:** Updated `/apps/web/src/app/controllers/wizard/page.tsx` with smart defaults
- **Resources:**
  - Browser geolocation API
  - Room name suggestions: `/apps/web/src/lib/room-suggestions.ts`
- **Unblocks:** TASK-004

---

### SECTION 1B: Error Recovery & Connection Guidance

**TASK-004: Expand Error Guidance System with Connection Diagnostics**
- **Type:** Code
- **Effort:** 6 hrs
- **Priority:** P1-Blocking
- **Assigned:** coder
- **Depends On:** TASK-003
- **Acceptance Criteria:**
  - [ ] Errors classified into 5 categories: Credentials, Network, Device Offline, API Rate Limit, Server Error
  - [ ] Each error shows: plain-language explanation + actionable next step + retry button
  - [ ] For credentials errors: link to "Reset Password" page + verification steps
  - [ ] For network errors: show controller discovery troubleshooting guide + device status check
  - [ ] For offline devices: suggest checking WiFi + show last seen time
  - [ ] Error messages logged to activity_logs table with user_id for support team analysis
- **Deliverable:** Enhanced `ErrorGuidance.tsx` with categorization + activity logging
- **Resources:**
  - Extend `/apps/web/src/lib/error-guidance.ts`
  - Activity log hooks in `/apps/web/src/hooks/`
- **Unblocks:** TASK-005, TASK-006

**TASK-005: Add Automatic Retry Logic with Exponential Backoff**
- **Type:** Code
- **Effort:** 4 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-004
- **Acceptance Criteria:**
  - [ ] Connection test retries 3x with exponential backoff (2s, 4s, 8s)
  - [ ] User sees progress: "Attempt 1/3: Connecting to cloud API..."
  - [ ] Failed retry shows: which specific step failed (DNS lookup? authentication?)
  - [ ] Supabase/cloud API errors distinguished from device errors
  - [ ] Retry state persists in query cache (no repeated calls on re-mount)
- **Deliverable:** `useRetry()` hook in `/apps/web/src/hooks/`
- **Resources:**
  - Existing retry logic in `/apps/automation-engine/lib/adapters/retry.ts` (reference)
- **Unblocks:** TASK-007

**TASK-006: Implement Connection Health Check & Status Indicator**
- **Type:** Code
- **Effort:** 5 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-004
- **Acceptance Criteria:**
  - [ ] Controller card shows status dot: green (online) | yellow (stale >1h) | red (offline)
  - [ ] Hover tooltip shows: "Last seen 5 minutes ago" or "offline for 2 hours"
  - [ ] Dashboard shows aggregated metric: "3/5 controllers online"
  - [ ] Click status → opens connection diagnostics panel
  - [ ] Real-time updates via Supabase subscription on controllers.status
- **Deliverable:** `ControllerStatusIndicator.tsx` + updated `ControllerCard.tsx`
- **Resources:**
  - Supabase realtime subscriptions (controllers table)
  - Existing polling logic in cron routes
- **Unblocks:** TASK-009

**TASK-007: Create Brand-Specific Connection Guides**
- **Type:** Spec + Config
- **Effort:** 3 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-005
- **Acceptance Criteria:**
  - [ ] Each brand has troubleshooting guide: `/docs/controller-guides/[brand].md`
  - [ ] Guides include: prerequisites checklist, screenshot walkthrough, common errors
  - [ ] In-app: modal shown when connection fails with brand-specific tips
  - [ ] AI hint system: GROK analyzes error → suggests brand-specific solution
  - [ ] Guide content maintainable by non-developers (markdown format)
- **Deliverable:**
  - `/docs/controller-guides/{ac_infinity,inkbird,ecowitt,csv_upload}.md`
  - Config in `/apps/web/src/lib/brand-guides.ts`
  - UI in brand-specific modals
- **Resources:**
  - Brand API documentation (AC Infinity, Inkbird cloud APIs)
  - Existing setup docs in `/docs/`
- **Unblocks:** TASK-008

**TASK-008: Add Credential Recovery & Revalidation**
- **Type:** Code
- **Effort:** 4 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-007
- **Acceptance Criteria:**
  - [ ] "Update Credentials" button on offline controllers
  - [ ] Modal shows current credentials (masked) + form to re-enter
  - [ ] On submit: re-test connection + show result (success/error with guidance)
  - [ ] If successful: update encrypted credentials in DB + reset status to 'online'
  - [ ] Audit log entry: "User updated credentials for Controller X" (security)
  - [ ] Failed attempts throttled: max 5 per hour per controller
- **Deliverable:** `CredentialUpdateModal.tsx` + API route `/api/controllers/[id]/credentials`
- **Resources:**
  - Server-side encryption in `/apps/web/src/lib/server-encryption.ts` (existing)
- **Unblocks:** TASK-011

---

### SECTION 1C: Proactive Health Monitoring

**TASK-009: Implement Controller Health Scoring System**
- **Type:** Code
- **Effort:** 5 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-006
- **Acceptance Criteria:**
  - [ ] Health score (0-100) combines 4 metrics: uptime % (40%) + sensor freshness (30%) + error rate (20%) + sync lag (10%)
  - [ ] Displayed on controller card + dashboard summary
  - [ ] Score calculated in cron job (runs hourly) + cached in new `controller_health` table
  - [ ] Schema migration adds: `controller_health(controller_id, score, metrics_snapshot, calculated_at)`
  - [ ] Emoji indicators: 🟢 (90+) 🟡 (70-89) 🔴 (<70)
  - [ ] Triggers alert if score drops suddenly (>20 point drop in 1 hour)
- **Deliverable:**
  - Type definitions in `/apps/web/src/types/index.ts`
  - Scoring logic: `/apps/web/src/lib/health-scoring.ts`
  - Cron endpoint: `/api/cron/health-check`
  - Component: `ControllerHealthCard.tsx`
- **Resources:**
  - Sensor readings table (last_update timestamp)
  - Activity logs (error_message analysis)
- **Unblocks:** TASK-010, TASK-011

**TASK-010: Add Connection Quality Metrics & Network Diagnostics**
- **Type:** Code
- **Effort:** 4 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-009
- **Acceptance Criteria:**
  - [ ] Diagnostics panel shows: response time (ms) | packet loss % | sync lag (seconds) | API call success rate
  - [ ] Color-coded ranges: green <500ms, yellow 500-1000ms, red >1000ms
  - [ ] Run diagnostic button: pings controller + collects metrics + shows report
  - [ ] Historical chart: 7-day connection quality trend
  - [ ] Recommendations: "Try reconnecting" | "Check WiFi signal" | "Contact support"
- **Deliverable:** `ControllerDiagnosticsPanel.tsx` + diagnostic utility functions
- **Resources:**
  - Existing connection logs in activity_logs
  - Response time metrics tracked in API routes
- **Unblocks:** None (parallel to TASK-011)

**TASK-011: Create Proactive Alerts for Connection Issues**
- **Type:** Code
- **Effort:** 3 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-009
- **Acceptance Criteria:**
  - [ ] Alert triggers if: offline >30 min | 3+ consecutive failed commands | health score <50
  - [ ] User gets: push notification + in-app banner + email (digest)
  - [ ] Alert includes quick action: "Reconnect Now" | "View Diagnostics"
  - [ ] Duplicate suppression: max 1 alert per controller per hour
  - [ ] User can snooze alerts (12/24/48 hours)
  - [ ] Alerts table: tracks when/why/status for analytics
- **Deliverable:**
  - Alert logic: `/apps/web/src/lib/alerting.ts`
  - Cron trigger: `/api/cron/check-alerts`
  - Notification service integration
- **Resources:**
  - Supabase push notifications (VAPID keys already in env)
  - Alert preferences: extend users table or create alerts_settings table
- **Unblocks:** Nothing (Phase 1 concludes here)

---

### REVIEW CHECKPOINT: Phase 1

**TASK-012: Code Review - Phase 1: Onboarding & Error Recovery**
- **Type:** Review
- **Effort:** 2 hrs
- **Priority:** P1-Blocking
- **Assigned:** code-auditor
- **Depends On:** TASK-003, TASK-008, TASK-011
- **Review Scope:**
  - [ ] All new components follow shadcn patterns (consistent spacing/colors)
  - [ ] Error messages are user-friendly (no stack traces)
  - [ ] Accessibility: keyboard nav, ARIA labels, color contrast
  - [ ] Performance: no unnecessary re-renders, lazy loading where needed
  - [ ] Security: credentials never logged/exposed, XSS prevention
  - [ ] TypeScript: all types strict, no `any`
  - [ ] Tests: unit tests for health scoring, error classification
  - [ ] Activity logging: all user actions tracked for support
- **Acceptance Criteria:**
  - All blocking issues resolved
  - Code merged to main
  - Changelog updated with Phase 1 features
- **Unblocks:** Phase 2 (TASK-013+)

---

## PHASE 2: ENHANCEMENT - BULK OPERATIONS & ANALYTICS
**Duration:** 4 weeks | **Effort:** 120 hours | **Priority:** P2-High

---

### SECTION 2A: Bulk Controller Operations

**TASK-013: Design Bulk Selection UI Pattern**
- **Type:** Code
- **Effort:** 4 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-012
- **Acceptance Criteria:**
  - [ ] Controllers page has "Select All" checkbox + individual row checkboxes
  - [ ] Bulk actions bar appears when 1+ selected: "Delete" | "Assign to Room" | "Update Name" | "Test Connection"
  - [ ] Visual feedback: rows highlighted, count shown ("3 of 8 selected")
  - [ ] Keyboard support: Shift+Click to select range, Cmd/Ctrl+A for all
  - [ ] Responsive: mobile shows toggle for bulk mode (checkboxes take space)
  - [ ] State persists during page interaction (not cleared on sort/filter)
- **Deliverable:** `BulkActionBar.tsx` + updated `ControllersList.tsx`
- **Resources:**
  - Checkbox state management: useState or zustand
  - shadcn Button, Checkbox components
- **Unblocks:** TASK-014, TASK-015, TASK-016

**TASK-014: Implement Bulk Assign to Room**
- **Type:** Code
- **Effort:** 3 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-013
- **Acceptance Criteria:**
  - [ ] Modal shows room dropdown + preview of selected controllers
  - [ ] On confirm: updates all selected controllers' room_id
  - [ ] Shows progress: "Assigning 3 controllers..." with count
  - [ ] Optimistic UI: controllers move to room immediately (rollback on error)
  - [ ] Activity log: single entry "User assigned 3 controllers to Grow Room"
  - [ ] Error handling: if 1 fails, show which controller + allow retry
- **Deliverable:** `BulkAssignModal.tsx` + API batch operation
- **Resources:**
  - API route: batch update endpoint `/api/controllers/batch-update`
- **Unblocks:** None (parallel to TASK-015)

**TASK-015: Add Bulk Connection Test**
- **Type:** Code
- **Effort:** 3 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-013
- **Acceptance Criteria:**
  - [ ] Button: "Test Connections" runs in parallel (all at once)
  - [ ] Shows progress: "Testing 5 controllers... 3 completed"
  - [ ] Results table: controller | status (✓/✗) | response time | action (Retry/Update Credentials)
  - [ ] Summary: "4 online, 1 offline. View diagnostics?"
  - [ ] Batch test results logged for analysis
  - [ ] Timeout per controller: 30s max
- **Deliverable:** `BulkTestModal.tsx` + batch test logic
- **Resources:**
  - Parallel requests with Promise.all()
  - Queue limiting to avoid overwhelming adapters
- **Unblocks:** None (parallel to TASK-016)

**TASK-016: Implement Bulk Delete with Confirmation**
- **Type:** Code
- **Effort:** 2 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-013
- **Acceptance Criteria:**
  - [ ] Confirmation modal: "Delete 3 controllers? This cannot be undone."
  - [ ] Shows controllers being deleted
  - [ ] Checkbox: "Also delete associated sensor data" (off by default, data archived 30 days first)
  - [ ] On delete: removes from controllers + cascade deletes workflows/schedules
  - [ ] Activity log: "User deleted 3 controllers"
  - [ ] Success notification: "3 controllers deleted"
- **Deliverable:** `BulkDeleteModal.tsx` + cascade delete logic
- **Resources:**
  - Cascade delete rules defined in DB schema
  - Soft delete pattern for sensor data (archive before hard delete)
- **Unblocks:** Nothing critical

---

### SECTION 2B: Advanced Sensor Analytics

**TASK-017: Implement Custom Date Range Selection**
- **Type:** Code
- **Effort:** 4 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-012
- **Acceptance Criteria:**
  - [ ] Sensor chart has date picker: quick select (Last 7 days | 30 days | 90 days) + custom range
  - [ ] Preset buttons: "Today" | "This Week" | "This Month" | "YTD"
  - [ ] Custom range: date from/to inputs + timezone consideration
  - [ ] Persists selection in URL params (shareable reports)
  - [ ] Chart auto-reloads with new data on range change
  - [ ] Mobile: date picker collapses to single popup
  - [ ] Loads progressively (show skeleton while data fetches)
- **Deliverable:** `DateRangePicker.tsx` component
- **Resources:**
  - shadcn Calendar component + custom wrapper
  - Date utility: date-fns library
  - URL param handling: useSearchParams hook
- **Unblocks:** TASK-018, TASK-019, TASK-020

**TASK-018: Add Heatmap Visualization for Sensor Trends**
- **Type:** Code
- **Effort:** 6 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-017
- **Acceptance Criteria:**
  - [ ] New chart type: 2D heatmap showing temp/humidity by time-of-day across 7 days
  - [ ] X-axis: hour (0-23) | Y-axis: day of week
  - [ ] Color intensity: value range (cool blue = low, warm red = high)
  - [ ] Hover: shows exact value + count of readings
  - [ ] Toggleable: switch between heatmap/line chart
  - [ ] Export: download as PNG
  - [ ] Mobile: swappable to table view (heatmap too dense on phone)
- **Deliverable:** `SensorHeatmap.tsx` component using Recharts or D3
- **Resources:**
  - Recharts heatmap recipe or custom D3 implementation
  - Color scale libraries: `chroma.js` or Recharts gradients
- **Unblocks:** TASK-019

**TASK-019: Implement Sensor Correlation Analysis**
- **Type:** Code
- **Effort:** 5 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-018
- **Acceptance Criteria:**
  - [ ] New dashboard card: "Sensor Correlations"
  - [ ] Shows pairs: temperature vs humidity, VPD vs CO2 (all combinations available)
  - [ ] Visualization: scatter plot with regression line + correlation coefficient (R²)
  - [ ] Color points by time of day (shows if pattern changes AM/PM)
  - [ ] Insight: "Strong positive correlation (0.92): Higher temp → Higher humidity"
  - [ ] Export data: CSV with calculated coefficients
  - [ ] Note: requires min 50 readings for valid correlation
- **Deliverable:** `SensorCorrelationAnalysis.tsx`
- **Resources:**
  - Simple Linear Regression library or implement Pearson correlation
  - Recharts scatter plot
- **Unblocks:** TASK-021

**TASK-020: Add Export Functionality (CSV/JSON/PDF)**
- **Type:** Code
- **Effort:** 4 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-017
- **Acceptance Criteria:**
  - [ ] Export button on sensor charts: CSV | JSON | PDF
  - [ ] CSV: columns = timestamp, temp, humidity, vpd, co2, light (all selected sensors)
  - [ ] JSON: structured with metadata (date range, controller, export time)
  - [ ] PDF: includes chart images + summary stats + correlation tables
  - [ ] Filename: `enviroflow_sensors_[controllername]_[startdate]_[enddate].csv`
  - [ ] Downloads trigger: no server round-trip (client-side generation)
  - [ ] Large exports (>100k rows): warn user about browser memory
- **Deliverable:** `ExportButton.tsx` + utility functions
- **Resources:**
  - CSV generation: `papaparse` library
  - PDF generation: `jsPDF` + `html2canvas`
  - Large data: streaming / chunking strategies
- **Unblocks:** Nothing critical (parallel work)

**TASK-021: Create Dashboard Analytics Summary Cards**
- **Type:** Code
- **Effort:** 3 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-019
- **Acceptance Criteria:**
  - [ ] New dashboard section: "This Period Analytics"
  - [ ] Cards show: avg temp | avg humidity | VPD range | CO2 avg | compliance % (within targets)
  - [ ] Trend indicators: up/down arrows + % change vs previous period
  - [ ] Clickable: each card links to detailed sensor view
  - [ ] Period selector: matches date range picker (or defaults to last 7 days)
  - [ ] Realtime: updates as new readings arrive
  - [ ] Empty state: "No data available. Check sensor status."
- **Deliverable:** `AnalyticsSummaryCards.tsx` component
- **Resources:**
  - Existing analytics data from `/api/analytics` or extend hook
- **Unblocks:** Nothing critical

---

### SECTION 2C: Device Scheduling UI

**TASK-022: Design Device Schedule Builder Component**
- **Type:** Spec + Code
- **Effort:** 6 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-012
- **Acceptance Criteria:**
  - [ ] New page: `/dashboard/schedules` (accessible from controller device card)
  - [ ] Visual schedule builder: weekly calendar grid (7 cols × 24 rows)
  - [ ] Drag to select time blocks for each device
  - [ ] Each block shows: device (fan/light/outlet) | action (on/off/dim to X%)
  - [ ] Add schedule button → modal with: name | trigger type | time/recurrence
  - [ ] Trigger types: time-based (8am daily) | sunrise/sunset | cron expression
  - [ ] Preview: shows when schedule will run + estimated automation value
  - [ ] Mobile: simplified interface (list of schedules, edit in modal)
- **Deliverable:** `/apps/web/src/app/schedules/page.tsx` + builder components
- **Resources:**
  - Calendar library: `react-big-calendar` or custom grid
  - Database: `dimmer_schedules` table already exists (extend for all device types)
  - Type updates: `DimmerScheduleType` → `DeviceSchedule` (more generic)
- **Unblocks:** TASK-023, TASK-024, TASK-025, TASK-026

**TASK-023: Implement Time-Based Schedule Execution**
- **Type:** Code
- **Effort:** 5 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-022
- **Acceptance Criteria:**
  - [ ] Cron job: `/api/cron/schedules` runs every minute
  - [ ] Checks active schedules, matches current time
  - [ ] Executes matched schedule: sends device command via adapter
  - [ ] Logs: activity_logs entry with result (success/failed)
  - [ ] Error handling: if device offline, retries 3x with 5s backoff, then marks failed
  - [ ] Rate limiting respected: max 10 commands per controller per minute
  - [ ] Dry run mode: simulates execution without sending commands
- **Deliverable:**
  - Cron endpoint: `/api/cron/schedules`
  - Database functions: get_scheduled_actions(now)
  - Execution service: `/apps/web/src/lib/schedule-executor.ts`
- **Resources:**
  - Existing cron infrastructure: similar to `/api/cron/workflows`
  - Device control endpoints: `/api/controllers/[id]/devices/[port]/control`
- **Unblocks:** TASK-024

**TASK-024: Add Sunrise/Sunset Dimming Schedules**
- **Type:** Code
- **Effort:** 4 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-023
- **Acceptance Criteria:**
  - [ ] Schedule type: "Sunrise/Sunset Dimming"
  - [ ] User selects: device + curve type (linear | sigmoid | exponential | logarithmic)
  - [ ] Inputs: start intensity (%) | target intensity (%) | duration (minutes)
  - [ ] Preview: curve shows how intensity changes over time
  - [ ] Execution: calculates intermediate values based on elapsed time + curve
  - [ ] Uses room timezone + geolocation (latitude/longitude) for sunrise/sunset times
  - [ ] Fallback: manual start/end times if geolocation unavailable
  - [ ] Realtime: re-evaluates every minute (smooth dimming if job runs frequently)
- **Deliverable:** `DimmerSchedule.tsx` + curve calculation utility
- **Resources:**
  - Sunrise/sunset library: `suncalc` or `solar-calculator`
  - Curve functions: implement sigmoid/exp/log transformations
  - Room geolocation: already stored in DB (latitude/longitude)
- **Unblocks:** TASK-025

**TASK-025: Implement Schedule Templates (Presets)**
- **Type:** Code
- **Effort:** 3 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-024
- **Acceptance Criteria:**
  - [ ] Template gallery: "Day/Night Mode" | "Sunrise Ramp-Up" | "Evening Wind-Down" | "Plant Cloning"
  - [ ] User selects template → auto-fills schedule for all devices in room
  - [ ] Can customize after selection before saving
  - [ ] Template creation: user can save current schedule as template
  - [ ] Templates shareable: generate share link (anonymous access to template, not schedules)
  - [ ] Community templates: featured templates from EnviroFlow team
- **Deliverable:** `ScheduleTemplates.tsx` component + template management API
- **Resources:**
  - Presets stored in: config file or DB table (templates)
  - Route: `/api/templates`, `/api/templates/[id]/apply`
- **Unblocks:** Nothing critical

**TASK-026: Add Smart Recommendations for Schedules**
- **Type:** Code
- **Effort:** 3 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-025
- **Acceptance Criteria:**
  - [ ] When user creates schedule: AI suggests optimal settings
  - [ ] Analysis: looks at sensor history + growth stage + target conditions
  - [ ] Suggestion: "Based on your current VPD, try: fan on 6-8am, light ramp to 75% by 8am"
  - [ ] User can accept/ignore suggestion
  - [ ] Rationale: shows why this schedule is recommended
  - [ ] Confidence score: "85% match to your goals"
  - [ ] Uses GROK API (existing AI integration)
- **Deliverable:** `ScheduleRecommendation.tsx` component
- **Resources:**
  - Sensor history query functions
  - GROK API integration (existing in `/api/analyze`)
  - Growth stage context from workflow
- **Unblocks:** Nothing critical

---

### REVIEW CHECKPOINT: Phase 2

**TASK-027: Code Review - Phase 2: Bulk Operations & Analytics**
- **Type:** Review
- **Effort:** 2 hrs
- **Priority:** P2-High
- **Assigned:** code-auditor
- **Depends On:** TASK-016, TASK-021, TASK-026
- **Review Scope:**
  - [ ] Bulk operations handle partial failures gracefully
  - [ ] Analytics data is accurate (test with sample datasets)
  - [ ] Date range picker timezone-aware (test DST transitions)
  - [ ] Schedule execution doesn't cause command storms (rate limiting)
  - [ ] Performance: charts render <500ms even with 10k points
  - [ ] Mobile responsiveness verified (tested on real devices)
  - [ ] Security: user can only see/modify own controllers/schedules
  - [ ] E2E tests written for critical workflows
- **Acceptance Criteria:**
  - All blocking issues resolved
  - Code merged to main
  - Changelog updated with Phase 2 features
- **Unblocks:** Phase 3 (TASK-028+)

---

## PHASE 3: INTEGRATION - NEW BRANDS & PROTOCOLS
**Duration:** 4 weeks | **Effort:** 140 hours | **Priority:** P2-High

---

### SECTION 3A: Govee Integration

**TASK-028: Research Govee API & Design Adapter Architecture**
- **Type:** Spec
- **Effort:** 3 hrs
- **Priority:** P2-High
- **Assigned:** Human/Architect (or senior coder)
- **Depends On:** TASK-027
- **Acceptance Criteria:**
  - [ ] Architecture doc created: `/docs/spec/Govee-Integration.md`
  - [ ] API analysis: authentication (API key + device ID) | device discovery | sensors | commands
  - [ ] Supported devices identified: H5179 (BLE) + WiFi models (if available)
  - [ ] Limitations documented: BLE requires cloud relay, read-only for some models
  - [ ] Error scenarios mapped: device not found, offline, invalid key
  - [ ] Rate limits defined: requests per minute, concurrent connections
  - [ ] Security concerns addressed: API key storage, credential rotation
  - [ ] Design decision: cloud API only (no local BLE access) for MVP
- **Deliverable:** Design doc + decision log
- **Resources:**
  - Govee API documentation (if available)
  - Community resources: Govee integration threads on Reddit/forums
  - Reference: existing AC Infinity/Inkbird adapters
- **Unblocks:** TASK-029, TASK-030, TASK-031

**TASK-029: Implement GoveeAdapter with API Client**
- **Type:** Code
- **Effort:** 6 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-028
- **Acceptance Criteria:**
  - [ ] File: `/apps/automation-engine/lib/adapters/GoveeAdapter.ts`
  - [ ] Implements `ControllerAdapter` interface
  - [ ] `connect()`: validates API key + fetches paired devices
  - [ ] `readSensors()`: fetches latest sensor state for device
  - [ ] `controlDevice()`: sends command (on/off/color/brightness)
  - [ ] `getStatus()`: returns online/offline status
  - [ ] Retry logic: handles transient API failures
  - [ ] Logging: all API calls logged for debugging
  - [ ] Tests: unit tests for adapter methods (mock API)
- **Deliverable:** GoveeAdapter implementation + unit tests
- **Resources:**
  - Govee API client library (if exists) or HTTP client (axios)
  - Retry pattern: `/apps/automation-engine/lib/adapters/retry.ts`
  - Type definitions: extend to `GoveeCredentials`
- **Unblocks:** TASK-030

**TASK-030: Add Govee to Brand List & Onboarding**
- **Type:** Code
- **Effort:** 3 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-029
- **Acceptance Criteria:**
  - [ ] Brand list includes Govee: status = "available"
  - [ ] Onboarding wizard step 1: Govee card shows "API Key Required"
  - [ ] Step 2: form asks for Govee API key (password type) + link to get key
  - [ ] Discovery: lists paired Govee devices after key validation
  - [ ] Error handling: invalid key → show guide to get correct key
  - [ ] Test connection: validates key + lists at least 1 device
  - [ ] UI: Govee logo in brand list
- **Deliverable:** Updates to `/apps/web/src/app/api/controllers/brands/route.ts` + wizard
- **Resources:**
  - Brand config: `/apps/automation-engine/lib/adapters/index.ts`
  - Govee logo/assets
- **Unblocks:** TASK-031, TASK-032

**TASK-031: Implement Govee Device Discovery**
- **Type:** Code
- **Effort:** 4 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-030
- **Acceptance Criteria:**
  - [ ] Discovery endpoint: calls GoveeAdapter.discoverDevices()
  - [ ] Returns: device ID, name, model, capabilities (sensors/devices)
  - [ ] Shows: which devices already registered (de-duplicate)
  - [ ] Multi-select: user selects devices to add
  - [ ] Bulk add: creates controller record for each selected device
  - [ ] Capability mapping: auto-detects sensor/device types from Govee model
  - [ ] Error: if discovery fails, show why (invalid key, offline, etc.)
- **Deliverable:** Discovery logic in GoveeAdapter + API endpoint
- **Resources:**
  - Existing discovery patterns: AC Infinity, Inkbird
  - UI: reuse discovery modal from existing implementations
- **Unblocks:** TASK-032

**TASK-032: Add Govee to CI/CD Testing**
- **Type:** Test
- **Effort:** 2 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-031
- **Acceptance Criteria:**
  - [ ] Unit tests: mock Govee API responses
  - [ ] Integration tests: end-to-end wizard flow (using test API key)
  - [ ] GitHub Actions: test runs on PR (no external API calls, mocked)
  - [ ] Code coverage: GoveeAdapter at 80%+ coverage
  - [ ] Performance tests: discovery with 50 devices <5s
- **Deliverable:** Test files + CI configuration
- **Resources:**
  - Jest test framework (existing)
  - Mock data: `/apps/automation-engine/lib/adapters/__mocks__/govee.ts`
- **Unblocks:** Nothing critical

---

### SECTION 3B: MQTT Framework & Generic Integration

**TASK-033: Design MQTT Architecture & Credential Schema**
- **Type:** Spec
- **Effort:** 4 hrs
- **Priority:** P2-High
- **Assigned:** Human/Architect (or senior coder)
- **Depends On:** TASK-027
- **Acceptance Criteria:**
  - [ ] Spec doc: `/docs/spec/MQTT-Integration.md`
  - [ ] Topic structure defined: `enviroflow/{userId}/{controllerId}/sensors/#` and `commands/#`
  - [ ] Message format (JSON): { type, sensor_type, value, unit, timestamp }
  - [ ] Authentication: username/password + TLS certificate support
  - [ ] Broker discovery: support for local (Mosquitto) + cloud (HiveMQ, AWS IoT)
  - [ ] Wildcard subscriptions: `+` for device ID, `#` for all sensors
  - [ ] QoS levels: use 1 (at-least-once) for reliability
  - [ ] Credential security: encrypted in DB, never exposed to client
  - [ ] Error scenarios: broker offline, auth failure, message format invalid
- **Deliverable:** Architecture doc + credential schema
- **Resources:**
  - MQTT v3.1.1 spec
  - Community MQTT integrations for reference (Home Assistant, etc.)
- **Unblocks:** TASK-034, TASK-035, TASK-036

**TASK-034: Implement MQTTAdapter Core**
- **Type:** Code
- **Effort:** 7 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-033
- **Acceptance Criteria:**
  - [ ] File: `/apps/automation-engine/lib/adapters/MQTTAdapter.ts`
  - [ ] Implements `ControllerAdapter` interface
  - [ ] `connect()`: establishes MQTT connection, validates auth
  - [ ] `readSensors()`: subscribes to sensor topics, parses JSON messages
  - [ ] `controlDevice()`: publishes command to device topic
  - [ ] `getStatus()`: checks connection state, last message timestamp
  - [ ] Message parsing: validates JSON + extracts sensor_type, value, unit
  - [ ] Error handling: broker offline, auth failed, malformed messages
  - [ ] Logging: all connections/disconnections logged
  - [ ] Tests: unit tests with mock MQTT broker (mqtt.js test suite)
  - [ ] Library: uses `mqtt` npm package (lightweight MQTT client)
- **Deliverable:** MQTTAdapter implementation + tests
- **Resources:**
  - MQTT client library: `mqtt` (npm package)
  - Mock broker for tests: `aedes` (lightweight broker)
  - Message validation: Zod schema
- **Unblocks:** TASK-035, TASK-036

**TASK-035: Add MQTT to Brand List & Onboarding**
- **Type:** Code
- **Effort:** 3 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-034
- **Acceptance Criteria:**
  - [ ] Brand list includes MQTT: status = "available"
  - [ ] Onboarding step 2: form for MQTT credentials
  - [ ] Fields: broker URL | port | username | password | topic prefix | TLS (toggle)
  - [ ] Help text: examples for Mosquitto, HiveMQ, AWS IoT
  - [ ] Test connection: validates broker reachability + auth
  - [ ] Error messages: "Broker unreachable" | "Authentication failed" | "Invalid topic"
  - [ ] UI: MQTT icon/logo
- **Deliverable:** Updates to brands list + onboarding wizard
- **Resources:**
  - Brand config: `/apps/automation-engine/lib/adapters/index.ts`
  - Help content: `/apps/web/src/lib/brand-guides.ts`
- **Unblocks:** TASK-036

**TASK-036: Implement MQTT Device Discovery & Auto-Mapping**
- **Type:** Code
- **Effort:** 5 hrs
- **Priority:** P2-High
- **Assigned:** coder
- **Depends On:** TASK-035
- **Acceptance Criteria:**
  - [ ] Discovery: subscribes to topic wildcard, waits 10s for messages
  - [ ] Auto-detect: parses incoming messages to identify sensors + devices
  - [ ] UI: shows discovered sensors (e.g., "temp_1", "humidity_1", "fan_port_1")
  - [ ] Capability mapping: user manually maps (or auto-detect by convention)
  - [ ] Convention example: `{prefix}/temp_sensor` → sensor type "temperature"
  - [ ] Supports multiple device types: can map port 1→fan, port 2→light
  - [ ] Validation: requires at least 1 sensor/device discovered
  - [ ] Error: if no messages received in 10s, suggest troubleshooting
- **Deliverable:** Discovery logic in MQTTAdapter + UI for mapping
- **Resources:**
  - Topic subscription wildcards
  - Auto-detection heuristics (naming conventions)
- **Unblocks:** TASK-037

**TASK-037: Add MQTT to CI/CD & Create Integration Tests**
- **Type:** Test
- **Effort:** 3 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-036
- **Acceptance Criteria:**
  - [ ] Unit tests: mock MQTT broker interactions
  - [ ] Integration tests: publish messages, verify parsing
  - [ ] CI: Docker Compose test environment with mock MQTT broker
  - [ ] Tests run on every PR
  - [ ] Code coverage: MQTTAdapter at 75%+ coverage
  - [ ] Performance: handle 100 messages/sec from broker
- **Deliverable:** Test files + CI configuration
- **Resources:**
  - Docker Compose: test infrastructure
  - Mock MQTT broker: aedes
  - Test data: realistic sensor messages
- **Unblocks:** Nothing critical

---

### SECTION 3C: Enhanced Discovery & Home Assistant

**TASK-038: Research Home Assistant Integration Options**
- **Type:** Spec
- **Effort:** 2 hrs
- **Priority:** P3-Medium
- **Assigned:** Human/Architect
- **Depends On:** TASK-027
- **Acceptance Criteria:**
  - [ ] Spec doc: `/docs/spec/HomeAssistant-Integration.md`
  - [ ] Two options evaluated: MQTT bridge vs direct HA API
  - [ ] Decision: MQTT bridge (leverages MQTT work) or native HA integration
  - [ ] Use case: user has Home Assistant + EnviroFlow, wants single control point
  - [ ] Architecture: bidirectional sync (HA entities ↔ EnviroFlow controllers)
  - [ ] Limitations documented
- **Deliverable:** Decision doc + architecture spec
- **Resources:**
  - Home Assistant documentation
  - Community HA integrations
- **Unblocks:** TASK-039, TASK-040

**TASK-039: Implement Home Assistant MQTT Bridge (Phase 3.5)**
- **Type:** Code
- **Effort:** 5 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-038, TASK-036 (MQTT)
- **Acceptance Criteria:**
  - [ ] Optional: HA discovery bridge (auto-populate HA with EnviroFlow entities)
  - [ ] Entity format: `homeassistant/sensor/enviroflow_room1_temp` (MQTT Discovery)
  - [ ] HA can read EnviroFlow sensor data + control devices
  - [ ] Two-way sync: changes in HA reflected in EnviroFlow, vice versa
  - [ ] Conflict resolution: last-write-wins or manual override
  - [ ] Documentation: setup guide for HA users
- **Deliverable:** HA bridge configuration + setup docs
- **Resources:**
  - Home Assistant MQTT Discovery protocol
  - Existing MQTT infrastructure
- **Unblocks:** Nothing critical

**TASK-040: Add Generic Device Support & Custom Adapter Framework**
- **Type:** Code
- **Effort:** 4 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-038
- **Acceptance Criteria:**
  - [ ] "Custom" brand: allows advanced users to define sensor/device mappings
  - [ ] JSON schema editor: user defines mapping (HTTP endpoint, parsing rules)
  - [ ] Example: user has custom Arduino setup, defines: `POST /api/arduino/sensors → parse JSON → temp field`
  - [ ] Limited to trusted users (feature flag or pro plan)
  - [ ] Validation: safety checks (no code execution, rate limiting)
  - [ ] Documentation: sample schemas for common DIY setups
- **Deliverable:** Custom adapter framework + UI
- **Resources:**
  - JSON schema validation library
  - Custom mapping storage: new table `custom_adapters`
- **Unblocks:** Nothing critical

**TASK-041: Enhance Device Discovery with Local Network Scanning**
- **Type:** Code
- **Effort:** 5 hrs
- **Priority:** P3-Medium
- **Assigned:** coder
- **Depends On:** TASK-027
- **Acceptance Criteria:**
  - [ ] New discovery method: mDNS/Bonjour local network scan
  - [ ] Finds devices on same network: MQTT brokers, local controllers, etc.
  - [ ] UI: shows discovered IPs + device types
  - [ ] User can select + add directly (no cloud API needed)
  - [ ] Fallback if mDNS unavailable (manual IP entry)
  - [ ] Privacy: local discovery not sent to cloud
  - [ ] Security: validate SSL certificates for local connections
- **Deliverable:** Local discovery service + UI
- **Resources:**
  - mDNS library: `mdns` or `bonjour` (npm packages)
  - Browser API: limited for local discovery (might need service worker)
  - Fallback: user enters IP manually
- **Unblocks:** Nothing critical

**TASK-042: Add IPv6 & SSL/TLS Support to Adapters**
- **Type:** Code
- **Effort:** 3 hrs
- **Priority:** P4-Low
- **Assigned:** coder
- **Depends On:** TASK-027 (Phase 3 complete)
- **Acceptance Criteria:**
  - [ ] All adapters support IPv6 addresses (where applicable)
  - [ ] MQTT: TLS/SSL certificate validation
  - [ ] Local network connections: accept self-signed certs (with user warning)
  - [ ] HTTPS endpoints: certificate pinning option for security-critical setups
  - [ ] Documentation: security best practices for each adapter
- **Deliverable:** Updates to all adapters + docs
- **Resources:**
  - Node.js TLS APIs
  - Certificate validation libraries
- **Unblocks:** Nothing critical

**TASK-043: Create Discovery Troubleshooting Guide**
- **Type:** Spec + Docs
- **Effort:** 2 hrs
- **Priority:** P4-Low
- **Assigned:** Human/Tech Writer
- **Depends On:** TASK-041
- **Acceptance Criteria:**
  - [ ] Comprehensive guide: `/docs/discovery-troubleshooting.md`
  - [ ] Common issues: device not appearing, connection timeout, auth failed
  - [ ] Solutions: network config, firewall, device requirements
  - [ ] Screenshots: step-by-step for each brand
  - [ ] Links to brand-specific support pages
- **Deliverable:** Troubleshooting guide
- **Resources:**
  - Existing brand guides (leverage)
- **Unblocks:** Nothing critical

---

### REVIEW CHECKPOINT: Phase 3

**TASK-044: Code Review - Phase 3: New Integrations**
- **Type:** Review
- **Effort:** 3 hrs
- **Priority:** P2-High
- **Assigned:** code-auditor
- **Depends On:** TASK-032, TASK-037, TASK-043
- **Review Scope:**
  - [ ] All adapters follow consistent patterns (GoveeAdapter, MQTTAdapter)
  - [ ] Error handling comprehensive (all failure paths tested)
  - [ ] Security verified: credentials encrypted, no leaks
  - [ ] Discovery reliable (handles timeouts, offline devices)
  - [ ] Performance: discovery <10s even with slow networks
  - [ ] Documentation complete (setup guides, API docs)
  - [ ] Tests cover happy path + all error scenarios
  - [ ] Integration with existing system smooth (no breaking changes)
- **Acceptance Criteria:**
  - All blocking issues resolved
  - Code merged to main
  - Changelog updated with Phase 3 features
  - Discovery guide published
- **Unblocks:** Phase 4 (TASK-045+)

---

## PHASE 4: LAUNCH - QA, PERFORMANCE & ROLLOUT
**Duration:** 2 weeks | **Effort:** 80 hours | **Priority:** P1-Blocking

---

**TASK-045: Write E2E Tests for Complete User Journeys**
- **Type:** Test
- **Effort:** 8 hrs
- **Priority:** P1-Blocking
- **Assigned:** coder
- **Depends On:** TASK-044
- **Acceptance Criteria:**
  - [ ] 5 E2E test scenarios (using Playwright or Cypress):
    1. Add AC Infinity → test connection → assign to room → verify dashboard
    2. Add Govee → discover device → control light → check activity log
    3. Create schedule → verify execution at scheduled time
    4. Bulk assign 3 controllers → test success + partial failure handling
    5. Export sensor data → verify CSV structure + values
  - [ ] Tests run in CI on every PR
  - [ ] Pass rate: 100% (no flaky tests)
  - [ ] Timeout: <5 min total per test run
  - [ ] Screenshots on failure for debugging
- **Deliverable:** E2E test suite in `/apps/web/e2e/`
- **Resources:**
  - Playwright/Cypress
  - Test data fixtures
  - CI configuration (GitHub Actions)
- **Unblocks:** TASK-046

**TASK-046: Performance Testing & Optimization**
- **Type:** Test + Code
- **Effort:** 6 hrs
- **Priority:** P1-Blocking
- **Assigned:** coder
- **Depends On:** TASK-045
- **Acceptance Criteria:**
  - [ ] Lighthouse scores: 90+ on performance (mobile + desktop)
  - [ ] Dashboard load time: <3s with 50 controllers
  - [ ] Charts render: <500ms even with 10k data points
  - [ ] Sensor polling: <500ms round-trip time
  - [ ] Discovery: <10s for cloud APIs, <5s for local mDNS
  - [ ] Bundle size: no major regressions (<5% increase)
  - [ ] Memory: monitor for leaks in long-running sessions
  - [ ] Database query optimization: N+1 queries eliminated
- **Deliverable:** Performance report + optimizations applied
- **Resources:**
  - Lighthouse CI
  - React DevTools Profiler
  - Database query analysis tools
- **Unblocks:** TASK-047

**TASK-047: Security Audit & Penetration Testing**
- **Type:** Review + Test
- **Effort:** 5 hrs
- **Priority:** P1-Blocking
- **Assigned:** code-auditor + security specialist
- **Depends On:** TASK-046
- **Acceptance Criteria:**
  - [ ] OWASP Top 10 checks passed
  - [ ] XSS prevention verified (no DOM injection vectors)
  - [ ] CSRF tokens checked
  - [ ] SQL injection prevention (Supabase parameterized queries)
  - [ ] Authentication: session handling, token expiry
  - [ ] Authorization: RLS policies enforced
  - [ ] Data encryption: credentials encrypted at rest + in transit
  - [ ] Rate limiting: tested for brute force protection
  - [ ] Secrets scanning: no API keys/passwords in code
  - [ ] Dependency audit: npm audit, security patches applied
- **Deliverable:** Security audit report + remediation checklist
- **Resources:**
  - OWASP testing guide
  - Burp Suite or OWASP ZAP
  - GitHub security features (dependabot, code scanning)
- **Unblocks:** TASK-048

**TASK-048: Beta Release & User Testing**
- **Type:** Test + Rollout
- **Effort:** 4 hrs
- **Priority:** P1-Blocking
- **Assigned:** Product Manager + coder
- **Depends On:** TASK-047
- **Acceptance Criteria:**
  - [ ] Beta program: 20-50 early users get feature access
  - [ ] Onboarding: each beta user walks through new features
  - [ ] Feedback collection: survey + in-app feedback widget
  - [ ] Success criteria: 80%+ task completion rate, NPS >40
  - [ ] Issues tracked: critical bugs, UX friction points
  - [ ] Iterations: fix critical bugs, 48-72h turnaround
  - [ ] Documentation: refined based on user feedback
- **Deliverable:** Beta test report + updated docs
- **Resources:**
  - Beta user cohort (from waitlist or existing users)
  - Feedback tools (Hotjar, Typeform)
  - Issue tracking (GitHub Issues)
- **Unblocks:** TASK-049

**TASK-049: Final Documentation & Changelog**
- **Type:** Docs
- **Effort:** 3 hrs
- **Priority:** P1-Blocking
- **Assigned:** Tech Writer
- **Depends On:** TASK-048
- **Acceptance Criteria:**
  - [ ] Comprehensive changelog: all new features + bug fixes + breaking changes
  - [ ] User guide: updated with new UI workflows
  - [ ] API docs: new endpoints documented + examples
  - [ ] Admin docs: performance tuning, troubleshooting
  - [ ] Video tutorials: 3 min clips for onboarding, scheduling, exports
  - [ ] Setup guides: per-brand with screenshots
  - [ ] Migration guide: if any breaking changes
- **Deliverable:** `/docs/CHANGELOG.md` + updated user docs
- **Resources:**
  - Existing docs structure
  - Video recording tool (Loom, ScreenFlow)
- **Unblocks:** TASK-050

**TASK-050: Production Deployment & Monitoring**
- **Type:** Ops + Rollout
- **Effort:** 4 hrs
- **Priority:** P1-Blocking
- **Assigned:** DevOps + coder
- **Depends On:** TASK-049
- **Acceptance Criteria:**
  - [ ] Deployment plan: feature flags for gradual rollout (50% → 100%)
  - [ ] Database migrations: zero-downtime schema updates
  - [ ] Monitoring: error tracking (Sentry), performance (Datadog), logs (CloudWatch)
  - [ ] Alerts configured: critical errors notify team
  - [ ] Rollback plan: if critical issues, revert in <5 min
  - [ ] Smoke tests: automated checks after deploy
  - [ ] Communication: status page updated, users notified of new features
- **Deliverable:** Deployment playbook + monitoring setup
- **Resources:**
  - Vercel deployment (existing)
  - Sentry error tracking
  - Feature flag service (LaunchDarkly or custom)
- **Unblocks:** TASK-051

**TASK-051: Post-Launch Monitoring & Support (Week 1)**
- **Type:** Ops + Support
- **Effort:** 8 hrs (distributed across week)
- **Priority:** P1-Blocking
- **Assigned:** coder + support team
- **Depends On:** TASK-050
- **Acceptance Criteria:**
  - [ ] Daily monitoring: error rate <0.1%, uptime >99.5%
  - [ ] Response time: <100ms p95 latency
  - [ ] User feedback: actively monitor Slack/Discord/support channel
  - [ ] Critical bugs: hotfix within 2 hours
  - [ ] Documentation updates: clarify confusing features
  - [ ] User success: track onboarding completion rate, adoption metrics
- **Deliverable:** Daily standup report + metrics dashboard
- **Resources:**
  - Monitoring dashboards
  - Support tools (Zendesk, Discord bot)
- **Unblocks:** Nothing (launch complete)

**TASK-052: Collect Feedback & Create Improvement Roadmap**
- **Type:** Planning
- **Effort:** 3 hrs
- **Priority:** P4-Low
- **Assigned:** Product Manager
- **Depends On:** TASK-051
- **Acceptance Criteria:**
  - [ ] User interviews: 5-10 users provide deep feedback
  - [ ] Feature requests: categorized by demand + effort
  - [ ] Pain points: identified from support tickets + user testing
  - [ ] Roadmap v2: created based on feedback
  - [ ] Community: discussions started for feature voting
- **Deliverable:** Feedback summary + Phase 2 roadmap
- **Resources:**
  - User research tools
  - Roadmap prioritization framework
- **Unblocks:** Future phases

**TASK-053: Knowledge Transfer & Team Documentation**
- **Type:** Docs
- **Effort:** 3 hrs
- **Priority:** P4-Low
- **Assigned:** Senior coder
- **Depends On:** TASK-052
- **Acceptance Criteria:**
  - [ ] Architecture overview: 10-page guide for new developers
  - [ ] Adapter patterns: how to build new integrations (template)
  - [ ] Common tasks: how to add new sensor type, device type
  - [ ] Debugging guide: common issues + solutions
  - [ ] Video walkthrough: 20 min codebase tour for onboarding
- **Deliverable:** `/docs/DEVELOPMENT.md` + video recording
- **Resources:**
  - Existing code comments
  - Architecture diagrams
- **Unblocks:** Future maintainability

---

### FINAL REVIEW & LAUNCH SIGN-OFF

**TASK-054: Final Code Review & Launch Approval**
- **Type:** Review
- **Effort:** 2 hrs
- **Priority:** P1-Blocking
- **Assigned:** code-auditor + product lead
- **Depends On:** TASK-051, TASK-053
- **Final Checklist:**
  - [ ] All 50+ tasks completed + tested
  - [ ] Code quality: linting, tests, coverage >80%
  - [ ] Security: audit passed, no known vulnerabilities
  - [ ] Performance: meets all targets
  - [ ] Documentation: complete and accurate
  - [ ] User feedback: incorporated where feasible
  - [ ] Team trained: all developers understand new code
- **Approval Sign-Off:**
  - Product: "Feature set meets roadmap"
  - Engineering: "Code quality acceptable, tech debt managed"
  - Support: "Documentation adequate for user support"
- **Unblocks:** Public launch

---

## SUMMARY

### By Phase

| Phase | Name | Duration | Effort | Priority | Status |
|-------|------|----------|--------|----------|--------|
| 1 | Foundation: Onboarding & Error Recovery | 3 weeks | 80 hrs | P1 | Pending |
| 2 | Enhancement: Bulk Ops & Analytics | 4 weeks | 120 hrs | P2 | Pending |
| 3 | Integration: New Brands | 4 weeks | 140 hrs | P2 | Pending |
| 4 | Launch: QA & Rollout | 2 weeks | 80 hrs | P1 | Pending |
| **TOTAL** | **All Phases** | **13 weeks** | **420 hrs** | — | — |

### By Task Count

- **Total Tasks:** 54
- **Code Tasks:** 38
- **Spec/Design Tasks:** 7
- **Test Tasks:** 6
- **Review Checkpoints:** 4 (Phase Reviews)
- **Ops/Support Tasks:** 5
- **Documentation:** 8

### By Team Role

| Role | Task Count | Total Effort | Tasks |
|------|-----------|----------------|-------|
| **coder** | 38 | 280 hrs | TASK-001, 002, 003, 004, 005, 006, 008-010, 013-026, 029-030, 034-036, 045-046, 049-051 |
| **code-auditor** | 4 | 9 hrs | TASK-012, 027, 044, 054 (Review Checkpoints) |
| **Human/Architect** | 5 | 15 hrs | TASK-028, 033, 038 (Specs) + TASK-007 (guides) + TASK-052 (roadmap) |
| **DevOps/Ops** | 3 | 12 hrs | TASK-050, 051 |
| **Product/Tech Writer** | 4 | 11 hrs | TASK-049, 052, 053 + TASK-043 (docs) |

### Critical Path

```
TASK-001 → TASK-003 → TASK-004 → TASK-008 → TASK-012
  ↓
TASK-013 → TASK-016 → TASK-021 → TASK-027
  ↓
TASK-028 → TASK-031 → TASK-032 → TASK-044
  ↓
TASK-045 → TASK-046 → TASK-047 → TASK-048 → TASK-050 → TASK-051 → TASK-054
```

**Critical Path Duration:** ~13 weeks (with proper parallelization)

### Parallel Opportunities

These task groups can run simultaneously:

- **Phase 1:** Tasks 5-11 can run in parallel after TASK-003 completes
- **Phase 2:** Bulk ops (13-16) parallel with Analytics (17-21) parallel with Scheduling (22-26)
- **Phase 3:** Govee (28-32) parallel with MQTT (33-37)

With 3-person team: estimate 10-12 weeks total (vs 13 weeks sequential)

---

## RISKS & MITIGATIONS

### Risk 1: Third-Party API Changes (Govee/Inkbird)
- **Impact:** Integration breaks if API changes
- **Mitigation:**
  - Version API implementations separately
  - Add feature detection in adapters
  - Maintain API request/response logging
  - Beta test with partner APIs before release

### Risk 2: Performance Degradation at Scale
- **Impact:** Dashboard slow with 100+ controllers
- **Mitigation:**
  - Implement pagination + lazy loading early
  - Database indexing on `user_id + created_at`
  - Cache frequently accessed queries
  - Load testing in Phase 4 before launch

### Risk 3: Credential Storage Security Breach
- **Impact:** User data exposed
- **Mitigation:**
  - AES-256-GCM encryption (already implemented)
  - Regular security audits (TASK-047)
  - Never log/display encrypted credentials
  - Implement credential rotation mechanism

### Risk 4: MQTT Integration Complexity
- **Impact:** Takes longer than estimated, delays Phase 3
- **Mitigation:**
  - Spike task (TASK-033) validates feasibility early
  - Use existing MQTT libraries (don't reinvent)
  - Start with core functionality, add features iteratively

### Risk 5: Team Bandwidth Constraints
- **Impact:** Tasks slip due to competing priorities
- **Mitigation:**
  - Prioritize P1 tasks first (phases 1 & 4)
  - Timebox exploratory work (specs)
  - Break large tasks into smaller chunks
  - Regular standups to identify blockers early

### Risk 6: Beta User Adoption Low
- **Impact:** Insufficient feedback to validate features
- **Mitigation:**
  - Recruit beta users from existing customer base
  - Provide incentives (feature access, early pricing)
  - Active engagement: weekly check-ins, AMA sessions
  - Adjust features based on real-world usage

---

## SUCCESS METRICS (Post-Launch)

### Adoption
- 60% of active users complete onboarding tour
- 40% of users add 2+ controllers within first week
- 25% create first automation schedule within month 1

### Quality
- Controller success rate: 95%+ first attempt (vs current 75%)
- Support tickets related to onboarding: 50% reduction
- User NPS: 50+ (vs baseline 30)

### Performance
- Dashboard load time: 2-3 seconds (50 controllers)
- Command execution: <500ms latency
- Uptime: 99.9% (currently 99.5%)

### Engagement
- Weekly active users: 30% increase
- Feature usage: 70% of users use at least 3 of new features
- Scheduled automations: 200+ active schedules by end of month 1

---

## NEXT STEPS

1. **Week 1:** Review this plan with team, adjust estimates based on capacity
2. **Week 2:** Start Phase 1 (TASK-001-003), parallel discovery research (TASK-028, 033)
3. **Weekly:** Standups to track progress, identify blockers
4. **Post-Phase-1:** Conduct TASK-012 review, adjust plan based on learnings
5. **Post-Launch:** Gather user feedback (TASK-052), plan Phase 2+ based on priorities

---

**Document Version:** 1.0
**Last Updated:** 2026-01-24
**Status:** Ready for Planning Meeting
**Approval:** Pending (Arch + PM sign-off)
