# EnviroFlow Phase 1 Kickoff Guide
**Phase 1: Foundation - Onboarding & Error Recovery**
**Duration:** 3 weeks | **Effort:** 80 developer hours
**Date:** January 24, 2026

---

## Phase Overview

### What Phase 1 Accomplishes
- Reduce controller onboarding time from 8 minutes to 3 minutes
- Improve first-attempt connection success rate from 75% to 95%
- Provide real-time health monitoring for all controllers
- Create self-service error recovery for users

### Success Criteria
- Interactive onboarding tour: 60%+ completion rate
- Error guidance system: users fix issues in <2 min (vs 10 min average now)
- Health monitoring: alerts for 90%+ offline events within 30 min
- Support tickets related to onboarding: 50% reduction

### Team Capacity
- **2-3 senior developers** (280 hours spread across Phase 1-4)
- **1 code auditor** (review before Phase 2)
- **1 architect/PM** (decision support)

---

## Work Breakdown - Phase 1 Tasks

### Group 1A: Onboarding Experience (3 tasks, 15 hrs)

#### TASK-001: Interactive Onboarding Tour Component (6 hrs)
**Assigned to:** coder
**Dependency:** None (start immediately)

**What to build:**
- Overlay component that appears on first login
- 5 progressive steps with animations
- Step titles: Dashboard Overview → Sensor Monitoring → Device Control → Automation Basics → Next Steps
- Dismissible and re-triggerable from Help menu
- Mobile responsive (critical: 60% users on mobile)

**Acceptance Criteria:**
```
[ ] Tour component shows all 5 steps correctly
[ ] Persists completion state (localStorage)
[ ] Mobile layout works on screens <600px
[ ] Analytics track which steps users skip
[ ] No jank/lag during animations
```

**Files to Create/Update:**
- `NEW: /apps/web/src/components/OnboardingTour.tsx`
- `UPDATE: /apps/web/src/types/index.ts` (add OnboardingStep type)
- `NEW: /apps/web/src/lib/onboarding-content.ts` (step definitions)
- `NEW: /apps/web/src/hooks/use-onboarding.ts` (state management)

**Technical Approach:**
```typescript
// Structure
interface OnboardingStep {
  id: string
  title: string
  description: string
  targetElement?: string  // selector for highlight
  action?: string         // e.g., "click-to-continue"
  skippable: boolean
}

// Component takes steps[] + onComplete callback
// Uses shadcn Dialog or custom overlay
// Stores completion in localStorage + DB
```

**Resources:**
- Reference onboarding flows: Vercel, Linear, GitHub
- Use shadcn Popover + Dialog for positioning
- React Spring for smooth animations
- Store state in context to prevent re-renders

**Unblocks:** TASK-002, TASK-003 (and everything downstream)

---

#### TASK-002: Contextual Tooltips & Help System (5 hrs)
**Assigned to:** coder
**Dependency:** TASK-001 (need onboarding hook)

**What to build:**
- Reusable tooltip component for form fields
- Help icons with detailed explanations
- Modal view of full help content + external links
- Keyboard accessible (Tab through, Enter to expand)
- Emoji/icons make content scannable

**Acceptance Criteria:**
```
[ ] Tooltips on: controller name, credentials, room, device ports
[ ] Help modal shows full content + links
[ ] Mobile: tooltips stay visible and accessible
[ ] Keyboard: fully navigable with Tab/Enter/Escape
[ ] Performance: no layout shift when tooltip appears
```

**Files to Create/Update:**
- `NEW: /apps/web/src/components/HelpTooltip.tsx`
- `NEW: /apps/web/src/components/TooltipProvider.tsx` (context)
- `NEW: /apps/web/src/lib/help-content.ts`
- `UPDATE: /apps/web/src/app/controllers/wizard/[step]/page.tsx` (add tooltips)

**Technical Approach:**
```typescript
// Central help content registry
const HELP_CONTENT = {
  'controller-name': {
    title: 'Controller Name',
    description: 'A friendly name to identify this device...',
    icon: '📝',
    links: [{ text: 'More info', url: 'https://...' }]
  },
  // ... more entries
}

// Usage in forms
<HelpTooltip id="controller-name" />
```

