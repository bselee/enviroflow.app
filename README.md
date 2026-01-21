# EnviroFlow

Universal environmental automation platform for monitoring sensors, controlling devices, and automating workflows across multiple hardware controllers.

**Domain:** [enviroflow.app](https://enviroflow.app)
**Status:** MVP Complete
**Stack:** Next.js 14, Supabase, React Flow, shadcn/ui

## Features

- **Multi-Brand Support**: AC Infinity, Inkbird, CSV Upload
- **Visual Workflow Builder**: Drag-and-drop automation with 6 node types
- **Real-Time Monitoring**: Live sensor data with Supabase Realtime
- **Smart Automation**: Hysteresis control prevents rapid on/off cycling
- **AI Analysis**: Grok-powered environmental insights
- **Push Notifications**: Web Push API for alerts
- **2FA Security**: TOTP-based two-factor authentication

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local with your credentials

# Run development server
npm run dev

# Build for production
npm run build
```

## Repository Structure

```
apps/
├── web/                    # Next.js 14 frontend
│   └── src/
│       ├── app/            # Pages and API routes (15 endpoints)
│       ├── components/     # React components (40+)
│       ├── hooks/          # Custom React hooks (8)
│       ├── contexts/       # Auth context
│       ├── lib/            # Utilities, Supabase client
│       └── types/          # Shared TypeScript types
│
└── automation-engine/      # Backend services
    └── supabase/
        └── migrations/     # Database schema

docs/
├── SETUP.md               # Deployment guide
├── BACKEND_GUIDE.md       # API documentation
└── spec/                  # Product specifications
```

## Documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](docs/SETUP.md) | Complete deployment guide |
| [CLAUDE.md](CLAUDE.md) | AI assistant instructions |
| [BACKEND_GUIDE.md](docs/BACKEND_GUIDE.md) | API reference |
| [MVP Spec](docs/spec/EnviroFlow_MVP_Spec_v2.0.md) | Product requirements |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| UI | shadcn/ui, Tailwind CSS, Radix UI |
| Workflow | @xyflow/react (React Flow) |
| Charts | Recharts |
| Backend | Supabase PostgreSQL, RLS |
| Auth | Supabase Auth, TOTP 2FA |
| AI | Grok API (x.ai) |
| Notifications | Web Push API |
| Deployment | Vercel |

## Environment Variables

Required for `apps/web/.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI
GROK_API_KEY=xai-...

# App
NEXT_PUBLIC_APP_URL=https://enviroflow.app

# Push Notifications (optional)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Cron (optional)
CRON_SECRET=...
```

## Deployment

See [docs/SETUP.md](docs/SETUP.md) for detailed deployment instructions.

### Quick Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Database Setup

Run migration in Supabase SQL Editor:
```
apps/automation-engine/supabase/migrations/20260121_complete_schema.sql
```

## API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/controllers` | GET, POST | List/add controllers |
| `/api/controllers/[id]` | GET, PUT, DELETE | Controller CRUD |
| `/api/controllers/[id]/sensors` | GET | Live sensor readings |
| `/api/rooms` | GET, POST | Room management |
| `/api/rooms/[id]` | GET, PUT, DELETE | Room CRUD |
| `/api/workflows` | GET, POST | Workflow management |
| `/api/workflows/[id]` | GET, PUT, DELETE | Workflow CRUD |
| `/api/cron/workflows` | GET | Execute automations |
| `/api/analyze` | POST | AI analysis |
| `/api/export` | GET | Export data (CSV/JSON) |

## License

Private - All rights reserved
