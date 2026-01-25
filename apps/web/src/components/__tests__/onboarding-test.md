# Onboarding Tour Test Plan

## Component: OnboardingTour
## Hook: useOnboarding
## Content: onboarding-content.ts

### Test Checklist

#### 1. First Login Experience
- [ ] Tour appears automatically on first visit (no localStorage entry)
- [ ] Shows step 1/6 "Welcome to EnviroFlow"
- [ ] Progress bar shows 17% complete
- [ ] "Previous" button is disabled on first step
- [ ] "Next" button advances to step 2

#### 2. Navigation
- [ ] "Next" button advances through all 6 steps
- [ ] "Previous" button goes back (enabled from step 2 onwards)
- [ ] Arrow keys work: Left = Previous, Right = Next
- [ ] Step indicators (dots) show current position
- [ ] Progress bar updates correctly (0-100%)

#### 3. Skip Functionality
- [ ] "Skip" button appears on steps 1-5
- [ ] "Skip" button is hidden on last step
- [ ] Clicking "Skip" advances to next step
- [ ] Skipped steps are tracked in localStorage analytics
- [ ] Multiple skips accumulate in skippedSteps array

#### 4. Completion
- [ ] Last step (6/6) shows "Start Exploring" button
- [ ] Clicking completion button sets completed: true in localStorage
- [ ] Tour closes after completion
- [ ] Tour does not auto-show on subsequent page loads
- [ ] completedAt timestamp is saved

#### 5. Persistence (localStorage)
- [ ] State is saved to `enviroflow_onboarding_state`
- [ ] Contains: completed, currentStep, skippedSteps, version
- [ ] Analytics saved to `enviroflow_onboarding_analytics`
- [ ] Closing tour (X button) saves currentStep
- [ ] Reopening shows same step as before

#### 6. Version Management
- [ ] Version is "1.0.0"
- [ ] Changing version resets tour for all users
- [ ] Old localStorage is cleared on version mismatch

#### 7. Dismiss/Exit
- [ ] X button closes tour without completing
- [ ] ESC key closes tour
- [ ] Closing does NOT mark as completed
- [ ] Can resume from same step later

#### 8. Responsive Design
- [ ] Mobile (<600px): Dialog is full width
- [ ] Tablet (600-1024px): Dialog is constrained
- [ ] Desktop (>1024px): Max width 600px
- [ ] Step indicators stack properly on mobile
- [ ] Buttons are full width on mobile

#### 9. Analytics Tracking
- [ ] "view" event logged on each step view
- [ ] "skip" event logged with stepId
- [ ] "complete" event logged on tour completion
- [ ] timeSpentSeconds tracked for non-view events
- [ ] All events include timestamp

#### 10. Integration
- [ ] Tour renders in dashboard layout
- [ ] Does not block user interactions when dismissed
- [ ] No console errors or warnings
- [ ] No memory leaks (cleanup on unmount)

### Manual Testing Steps

1. **Fresh User Test**
   - Open browser in incognito mode
   - Clear localStorage: `localStorage.clear()`
   - Navigate to /dashboard
   - Verify tour appears automatically

2. **Navigation Test**
   - Click "Next" 5 times
   - Click "Previous" once
   - Use arrow keys to navigate
   - Verify all steps show correct content

3. **Skip Test**
   - Start tour
   - Click "Skip" on step 2
   - Check analytics: `JSON.parse(localStorage.getItem('enviroflow_onboarding_analytics'))`
   - Verify skip event exists

4. **Completion Test**
   - Navigate to last step
   - Click "Start Exploring"
   - Check state: `JSON.parse(localStorage.getItem('enviroflow_onboarding_state'))`
   - Verify completed: true

5. **Persistence Test**
   - Start tour
   - Navigate to step 3
   - Close tour (X button)
   - Refresh page
   - Open tour manually (when feature added)
   - Verify starts at step 3

6. **Mobile Test**
   - Open DevTools
   - Set viewport to 375px (iPhone)
   - Verify buttons stack vertically
   - Verify dialog is responsive
   - Verify touch interactions work

### Expected localStorage Format

```json
// enviroflow_onboarding_state
{
  "completed": false,
  "currentStep": 2,
  "skippedSteps": ["sensors"],
  "version": "1.0.0",
  "completedAt": "2026-01-24T10:30:00.000Z"
}

// enviroflow_onboarding_analytics
[
  {
    "stepId": "welcome",
    "action": "view",
    "timestamp": "2026-01-24T10:25:00.000Z"
  },
  {
    "stepId": "dashboard",
    "action": "view",
    "timestamp": "2026-01-24T10:25:30.000Z",
    "timeSpentSeconds": 30
  },
  {
    "stepId": "sensors",
    "action": "skip",
    "timestamp": "2026-01-24T10:26:00.000Z",
    "timeSpentSeconds": 15
  },
  {
    "stepId": "next-steps",
    "action": "complete",
    "timestamp": "2026-01-24T10:30:00.000Z",
    "timeSpentSeconds": 120
  }
]
```

### Success Criteria

All checklist items pass ✓
No console errors ✓
Mobile responsive on screens <600px ✓
localStorage persists correctly ✓
Analytics events tracked ✓
Tour can be completed and dismissed ✓
No jank/lag during animations ✓