**Resources:**
- shadcn Tooltip, Popover, Dialog components
- Help content lives in config (not hard-coded in JSX)
- Icons from lucide-react or emoji

**Unblocks:** TASK-003

---

#### TASK-003: Smart Defaults & Room Suggestion (4 hrs)
**Assigned to:** coder
**Dependency:** TASK-002

**What to build:**
- Auto-fill controller name with brand + model
- Pre-select room (if 1 exists), prompt to create (if 0 exist)
- Smart room suggestion based on controller type
- Auto-detect timezone from browser geolocation
- All defaults overridable

**Acceptance Criteria:**
```
[ ] Name auto-fills: "AC Infinity Controller 69"
[ ] Room pre-selection logic: 1 room → select | 0 rooms → create prompt
[ ] Room suggestions: temp/humidity → "Grow Room", climate → "Ambient"
[ ] Timezone auto-detects from geolocation (with fallback)
[ ] All defaults can be overridden before submit
```

**Files to Create/Update:**
- `UPDATE: /apps/web/src/app/controllers/wizard/[step]/page.tsx`
- `NEW: /apps/web/src/lib/room-suggestions.ts`
- `NEW: /apps/web/src/hooks/use-geolocation.ts`
- `UPDATE: /apps/web/src/types/index.ts` (if needed)

**Technical Approach:**
```typescript
// Room suggestion logic
const suggestRoom = (controllerType: SensorType[]) => {
  if (hasTemp && hasHumidity) return "Grow Room"
  if (hasTemp && !hasHumidity) return "Climate"
  // ... more patterns
}

// Auto-detect timezone
const useGeolocation = () => {
  const [timezone, setTimezone] = useState('UTC')
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(pos => {
      setTimezone(getTimezoneFromCoords(pos.coords))
    })
  }, [])
}
```

**Resources:**
- Geolocation API (browser built-in)
- Timezone detection: `auto-detect-timezone` or similar package
- Room naming conventions: keep simple (Grow Room, Ambient, etc.)

**Unblocks:** TASK-004 (foundation complete)

---

### Group 1B: Error Recovery & Guidance (5 tasks, 22 hrs)

#### TASK-004: Expand Error Guidance System (6 hrs)
**Assigned to:** coder
**Dependency:** TASK-003

**What to build:**
- Categorize errors: Credentials | Network | Device Offline | Rate Limit | Server Error
- Each error shows: plain explanation + actionable next step + retry button
- Credential errors: link to "Reset Password" page
- Network errors: device status check + troubleshooting
- Offline devices: suggest WiFi check, show last seen time
- Log errors to activity_logs for support team analysis

**Acceptance Criteria:**
```
[ ] 5 error categories implemented
[ ] Each category has specific guidance (not generic)
[ ] Errors logged to activity_logs with user_id
[ ] Error messages tested with real failure scenarios
[ ] Guidance links working (no 404s)
[ ] Mobile: text readable, buttons tap-able
```

**Files to Create/Update:**
- `UPDATE: /apps/web/src/lib/error-guidance.ts` (expand existing)
- `UPDATE: /apps/web/src/components/ErrorGuidance.tsx`
- `UPDATE: /apps/web/src/app/api/controllers/route.ts` (log errors)
- `NEW: /apps/web/src/lib/error-classifier.ts`

**Technical Approach:**
```typescript
// Error classification system
interface ErrorContext {
  type: 'credentials' | 'network' | 'offline' | 'rate_limit' | 'server'
  originalError: Error
  brand: ControllerBrand
  retryable: boolean
}

// Guidance for each type
const ERROR_GUIDANCE = {
  credentials: {
    title: 'Authentication Failed',
    description: 'Check your email and password...',
    actions: [
      { label: 'Reset Password', href: '/reset-password' },
      { label: 'Verify Credentials', action: 'retry' }
    ]
  },
  // ... more types
}

// Activity log
await logActivity({
  action_type: 'controller_connection_failed',
  action_data: { error_type, original_message, brand },
  result: 'failed'
})
```

