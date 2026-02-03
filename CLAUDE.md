# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EnviroFlow is a universal environmental automation platform for monitoring sensors, controlling devices, and automating workflows across multiple hardware controllers (AC Infinity, Inkbird, Ecowitt, Govee, MQTT, CSV Upload).

**Domain:** enviroflow.app
**Supabase:** vhlnnfmuhttjpwyobklu.supabase.co
**Status:** MVP Complete
**Spec:** See [docs/spec/EnviroFlow_MVP_Spec_v2.0.md](docs/spec/EnviroFlow_MVP_Spec_v2.0.md)

## Common Commands

```bash
# From repository root
npm install              # Install all dependencies (Turborepo workspaces)
npm run dev              # Run all apps in dev mode
npm run build            # Build all apps

# From apps/web/
npm run dev              # Next.js dev server on :3000
npm run build            # Production build
npm run lint             # ESLint

# Unit Tests (Jest) - run from apps/web/
npm run test             # Run all unit tests
npm run test:watch       # Watch mode for TDD
npm run test -- --testPathPattern="component-name"  # Run specific tests
npm run test:coverage    # Generate coverage report

# E2E Tests (Playwright) - run from apps/web/
npm run test:e2e         # Run all E2E tests (starts dev server automatically)
npm run test:e2e:chromium   # Chromium only
npm run test:e2e:mobile     # Mobile viewport tests
npm run test:e2e:headed     # Run with visible browser
npm run test:e2e:debug      # Debug mode with inspector

# Database migrations (run in Supabase SQL Editor)
# https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
# - apps/automation-engine/supabase/migrations/20260121_complete_schema.sql
# - apps/automation-engine/supabase/migrations/20260121_notifications.sql
```

## Architecture

> **📖 See `docs/ARCHITECTURE.md` for the complete, authoritative architecture guide.**

### Data Flow Pattern

**Live Sensor Data**: Direct API Polling (like Home Assistant)
- Browser → Next.js API Route → AC Infinity Cloud API → Response
- Poll every 10-30 seconds using `setInterval` + `fetch`
- NO Supabase Realtime subscriptions for sensors

**Configuration Data**: Supabase Storage Only
- Rooms, controller credentials, historical readings
- Standard CRUD operations, NOT real-time subscriptions

### Monorepo Structure

