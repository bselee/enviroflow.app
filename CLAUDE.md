# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EnviroFlow is a universal environmental automation platform for monitoring sensors, controlling devices, and automating workflows across multiple hardware controllers (AC Infinity, Inkbird, CSV Manual Upload, and more).

**Domain:** enviroflow.app
**Supabase:** vhlnnfmuhttjpwyobklu.supabase.co
**Status:** MVP Complete
**Spec:** See [docs/spec/EnviroFlow_MVP_Spec_v2.0.md](docs/spec/EnviroFlow_MVP_Spec_v2.0.md)

## Repository Structure

This is a **Turborepo monorepo** with two main applications:

```
apps/
├── web/                    # Next.js 14 frontend (React 18, TypeScript)
│   └── src/
│       ├── app/            # App Router pages and API routes
│       │   ├── api/        # 15 API routes (see below)
│       │   ├── dashboard/  # Main dashboard page
│       │   ├── controllers/# Controller management
│       │   ├── automations/# Workflow list + builder
│       │   ├── analytics/  # Charts and KPIs
│       │   ├── settings/   # User preferences + 2FA
│       │   ├── login/      # Authentication
│       │   ├── signup/     # Registration
│       │   └── reset-password/ # Password recovery
│       ├── components/     # React components (shadcn/ui based)
│       │   ├── ui/         # 50+ shadcn/ui primitives
│       │   ├── layout/     # AppLayout, AppSidebar, PageHeader
│       │   ├── dashboard/  # RoomCard, ActivityLog, KPICards, AddRoomDialog
│       │   ├── controllers/# AddControllerDialog, EditControllerDialog, DeleteControllerDialog
│       │   ├── workflow/   # WorkflowBuilder, NodePalette, PropertiesPanel, 6 node types
│       │   └── settings/   # ChangePasswordDialog, TwoFactorDialog
│       ├── contexts/       # AuthContext
│       ├── hooks/          # 8 custom React hooks
│       ├── lib/            # Utilities, Supabase client, encryption, notifications
│       └── types/          # Shared TypeScript types
│
└── automation-engine/      # Backend (adapters, migrations)
    ├── supabase/
    │   └── migrations/     # SQL schema migrations
    └── lib/
        └── adapters/       # Controller brand adapters (inline in API routes)
```

## Common Commands

### Development
```bash
npm install              # Install all dependencies (run from root)
npm run dev              # Next.js dev server on :3000
npm run build            # Production build
npm run lint             # ESLint
```

### Deployment
```bash
vercel --prod            # Deploy to production
```

## Architecture

### Frontend Stack
- **Framework:** Next.js 14 with App Router
- **UI:** shadcn/ui (50+ components) with Radix UI primitives
- **Styling:** Tailwind CSS with custom theme (dark mode support)
- **State:** Supabase client with Realtime subscriptions
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts
- **Workflow Builder:** @xyflow/react (React Flow)

### Backend Stack
- **Database:** Supabase PostgreSQL with Row-Level Security (RLS)
- **Auth:** Supabase Auth (email/password, 2FA with TOTP)
- **API:** Next.js API Routes
- **Automation:** Vercel Cron (every minute) → /api/cron/workflows
- **Push Notifications:** Web Push API with service worker

### Key Database Tables (13 total)
| Table | Purpose | Retention |
|-------|---------|-----------|
| `rooms` | Logical grouping with lat/long | Permanent |
| `controllers` | Hardware with encrypted credentials | Permanent |
| `workflows` | Automation definitions (React Flow) | Permanent |
| `dimmer_schedules` | Sunrise/sunset lighting | Permanent |
| `activity_logs` | Execution history | 90 days |
| `sensor_readings` | Cached sensor data | 30 days |
| `ai_insights` | Grok AI analysis | Permanent |
| `growth_stages` | Plant stage definitions | Permanent |
| `push_tokens` | Notification tokens | Permanent |