**Resources:**
- Existing ErrorGuidance.tsx (extend it)
- Error messages from API responses (use context)
- Activity logs table (already exists)

**Unblocks:** TASK-005

---

#### TASK-005: Automatic Retry Logic (4 hrs)
**Assigned to:** coder
**Dependency:** TASK-004

**What to build:**
- Connection test retries 3x with exponential backoff (2s, 4s, 8s)
- UI shows progress: "Attempt 1/3: Connecting..."
- Failed retry shows which step failed (DNS, auth, timeout?)
- Supabase errors distinguished from device errors
- Retry state cached (no repeated calls on re-mount)

**Acceptance Criteria:**
```
[ ] Retries work: 3 attempts with increasing backoff
[ ] UI shows progress during retries
[ ] Failed attempt details shown (DNS vs auth vs timeout)
[ ] Cache prevents duplicate API calls
[ ] Timeout per attempt: 30 seconds max
[ ] Mobile: clear visual feedback during retries
```

**Files to Create/Update:**
- `NEW: /apps/web/src/hooks/use-retry.ts`
- `UPDATE: /apps/web/src/app/controllers/wizard/[step]/page.tsx`
- Reference: `/apps/automation-engine/lib/adapters/retry.ts`

**Technical Approach:**
```typescript
// Hook-based retry logic
const useRetry = <T,>(
  fn: () => Promise<T>,
  options: { maxAttempts: number; backoff: 'exponential' | 'linear' }
) => {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'idle' | 'retrying' | 'success' | 'failed'>()

  const retry = async () => {
    for (let i = 1; i <= options.maxAttempts; i++) {
      try {
        setAttempt(i)
        const result = await fn()
        setStatus('success')
        return result
      } catch (error) {
        if (i < options.maxAttempts) {
          const delay = 2 ** i * 1000 // exponential backoff
          await new Promise(r => setTimeout(r, delay))
        } else {
          setStatus('failed')
          throw error
        }
      }
    }
  }

  return { attempt, status, retry }
}
```

**Resources:**
- Reference existing retry logic in automation-engine
- Calculate backoff duration: `2^n * 1000 ms`
- Query caching: React Query or native useEffect cleanup

**Unblocks:** TASK-006

---

#### TASK-006: Connection Health Check & Status Indicator (5 hrs)
**Assigned to:** coder
**Dependency:** TASK-004

**What to build:**
- Controller card shows status dot: green | yellow (stale >1h) | red (offline)
- Hover tooltip: "Last seen 5 minutes ago" or "offline for 2 hours"
- Dashboard metric: "3/5 controllers online"
- Click status → opens connection diagnostics panel
- Real-time updates via Supabase subscription

**Acceptance Criteria:**
```
[ ] Status indicators: green (online) | yellow (stale) | red (offline)
[ ] Hover tooltip shows last seen time
[ ] Dashboard shows online count
[ ] Diagnostics panel includes: response time, sync lag, API success rate
[ ] Realtime updates when controller status changes
[ ] Mobile: status clearly visible at small sizes
```

**Files to Create/Update:**
- `NEW: /apps/web/src/components/ControllerStatusIndicator.tsx`
- `UPDATE: /apps/web/src/components/ControllerCard.tsx`
- `NEW: /apps/web/src/components/ControllerDiagnosticsPanel.tsx`
- `UPDATE: /apps/web/src/hooks/use-controllers.ts` (add subscription)

**Technical Approach:**
```typescript
// Status determination logic
const getControllerStatus = (controller: Controller) => {
  const now = new Date()
  const lastSeenMs = now.getTime() - new Date(controller.last_seen).getTime()
  const minutesSinceLastSeen = lastSeenMs / 1000 / 60

  if (controller.status === 'offline') return 'offline'
  if (minutesSinceLastSeen > 60) return 'stale'
  return 'online'
}

// Subscription to updates
const useControllerStatus = (controllerId: string) => {
  useEffect(() => {
    const sub = supabase
      .from('controllers')
      .on('UPDATE', (payload) => {
        // Update status when controller record changes
      })
      .subscribe()
  }, [])
}
```

