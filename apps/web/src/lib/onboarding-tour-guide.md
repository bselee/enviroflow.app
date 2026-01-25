# EnviroFlow Onboarding Tour - Step by Step Guide

## Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1/6                                        17% Complete│
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                              │
│  Welcome to EnviroFlow                                       │
│  Your universal environmental automation platform.          │
│  Monitor sensors, control devices, and automate workflows   │
│  across all your hardware controllers in one place.         │
│                                                              │
│  ● ○ ○ ○ ○ ○                                                │
│                                                              │
│  ┌──────────┐  ┌──────┐               ┌──────────────────┐ │
│  │ Previous │  │ Skip │               │  Get Started  →  │ │
│  └──────────┘  └──────┘               └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Step Details

### Step 1: Welcome to EnviroFlow (id: "welcome")
**Title:** Welcome to EnviroFlow
**Content:** Your universal environmental automation platform. Monitor sensors, control devices, and automate workflows across all your hardware controllers in one place.
**CTA:** Get Started
**Progress:** 17%

**User Actions Available:**
- Click "Get Started" → Next step
- Click "Skip" → Next step (tracked)
- Click X → Dismiss tour
- Press ESC → Dismiss tour
- Press → → Next step

---

### Step 2: Dashboard Overview (id: "dashboard")
**Title:** Dashboard Overview
**Content:** Your command center shows real-time environment conditions with VPD (Vapor Pressure Deficit) at the center. Track temperature, humidity, and trends across all your rooms at a glance.
**CTA:** Next
**Progress:** 33%

**Visual Context:**
- Background shows the actual dashboard (slightly dimmed)
- User can see the VPD dial and environment snapshot behind the modal
- This creates context for what they're learning about

**User Actions Available:**
- Click "Next" → Next step
- Click "Previous" → Back to step 1
- Click "Skip" → Next step (tracked)
- Click X → Dismiss tour
- Press ← → Previous step
- Press → → Next step

---

### Step 3: Sensor Monitoring (id: "sensors")
**Title:** Sensor Monitoring
**Content:** The Intelligent Timeline displays 24-hour sensor trends with customizable time ranges. Spot patterns, detect anomalies, and stay within optimal ranges for your grow stages.
**CTA:** Next
**Progress:** 50%

**Visual Context:**
- Modal positioned to not obscure the timeline chart
- User can see temperature/humidity/VPD trends in background

**Key Learning:**
- Users understand where to find historical data
- They learn about the time range selector (24h, 7d, 30d)
- They see how optimal ranges are visualized

---

### Step 4: Device Control (id: "devices")
**Title:** Device Control
**Content:** Control your connected devices directly from room cards. Toggle fans, lights, and outlets with a single tap. Create rooms to organize controllers by location or grow stage.
**CTA:** Next
**Progress:** 67%

**Visual Context:**
- Modal highlights room cards area
- User sees device toggle controls
- "Add Room" button is visible

**Key Learning:**
- Direct device control from dashboard
- Room organization concept
- Quick access to device states

---

### Step 5: Automation Basics (id: "automation")
**Title:** Automation Basics
**Content:** Build powerful workflows with visual automation. Set conditions based on sensor readings and trigger device actions automatically. Your environment stays optimal 24/7, even while you sleep.
**CTA:** Next
**Progress:** 83%

**Visual Context:**
- Modal explains workflow concepts
- Mentions visual builder (React Flow)
- Emphasizes "set it and forget it" automation

**Key Learning:**
- What workflows are
- Why automation matters
- Where to create workflows (navigation hint)

---

### Step 6: Next Steps (id: "next-steps")
**Title:** You're All Set!
**Content:** Ready to connect your first controller? Click "Add Room" to create a space, then add controllers from supported brands like AC Infinity, Inkbird, and more. You can restart this tour anytime from the Help menu.
**CTA:** Start Exploring
**Progress:** 100%

**Visual Context:**
- Completion celebration
- Clear next action (Add Room)
- Mentions supported brands
- Tells user how to restart tour

**User Actions Available:**
- Click "Start Exploring" → Complete tour, close modal
- Click "Previous" → Back to step 5
- Click X → Dismiss (but not complete)
- Press ← → Previous step
- Press → → Complete tour

---

## Navigation Summary

### Buttons
- **Previous**: ← Arrow key or button (disabled on step 1)
- **Next**: → Arrow key or button (changes to "Start Exploring" on last step)
- **Skip**: Available on steps 1-5, hidden on step 6
- **X (Close)**: Always available, dismisses without completing

### Progress Indicators
- **Progress Bar**: Numeric percentage at top (17%, 33%, 50%, 67%, 83%, 100%)
- **Step Counter**: "Step X of 6" text
- **Dot Indicators**: 6 dots showing current position
  - Current step: Long bar (8px wide), primary color
  - Completed steps: Small dot (1.5px), half opacity
  - Future steps: Small dot (1.5px), muted color

### Keyboard Shortcuts
- `→` Right Arrow: Next step
- `←` Left Arrow: Previous step (if not first)
- `ESC`: Dismiss tour
- `Enter`: Trigger focused button

