# EnviroFlow Dashboard PRD (Complete)
**Version**: 1.1 - Post-Clarification  
**Last Updated**: 2025-01-22  
**Status**: Ready for Development

---

## 1. One-Sentence Problem

**Indoor growers** with multiple environmental controllers struggle to **monitor and compare conditions across rooms in real-time** because **each vendor's native app shows different data formats and requires switching between apps**, resulting in **delayed responses to environmental issues and inability to spot cross-room patterns**.

---

## 2. Demo Goal (What Success Looks Like)

**Success = A grower with 2+ different controller brands (AC Infinity, TrolMaster, etc.) can:**
- View all room environments in a single, unified dashboard
- See richer data visualization (24h trends, VPD calculations, optimal zones) than any native app provides
- Identify cross-room issues at a glance (e.g., "Flower Room 2 trending 15% higher VPD than Flower Room 1")
- Access historical patterns and automation impact that native apps don't surface
- **Configure the dashboard to their preferences** (metric priorities, view modes, optimal ranges)

**Demo Outcome:** Observer says *"I would actually use this instead of my controller's app."*

### 2.1 Non-Goals

- Multi-user collaboration features
- Mobile native app (web responsive only for demo)
- Alert notification system (show alerts, don't deliver them)
- Equipment marketplace or hardware sales
- Recipe/grow schedule templates
- Social/community features

### 2.2 Autonomy Target

**This feature targets: L2 - Analyze**

The dashboard detects environmental data (L1), **analyzes patterns and trends** (L2 - current target), and surfaces insights without taking action. Future iterations will progress to L3 (recommendations) and beyond.

### 2.3 Demo Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Data comprehension time | <5 seconds to understand all-rooms status | Observer test: "Which room needs attention?" |
| Cross-controller data unification | Display 3+ controller brands in single view | Visual confirmation during demo |
| Visual superiority vs native | Observer preference for EnviroFlow UI | Post-demo survey: "Would you use this?" |
| Historical insight depth | Show 24h+ trends with automation markers | Visible in timeline component |
| **Demo data clarity** | **100% of observers identify demo vs real data** | **Visual indicators (banner + badges) clearly distinguish demo mode** |

---

## 3. Target User (Role-Based)

| Attribute | Value |
|-----------|-------|
| **Role / Context** | Commercial indoor grower managing 2-8 grow rooms with mixed controller hardware (AC Infinity, TrolMaster, Pulse, etc.) |
| **Skill Level** | Intermediate - understands VPD, environmental parameters, but not a programmer |
| **Key Constraint** | Time - checks conditions 3-5x daily while managing physical grow tasks; can't spend 30+ minutes deciphering data |
| **Current Tools** | Multiple native controller apps (AC Infinity, TrolMaster), hand-tracking in spreadsheets, tribal knowledge about "what worked last run" |

---

## 4. Core Use Cases

### 4.1 Happy Path (Primary Flow)

**Start condition:**
> User has 3 rooms: Veg Room A (AC Infinity controller), Flower Room 1 (TrolMaster), Flower Room 2 (TrolMaster). Controllers are connected to EnviroFlow.

**Steps:**

1. User opens enviroflow.app dashboard
2. System displays unified view: all 3 rooms with current VPD, temp, humidity, CO2 (where available)
3. User immediately sees Flower Room 2 has VPD 1.5 (amber warning state) vs user-defined optimal 0.8-1.2
4. User clicks Flower Room 2 card → expands to detailed timeline view
5. User sees 24h VPD trend climbing since 6am, overlaid with color-coded automation zone showing "Lights turned on 6:00am"
6. User identifies correlation: VPD rises when lights turn on without compensating humidity increase
7. User navigates to automations tab, adjusts humidifier automation to increase output during light hours
8. User returns to dashboard, sees real-time update as humidifier activates (instant update with smooth counting animation)

**End condition:**
> User identified and responded to cross-room environmental variance using unified data visualization without switching apps or manually calculating trends.

### 4.2 Critical Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Controller goes offline (Wi-Fi drop) | Dashboard shows "Last updated 5 min ago" with grayed status, maintains last known state, prominent "Connection Lost" indicator |
| Brand A reports temp in Celsius, Brand B in Fahrenheit | System auto-converts all to user's preference setting, displays consistently across all rooms |
| Controller supports only temp/humidity (no CO2) | Dashboard shows available metrics only, empty state says "This controller doesn't report CO2" - no broken UI |
| New controller type added mid-demo | System detects new device, auto-creates room card with "Configure Room Name" prompt, pulls available metrics immediately |
| Historical data not available (new installation) | Timeline shows "Collecting data..." with current values only, explains "24h history available after first day" |
| **User switches view modes mid-session** | **Layout instantly adapts (grid/carousel/split-screen), maintains current room selection, no data loss** |
| **Rapid data updates during animation** | **Animation extends smoothly or queues next update, no jarring snaps or skipped values** |

---

## 5. Functional Decisions (What It Must Do)

| ID | Function | Notes |
|----|----------|-------|
| F1 | **Multi-controller aggregation** | Pull real-time data from 3+ different controller APIs simultaneously |
| F2 | **Unified metric normalization** | Convert all temperature, humidity, pressure units to consistent display format based on user preference |
| F3 | **VPD auto-calculation** | Calculate VPD from temp/humidity when controller doesn't provide it natively using Magnus-Tetens formula |
| F4 | **24-hour timeline visualization** | Display multi-metric graphs with time-aligned automation activity zones, user-toggleable metric visibility |
| F5 | **Status-based visual hierarchy** | Use user-defined optimal ranges and color system (green/amber/red) to prioritize rooms needing attention |
| F6 | **Cross-room comparison with multiple view modes** | User-selectable layouts: primary+mini-cards (default), grid view, carousel, split-screen comparison |
| F7 | **Historical pattern detection** | Surface trends like "VPD climbing for 3+ hours" or "Temp variance +/- 5°F daily" with contextual insights |
| F8 | **Real-time WebSocket updates** | Push new readings to UI within 5 seconds of controller reporting, instant visual updates with smooth animations |
| F9 | **User-configurable metric preferences** | Per-room optimal ranges, hero dial metric selection, timeline visibility toggles, view mode persistence |
| F10 | **Adaptive performance tiers** | Animation quality auto-adjusts based on device capability: full (>55fps), simplified (40-55fps), minimal (<40fps) |

---

## 6. UX Decisions (What the Experience Is Like)

### 6.1 Entry Point

- **How user starts:** Navigate to enviroflow.app → auto-loads to main dashboard (no login required for demo)
- **What they see first:** 
  - **If no controllers connected:** Demo mode with 2-3 sample rooms showing realistic data + prominent "Connect Your First Controller" CTA
  - **If controllers connected:** "Living environment" view showing all connected rooms as cards with current VPD dial + temp/humidity, sorted by status (alerts first, then by weighted priority)

### 6.2 Inputs

| Input | Type | Required | Validation |
|-------|------|----------|------------|
| Room name | Text field | No | Max 50 chars, defaults to "Room 1", "Room 2" |
| **Optimal VPD range (per room)** | **Numeric range (min/max)** | **No** | **0.4-2.0 kPa, defaults: Veg 1.0-1.2, Flower 0.8-1.0** |
| **Optimal temp range (per room)** | **Numeric range (min/max)** | **No** | **50-90°F, user-definable based on growth stage** |
| **Warning tolerance (per room)** | **Numeric** | **No** | **Default ±0.2 kPa for VPD, ±2°F for temp** |
| **Alert threshold (per room)** | **Numeric** | **No** | **Default >0.3 kPa for VPD, >5°F for temp** |
| **Primary metric preference** | **Dropdown select** | **No** | **VPD/Temp/Humidity/CO2, defaults to VPD** |
| **Timeline visible metrics** | **Multi-select checkboxes** | **No** | **Defaults to all available metrics** |
| Temperature unit preference | Toggle (F/C) | No | Defaults to F |
| **View mode preference** | **Segmented control** | **No** | **Primary+Mini/Grid/Carousel/Split, defaults to Primary+Mini** |
| Time range for timeline | Segmented control | No | Options: 1h, 6h, 24h, 7d, defaults to 24h |
| **Animation quality** | **Dropdown** | **No** | **Auto/Full/Reduced/Minimal, defaults to Auto** |

### 6.3 Outputs

| Output | Format | Destination |
|--------|--------|-------------|
| Current environment status | Interactive dashboard cards with user-selected hero metric | Main viewport |
| Historical timeline | SVG/Canvas chart with user-toggleable metrics, automation zones, hover tooltips | Expanded room detail view |
| Automation activity zones | Color-coded background regions on timeline with labels | Overlaid on timeline chart |
| Cross-room comparison table | Side-by-side metric grid in selected view mode | Slide-in panel or grid layout |
| Trend insights | Natural language cards with weighted priority | Below timeline ("VPD trending high 3h") |
| **Smart action cards** | **2-3 contextual cards: alerts (severity-sorted) + info (weighted scoring)** | **Bottom section of dashboard** |

### 6.4 Feedback & States

| State | UI Treatment |
|-------|--------------|
| **Loading** | Skeleton cards with pulsing gradient, "Connecting to controllers..." |
| **Success** | Smooth fade-in, status glow (green) around cards, live data badge, **subtle pulse on metric update** |
| **Failure** | Card shows last known state with red outline, "Connection lost" banner, retry button |
| **Partial results** | Display working controllers normally, show unavailable ones with "Retrying..." status |
| **Awaiting external response** | Spinner on specific metric (e.g., "Refreshing CO2...") while others update normally |
| **Demo mode** | **Prominent "🔵 Viewing Demo Data" banner, DEMO badge on each card, faster animation cycles (3s vs 5s)** |
| **Real connection established** | **Demo mode fade-out animation, banner changes to "✓ Controllers Connected", DEMO badges remove** |
| **View mode switching** | **Smooth transition animation (300ms), layout morphs between modes, no flash/reload** |
| **Performance degradation** | **Subtle indicator in settings: "Animation quality: Reduced (device performance)"** |

### 6.5 Errors (Minimum Viable Handling)

| Error Condition | User Experience |
|-----------------|-----------------|
| **Input is invalid** | Inline red text: "VPD range must be between 0.4-2.0 kPa" with input field shake animation |
| **System/API fails** | Toast notification: "Can't reach [controller name]. Showing last known data." + timestamp |
| **User does nothing (timeout)** | N/A for dashboard (passive monitoring), but idle for 10+ min = pause WebSocket, resume on interaction |
| **Data source unavailable** | Gray out affected metrics, show "Waiting for [controller]..." with spinning icon, rest of dashboard functional |
| **WebSocket disconnection** | Auto-attempt reconnect (exponential backoff: 1s, 2s, 4s, 8s, 16s max), fall back to 30s polling, show "Connection unstable" indicator |
| **Animation performance poor** | Auto-downgrade to simplified tier, show notification: "Reduced animations for better performance" |

### 6.6 First-Time User Experience

**Demo Mode (Zero Controllers Connected):**

EnviroFlow provides immediate value demonstration before configuration:

**Visual Treatment:**
- Dashboard loads with 2-3 sample rooms showing realistic environmental data
- **Prominent banner across top:** "🔵 Viewing Demo Data - Connect your controllers to see real-time monitoring"
- **Each room card displays semi-transparent "DEMO" watermark badge** (top-right corner, 40% opacity)
- **Large, colorful "Connect Your First Controller" CTA button** (top-right, primary color, pulsing glow)

**Demo Data Behavior:**
- Realistic variance patterns: temp climbs during light hours (76°F → 82°F over 6h), humidity inversely correlates (60% → 52%)
- VPD follows natural curve based on temp/humidity changes
- Automation zones visible: "VPD Control" active 6am-8am (light blue zone), "Light Schedule" 6am-6pm (amber zone)
- Timeline populated with 24h of synthetic data showing typical day/night cycles
- **Slightly accelerated update cycles (every 3s instead of 5s)** to showcase live capabilities during demo viewing
- All metrics show realistic "noise" (±0.1 kPa VPD variance, ±1°F temp flutter)

**Transition to Real Mode:**
- **Demo data instantly removed when first real controller connects** (WebSocket connection established)
- Smooth fade-out animation for demo cards (500ms opacity to 0, then remove from DOM)
- Banner changes to "✓ Controllers Connected - Monitoring [N] rooms" with success checkmark
- Demo badges disappear
- Real data streams in with pulse indicators showing "live" status
- **No manual "dismiss demo" option** - demo persists until real connection, forcing user to connect

**Persistent Elements:**
- "+ Add Controller" button remains visible after demo dismissal (moves to top-right header)
- User can add more controllers at any time
- Settings gear icon always accessible for preference configuration

**Purpose:**
- Eliminate "empty state" barrier for first-time users
- Showcase full dashboard capabilities immediately (timeline, automations, cross-room comparison)
- Demonstrate value proposition before configuration effort required
- Reduce demo preparation friction (no need to pre-configure test controllers)
- Build confidence that EnviroFlow handles complex multi-room scenarios

---

## 7. Data & Logic (At a Glance)

### 7.1 Data Source Matrix

| Data Point | Source(s) | Sync Direction | Frequency | Fallback |
|------------|-----------|----------------|-----------|----------|
| Temperature | Controller APIs (AC Infinity, TrolMaster, etc.) | Inbound | Real-time (WebSocket) or 1-5s poll | Last known value + "stale" indicator after 30s |
| Humidity | Controller APIs | Inbound | Real-time or 1-5s poll | Last known value + "stale" indicator after 30s |
| VPD | Controller API (if native) OR calculated | Inbound or calculated | Same as temp/humidity | Calculate from temp/humidity using Magnus-Tetens |
| CO2 | Controller API (if available) | Inbound | Real-time or 1-5s poll | Show "N/A" if controller doesn't support |
| Automation events | EnviroFlow automation engine | Inbound (logged internally) | Real-time on trigger | Queried from local PostgreSQL |
| **Automation activity periods** | **EnviroFlow automation engine** | **Inbound (logged with start/end timestamps)** | **Real-time state changes** | **Stored in PostgreSQL, queried for timeline range** |
| User preferences | EnviroFlow user settings DB (Supabase) | Bidirectional | On change + page load | Browser localStorage cache, queue sync when connection restored |
| Historical data | Time-series database (InfluxDB/TimescaleDB) | Inbound (queried) | On timeline load | In-memory cache (last 1000 points), show "Historical data unavailable" for older ranges |
| **User interaction patterns** | **Frontend analytics (local)** | **Outbound (logged locally)** | **On room view, setting change** | **Used for smart card scoring, not persisted long-term** |

### 7.2 Processing Logic

**Real-Time Update Flow:**
```
Controller APIs (WebSocket or 1-5s polling)
  → Receive new data point
  → Normalize units (F↔C conversion based on user preference)
  → Calculate VPD if not provided by controller
  → Determine status color based on user-defined optimal range
  → Immediately push to frontend via WebSocket (no batching/throttling)
  → Trigger smooth counting animation (400ms duration, easeOutExpo easing)
  → Brief pulse indicator on updated metric (subtle glow, 200ms)
  → Update time-series database asynchronously (non-blocking write)
  → If change crosses optimal threshold → trigger smart card re-prioritization
```

**VPD Calculation (when not provided by controller):**
```
Input: Temperature (T in °C), Relative Humidity (RH in %)

Step 1: Calculate Saturation Vapor Pressure (SVP)
  SVP = 0.61078 × exp((17.27 × T) / (T + 237.3))  // kPa

Step 2: Calculate VPD
  VPD = SVP × (1 - RH/100)  // kPa

Error handling:
  - If T < 0°C or T > 50°C: return null, show "Invalid temp for VPD"
  - If RH < 0% or RH > 100%: return null, show "Invalid humidity for VPD"
  - Round result to 2 decimal places
```

**Smart Card Prioritization Algorithm:**
```
1. Check for alert conditions (deviation from user-defined optimal ranges)
   → If RED alert exists (deviation > alert threshold): place at position 1 (highest priority)
   → If AMBER warning exists (deviation > warning tolerance): place at position 2
   
2. For non-alert cards, calculate weighted score for each room/automation:
   
   Severity score (40%):
     - Distance from optimal range (0-1 normalized)
     - Formula: min(1, deviation / alert_threshold)
   
   Recency score (30%):
     - Time since last significant change (0-1, decay over 1 hour)
     - Formula: max(0, 1 - (minutes_since_change / 60))
   
   User pattern score (20%):
     - Room view frequency (0-1, based on last 7 days)
     - Formula: room_views / max_room_views_any_room
   
   Time context score (10%):
     - Relevance to time of day (0-1)
     - Examples: Light schedule card scores 1.0 within 1h of sunrise/sunset, 0.2 otherwise
     - Automation cards score higher when next trigger is <1h away

3. Calculate total weighted score:
   total_score = (severity × 0.4) + (recency × 0.3) + (user_pattern × 0.2) + (time_context × 0.1)

4. Sort cards by: Alert tier (RED > AMBER) → Total weighted score (descending)

5. Display top 3 cards

6. Re-calculate on:
   - New data arrival (any metric change)
   - User interaction (room view, setting change)
   - 60-second timer (for time context updates)
```

**Color Status Determination (Per Room, Per Metric):**
```
Input: 
  - current_value (e.g., VPD = 1.4 kPa)
  - user_optimal_min (e.g., 0.8 kPa)
  - user_optimal_max (e.g., 1.2 kPa)
  - warning_tolerance (e.g., ±0.2 kPa)
  - alert_threshold (e.g., >0.3 kPa)

Step 1: Calculate deviation from optimal range
  if current_value < user_optimal_min:
    deviation = user_optimal_min - current_value
  else if current_value > user_optimal_max:
    deviation = current_value - user_optimal_max
  else:
    deviation = 0  // Within optimal range

Step 2: Determine status tier
  if deviation == 0:
    status = "optimal" (GREEN)
  else if deviation <= warning_tolerance:
    status = "warning" (AMBER)
  else if deviation > alert_threshold:
    status = "alert" (RED)

Step 3: Apply gradient color interpolation for smooth transitions
  - Use HSL color space for smooth gradient
  - GREEN: hsl(142, 71%, 45%) - #10b981
  - AMBER: hsl(38, 92%, 50%) - #f59e0b
  - RED: hsl(0, 72%, 51%) - #ef4444
  
  - Interpolate based on deviation percentage within each tier
  - Example: Warning tier (0.2-0.3 kPa deviation) gradually shifts from green-amber to amber

Step 4: Apply to visual elements
  - Dial stroke color
  - Card border glow
  - Status indicator dot
  - Timeline zone background
```

**Animation Performance Tier Selection:**
```
On page load and periodically (every 30s):

1. Measure frame rate using requestAnimationFrame
   - Sample 60 frames
   - Calculate average FPS

2. Check user preference setting
   if user_setting == "Manual Override":
     use selected tier (Full/Reduced/Minimal)
     return

3. Auto-detect tier based on performance:
   if avg_fps > 55:
     tier = "Full"
     // Enable all animations: pulse glows, smooth counting, chart easing, transitions
   else if avg_fps >= 40 and avg_fps <= 55:
     tier = "Simplified"
     // Disable: pulse glows, complex chart easing
     // Keep: smooth counting (faster at 200ms), basic transitions
   else if avg_fps < 40:
     tier = "Minimal"
     // Disable: all decorative effects
     // Keep: essential data update animations (instant counting 100ms)

4. Apply tier CSS class to root element
   <div class="animation-tier-{tier}">
   
5. Show subtle notification on tier change (only if downgrading):
   "Animations reduced for better performance"
   
6. Respect prefers-reduced-motion media query as override:
   if prefers-reduced-motion == "reduce":
     tier = "Minimal"
```

### 7.3 Output Destinations

| Output | Destination | Persistence |
|--------|-------------|-------------|
| Live dashboard state | Browser (React components via WebSocket) | Temporary (in-memory, clears on page reload) |
| Historical timeline data | Browser (chart library with 5-min cache) | Temporary (re-fetched on timeline view) |
| Automation activity zones | Browser (overlaid on timeline) | Stored (PostgreSQL, queried per timeline range) |
| Trend insights | Browser (smart action cards, re-calculated dynamically) | Temporary (re-generated on data changes) |
| User preference changes | Server API → Supabase PostgreSQL | Persistent (synced across devices/sessions) |
| **User interaction patterns** | **Browser localStorage (view counts, timestamps)** | **Persistent locally (7-day rolling window)** |
| **Performance metrics (FPS)** | **Browser memory only** | **Temporary (not logged or stored)** |

---

## 8. Integration Touchpoints

| System | Interaction Type | Direction | Critical? | Fallback if Unavailable |
|--------|------------------|-----------|-----------|-------------------------|
| **AC Infinity Cloud API** | Read environmental data | In | Yes | Mock data stream with realistic variance for demo (temp: 72-78°F sine wave, humidity: 55-62% inverse correlation) |
| **TrolMaster API** | Read environmental data | In | Yes | Mock data stream with realistic variance for demo |
| **Pulse API** (optional) | Read environmental data | In | No | Gracefully omit, show "Pulse integration coming soon" badge in Add Controller flow |
| **EnviroFlow Automation Engine** | Read automation events & activity periods | In | Yes (internal) | Show empty state "No automations configured yet" + "Create Automation" CTA |
| **Time-Series Database** (InfluxDB) | Write live data / Read historical | Both | Yes (internal) | **Real-time view continues with in-memory cache (last 1000 points), timeline shows "Historical data unavailable" message for ranges beyond cache** |
| **WebSocket Server** | Push real-time updates | Out | Yes (internal) | **Fall back to 30s HTTP polling (auto-detect after 3 missed heartbeats at 5s intervals = 15s detection), show "Connection unstable - using polling" indicator** |
| **User Settings DB** (Supabase) | Read/Write preferences | Both | No | **Use browser localStorage cache, queue writes for sync when connection restored, show "⚠️ Settings saved locally (will sync)" indicator** |

**Integration Notes:**
- **AC Infinity & TrolMaster**: Critical for demo credibility. If live APIs unavailable, use high-fidelity mocks with realistic data patterns (e.g., temp rises when lights turn on at 6am, humidity inversely correlates, VPD follows natural curve)
- **WebSocket**: Core to "live dashboard" feel. HTTP polling fallback acceptable (30s) but degrades demo impact. Ensure reconnection logic is robust (exponential backoff: 1s, 2s, 4s, 8s, max 16s)
- **Time-Series DB**: Nice-to-have for demo. Can simulate with in-memory sliding window if infrastructure not ready. Timeline should gracefully degrade to "last 1 hour only" if database unavailable.
- **Demo Data**: Mock controller responses should include realistic metadata (controller_id, room_name, timestamp) to match production data shape

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1)
**Sprint Goal:** Core infrastructure and design system