**Resources:**
- Supabase realtime subscriptions (controllers table)
- Lucide icons: CheckCircle, AlertCircle, XCircle
- shadcn Popover for tooltips

**Unblocks:** TASK-009

---

#### TASK-007: Brand-Specific Connection Guides (3 hrs)
**Assigned to:** coder + architect
**Dependency:** TASK-006

**What to build:**
- 4 brand guides: AC Infinity, Inkbird, Ecowitt, CSV Upload
- Each guide: prerequisites checklist, screenshots, common errors
- In-app: modal shown on connection failure with brand-specific tips
- AI hint system: GROK analyzes error → suggests solution
- Guides maintainable by non-developers (markdown)

**Acceptance Criteria:**
```
[ ] Guides for all 4 brands (AC Infinity, Inkbird, Ecowitt, CSV)
[ ] Each guide: prerequisites, screenshots, troubleshooting
[ ] In-app modals show relevant guide on error
[ ] AI integration: GROK suggests fixes for errors
[ ] Markdown format: easy to update
```

**Files to Create/Update:**
- `NEW: /docs/controller-guides/{ac_infinity,inkbird,ecowitt,csv_upload}.md`
- `NEW: /apps/web/src/lib/brand-guides.ts` (load guides)
- `NEW: /apps/web/src/components/BrandGuideModal.tsx`
- `UPDATE: /apps/web/src/lib/error-guidance.ts` (link to guides)

**Technical Approach:**
```markdown
# AC Infinity Controller Connection Guide

## Prerequisites
- [ ] Controller powered on (green LED)
- [ ] Connected to 2.4GHz WiFi (not 5GHz)
- [ ] App installed on phone/tablet
- [ ] AC Infinity account created

## Step 1: Find Your Device Code
Screenshot: [controller-code.png]
...

## Common Errors
### "Email or password incorrect"
**Cause:** Wrong credentials
**Fix:** Log into official AC Infinity app to verify credentials work
**Video:** [link-to-video]
```

**Resources:**
- Brand API documentation
- Existing setup docs
- GROK API (already integrated in `/api/analyze`)

**Unblocks:** TASK-008

---

#### TASK-008: Credential Recovery & Revalidation (4 hrs)
**Assigned to:** coder
**Dependency:** TASK-007

**What to build:**
- "Update Credentials" button on offline controllers
- Modal shows current credentials (masked) + form to re-enter
- On submit: re-test connection + show result
- Successful update: reset status to 'online'
- Audit log entry for security
- Rate limiting: max 5 attempts per hour per controller

**Acceptance Criteria:**
```
[ ] "Update Credentials" button visible on offline controllers
[ ] Modal shows masked credentials + update form
[ ] Re-test connection after update
[ ] Success: controller status updated to 'online'
[ ] Audit log: security entry created
[ ] Rate limiting: 5 attempts max per hour
```

**Files to Create/Update:**
- `NEW: /apps/web/src/components/CredentialUpdateModal.tsx`
- `NEW: /apps/web/src/app/api/controllers/[id]/credentials/route.ts`
- `UPDATE: /apps/web/src/components/ControllerCard.tsx`

**Technical Approach:**
```typescript
// API Route: PUT /api/controllers/[id]/credentials
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const { credentials } = await request.json()

  // Rate limit check
  const recentAttempts = await supabase
    .from('activity_logs')
    .select('*')
    .eq('controller_id', params.id)
    .eq('action_type', 'credential_update_attempt')
    .gt('timestamp', new Date(Date.now() - 3600000).toISOString())
    .limit(5)

  if (recentAttempts.data?.length >= 5) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in 1 hour.' },
      { status: 429 }
    )
  }

  // Re-test connection
  const adapter = getAdapter(controller.brand)
  const result = await adapter.connect(buildCredentials(controller.brand, credentials))

  if (result.success) {
    // Update credentials (encrypted)
    await encryptAndUpdate(controller.id, credentials)
    // Log success
    await logActivity('credential_update_success', ...)
    return NextResponse.json({ success: true, status: 'online' })
  } else {
    // Log failed attempt
    await logActivity('credential_update_failed', ...)
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
}
```

