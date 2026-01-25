# OnboardingTour Component

Quick reference for using the interactive onboarding tour in EnviroFlow.

## Quick Start

### Basic Usage
```tsx
import { OnboardingTour } from "@/components/OnboardingTour";

export default function Page() {
  return (
    <>
      <OnboardingTour />
      {/* Your page content */}
    </>
  );
}
```

### Programmatic Control
```tsx
import { useOnboarding } from "@/hooks/use-onboarding";

function HelpMenu() {
  const { restartTour, isCompleted, getAnalytics } = useOnboarding();

  return (
    <button onClick={restartTour} disabled={!isCompleted}>
      Restart Tour
    </button>
  );
}
```

## API Reference

### `<OnboardingTour />` Component

**Props:**
- `className?: string` - Optional custom styling
- `onComplete?: () => void` - Callback when tour completes
- `onDismiss?: () => void` - Callback when tour is dismissed

**Example:**
```tsx
<OnboardingTour
  onComplete={() => console.log("Tour completed!")}
  onDismiss={() => console.log("Tour dismissed")}
/>
```

---

### `useOnboarding()` Hook

**Returns:**
```typescript
{
  isActive: boolean;        // Is tour currently showing
  currentStep: number;      // Current step index (0-5)
  totalSteps: number;       // Total steps (6)
  isCompleted: boolean;     // Has user completed tour
  nextStep: () => void;     // Go to next step
  previousStep: () => void; // Go to previous step
  skipStep: () => void;     // Skip current step
  completeTour: () => void; // Mark tour as complete
  dismissTour: () => void;  // Close without completing
  restartTour: () => void;  // Reset and show from step 1
  startTour: () => void;    // Show tour at current step
  getAnalytics: () => OnboardingAnalytics[]; // Get analytics events
}
```

**Example:**
```tsx
const { isActive, currentStep, nextStep, restartTour } = useOnboarding();

// Check if tour is active
if (isActive) {
  console.log(`On step ${currentStep + 1}`);
}

// Manually advance
nextStep();

// Restart from beginning
restartTour();
```

---

## Content Configuration

Edit `/apps/web/src/lib/onboarding-content.ts`:

```typescript
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to EnviroFlow",
    content: "Your universal environmental automation platform...",
    position: "center",
    ctaText: "Get Started",
  },
  // ... more steps
];
```

**Step Properties:**
- `id: string` - Unique identifier
- `title: string` - Step title
- `content: string` - Step description
- `position?: "top" | "bottom" | "left" | "right" | "center"` - Position (default: center)
- `imageUrl?: string` - Optional image
- `ctaText?: string` - Button text (default: "Next")
- `ctaLink?: string` - Optional navigation link

---

## LocalStorage Schema

### State
**Key:** `enviroflow_onboarding_state`

```json
{
  "completed": false,
  "currentStep": 2,
  "skippedSteps": ["sensors"],
  "version": "1.0.0",
  "completedAt": "2026-01-24T10:30:00.000Z"
}
```

### Analytics
**Key:** `enviroflow_onboarding_analytics`

```json
[
  {
    "stepId": "welcome",
    "action": "view",
    "timestamp": "2026-01-24T10:25:00.000Z"
  },
  {
    "stepId": "sensors",
    "action": "skip",
    "timestamp": "2026-01-24T10:26:00.000Z",
    "timeSpentSeconds": 15
  }
]
```

---

## Behavior

### First Visit
- Tour auto-shows if no localStorage entry exists
- Starts at step 1

### Dismiss
- Saves current step
- Does NOT mark as completed
- Can resume later

### Complete
- Marks as completed
- Sets `completedAt` timestamp
- Will not auto-show again

### Version Change
- If `ONBOARDING_VERSION` changes, tour resets for all users
- Old localStorage is cleared

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` | Next step |
| `←` | Previous step |
| `ESC` | Dismiss tour |
| `Enter` | Click focused button |

---

## Responsive Design

| Breakpoint | Behavior |
|------------|----------|
| Mobile (<600px) | Full width, stacked buttons |
| Tablet (600-1024px) | 90% width, max 600px |
| Desktop (>1024px) | Max 600px, centered |

---

## Common Tasks

### Add to Help Menu
```tsx
import { useOnboarding } from "@/hooks/use-onboarding";

function HelpDropdown() {
  const { restartTour } = useOnboarding();

  return (
    <DropdownMenu>
      <DropdownMenuItem onClick={restartTour}>
        Show Tour
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
```

### Track Custom Event
```tsx
import { useOnboarding } from "@/hooks/use-onboarding";

function CustomButton() {
  const { getAnalytics } = useOnboarding();

  const handleClick = () => {
    // Get analytics
    const events = getAnalytics();
    console.log("User completed", events.filter(e => e.action === "complete").length, "tours");
  };

  return <button onClick={handleClick}>View Stats</button>;
}
```

### Force Reset (Debug)
```tsx
// In browser console
localStorage.removeItem('enviroflow_onboarding_state');
localStorage.removeItem('enviroflow_onboarding_analytics');
window.location.reload();
```

---

## Troubleshooting

### Tour won't show
1. Check if already completed:
   ```js
   const state = JSON.parse(localStorage.getItem('enviroflow_onboarding_state'));
   console.log(state.completed); // true = already done
   ```

2. Call `restartTour()` to force show:
   ```tsx
   const { restartTour } = useOnboarding();
   restartTour();
   ```

### Analytics not saving
1. Check localStorage quota:
   ```js
   try {
     localStorage.setItem('test', 'test');
     console.log('localStorage available');
   } catch (e) {
     console.error('localStorage full or blocked');
   }
   ```

2. Check browser privacy settings (incognito mode may block)

### Progress bar incorrect
- Verify `currentStep` is updating
- Check React DevTools for component state
- Refresh to reload from localStorage

---

## Best Practices

### DO
✅ Show tour on dashboard (first meaningful page)
✅ Let users dismiss and resume later
✅ Track analytics for improvement
✅ Keep step content concise (2-3 sentences)
✅ Update version when making breaking changes

### DON'T
❌ Force users to complete tour
❌ Show tour on every page
❌ Block critical actions during tour
❌ Make steps too long or detailed
❌ Forget to test on mobile

---

## Testing

### Manual Test
```bash
# Clear state
localStorage.clear()

# Reload page
window.location.reload()

# Tour should appear automatically
```

### Check Analytics
```javascript
// View all events
const analytics = JSON.parse(
  localStorage.getItem('enviroflow_onboarding_analytics')
);
console.table(analytics);

// Count by action
const counts = analytics.reduce((acc, e) => {
  acc[e.action] = (acc[e.action] || 0) + 1;
  return acc;
}, {});
console.log(counts);
```

---

## Related Files

- Component: `/apps/web/src/components/OnboardingTour.tsx`
- Hook: `/apps/web/src/hooks/use-onboarding.ts`
- Content: `/apps/web/src/lib/onboarding-content.ts`
- Types: `/apps/web/src/types/index.ts` (OnboardingStep, OnboardingState, OnboardingAnalytics)
- Test Plan: `/apps/web/src/components/__tests__/onboarding-test.md`
- Guide: `/apps/web/src/lib/onboarding-tour-guide.md`

---

## Support

For questions or issues:
1. Check this README
2. Read the test plan
3. Review the implementation summary
4. Check browser console for errors