**Tasks:**
- [ ] Set up Next.js 14+ project with TypeScript strict mode
- [ ] Configure Tailwind CSS with design tokens (colors, fonts, spacing)
- [ ] Create base component library (GlassmorphicCard, Button, StatusGlow, etc.)
- [ ] Implement Zustand stores (environmentStore, userPrefsStore)
- [ ] Set up WebSocket connection infrastructure (connection manager, reconnection logic)
- [ ] Create mock data generators (realistic controller responses with variance)
- [ ] Build layout shell with bottom navigation

**Deliverables:**
- Working Next.js app with routing
- Design system documentation (Storybook)
- Mock data API responding with realistic environmental data
- Persistent user preference storage (localStorage + optional Supabase sync)

### Phase 2: Dashboard Core (Week 2)
**Sprint Goal:** Main dashboard with live data and user configurability

**Tasks:**
- [ ] Build VPDDial component (user-selectable primary metric, smooth animations)
- [ ] Build EnvironmentSnapshot component (temp/humidity surrounding hero dial)
- [ ] Implement AnimatedNumber component with performance tier support
- [ ] Create user preference panel (optimal ranges, warning/alert thresholds)
- [ ] Integrate real-time WebSocket updates (instant UI refresh on data arrival)
- [ ] Add connection status handling (online/offline indicators, last update timestamp)
- [ ] Implement pull-to-refresh for mobile
- [ ] Build demo mode (pre-loaded sample data, DEMO badges, CTA button)

