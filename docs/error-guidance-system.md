# Error Guidance System

The Error Guidance System provides user-friendly error messages with actionable troubleshooting steps and automatic error logging for support analysis.

## Overview

The system consists of three main components:

1. **Error Classifier** (`/apps/web/src/lib/error-classifier.ts`) - Categorizes errors and logs them to the database
2. **Error Guidance** (`/apps/web/src/lib/error-guidance.ts`) - Provides human-readable error messages and troubleshooting steps
3. **Error UI Components** (`/apps/web/src/components/ui/error-guidance.tsx`) - Displays errors with guidance in the UI

## Error Categories

The system classifies errors into 5 main categories:

| Category | Description | Retryable | Retry Delay |
|----------|-------------|-----------|-------------|
| `credentials` | Authentication/authorization failures | No | 0s |
| `network` | Network connectivity problems | Yes | 5s |
| `offline` | Device/controller is unreachable | Yes | 30s |
| `rate_limit` | Too many requests | Yes | 60s |
| `server` | Server-side errors | Yes | 30s |

## Usage

### In API Routes

```typescript
import { classifyAndLogError } from '@/lib/error-classifier';

export async function POST(request: NextRequest) {
  try {
    // Your code here
    await connectToController(credentials);
  } catch (error) {
    // Classify and log the error
    const errorContext = await classifyAndLogError(error, {
      brand: 'ac_infinity',
      context: 'connection',
      controllerId: controller.id,
      userId: user.id,
      metadata: {
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    // Return structured error response
    return NextResponse.json(
      {
        success: false,
        error: extractErrorMessage(errorContext.originalError),
        errorType: errorContext.type,
        retryable: errorContext.retryable,
      },
      { status: errorContext.statusCode || 500 }
    );
  }
}
```

### In React Components

```tsx
import { ErrorGuidance } from '@/components/ui/error-guidance';

function MyComponent() {
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error && (
        <ErrorGuidance
          error={error}
          brand="ac_infinity"
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
  error="Connection failed"
  brand="ac_infinity"
  compact
  onRetry={handleRetry}
/>
```

## Error Guidance Features

### 1. Plain Language Explanation

Every error is translated into plain language:

- **Before:** `ECONNREFUSED`
- **After:** "Connection Problem: Check your internet connection is working"

### 2. Actionable Next Steps

Each error category provides specific troubleshooting steps:

#### Credentials Error
- Double-check email and password
- Verify credentials in official app
- Link to password reset page
- Brand-specific credential help

#### Network Error
- Check internet connection
- Verify cloud service is online
- Try disabling VPN
- Check firewall settings
- Troubleshooting guide link

#### Offline Device
- Check device power
- Verify WiFi connection
- Shows last seen time
- WiFi indicator checks
- Power cycle instructions

#### Rate Limit
- Wait time displayed
- Explanation of rate limits
- Reduce polling frequency
- Close other apps

#### Server Error
- Wait and retry
- Check official app
- Status page link
- Contact support if persists

### 3. Retry Buttons

Retryable errors show a retry button with:
- Visual feedback
- Recommended wait time
- Automatic retry logic (optional)

### 4. Connection Diagnostics

For connection and discovery errors, the system provides step-by-step diagnostics:

```tsx
<ErrorGuidance
  error={error}
  brand="ac_infinity"
  context="discovery"
  showDiagnostics
/>
```

Diagnostics include:
- Step-by-step verification checks
- Expected results
- Troubleshooting tips for each step
- Brand-specific guidance

### 5. Last Seen Time

For offline devices, the system displays the last time the device was seen:

```tsx
<ErrorGuidance
  error="Controller is offline"
  brand="ac_infinity"
  lastSeen={controller.last_seen}
/>
```

Output: "Last seen: 2 hours ago"

### 6. Activity Logging

All errors are automatically logged to the `activity_logs` table with:

- User ID
- Controller ID (if applicable)
- Error type and message
- Context (connection, sensors, etc.)
- IP address and user agent
- Timestamp

This enables:
- Support debugging
- Error pattern analysis
- User-specific troubleshooting
- Proactive issue detection

## Brand-Specific Guidance

The system provides customized guidance for each controller brand:

### AC Infinity
- WiFi vs Bluetooth controller checks
- 2.4GHz vs 5GHz WiFi requirements
- Cloud connectivity verification
- Firmware update considerations