**Resources:**
- Existing credential encryption in server-encryption.ts
- Activity log structure
- Rate limiting pattern

**Unblocks:** TASK-011 (health monitoring)

---

### Group 1C: Proactive Health Monitoring (3 tasks, 12 hrs)

#### TASK-009: Controller Health Scoring System (5 hrs)
**Assigned to:** coder
**Dependency:** TASK-006

**What to build:**
- Health score (0-100) combining: uptime % (40%) + sensor freshness (30%) + error rate (20%) + sync lag (10%)
- Displayed on controller card + dashboard summary
- Score calculated hourly in cron job
- New table: `controller_health` stores scores + metrics
- Emoji indicators: 🟢 (90+) 🟡 (70-89) 🔴 (<70)
- Alert if score drops suddenly (>20 point drop in 1 hour)

**Acceptance Criteria:**
```
[ ] Health score calculation logic implemented
[ ] New controller_health table created (migration)
[ ] Cron job runs hourly to calculate scores
[ ] Dashboard displays scores with emoji indicators
[ ] Alert triggers on sudden score drop
[ ] Historical tracking for trend analysis
```

**Files to Create/Update:**
- `NEW: /apps/web/src/lib/health-scoring.ts`
- `NEW: /apps/web/src/app/api/cron/health-check/route.ts`
- `NEW: Database migration for controller_health table`
- `NEW: /apps/web/src/components/ControllerHealthCard.tsx`
- `UPDATE: /apps/web/src/types/index.ts` (add ControllerHealth type)

**Technical Approach:**
```typescript
// Health score calculation
const calculateHealthScore = (controller: Controller, metrics: Metrics) => {
  const uptimeScore = metrics.uptimePercent * 0.4       // 40%
  const freshnessScore = calculateFreshness() * 0.3    // 30%
  const errorScore = (100 - metrics.errorRate) * 0.2   // 20%
  const syncScore = calculateSyncLag() * 0.1           // 10%

  return Math.round(uptimeScore + freshnessScore + errorScore + syncScore)
}

// Cron job
export async function GET(request: NextRequest) {
  const controllers = await getActiveControllers()

  for (const controller of controllers) {
    const metrics = await collectMetrics(controller.id)
    const score = calculateHealthScore(controller, metrics)

    // Check for sudden drop
    const previousScore = await getPreviousScore(controller.id)
    if (previousScore - score > 20) {
      await triggerAlert(controller.id, 'health_drop')
    }

    // Store score
    await supabase.from('controller_health').insert({
      controller_id: controller.id,
      score,
      metrics_snapshot: metrics,
      calculated_at: new Date().toISOString()
    })
  }
}
```

**Resources:**
- Metrics from: sensors table (freshness), activity logs (errors), controller.last_seen
- Cron infrastructure: similar to existing workflows cron
- Database migration scripts

**Unblocks:** TASK-010, TASK-011

---

#### TASK-010: Connection Quality Metrics & Diagnostics (4 hrs)
**Assigned to:** coder
**Dependency:** TASK-009

**What to build:**
- Diagnostics panel: response time | packet loss % | sync lag | API success rate
- Color-coded: green <500ms, yellow 500-1000ms, red >1000ms
- Run diagnostic button: pings controller, collects metrics, shows report
- 7-day connection quality trend chart
- Recommendations: "Try reconnecting" | "Check WiFi" | "Contact support"

**Acceptance Criteria:**
```
[ ] Diagnostics panel shows 4 metrics
[ ] Color coding applied correctly
[ ] Run diagnostic button works
[ ] 7-day trend chart displays
[ ] Recommendations contextual
```