**Deliverables:**
- Functional main dashboard with live updates
- User-configurable optimal ranges per room
- Demo mode for first-time users
- Responsive layout (mobile + desktop with vertical stacking)

### Phase 3: Timeline & Visualization (Week 3)
**Sprint Goal:** Data visualization with automation zones and user controls

**Tasks:**
- [ ] Build IntelligentTimeline component (multi-metric chart with shared X-axis)
- [ ] Implement automation activity zones (color-coded background regions)
- [ ] Create metric visibility toggles (checkboxes in legend, persist per room)
- [ ] Implement chart interactions (zoom, pan, hover tooltips)
- [ ] Create time range selector (1h/6h/24h/7d with smooth transitions)
- [ ] Add automation event markers/zones with click-to-expand details
- [ ] Build detailed tooltip component (all metrics at timestamp)
- [ ] Implement data export feature (CSV download of timeline data)

**Deliverables:**
- Interactive timeline chart with user-toggleable metrics
- Automation activity zones showing active periods
- Historical data view with export capability
- Touch-optimized interactions for mobile

### Phase 4: Multi-Room & View Modes (Week 4)
**Sprint Goal:** Cross-room comparison with multiple layout options

**Tasks:**
- [ ] Build view mode selector component (Primary+Mini/Grid/Carousel/Split)
- [ ] Implement Primary+Mini-cards layout (default)
- [ ] Implement Grid view (all rooms equal size, responsive grid)
- [ ] Implement Carousel view (swipe-enabled for mobile)
- [ ] Implement Split-screen comparison (side-by-side synchronized timelines)
- [ ] Add smooth transitions between view modes (300ms morph animations)
- [ ] Create room switcher component (for Primary+Mini mode)
- [ ] Persist user's preferred view mode in settings

