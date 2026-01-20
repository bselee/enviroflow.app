# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EnviroFlow is a universal environmental automation platform for monitoring sensors, controlling devices, and automating workflows across multiple hardware controllers (AC Infinity, Inkbird, CSV Manual Upload, and more).

**Domain:** enviroflow.app  
**Supabase:** vhlnnfmuhttjpwyobklu.supabase.co  
**Status:** MVP Development (Phase 1)  
**Spec:** See [docs/spec/EnviroFlow_MVP_Spec_v2.0.md](docs/spec/EnviroFlow_MVP_Spec_v2.0.md)

## Repository Structure

This is a **Turborepo monorepo** with two main applications:

```
apps/
├── web/                    # Next.js 14 frontend (React 18, TypeScript)
│   └── src/
│       ├── app/            # App Router pages and API routes
│       │   ├── api/
│       │   │   ├── analyze/           # AI analysis (Grok)
│       │   │   ├── controllers/       # Controller CRUD
│       │   │   └── cron/workflows/    # Workflow executor (Vercel Cron)
│       ├── components/     # React components (shadcn/ui based)
│       │   ├── ui/         # 50+ shadcn/ui primitives
│       │   ├── layout/     # AppLayout, AppSidebar, PageHeader
│       │   └── dashboard/  # RoomCard, ActivityLog, etc.
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Utilities, Supabase client, ai-insights.ts
│
└── automation-engine/      # Backend (adapters, migrations, future Edge Functions)
    ├── supabase/
    │   ├── migrations/     # SQL schema migrations (RUN THESE!)
    │   └── functions/      # Future: Supabase Edge Functions
    └── lib/
        └── adapters/       # Controller brand adapters
            ├── types.ts              # TypeScript interfaces
            ├── index.ts              # Factory & exports
            ├── ACInfinityAdapter.ts  # ✅ Implemented
            ├── InkbirdAdapter.ts     # ✅ Implemented
            └── CSVUploadAdapter.ts   # ✅ Implemented
```

## Common Commands

### Development
```bash
npm install              # Install all dependencies (run from root)
cd apps/web && npm run dev   # Next.js dev server on :3000
```

### Frontend (apps/web)
```bash
npm run dev              # Next.js dev server on :3000
npm run build            # Production build
npm run lint             # ESLint
```

### Database
```bash
# Run migrations in Supabase SQL Editor:
# https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
# Copy contents of: apps/automation-engine/supabase/migrations/20260120_complete_schema.sql
```

## Architecture

### Frontend
- **Framework:** Next.js 14 with App Router
- **UI:** shadcn/ui (50+ components) with Radix UI primitives
- **Styling:** Tailwind CSS with custom theme (dark mode support)
- **State:** Supabase client with Realtime subscriptions
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts

### Backend
- **Database:** Supabase PostgreSQL with Row-Level Security (RLS)
- **Auth:** Supabase Auth (email/password, 2FA planned)
- **API:** Next.js API Routes + future Supabase Edge Functions
- **Automation:** Vercel Cron (every minute) → /api/cron/workflows

### Controller Adapter Pattern
Hardware controllers are abstracted via the `ControllerAdapter` interface:
```typescript
interface ControllerAdapter {
  connect(credentials): Promise<ConnectionResult>
  readSensors(controllerId): Promise<SensorReading[]>
  controlDevice(controllerId, port, command): Promise<CommandResult>
  getStatus(controllerId): Promise<ControllerStatus>
  disconnect(controllerId): Promise<void>
}
```

**Supported Brands (MVP):**
- AC Infinity (Controller 69, UIS lights/fans) - 40% market share
- Inkbird (ITC-308, ITC-310T, IHC-200) - 25% market share
- CSV Upload (manual data for any brand) - fallback option

### Key Database Tables
- `controllers` - Registered hardware controllers
- `rooms` - Logical grouping of controllers
- `workflows` - Automation workflow definitions (React Flow nodes/edges)
- `dimmer_schedules` - Sunrise/sunset lighting schedules
- `activity_logs` - Execution history (90-day retention)
- `sensor_readings` - Cached sensor data (30-day retention)
- `ai_insights` - Grok AI analysis results
- `growth_stages` - Plant growth stage definitions
- `push_tokens` - Mobile push notification tokens

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/analyze` | POST | AI analysis via Grok |
| `/api/controllers` | GET/POST | List/add controllers |
| `/api/controllers/brands` | GET | Supported brands list |
| `/api/controllers/csv-template` | GET | Download CSV template |
| `/api/cron/workflows` | GET | Execute active workflows |

## Environment Variables

Create `.env.local` in `apps/web/`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://vhlnnfmuhttjpwyobklu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROK_API_KEY=xai-...
NEXT_PUBLIC_APP_URL=https://enviroflow.app
CRON_SECRET=your-secret-for-vercel-cron  # Optional
```

## TypeScript Configuration

Path alias `@/*` maps to `./src/*` in the web app.

```typescript
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
```

## Environment Variables

Required variables (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side operations
- `GROK_API_KEY` - AI analysis (x.ai)

## Key Patterns

### Supabase Realtime
Tables with realtime enabled: `ai_insights`, `automation_actions`, `controllers`

### Edge Function Execution
Workflow executor and sunrise-sunset functions run via Supabase cron jobs every 60 seconds. They use service role key to bypass RLS.

### AI Integration
API route at `/api/analyze` sends sensor data to Grok API for environmental analysis and stores results in `ai_insights` table.