**Files to Create/Update:**
- `NEW: /apps/web/src/components/ControllerDiagnosticsPanel.tsx`
- `NEW: /apps/web/src/app/api/controllers/[id]/diagnostics/route.ts`
- `NEW: /apps/web/src/lib/diagnostic-utils.ts`

**Unblocks:** Nothing (parallel to TASK-011)

---

#### TASK-011: Proactive Alerts for Connection Issues (3 hrs)
**Assigned to:** coder
**Depends on:** TASK-009

**What to build:**
- Alert triggers: offline >30 min | 3+ failed commands | health score <50
- User gets: push notification + in-app banner + email digest
- Alert includes quick action: "Reconnect Now" | "View Diagnostics"
- Duplicate suppression: max 1 per controller per hour
- User can snooze alerts (12/24/48 hours)
- Alerts table: tracks when/why/status

**Acceptance Criteria:**
```
[ ] Alerts trigger on configured conditions
[ ] Notifications sent (push/in-app/email)
[ ] Snooze feature works
[ ] Duplicate suppression working
[ ] Alerts table tracks history
```

**Files to Create/Update:**
- `NEW: /apps/web/src/lib/alerting.ts`
- `NEW: /apps/web/src/app/api/cron/check-alerts/route.ts`
- `NEW: /apps/web/src/components/AlertBanner.tsx`
- Database migration for alerts table

**Unblocks:** Nothing (Phase 1 concludes)

---

## Phase 1 Review Checkpoint

**TASK-012: Code Review - Phase 1** (2 hrs)
**Assigned to:** code-auditor
**After:** All Phase 1 tasks complete

### Review Checklist

Components & UX:
- [ ] Onboarding tour responsive on mobile
- [ ] All tooltips accessible (keyboard + screen reader)
- [ ] Error messages don't expose stack traces
- [ ] Loading states clear and not jank-y
- [ ] Color contrast meets WCAG AA standards

Code Quality:
- [ ] TypeScript: strict mode, no `any` types
- [ ] No unnecessary re-renders (check React DevTools)
- [ ] Proper error boundary usage
- [ ] Comments on complex logic
- [ ] Consistent code style (ESLint passes)

Testing:
- [ ] Unit tests for health scoring logic
- [ ] Unit tests for error classification
- [ ] Error scenarios tested manually
- [ ] Mobile testing on real devices (iPhone + Android)

Security:
- [ ] No credentials exposed in logs/errors
- [ ] Encryption/decryption working correctly
- [ ] Rate limiting enforced (credential updates)
- [ ] No XSS vulnerabilities
- [ ] Audit logs created for sensitive actions

Performance:
- [ ] Dashboard loads <3s with 20 controllers
- [ ] Onboarding tour smooth (60 fps)
- [ ] No memory leaks in long sessions
- [ ] Charts/graphs render quickly

Documentation:
- [ ] Code comments on complex functions
- [ ] README updated if new components added
- [ ] Types documented in types/index.ts
- [ ] Any breaking changes noted

---

## How to Get Started

### Day 1: Setup & Planning

1. **Read the full plan:**
   - Main plan: `/workspaces/enviroflow.app/ENVIROFLOW_PROJECT_TODOS.md`
   - This kickoff: `/workspaces/enviroflow.app/PHASE_1_KICKOFF.md`
   - Summary: `/workspaces/enviroflow.app/PROJECT_SUMMARY.md`

2. **Team meeting (1 hour):**
   - Discuss approach for TASK-001
   - Clarify design system expectations
   - Assign work: who takes TASK-001, 002, etc.
   - Identify blockers early

3. **Setup:**
   - Create feature branch: `feat/phase1-onboarding`
   - Create GitHub milestone: "Phase 1: Foundation"
   - Create GitHub issues for each task (linked to milestone)
   - Setup CI: ensure tests run on PR

### Week 1: TASK-001 + 004 + 006 (Foundation)

**Start:** TASK-001 (Onboarding Tour)
- Design component structure
- Create basic UI shell
- Implement step progression
- Test on mobile
- **PR Review:** TASK-012 mid-week (early feedback)