**Deliverables:**
- 4 distinct view modes with smooth transitions
- User preference persistence across sessions
- Mobile-optimized layouts (carousel on small screens)
- Side-by-side comparison capability

### Phase 5: Smart Features & Intelligence (Week 5)
**Sprint Goal:** AI-powered suggestions and contextual recommendations

**Tasks:**
- [ ] Build SmartActionCards component with priority queue system
- [ ] Implement weighted scoring algorithm (severity 40%, recency 30%, patterns 20%, time context 10%)
- [ ] Create alert detection logic (RED/AMBER tier classification)
- [ ] Build trend analysis engine (pattern detection: "VPD climbing 3h+")
- [ ] Add user interaction tracking (room view frequency, time spent)
- [ ] Implement time-of-day context scoring (sunrise/sunset awareness)
- [ ] Create notification system for critical alerts (visual only, no push)
- [ ] Build smart defaults engine (suggest optimal ranges based on room type)

**Deliverables:**
- Contextual action cards (max 3 visible, dynamically prioritized)
- Alert-first prioritization system
- Trend insights with natural language descriptions
- User pattern-aware recommendations

### Phase 6: Settings & Preferences (Week 6)
**Sprint Goal:** Comprehensive user customization and profile management

**Tasks:**
- [ ] Build settings interface (multi-tab panel: General, Rooms, Appearance, Advanced)
- [ ] Create per-room configuration UI (optimal ranges with visual sliders + preview)
- [ ] Add animation quality selector (Auto/Full/Reduced/Minimal with manual override)
- [ ] Implement temperature unit toggle (F/C with instant conversion)
- [ ] Build view mode persistence and defaults management
- [ ] Create user preference import/export (JSON backup/restore)
- [ ] Add "Reset to Defaults" functionality with confirmation
- [ ] Build onboarding flow (first-time setup wizard for optimal ranges)

