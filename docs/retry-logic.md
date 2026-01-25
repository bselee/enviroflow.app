# Automatic Retry Logic with Exponential Backoff

## Overview

The EnviroFlow application now includes a reusable retry mechanism for connection tests and API calls. This feature improves reliability by automatically retrying failed operations with increasing delays between attempts.

## Implementation

### Hook: `useRetry`

Location: `/apps/web/src/hooks/use-retry.ts`

The `useRetry` hook provides automatic retry logic with the following features:

- **Configurable retry attempts** (default: 3)
- **Multiple backoff strategies** (exponential, linear, constant)
- **Error classification** (network, credentials, validation, server, timeout, unknown)
- **Progress tracking** (current attempt / max attempts)
- **Timeout support** (default: 30 seconds per attempt)
- **State persistence** (prevents duplicate calls on re-mount)

### Usage Example

```typescript
import { useRetry } from '@/hooks/use-retry';

function MyComponent() {
  const { execute, attempt, maxAttempts, status, error, reset } = useRetry(
    async () => {
      // Your async operation here
      const response = await fetch('/api/test-connection');
      if (!response.ok) throw new Error('Connection failed');
      return response.json();
    },
    {
      maxAttempts: 3,
      backoff: 'exponential',
      baseDelay: 2000, // 2 seconds
      timeout: 30000, // 30 seconds per attempt
      onAttempt: (attempt, max) => {
        console.log(`Attempt ${attempt}/${max}`);
      },
    }
  );

  // Use execute() to run the operation with retries
  // Status will be: 'idle' | 'retrying' | 'success' | 'failed'
}
```

## Retry Behavior

### Exponential Backoff

The default backoff strategy is exponential with the following delays:

- **Attempt 1**: Immediate (0ms)
- **Attempt 2**: 2 seconds (2000ms)
- **Attempt 3**: 4 seconds (4000ms)
- **Attempt 4**: 8 seconds (8000ms) - if maxAttempts > 3

Formula: `baseDelay * 2^(attempt - 1)`

### Linear Backoff

For linear backoff, delays increase linearly:

- **Attempt 1**: Immediate (0ms)
- **Attempt 2**: 2 seconds (2000ms)
- **Attempt 3**: 4 seconds (4000ms)
- **Attempt 4**: 6 seconds (6000ms)

Formula: `baseDelay * attempt`

### Constant Delay

For constant delay, all retries use the same delay:

- **All attempts**: 2 seconds (2000ms) - based on baseDelay

## Error Classification

The hook automatically classifies errors to provide better user guidance:

| Error Type | Indicators | User Guidance |
|------------|-----------|---------------|
| **network** | "fetch", "network", "econnrefused", "dns" | Check internet connection and try again |
| **credentials** | "password", "email", "authentication", "unauthorized" | Verify your email and password |
| **timeout** | "timeout", "timed out" | Operation took too long, try again |
| **validation** | "validation", "invalid", "bad request" | Check your input and try again |
| **server** | "server error", "internal" | Service may be experiencing issues |
| **unknown** | Everything else | General error message |

### Failed Step Detection

The hook also identifies which specific step failed:

- **DNS lookup** - Network resolution issues
- **Authentication** - Credential verification failed
- **Network connection** - TCP/IP connection failed
- **Request timeout** - Operation exceeded time limit
- **API call** - Server-side processing error

## Integration Points

### Controller Connection Flow

The retry logic is integrated into the controller addition flow:

1. **User enters credentials** in AddControllerDialog
2. **Connection attempt starts** when user clicks "Connect Controller"
3. **Retry loop executes** up to 3 times with exponential backoff
4. **Progress shown to user**:
   - "Attempt 1/3: Connecting to cloud API..."
   - "Attempt 2/3: Retrying connection..."
   - "Attempt 3/3: Retrying connection..."
5. **Success or failure** displayed with appropriate messaging

Location: `/apps/web/src/components/controllers/AddControllerDialog.tsx`

### Controller Test Connection

The `testConnection` function in `use-controllers.ts` also uses retry logic:

- **3 automatic retries** with exponential backoff
- **Detailed logging** of each attempt
- **Status updates** to the database after successful connection

Location: `/apps/web/src/hooks/use-controllers.ts`

## User Experience

### During Connection

Users see real-time progress during connection attempts:

```
Connecting to AC Infinity...
[Progress bar showing 33%]
Attempt 1/3: Connecting to cloud API...
This may take up to 30 seconds...
```

If the first attempt fails:

```
Connecting to AC Infinity...
[Progress bar showing 66%]
Attempt 2/3: Retrying connection...
This may take up to 30 seconds...
```

### On Success

After successful connection (on any attempt):

```
✓ Connected Successfully!
Your controller is now ready to use

Discovered Devices:
✓ Controller 69 Pro
✓ UIS Inline Fan
✓ UIS Light Bar
```

### On Failure

After all retries exhausted:

