# Sentry Error Tracking Setup

This document describes how to set up and use Sentry error tracking in the EnviroFlow application.

## Overview

Sentry is integrated into EnviroFlow to provide:
- Real-time error tracking and reporting
- Performance monitoring
- Session replay for debugging
- Stack traces and context for errors
- Alert notifications

The integration is **optional** and will gracefully fall back if not configured. The application will build and run normally without Sentry configuration.

## Configuration Files

The Sentry integration consists of three configuration files:

1. **`sentry.client.config.ts`** - Browser/client-side error tracking
2. **`sentry.server.config.ts`** - Server-side error tracking (API routes, SSR)
3. **`sentry.edge.config.ts`** - Edge Runtime error tracking (middleware, edge functions)

## Setup Instructions

### 1. Create a Sentry Account

1. Go to [https://sentry.io](https://sentry.io) and sign up
2. Create a new project and select **Next.js** as the platform
3. Copy the **DSN** (Data Source Name) from the project settings

### 2. Configure Environment Variables

Add the following variables to your `.env.local` file:

```bash
# Required: Sentry DSN for error tracking
SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
NEXT_PUBLIC_SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id

# Optional: For uploading source maps (production builds)
SENTRY_AUTH_TOKEN=your-auth-token
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug

# Optional: Environment name (defaults to NODE_ENV)
SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production

# Optional: Performance monitoring sample rates (0.0 to 1.0)
SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1

# Optional: Session replay sample rates (0.0 to 1.0)
NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1.0
```

#### Environment Variable Descriptions

- **`SENTRY_DSN`** - Server-side DSN (not exposed to browser)
- **`NEXT_PUBLIC_SENTRY_DSN`** - Client-side DSN (exposed to browser)
- **`SENTRY_AUTH_TOKEN`** - Authentication token for uploading source maps during build
- **`SENTRY_ORG`** - Your Sentry organization slug
- **`SENTRY_PROJECT`** - Your Sentry project slug
- **`SENTRY_ENVIRONMENT`** - Environment name for filtering (e.g., production, staging)
- **`SENTRY_TRACES_SAMPLE_RATE`** - Percentage of transactions to monitor for performance (0.1 = 10%)
- **`SENTRY_REPLAYS_SESSION_SAMPLE_RATE`** - Percentage of sessions to record replays (0.1 = 10%)
- **`SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE`** - Percentage of error sessions to record (1.0 = 100%)

### 3. Generate Auth Token (Optional - for source maps)

Source maps allow Sentry to show readable stack traces in production:

1. Go to **Settings → Auth Tokens** in your Sentry organization
2. Create a new token with **project:releases** and **project:write** scopes
3. Add the token to your `.env.local` as `SENTRY_AUTH_TOKEN`

### 4. Verify Installation

Build the application to ensure Sentry doesn't break the build:

```bash
cd apps/web
npm run build
```

You should see console output indicating Sentry initialization status:
- `✓ Sentry client initialized` - Client config loaded
- `✓ Sentry server initialized` - Server config loaded
- `✓ Sentry edge initialized` - Edge config loaded

Or if not configured:
- `ℹ Sentry client not initialized (NEXT_PUBLIC_SENTRY_DSN not set)`

## Features

### 1. Error Tracking

All unhandled errors are automatically captured and sent to Sentry with:
- Full stack trace
- User context (if authenticated)
- Breadcrumbs (user actions leading to error)
- Device and browser information
- Request context

### 2. Performance Monitoring

Sentry tracks:
- Page load times
- API route performance
- Database query performance
- Third-party API calls

Sample rate is configurable via `SENTRY_TRACES_SAMPLE_RATE` (default: 10%).

### 3. Session Replay

Sentry can record user sessions for debugging:
- DOM snapshots
- User interactions
- Console logs
- Network requests

Sensitive data is automatically masked (text, media).

### 4. Privacy & Security

The configuration includes built-in privacy protections:

**Client-side (`sentry.client.config.ts`):**
- Masks all text in session replays
- Blocks all media in session replays
- Filters out passwords, tokens, API keys from breadcrumbs
- Ignores browser extension errors
- Doesn't send events in development (unless `NEXT_PUBLIC_SENTRY_DEBUG=true`)

**Server-side (`sentry.server.config.ts`):**
- Removes cookies and sensitive headers
- Filters credentials, passwords, tokens from event data
- Ignores expected network errors
- Doesn't send events in development (unless `SENTRY_DEBUG=true`)

### 5. Manual Error Capture

You can manually capture errors in your code:

```typescript
import * as Sentry from '@sentry/nextjs';

try {
  // Your code
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      section: 'automation',
    },
    extra: {
      controllerId: '123',
      workflowId: '456',
    },
  });
}
```

### 6. Custom Context

Add user context for better debugging:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.username,
});
```

Add custom tags:

```typescript
Sentry.setTag('feature', 'automation');
Sentry.setTag('room_id', roomId);
```

## Deployment

### Vercel

Sentry works automatically on Vercel when environment variables are set:

1. Go to **Project Settings → Environment Variables**
2. Add the Sentry variables (at minimum `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`)
3. Redeploy your application

For source maps, also add:
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

### Other Platforms

Ensure the environment variables are available during both:
1. **Build time** - For source map upload
2. **Runtime** - For error tracking

## Troubleshooting

### Build succeeds but no errors are captured

- Verify `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are set correctly
- Check the console for initialization messages
- Test with a manual error: `throw new Error('Test Sentry')`
- Verify the DSN is valid in your Sentry project settings

### Source maps not uploaded

- Ensure `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are set
- Check the build output for upload errors
- Verify your auth token has the correct permissions

### Too many events

Adjust sample rates in `.env.local`:
```bash
SENTRY_TRACES_SAMPLE_RATE=0.05  # 5% of transactions
NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.05  # 5% of sessions
```

### Sensitive data in events

The configuration already filters common sensitive fields, but you can add more in the `beforeSend` hooks in:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`

## Disabling Sentry

To disable Sentry completely:

1. Remove or comment out the `SENTRY_DSN` variables in `.env.local`
2. The application will build and run normally without Sentry

## Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry JavaScript SDK](https://docs.sentry.io/platforms/javascript/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Session Replay](https://docs.sentry.io/product/session-replay/)

## Support

For issues or questions about the Sentry integration:
1. Check the [Sentry documentation](https://docs.sentry.io/)
2. Review the configuration files for inline comments
3. Open an issue in the EnviroFlow repository