**Deliverables:**
- Complete settings panel with all user preferences
- Per-room customization interface
- Import/export functionality for user profiles
- Onboarding wizard for new users

### Phase 7: Polish & Performance (Week 7)
**Sprint Goal:** Optimization, accessibility, and production readiness

**Tasks:**
- [ ] Performance optimization (bundle size < 500KB gzipped, code splitting by route)
- [ ] Implement animation tier auto-detection (frame rate monitoring)
- [ ] Animation fine-tuning (smooth easing curves, consistent timing)
- [ ] Accessibility audit (WCAG AA compliance: contrast, keyboard navigation, ARIA labels)
- [ ] Error boundary implementation (graceful degradation on component failures)
- [ ] Loading state improvements (skeleton screens, progressive enhancement)
- [ ] Mobile gesture refinements (touch targets 44x44px minimum, swipe sensitivity)
- [ ] Cross-browser testing (Chrome, Safari, Firefox, Edge)
- [ ] Performance testing on budget devices (mid-range Android phone, older laptop)

**Deliverables:**
- Optimized bundle (<500KB, <2s initial load on 3G)
- 60fps animations on modern devices, graceful degradation on older hardware
- WCAG AA accessibility compliance
- Robust error handling with user-friendly messages

### Phase 8: Testing & Demo Prep (Week 8)
**Sprint Goal:** QA, demo rehearsal, and production deployment

