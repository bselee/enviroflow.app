# Error Handling Migration Guide

Quick guide for migrating existing error handling to the new Error Guidance System.

## API Routes

### Before
```typescript
export async function POST(request: NextRequest) {
  try {
    await someOperation();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
```

### After
```typescript
import { classifyAndLogError, extractErrorMessage } from '@/lib/error-classifier';

export async function POST(request: NextRequest) {
  try {
    const client = createServerClient();
    const { data: { user } } = await client.auth.getUser();

    await someOperation();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorContext = await classifyAndLogError(error as Error, {
      brand: 'ac_infinity', // or from request body
      context: 'connection', // or 'sensors', 'discovery', etc.
      controllerId: controllerId, // if applicable
      userId: user?.id,
      metadata: {
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json({
      success: false,
      error: extractErrorMessage(errorContext.originalError),
      errorType: errorContext.type,
      retryable: errorContext.retryable,
    }, { status: errorContext.statusCode || 500 });
  }
}
```

## React Components

### Before
```tsx
function MyComponent() {
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error && (
        <div className="bg-red-100 p-4 rounded">
          <p className="text-red-800">{error}</p>
        </div>
      )}
    </>
  );
}
```

### After
```tsx
import { ErrorGuidance } from '@/components/ui/error-guidance';

function MyComponent() {
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error && (
        <ErrorGuidance
          error={error}
          brand={controller.brand}
          context="connection"
          controllerId={controller.id}
          lastSeen={controller.last_seen}
          showDiagnostics
          onRetry={handleRetry}
        />
      )}
    </>
  );
}
```

### Compact Mode (for inline errors)
```tsx
<ErrorGuidance
  error={error}
  brand={controller.brand}
  compact
  onRetry={handleRetry}
/>
```

## Common Patterns

### Controller Connection Error
```tsx
<ErrorGuidance
  error={error}
  brand={controller.brand}
  context="connection"
  controllerId={controller.id}
  showDiagnostics // Shows connection diagnostic steps
  onRetry={handleConnect}
/>
```

### Device Discovery Error
```tsx
<ErrorGuidance
  error="No devices found"
  brand={brand}
  context="discovery"
  showDiagnostics // Shows discovery troubleshooting
  onRetry={handleDiscover}
/>
```

### Sensor Reading Error
```tsx
<ErrorGuidance
  error={error}
  brand={controller.brand}
  context="sensors"
  controllerId={controller.id}
  onRetry={handleRefreshSensors}
/>
```

### Device Control Error
```tsx
<ErrorGuidance
  error={error}
  brand={controller.brand}
  context="device_control"
  controllerId={controller.id}
  compact // Inline error
  onRetry={handleRetry}
/>
```

### Offline Device
```tsx
<ErrorGuidance
  error="Controller is offline"
  brand={controller.brand}
  context="connection"
  controllerId={controller.id}
  lastSeen={controller.last_seen} // Shows "Last seen: 2 hours ago"
  onRetry={handleRefreshStatus}
/>
```

## Error Response Format

Standardize your API error responses:

```typescript
// Success
return NextResponse.json({
  success: true,
  data: { /* your data */ }
});

// Error
return NextResponse.json({
  success: false,
  error: 'Human-readable error message',
  errorType: 'credentials' | 'network' | 'offline' | 'rate_limit' | 'server',
  retryable: true | false,
  retryAfter?: 30 // seconds (optional)
}, { status: 401 | 500 | etc });
```

## Handling Errors in Client Code

```typescript
async function connectController(controllerId: string) {
  setLoading(true);
  setError(null);

  const response = await fetch(`/api/controllers/${controllerId}/connect`, {
    method: 'POST',
  });

  const data = await response.json();

  if (!data.success) {
    setError({
      message: data.error,
      type: data.errorType,
      retryable: data.retryable,
      retryAfter: data.retryAfter,
    });
  } else {
    // Handle success
  }

  setLoading(false);
}
```

## Action Handlers

The ErrorGuidance component supports these built-in actions:

```tsx
<ErrorGuidance
  error={error}
  onAction={(action) => {
    switch (action) {
      case 'retry': // Handled by onRetry prop
      case 'refresh': // Handled by onRetry prop or page reload
      case 'update_credentials': // Auto-navigates to edit page
      case 'login': // Auto-navigates to login page
      case 'wait': // Rate limit - just displays wait time
      case 'check_status': // Opens help URL
      case 'contact_support': // Shows support info
      default:
        // Custom action
    }
  }}
/>
```

## Custom Retry Logic

```tsx
const [retryCount, setRetryCount] = useState(0);
const [error, setError] = useState(null);

const handleRetry = async () => {
  setRetryCount(prev => prev + 1);

  try {
    await operation();
    setError(null);
    setRetryCount(0);
  } catch (err) {
    setError(err);

    // Log retry attempts
    if (retryCount >= 3) {
      // Max retries exceeded - escalate
      console.error('Max retries exceeded');
    }
  }
};

<ErrorGuidance
  error={error}
  onRetry={handleRetry}
  metadata={{ attemptNumber: retryCount }}
/>
```

## Tips

1. **Always provide context** - Helps generate better guidance
2. **Include brand** - Enables brand-specific troubleshooting
3. **Pass controllerId** - Enables direct links to edit page
4. **Show diagnostics for discovery** - Helps users self-serve
5. **Use compact mode for inline** - Better for small spaces
6. **Handle retry callbacks** - Implement proper retry logic
7. **Log errors in API routes** - Critical for support analysis

## Examples in Codebase

Look at these files for reference:
- `/apps/web/src/app/api/example-error-handler/route.ts` - API route example
- `/apps/web/src/components/ui/error-guidance.tsx` - Component implementation
- `/docs/error-guidance-system.md` - Complete documentation