```
Connection failed after 3 attempts: Invalid credentials

Error Type: credentials
Failed Step: Authentication

Troubleshooting:
• Double-check your email and password
• Try logging into the official app to verify credentials
• Ensure your account is active

[Back to Credentials] [Retry Connection]
```

## Configuration

### Per-Component Settings

Different components can use different retry configurations:

```typescript
// For critical operations - more retries
const criticalRetry = useRetry(operation, {
  maxAttempts: 5,
  baseDelay: 1000,
  timeout: 60000,
});

// For quick operations - fewer retries
const quickRetry = useRetry(operation, {
  maxAttempts: 2,
  baseDelay: 500,
  timeout: 10000,
});
```

### Skip Retry for Certain Scenarios

The code intelligently skips retries when not needed:

```typescript
// Skip retry for discovered devices (already validated)
const shouldRetry = addMode !== "discover" && brand !== "csv_upload";
const maxAttempts = shouldRetry ? 3 : 1;
```

## Testing

### Unit Tests

Location: `/apps/web/src/hooks/__tests__/use-retry.test.ts`

Tests cover:

- ✅ Success on first attempt
- ✅ Success after retries
- ✅ Failure after max retries
- ✅ Exponential backoff timing
- ✅ Error classification
- ✅ Callback invocation
- ✅ State reset

Run tests:

```bash
cd apps/web
npm test -- use-retry.test.ts
```

## Performance Considerations

### Timeout Per Attempt

Each attempt has a 30-second timeout to prevent indefinite hanging:

- **Total max time (3 attempts)**: ~44 seconds
  - Attempt 1: 0s + 30s timeout = 30s
  - Attempt 2: 2s delay + 30s timeout = 32s
  - Attempt 3: 4s delay + 30s timeout = 34s
  - Total: 30 + 2 + 30 + 4 + 30 = 96s maximum

However, most connections succeed within 5-10 seconds on the first attempt.

### Resource Cleanup

The hook properly cleans up resources:

- **Component unmount detection** prevents state updates after unmount
- **Promise race** for timeout prevents memory leaks
- **No zombie intervals** - all timers cleared on completion

## Future Enhancements

Potential improvements for the retry system:

1. **Circuit breaker pattern** - Stop retrying if service is consistently down
2. **Jitter** - Add randomness to backoff to prevent thundering herd
3. **Retry budget** - Limit total retries across all operations
4. **Persistent retry state** - Resume retries after page refresh
5. **Analytics** - Track retry success rates and common failure points

## API Reference

### `useRetry<T>(fn, options)`

#### Parameters

- **fn**: `() => Promise<T>` - The async operation to retry
- **options**: `UseRetryOptions` - Configuration object

#### Options

```typescript
interface UseRetryOptions {
  maxAttempts?: number;        // Default: 3
  backoff?: 'exponential' | 'linear' | 'constant';  // Default: 'exponential'
  baseDelay?: number;          // Default: 2000ms
  timeout?: number;            // Default: 30000ms
  onAttempt?: (attempt: number, maxAttempts: number) => void;
  onRetry?: (attempt: number, error: RetryError) => void;
  onExhausted?: (error: RetryError) => void;
}
```

#### Return Value

```typescript
interface UseRetryResult<T> {
  attempt: number;             // Current attempt (1-indexed)
  maxAttempts: number;         // Maximum attempts configured
  status: RetryStatus;         // 'idle' | 'retrying' | 'success' | 'failed'
  error: RetryError | null;    // Detailed error information
  data: T | null;              // Result data if successful
  execute: () => Promise<T>;   // Execute with retry logic
  reset: () => void;           // Reset to idle state
  isExecuting: boolean;        // Whether currently executing
  progress: number;            // Progress percentage (0-100)
  statusMessage: string;       // User-friendly status message
}
```

#### Error Information

```typescript
interface RetryError {
  message: string;             // Original error message
  type: ErrorType;             // Classified error type
  failedStep?: string;         // Which step failed
  statusCode?: number;         // HTTP status if applicable
  context?: Record<string, unknown>;  // Additional debugging info
}
```

## Best Practices

1. **Use appropriate max attempts** - 3 is good for network operations, 1-2 for quick operations
2. **Set reasonable timeouts** - 30s for cloud APIs, 10s for local operations
3. **Classify errors properly** - Helps users understand what went wrong
4. **Show progress to users** - Use `attempt` and `statusMessage` in UI
5. **Handle both success and failure** - Provide clear next steps in both cases
6. **Log retry attempts** - Use `onRetry` callback for monitoring
7. **Don't retry forever** - Respect user's time, fail gracefully after max attempts
8. **Skip retries when appropriate** - Pre-validated data doesn't need retry

## Troubleshooting

### Retry not working

Check that:
- Function is properly async and throws on error
- maxAttempts > 1
- Component hasn't unmounted during retry
- Timeout is sufficient for operation

### Too many retries

If users report excessive wait times:
- Reduce maxAttempts
- Decrease baseDelay
- Reduce timeout per attempt
- Use linear or constant backoff instead of exponential

### Errors not classified correctly

Update error classification logic in `classifyError()` function to include new error patterns.