**Tasks:**
- [ ] Write E2E tests (Playwright) for critical user paths (view dashboard, switch rooms, adjust settings)
- [ ] Unit test coverage >80% (components, utilities, stores)
- [ ] Integration tests for WebSocket connection handling
- [ ] Demo data refinement (ensure realistic variance, multiple growth scenarios)
- [ ] Beta user testing (3-5 growers with real controllers)
- [ ] Bug fixes from testing feedback
- [ ] Production deployment setup (Vercel with environment variables)
- [ ] Monitoring/analytics setup (error tracking, performance metrics)
- [ ] Documentation completion (README, setup guide, API integration docs)
- [ ] Demo rehearsal (ensure smooth flow, backup plans for connectivity issues)

**Deliverables:**
- Comprehensive test coverage (E2E + unit + integration)
- Beta feedback incorporated and bugs resolved
- Production deployment with monitoring
- Demo-ready application with fallback strategies

---

## 10. Performance Targets

### Load Performance
```
- Initial page load: <2s (3G network)
- Time to interactive: <3s
- First contentful paint: <1s
- Bundle size: <500KB (gzipped)
- WebSocket connection established: <1s
```

### Runtime Performance
```
- 60fps animations on modern devices (laptop, recent phone)
- 40fps minimum on budget devices (graceful degradation)
- WebSocket latency: <100ms server to UI update
- Chart render time: <200ms (1000 data points)
- Smooth scrolling on mobile (no jank)
- Data update animation: 400ms (smooth counting)
```

### Optimization Strategies
```
- Code splitting by route (lazy load timeline, settings)
- Dynamic imports for heavy components (charts loaded on-demand)
- Image optimization (WebP format with fallbacks)
- Font subsetting (only characters used in UI)
- Service worker caching (static assets, API responses)
- Virtual scrolling for long lists (automation events, historical data)
- Debounced inputs (search, range sliders)
- Memoized calculations (VPD, color status, smart card scores)
- Batched DOM updates (React batching, minimize re-renders)
```

---

## 11. Testing Requirements

### Unit Tests (Jest + React Testing Library)
```typescript
// Component tests
describe('VPDDial', () => {
  it('renders current VPD value with user-selected metric', () => {});
  it('animates smoothly when value changes (400ms duration)', () => {});
  it('shows optimal color when within user-defined range', () => {});
  it('shows warning color when deviation < warning tolerance', () => {});
  it('shows alert color when deviation > alert threshold', () => {});
  it('displays historical 24h trend as background arc', () => {});
  it('handles tap interaction to expand details', () => {});
  it('respects animation tier setting (Full/Reduced/Minimal)', () => {});
});

describe('IntelligentTimeline', () => {
  it('displays all metrics by default', () => {});
  it('toggles metric visibility via checkboxes', () => {});
  it('shows automation zones as background regions', () => {});
  it('handles click on zone to show automation details', () => {});
  it('updates in real-time when new data arrives', () => {});
  it('persists user metric visibility preferences', () => {});
});

describe('SmartActionCards', () => {
  it('prioritizes RED alerts first', () => {});
  it('calculates weighted score correctly (40/30/20/10 split)', () => {});
  it('displays max 3 cards', () => {});
  it('re-prioritizes when new data arrives', () => {});
  it('respects user interaction patterns in scoring', () => {});
});

// Utility tests
describe('vpdCalculation', () => {
  it('calculates VPD correctly using Magnus-Tetens formula', () => {});
  it('handles edge cases (0°C, 50°C, 0% RH, 100% RH)', () => {});
  it('returns null for invalid inputs', () => {});
  it('rounds to 2 decimal places', () => {});
});

describe('colorStatusDetermination', () => {
  it('returns green when within user optimal range', () => {});
  it('returns amber when deviation <= warning tolerance', () => {});
  it('returns red when deviation > alert threshold', () => {});
  it('interpolates color gradient smoothly', () => {});
});
```

### Integration Tests
```
- WebSocket connection handling (connect, disconnect, reconnect)
- API error recovery (timeout, 500 error, network failure)
- State synchronization (store updates trigger UI re-renders)
- Multi-component interactions (changing view mode updates all room cards)
- User preference persistence (localStorage ↔ Supabase sync)
- Demo mode transitions (demo data → real data fade-out)
```