### API Routes (15 total)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/controllers` | GET, POST | List/add controllers |
| `/api/controllers/[id]` | GET, PUT, DELETE | Controller CRUD |
| `/api/controllers/[id]/sensors` | GET | Live sensor readings |
| `/api/controllers/brands` | GET | Supported brands list |
| `/api/controllers/csv-template` | GET | Download CSV template |
| `/api/rooms` | GET, POST | List/add rooms |
| `/api/rooms/[id]` | GET, PUT, DELETE | Room CRUD |
| `/api/workflows` | GET, POST | List/add workflows |
| `/api/workflows/[id]` | GET, PUT, DELETE | Workflow CRUD |
| `/api/cron/workflows` | GET | Execute active workflows |
| `/api/analyze` | POST | AI analysis via Grok |
| `/api/push-tokens` | GET, POST, DELETE | Push notification tokens |
| `/api/export` | GET | Export data (CSV/JSON) |
| `/api/account` | GET, DELETE | Account info/deletion |
| `/api/auth/recovery-codes` | GET | 2FA recovery codes |

### React Hooks (8 total)

| Hook | Purpose |
|------|---------|
| `useRooms` | Room CRUD with controller counts |
| `useControllers` | Controller management with brand/room support |
| `useWorkflows` | Workflow CRUD with activation toggle |
| `useSensorReadings` | Sensor data with time series |
| `useActivityLogs` | Activity log viewing with filtering |
| `useAnalytics` | Dashboard KPIs and chart data |
| `useAuth` | Authentication context |
| `useToast` | Toast notifications |

### Workflow Builder

6 node types available:
1. **TriggerNode** (green) - Schedule, sensor threshold, or manual trigger
2. **SensorNode** (blue) - Read sensor values with threshold conditions
3. **ConditionNode** (amber) - AND/OR logic with true/false paths
4. **ActionNode** (orange) - Device control (on/off, speed, temperature)
5. **DimmerNode** (yellow) - Sunrise/sunset light schedules
6. **NotificationNode** (purple) - Push/email/SMS alerts

Features:
- Drag-and-drop from NodePalette
- Snap to grid (16px)
- MiniMap navigation
- Hysteresis support (trigger/reset thresholds)
- Conflict detection for same-device actions

## Environment Variables

Create `.env.local` in `apps/web/`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://vhlnnfmuhttjpwyobklu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROK_API_KEY=xai-...
NEXT_PUBLIC_APP_URL=https://enviroflow.app
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...  # For push notifications
VAPID_PRIVATE_KEY=...             # For push notifications
CRON_SECRET=your-secret           # For Vercel Cron
```

## TypeScript Configuration

Path alias `@/*` maps to `./src/*` in the web app.

```typescript
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useRooms } from "@/hooks";
```

## Security Features

1. **Credential Encryption**: Controller credentials encrypted before storage
2. **Row-Level Security**: All tables have RLS policies enforcing user_id
3. **2FA Support**: TOTP-based two-factor authentication
4. **Input Validation**: Zod schemas on all API inputs
5. **Sensor Validation**: Readings validated against physical ranges
6. **Hysteresis**: Prevents rapid on/off cycling in automations

## Key Patterns

### Supabase Realtime
Tables with realtime enabled: `controllers`, `workflows`, `rooms`, `activity_logs`, `sensor_readings`, `ai_insights`

### Workflow Execution
1. Vercel Cron triggers `/api/cron/workflows` every minute
2. Fetches active workflows with `trigger_state` management
3. Evaluates trigger conditions with hysteresis (ARMED → FIRED → RESET)
4. Executes action nodes via controller adapters
5. Logs results to `activity_logs`

### Controller Adapter Pattern
Hardware controllers abstracted via adapter interface:
```typescript
interface ControllerAdapter {
  connect(credentials): Promise<ConnectionResult>
  readSensors(controllerId): Promise<SensorReading[]>
  controlDevice(controllerId, port, command): Promise<CommandResult>
  getStatus(controllerId): Promise<ControllerStatus>
  disconnect(controllerId): Promise<void>
}
```

Supported brands: AC Infinity, Inkbird, CSV Upload

### AI Integration
`/api/analyze` sends sensor data to Grok API for environmental analysis and stores results in `ai_insights` table.