---

## State Transitions

```
┌─────────────────────────────────────────────────┐
│  FIRST VISIT                                    │
│  (no localStorage)                              │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  TOUR ACTIVE                                    │
│  isActive: true                                 │
│  currentStep: 0-5                               │
└─────────────────────────────────────────────────┘
          │                    │
    [Complete]            [Dismiss/X]
          │                    │
          ▼                    ▼
┌──────────────────┐  ┌──────────────────────────┐
│  COMPLETED       │  │  DISMISSED              │
│  completed: true │  │  completed: false       │
│  isActive: false │  │  isActive: false        │
│                  │  │  currentStep: saved     │
└──────────────────┘  └──────────────────────────┘
          │                    │
          │              [Restart]
          │                    │
          └────────────────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │  RESTART           │
          │  currentStep: 0    │
          │  completed: false  │
          │  isActive: true    │
          └─────────────────────┘
```

---

## Analytics Events Captured

### View Event
```json
{
  "stepId": "dashboard",
  "action": "view",
  "timestamp": "2026-01-24T10:25:00.000Z"
}
```

### Skip Event
```json
{
  "stepId": "sensors",
  "action": "skip",
  "timestamp": "2026-01-24T10:26:00.000Z",
  "timeSpentSeconds": 15
}
```

### Complete Event
```json
{
  "stepId": "next-steps",
  "action": "complete",
  "timestamp": "2026-01-24T10:30:00.000Z",
  "timeSpentSeconds": 120
}
```

### CTA Click Event (Future)
```json
{
  "stepId": "next-steps",
  "action": "cta_click",
  "timestamp": "2026-01-24T10:30:15.000Z",
  "timeSpentSeconds": 135
}
```

---

## Responsive Breakpoints

### Mobile (<600px)
- Dialog: Full width, 16px margin
- Buttons: Stack vertically, full width
- Step indicators: Smaller dots
- Padding: Reduced to 16px
- Font size: Slightly smaller for readability

### Tablet (600-1024px)
- Dialog: 90% width, max 600px
- Buttons: Horizontal layout
- Standard padding: 24px
- Step indicators: Full size

### Desktop (>1024px)
- Dialog: Max 600px width, centered
- Buttons: Horizontal with proper spacing
- Generous padding: 24px
- Optimal reading width

---

## Design System Integration

### Colors (from Tailwind theme)
- **Primary**: Dialog header, progress bar, active indicators
- **Muted**: Background, secondary text
- **Border**: Dialog border, separators
- **Background**: Dialog background with backdrop blur
- **Foreground**: Primary text

### Shadows
- Dialog: Large shadow for depth
- Buttons: Subtle shadow on hover

### Animations
- Dialog open/close: Zoom + fade (200ms)
- Progress bar: Smooth transition (300ms)
- Dot indicators: Width transition (300ms)

---

## Development Notes

### Adding New Steps

1. Add to `ONBOARDING_STEPS` array in `onboarding-content.ts`:
```typescript
{
  id: "new-feature",
  title: "New Feature Title",
  content: "Feature description...",
  position: "center",
  ctaText: "Next",
}
```

2. Update `getTotalSteps()` automatically reflects the new count

3. Analytics will track the new step automatically

### Changing Version

Update `ONBOARDING_VERSION` in `onboarding-content.ts`:
```typescript
export const ONBOARDING_VERSION = "1.1.0";
```

This will reset the tour for all users on next page load.

### Custom Styling

Override in component:
```tsx
<OnboardingTour className="custom-class" />
```

Or modify `OnboardingTour.tsx` directly.

---

## Accessibility Features

- **Keyboard Navigation**: Full keyboard control
- **ARIA Labels**: Descriptive labels on all interactive elements
- **Focus Management**: Proper focus trap within dialog
- **Screen Reader**: Semantic HTML structure
- **High Contrast**: Works with system dark mode
- **Reduced Motion**: Respects `prefers-reduced-motion`

---

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile Safari (iOS 14+)
- ✅ Chrome Mobile (Android 10+)

**Required APIs:**
- localStorage (all modern browsers)
- Dialog element via Radix UI (polyfilled)
- CSS Grid/Flexbox (all modern browsers)

---

## Troubleshooting

### Tour doesn't appear
1. Check localStorage: `localStorage.getItem('enviroflow_onboarding_state')`
2. If completed, call `restartTour()` from console
3. Or clear: `localStorage.removeItem('enviroflow_onboarding_state')`

### Analytics not saving
1. Check browser localStorage quota
2. Check console for errors
3. Verify `ONBOARDING_ANALYTICS_KEY` is correct

### Progress bar stuck
1. Verify `currentStep` is updating
2. Check React DevTools for component state
3. Refresh page to reload from localStorage

---

## Production Checklist

- [x] All 6 steps defined
- [x] Analytics tracking implemented
- [x] localStorage persistence working
- [x] Keyboard navigation functional
- [x] Mobile responsive
- [x] Accessibility compliant
- [x] Error handling robust
- [x] Documentation complete
- [x] No console errors
- [x] Build succeeds