Turborepo monorepo with two main applications:
- **apps/web/** - Next.js 14 frontend (App Router, React 18, TypeScript)
- **apps/automation-engine/** - Backend services (adapters, migrations, future Edge Functions)

### Frontend Stack
- **UI:** shadcn/ui components with Radix UI primitives
- **Styling:** Tailwind CSS with dark mode support
- **State:** Supabase client with Realtime subscriptions (no Redux/Zustand)
- **Forms:** React Hook Form + Zod validation
- **Workflow Builder:** @xyflow/react (React Flow)
- **Charts:** Recharts

### Backend Stack
- **Database:** Supabase PostgreSQL with Row-Level Security (RLS)
- **Auth:** Supabase Auth (email/password, TOTP 2FA)
- **API:** Next.js API Routes (server-side operations)
- **Automation:** Vercel Cron (every minute) → /api/cron/workflows
- **Error Tracking:** Sentry (optional, see apps/web/SENTRY_SETUP.md)

### Controller Adapter Pattern

Hardware controllers are abstracted via the `ControllerAdapter` interface in `apps/automation-engine/lib/adapters/`:

```typescript
interface ControllerAdapter {
  connect(credentials): Promise<ConnectionResult>
  readSensors(controllerId): Promise<SensorReading[]>
  controlDevice(controllerId, port, command): Promise<CommandResult>
  getStatus(controllerId): Promise<ControllerStatus>
  disconnect(controllerId): Promise<void>
}
```

Implemented adapters: `ACInfinityAdapter`, `InkbirdAdapter`, `EcowittAdapter`, `GoveeAdapter`, `MQTTAdapter`, `CSVUploadAdapter`

## Key Patterns

### TypeScript Types

Application types are in `apps/web/src/types/`:
- `index.ts` - Main types (controllers, rooms, workflows, sensors)
- `modes.ts` - Device mode types
- `schedules.ts` - Schedule types

Add new types to the appropriate existing file rather than creating new type files.

### Supabase Client Usage

Two client patterns exist:
- **Browser client** (`@/lib/supabase`): Uses `createClient()` singleton with cookies for SSR
- **Server client** (`@/lib/supabase-server`): For Server Components and API Routes with cookie-based auth
- **Service role client**: `createServerClient()` from `@/lib/supabase` bypasses RLS (server-side only)

### Custom Hooks Pattern

Hooks in `apps/web/src/hooks/` follow this pattern:
- Return `{ data, loading, error, ...mutations }` state
- Use `isMounted` ref to prevent state updates after unmount
- **LIVE SENSOR DATA**: Use Direct API Polling (see `docs/ARCHITECTURE.md`)
- **CONFIGURATION DATA**: Use Supabase for storage only (rooms, credentials, history)
- CRUD operations return `{ success: boolean, data?, error? }`

> **⚠️ IMPORTANT: See `docs/ARCHITECTURE.md` for the authoritative data flow pattern.**
> Sensor data MUST use Direct API Polling (like Home Assistant), NOT Supabase Realtime.

### Credential Encryption

Controller credentials are encrypted at rest using AES-256-GCM:
- **Encrypt/decrypt:** `apps/web/src/lib/server-encryption.ts` (server-side only)
- **Client-side masking:** `apps/web/src/lib/encryption.ts` (display only)
- Encryption happens in API routes before database storage
- Credentials are NEVER returned in API responses

### Demo Mode

When no user is authenticated, the app can show demo data. Demo data utilities are in `apps/web/src/lib/demo-data.ts`.

### Realtime Subscriptions

Tables with realtime enabled: `ai_insights`, `automation_actions`, `controllers`, `sensor_readings`

### User Preferences

User preferences are stored in Supabase `auth.users.user_metadata.dashboard_preferences`:
- **Caching:** Also stored in `localStorage` under `enviroflow_user_preferences`
- **Sync:** Debounced (1s) sync to server on changes
- **Hook:** `useUserPreferences()` handles fetch, update, and sync
- **Per-room settings:** Optimal ranges, warning tolerances, alert thresholds

Key preferences: `temperatureUnit` (F/C), `viewMode`, `primaryMetric`, `timelineMetrics`, `roomSettings`

### Workflow Builder

Visual workflow builder using `@xyflow/react`. Node types in `components/workflow/nodes/`:
- `TriggerNode` - Schedule or event-based triggers
- `SensorNode` - Sensor reading conditions
- `ConditionNode` - Logical conditions (and/or)
- `PortConditionNode` - Device port state conditions
- `ActionNode` - Device control actions
- `VerifiedActionNode` - Actions with verification
- `DimmerNode` - Dimmer/lighting schedule actions
- `ModeNode` - Device mode changes
- `NotificationNode` - Push/email notifications

### Testing

**Unit tests** (Jest) in `apps/web/src/**/__tests__/*.test.ts`:
- Test utilities, hooks, and lib functions
- Run specific test: `npm run test -- --testPathPattern="encryption"`

**E2E tests** (Playwright) in `apps/web/e2e/*.spec.ts`:
- Cover critical user journeys (auth, dashboard, controller setup, device control)
- Run in Chromium and mobile viewports
- Dev server starts automatically for local runs

## API Routes

API routes are in `apps/web/src/app/api/`. Key patterns:

| Pattern | Purpose |
|---------|---------|
| `/api/controllers/**` | Controller CRUD, sensors, devices, modes, discovery |
| `/api/sensors/live` | Live sensor data (Direct API Polling - primary pattern) |
| `/api/sensors/history` | Historical sensor readings from Supabase |
| `/api/rooms/**` | Room CRUD operations |
| `/api/workflows/**` | Workflow CRUD and execution |
| `/api/schedules/**` | Dimmer schedules and recommendations |
| `/api/alerts/**` | Alert management (acknowledge, resolve, snooze) |
| `/api/cron/**` | Vercel cron jobs (poll-sensors, workflows, check-alerts) |
| `/api/analyze` | AI analysis via Grok |
| `/api/export` | Export data (CSV/JSON) |

## Environment Variables

Required in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vhlnnfmuhttjpwyobklu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
XAI_API_KEY=xai-...  # AI analysis (GROK_API_KEY also supported)
NEXT_PUBLIC_APP_URL=https://enviroflow.app

# REQUIRED: 32-byte encryption key (64 hex chars)
# Generate: openssl rand -hex 32
ENCRYPTION_KEY=<64-character-hex-string>

# Optional
CRON_SECRET=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...  # Push notifications
VAPID_PRIVATE_KEY=...

# Sentry Error Tracking (optional)
# See apps/web/SENTRY_SETUP.md for full setup instructions
SENTRY_DSN=...  # Server-side DSN
NEXT_PUBLIC_SENTRY_DSN=...  # Client-side DSN
SENTRY_AUTH_TOKEN=...  # For source map upload
SENTRY_ORG=...  # Organization slug
SENTRY_PROJECT=...  # Project slug
```

## Key Database Tables

- `controllers` - Registered hardware controllers
- `rooms` - Logical grouping of controllers
- `workflows` - Automation definitions (React Flow nodes/edges)
- `sensor_readings` - Cached sensor data (30-day retention)
- `activity_logs` - Execution history (90-day retention)
- `dimmer_schedules` - Sunrise/sunset lighting schedules
- `ai_insights` - Grok AI analysis results
- `growth_stages` - Plant growth stage definitions