### E2E Tests (Playwright)
```typescript
test('user can view dashboard and interact with controls', async ({ page }) => {
  // Test main dashboard flow
  await page.goto('/dashboard');
  await expect(page.locator('[data-testid="vpd-dial"]')).toBeVisible();
  
  // Test real-time updates
  const vpdValue = page.locator('[data-testid="vpd-value"]');
  const initialValue = await vpdValue.textContent();
  await page.waitForTimeout(6000); // Wait for next data update
  const updatedValue = await vpdValue.textContent();
  expect(updatedValue).not.toBe(initialValue);
  
  // Test view mode switching
  await page.click('[data-testid="view-mode-grid"]');
  await expect(page.locator('[data-testid="grid-layout"]')).toBeVisible();
  
  // Test user preferences
  await page.click('[data-testid="settings-button"]');
  await page.fill('[data-testid="optimal-vpd-min"]', '0.9');
  await page.fill('[data-testid="optimal-vpd-max"]', '1.1');
  await page.click('[data-testid="save-settings"]');
  
  // Verify color status updated based on new range
  await expect(page.locator('[data-testid="room-card-1"]')).toHaveClass(/status-optimal|status-warning|status-alert/);
});

test('demo mode transitions to real mode on controller connection', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Verify demo mode active
  await expect(page.locator('[data-testid="demo-banner"]')).toBeVisible();
  await expect(page.locator('[data-testid="demo-badge"]')).toHaveCount(3);
  
  // Simulate controller connection (via WebSocket mock)
  await page.evaluate(() => {
    window.mockWebSocket.send(JSON.stringify({
      type: 'controller_connected',
      data: { controller_id: 'ctrl_123', name: 'Veg Room A' }
    }));
  });
  
  // Verify demo mode removed
  await expect(page.locator('[data-testid="demo-banner"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="demo-badge"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="connected-banner"]')).toBeVisible();
});
```

### Coverage Targets
```
- Unit test coverage: >80% (components, utilities, stores)
- Integration test coverage: >60% (critical data flows)
- E2E tests for critical paths: 100% (dashboard view, settings, view modes, demo mode)
```

---

## 12. Accessibility Checklist

- [ ] **WCAG AA color contrast** (4.5:1 minimum for text, 3:1 for UI components)
  - Test all status colors (green/amber/red) against backgrounds
  - Ensure timeline chart has sufficient contrast for colorblind users
- [ ] **Keyboard navigation** for all interactive elements
  - Tab order logical (top to bottom, left to right)
  - Focus indicators clearly visible (2px outline, high contrast)
  - Escape key closes modals/panels
  - Enter/Space activates buttons and toggles
- [ ] **Screen reader support** (ARIA labels and live regions)
  - All icons have aria-label (e.g., "Settings", "Add Controller")
  - Live regions for real-time data updates (aria-live="polite")
  - Status indicators announced (e.g., "VPD optimal at 1.0 kPa")
  - Chart data accessible via table alternative (hidden visually, exposed to screen readers)
- [ ] **Touch targets minimum 44x44px** on mobile
  - All buttons, toggles, sliders meet minimum size
  - Adequate spacing between interactive elements (8px minimum)
- [ ] **Reduced motion support**
  - Respect prefers-reduced-motion media query
  - Provide manual override in settings ("Animation quality: Minimal")
  - Essential animations remain (data updates) but simplified
- [ ] **High contrast mode support**
  - Test in Windows High Contrast Mode
  - Ensure borders/outlines visible when background images disabled
- [ ] **Font scaling** (up to 200% zoom)
  - Layout doesn't break at 200% browser zoom
  - No horizontal scrolling required at 200% zoom
  - Text remains readable, no overlapping elements
- [ ] **Alt text for all images/icons**
  - Controller brand logos have descriptive alt text
  - Decorative images use alt=""
- [ ] **Form validation announcements**
  - Error messages associated with inputs (aria-describedby)
  - Inline validation doesn't require color alone
  - Success confirmations announced to screen readers

---

## 13. Deployment Configuration

### Environment Variables
```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.enviroflow.app
NEXT_PUBLIC_WS_URL=wss://ws.enviroflow.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_ANALYTICS_ID=your_analytics_id

# .env.development
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_dev_anon_key
```

### Vercel Configuration
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1", "sfo1"],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://api.enviroflow.app",
    "NEXT_PUBLIC_WS_URL": "wss://ws.enviroflow.app"
  }
}
```

### CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm test -- --coverage
      - name: Run E2E tests
        run: npm run test:e2e
      - name: Check test coverage
        run: npm run test:coverage:check
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build production bundle
        run: npm run build
      - name: Analyze bundle size
        run: npm run analyze
      - name: Optimize assets
        run: npm run optimize
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
      - name: Run smoke tests
        run: npm run test:smoke
      - name: Notify team
        run: curl -X POST ${{ secrets.SLACK_WEBHOOK }} -d '{"text":"EnviroFlow deployed to production"}'
```

---

## 14. Documentation Requirements

### For Developers
- [ ] Component API documentation (Storybook with live examples)
- [ ] Setup/installation guide (README with step-by-step instructions)
- [ ] Architecture decision records (why WebSocket over polling, why Zustand over Redux)
- [ ] Contributing guidelines (code style, commit conventions, PR template)
- [ ] API integration guide (how to add new controller brands)
- [ ] Testing guide (how to write tests, mocking strategies)

### For Users
- [ ] Feature walkthrough (interactive tour on first load)
- [ ] Video tutorials (3-5 min videos: setup, customization, troubleshooting)
- [ ] FAQ (common questions about controllers, data accuracy, settings)
- [ ] Troubleshooting guide (connection issues, performance problems)
- [ ] Release notes (changelog with new features, bug fixes)

---

## 15. Launch Checklist

### Pre-Launch
- [ ] All core features implemented (F1-F10)
- [ ] Tests passing (unit >80%, integration >60%, E2E critical paths 100%)
- [ ] Performance targets met (<2s load, 60fps animations on modern devices)
- [ ] Accessibility audit passed (WCAG AA compliance verified)
- [ ] Cross-browser testing complete (Chrome, Safari, Firefox, Edge)
- [ ] Mobile testing on real devices (iOS Safari, Android Chrome)
- [ ] Security audit completed (no exposed API keys, XSS vulnerabilities)
- [ ] Analytics configured (page views, user interactions, error rates)
- [ ] Error monitoring set up (Sentry or equivalent)
- [ ] Documentation complete (user guides, developer docs)