### Ecowitt
- API key generation steps
- Gateway connectivity checks
- Sensor range troubleshooting
- MAC address formatting

### MQTT
- WebSocket protocol requirements
- Broker accessibility checks
- Topic configuration
- Authentication troubleshooting

### CSV Upload
- Template download
- Format validation
- File size limits

## Database Schema

Errors are logged to the `activity_logs` table:

```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  controller_id UUID REFERENCES controllers(id),
  action_type TEXT, -- e.g., 'error_credentials', 'error_network'
  details JSONB, -- { error_type, error_message, context, etc. }
  result TEXT, -- 'failed'
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ
);
```

## API Response Format

Standardized error response format:

```json
{
  "success": false,
  "error": "Controller is offline",
  "errorType": "offline",
  "retryable": true,
  "retryAfter": 30
}
```

## Error Classification Logic

### Credentials
- HTTP 401, 403
- "invalid credentials", "authentication failed"
- "invalid email", "invalid password"
- "unauthorized", "session expired"

### Network
- "network error", "connection refused"
- "ECONNREFUSED", "ENOTFOUND"
- "timeout", "DNS"
- "fetch failed"

### Offline
- HTTP 503
- "offline", "unreachable"
- "not connected", "controller not found"
- "device offline", "disconnected"

### Rate Limit
- HTTP 429
- "rate limit", "too many requests"
- "throttled", "quota exceeded"

### Server
- HTTP 5xx
- "internal server error"
- "service unavailable"
- Default for unclassified errors

## Testing

Run the test suite:

```bash
npm test error-classifier.test.ts
```

Test coverage includes:
- Error classification accuracy
- Message extraction
- Retry logic
- Brand-specific insights

## Best Practices

1. **Always classify and log errors** in API routes
2. **Provide context** (brand, controller ID, user ID)
3. **Use compact mode** for inline errors
4. **Show diagnostics** for connection issues
5. **Include last seen** for offline devices
6. **Handle retry callbacks** appropriately
7. **Test error states** in development

## Examples

### Complete Error Handling Flow

```tsx
// 1. API Route
export async function POST(request: NextRequest) {
  try {
    await adapter.connect(credentials);
  } catch (error) {
    const errorContext = await classifyAndLogError(error, {
      brand: 'ac_infinity',
      context: 'connection',
      controllerId: id,
      userId: user.id,
    });

    return NextResponse.json({
      success: false,
      error: extractErrorMessage(errorContext.originalError),
      errorType: errorContext.type,
      retryable: errorContext.retryable,
    }, { status: errorContext.statusCode || 500 });
  }
}

// 2. React Component
function ControllerCard({ controller }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/controllers/${controller.id}/connect`, {
      method: 'POST',
    });

    const data = await response.json();

    if (!data.success) {
      setError({
        message: data.error,
        type: data.errorType,
        retryable: data.retryable,
      });
    }

    setLoading(false);
  };

  return (
    <Card>
      {error && (
        <ErrorGuidance
          error={error.message}
          brand={controller.brand}
          context="connection"
          controllerId={controller.id}
          lastSeen={controller.last_seen}
          showDiagnostics
          onRetry={handleConnect}
        />
      )}
      <Button onClick={handleConnect} disabled={loading}>
        Connect
      </Button>
    </Card>
  );
}
```

## Migration Guide

### From Old Error Handling

**Before:**
```tsx
{error && <div className="error">{error}</div>}
```

**After:**
```tsx
{error && (
  <ErrorGuidance
    error={error}
    brand={controller.brand}
    onRetry={handleRetry}
  />
)}
```

## Support Analysis

Query activity logs for support:

```sql
-- Recent error patterns
SELECT
  action_type,
  details->>'error_type' as error_type,
  COUNT(*) as count
FROM activity_logs
WHERE
  action_type LIKE 'error_%'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY action_type, details->>'error_type'
ORDER BY count DESC;

-- User-specific errors
SELECT
  created_at,
  action_type,
  error_message,
  details
FROM activity_logs
WHERE
  user_id = 'user-uuid'
  AND action_type LIKE 'error_%'
ORDER BY created_at DESC
LIMIT 50;
```

## Future Enhancements

- [ ] Automatic retry with exponential backoff
- [ ] Error trend analysis dashboard
- [ ] Proactive error notifications
- [ ] AI-powered troubleshooting suggestions
- [ ] Multi-language support
- [ ] Error recovery workflows