**Parallel:** TASK-004 (Error Guidance)
- Expand error classifier
- Add activity logging
- Test with real failures

**Parallel:** TASK-006 (Status Indicators)
- Create indicator component
- Setup Supabase subscription
- Implement realtime updates

### Week 2: TASK-002, 003, 005, 007, 008 (Details)

**Continue:** TASK-001 + 004 + 006
- Refinements based on early feedback
- Mobile polish

**Start:** TASK-002 (Tooltips)
- Build tooltip component
- Populate help content

**Start:** TASK-003 (Smart Defaults)
- Implement room suggestion
- Timezone detection

**Start:** TASK-005 (Retry Logic)
- Hook implementation
- Test with real API failures

**Start:** TASK-007 (Brand Guides)
- Write markdown guides
- Create modals

**Start:** TASK-008 (Credential Recovery)
- Build update modal
- Test revalidation

### Week 3: TASK-009, 010, 011 + Review (QA & Monitoring)

**Complete:** All outstanding tasks
- Final polish
- Mobile testing
- Performance checks

**Start:** TASK-009 (Health Scoring)
- Calculation logic
- Cron job setup

**Start:** TASK-010 (Diagnostics)
- Metrics collection

**Start:** TASK-011 (Alerts)
- Alert triggering
- Notifications

**Final week:**
- All tasks in PR
- Address review feedback
- Merge to main
- Deploy to staging for TASK-012 review

**TASK-012 Review:**
- Code auditor reviews all Phase 1 code
- Issues: create follow-up tasks if needed
- Sign-off: "Ready for Phase 2"

---

## Key Contacts & Resources

### Team

```
Senior Developers (assign TASK-001, 004, 006, etc.):
  [Developer 1]: Tasks 001, 004, 006
  [Developer 2]: Tasks 002, 003, 005
  [Developer 3]: Tasks 007, 008, 009, 010, 011

Code Auditor (TASK-012):
  [Auditor]: Reviews all Phase 1

Architect (support & decisions):
  [Architect]: Advises on TASK-007 brand guides
```

### Documentation

- **Main Plan:** `/workspaces/enviroflow.app/ENVIROFLOW_PROJECT_TODOS.md`
- **Brand Info:** `/docs/spec/EnviroFlow_MVP_Spec_v2.0.md`
- **API Docs:** `/docs/` (in repo)
- **Codebase:** `/apps/web/src/` (frontend) + `/apps/automation-engine/` (backend)

### External Resources

- **Supabase Docs:** https://supabase.com/docs/
- **React Query:** https://tanstack.com/query/latest/ (for caching)
- **shadcn/ui:** https://ui.shadcn.com/ (components)
- **TypeScript:** https://www.typescriptlang.org/docs/

---

## Daily Standup Template

```
DAILY STANDUP - EnviroFlow Phase 1

Date: [Date]

Completed Yesterday:
- [Task]: [Brief description of work done]

Doing Today:
- [Task]: [What you're working on]

Blockers:
- [None] or [Describe blocker + plan to unblock]

Risks:
- [Anything that might delay Phase 1?]

PRs in Review:
- [PR link]: [Status]
```

---

## Success Indicators (End of Week 3)

By end of Phase 1:
- [ ] Onboarding tour deployed and 30%+ users completed it
- [ ] Error guidance system live with 5 error categories
- [ ] Health monitoring running (hourly cron)
- [ ] All 11 tasks merged to main
- [ ] <5 post-launch bugs found
- [ ] Code review passed (TASK-012)
- [ ] Team confident for Phase 2 start

---

## Rollback Plan (if critical issue found)

If Phase 1 features cause >1% error increase:

1. **Immediate:** Disable feature via feature flag (LaunchDarkly)
2. **Investigation:** Identify root cause in Phase 1 review
3. **Fix:** Create hotfix branch, merge quickly
4. **Redeploy:** Re-enable feature flag
5. **Post-Mortem:** Document what went wrong

---

**Good luck, team! Phase 1 is the foundation for everything else. Quality over speed.**

Questions? Tag [@architect] in GitHub discussions or Slack.