### Launch Day
- [ ] Deploy to production (Vercel with environment variables set)
- [ ] Monitor error rates (Sentry dashboard, no critical errors)
- [ ] Check performance metrics (Lighthouse score >90, <2s load time)
- [ ] Verify WebSocket connections (multiple concurrent users)
- [ ] Test critical user paths (view dashboard, switch rooms, adjust settings)
- [ ] Customer support ready (FAQ published, support email monitored)
- [ ] Social media announcement prepared (screenshots, demo video)

### Post-Launch (First Week)
- [ ] Gather user feedback (surveys, support tickets, user interviews)
- [ ] Monitor analytics (user retention, feature adoption, error rates)
- [ ] Track error reports (categorize by severity, prioritize fixes)
- [ ] Plan iteration 1 (based on top user requests and bug reports)
- [ ] Document learnings (what worked well, what needs improvement)
- [ ] Update roadmap (L3 recommendations, additional controller integrations)

---

## 16. Success Criteria (Demo Readiness)

A demo is considered **successful** when:

- [ ] Dashboard loads and displays 3 rooms with different controller brands (or convincing demo data)
- [ ] VPD dial animates smoothly and shows accurate color-coded status based on user-defined ranges
- [ ] Timeline chart displays 24h of data with automation activity zones visible as background regions
- [ ] Real-time updates are visible (value changes within 5 seconds with smooth counting animation)
- [ ] Cross-room comparison clearly shows environmental variance using selected view mode
- [ ] Works responsively on laptop (desktop view) and mobile (vertical stacking)
- [ ] Graceful error handling when controller "goes offline" (unplug test shows last known state + indicator)
- [ ] Observer can answer: "Which room has the VPD problem?" in <5 seconds
- [ ] **Demo mode clearly distinguishes sample data from real data** (banner + badges visible)
- [ ] **User can configure optimal ranges and see status colors update immediately**
- [ ] **Multiple view modes work** (can switch between Primary+Mini, Grid, Carousel, Split without bugs)
- [ ] **Smart action cards show contextually relevant information** (alerts appear first)
- [ ] **Animation quality adapts to device performance** (graceful degradation observable on slower device)

---

## Assumptions (Explicit)

1. **Controller APIs are accessible**: AC Infinity and TrolMaster provide documented APIs or reverse-engineered endpoints that are stable enough for production use
2. **WebSocket infrastructure exists**: Backend can push updates to connected clients with <100ms latency, or polling fallback works acceptably at 30s intervals
3. **Demo environment is controlled**: Using staging/test controllers or reliable mocks, not dependent on production grow facilities during demo presentations
4. **Single-user context**: No multi-tenancy, authentication, or sharing features required for this demo (each user has isolated dashboard)
5. **Modern browser target**: Chrome/Safari/Edge latest versions, no IE11 support needed
6. **Network reliability**: Assume reasonable internet connection (3G minimum) for WebSocket stability
7. **User technical comfort**: Target users can navigate settings, adjust ranges, and understand environmental metrics (VPD, temp, humidity)
8. **Controller metadata available**: Controllers provide room names, device types, or can be manually labeled by users
9. **Time-series database capacity**: InfluxDB or equivalent can handle 5-10 rooms × 4 metrics × 1-min intervals = ~50k data points per day without performance degradation
10. **Mobile web acceptable**: Users will accept responsive web experience vs native mobile app for this demo phase

---

## Appendix: Design Tokens Reference

### Color System
```css
/* Status Colors (User-defined range dependent) */
--status-optimal-from: #10b981;  /* Emerald 500 */
--status-optimal-to: #059669;    /* Emerald 600 */

--status-warning-from: #f59e0b;  /* Amber 500 */
--status-warning-to: #d97706;    /* Amber 600 */

--status-alert-from: #ef4444;    /* Red 500 */
--status-alert-to: #dc2626;      /* Red 600 */

/* Base Colors */
--env-bg: #1a1f2e;               /* Deep charcoal */
--env-surface: #242938;          /* Slightly lighter surface */
--env-border: rgba(255, 255, 255, 0.08);

/* Functional Colors */
--accent-blue: #3b82f6;          /* Blue 500 - interactive elements */
--text-primary: #ffffff;
--text-secondary: rgba(255, 255, 255, 0.6);
--text-tertiary: rgba(255, 255, 255, 0.4);

/* Automation Zone Colors */
--zone-vpd-control: rgba(59, 130, 246, 0.15);    /* Blue 500, 15% opacity */
--zone-light-schedule: rgba(245, 158, 11, 0.15); /* Amber 500, 15% opacity */
--zone-fan-override: rgba(139, 92, 246, 0.15);   /* Violet 500, 15% opacity */
```

### Typography Scale
```css
/* Hero Numbers - Dashboard primary metrics */
--font-hero: 72px;
--weight-hero: 200;     /* Ultra-light */
--line-height-hero: 1;

/* Metric Numbers - Secondary readings */
--font-metric: 64px;
--weight-metric: 300;   /* Light */
--line-height-metric: 1.1;

/* Supporting Data - Context and labels */
--font-supporting: 18px;
--weight-supporting: 400;  /* Regular */
--line-height-supporting: 1.5;

/* Context Text - Micro-copy */
--font-context: 14px;
--weight-context: 500;     /* Medium */
--line-height-context: 1.4;
```

### Spacing Scale
```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
--space-2xl: 48px;
```

### Animation Timing
```css
/* Transitions */
--transition-fast: 200ms;      /* Hover states, tooltips */
--transition-base: 300ms;      /* Most UI transitions */
--transition-slow: 400ms;      /* Number counting, data updates */
--transition-layout: 500ms;    /* Layout changes, view mode switches */

/* Easing Curves */
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);      /* Smooth out */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);  /* Subtle bounce */
--ease-expo: cubic-bezier(0.19, 1, 0.22, 1);       /* Expo out */
```

---

**End of PRD**

This document provides complete specifications for building the EnviroFlow Dashboard with all clarifications integrated. Ready for developer handoff and implementation sprint planning.