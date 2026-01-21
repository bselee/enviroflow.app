# EnviroFlow Setup Guide

Complete guide for deploying EnviroFlow from scratch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Supabase Setup](#supabase-setup)
4. [Vercel Deployment](#vercel-deployment)
5. [Environment Variables](#environment-variables)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ (recommended: 20.x)
- npm 9+
- Git
- GitHub account
- Supabase account (free tier works)
- Vercel account (free tier works)
- Grok API key from x.ai (optional, for AI features)

---

## Local Development

### 1. Clone the Repository

```bash
git clone https://github.com/bselee/enviroflow.app.git
cd enviroflow.app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local` with your credentials (see [Environment Variables](#environment-variables)).

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 5. Run Production Build (Test)

```bash
npm run build
```

Ensure build completes without errors before deploying.

---

## Supabase Setup

### 1. Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose organization and name (e.g., "enviroflow")
4. Select region closest to your users
5. Set a strong database password (save this!)
6. Click "Create new project"

### 2. Get API Keys

1. Go to Project Settings → API
2. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Never expose service_role key in client-side code!**

### 3. Run Database Migration

1. Go to SQL Editor in Supabase Dashboard
2. Click "New Query"
3. Copy contents of: `apps/automation-engine/supabase/migrations/20260121_complete_schema.sql`
4. Click "Run"

This creates:
- 13 tables with RLS policies
- Indexes for performance
- Realtime publication for 6 tables
- Default growth stages

### 4. Verify Tables

Run this query to verify:

```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected tables:
- activity_logs
- ai_insights
- audit_logs
- controllers
- dimmer_schedules
- growth_stages
- manual_sensor_data
- push_tokens
- rooms
- sensor_readings
- sunrise_sunset_cache
- workflow_templates
- workflows

### 5. Enable Realtime

1. Go to Database → Replication
2. Enable for these tables:
   - controllers
   - workflows
   - rooms
   - activity_logs
   - sensor_readings
   - ai_insights

---

## Vercel Deployment

### Option A: GitHub Integration (Recommended)

1. Push code to GitHub
2. Go to https://vercel.com/new
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build`
   - **Install Command**: `npm install`
5. Add environment variables (see below)
6. Click "Deploy"

### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy from apps/web directory
cd apps/web
vercel --prod
```

### Configure Cron Job

The `apps/web/vercel.json` already includes cron configuration:

```json
{
  "crons": [{
    "path": "/api/cron/workflows",
    "schedule": "* * * * *"
  }]
}
```

This runs workflow execution every minute.

---

## Environment Variables

### Required Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) | `eyJ...` |
| `NEXT_PUBLIC_APP_URL` | Your app URL | `https://enviroflow.app` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GROK_API_KEY` | x.ai API key for AI analysis | None (AI disabled) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push notification public key | None |
| `VAPID_PRIVATE_KEY` | Push notification private key | None |
| `CRON_SECRET` | Secret for cron endpoint | None |

### Generate VAPID Keys (for Push Notifications)

```bash
npx web-push generate-vapid-keys
```

---

## Post-Deployment Verification

### 1. Test Authentication

1. Go to your deployed URL
2. Click "Sign Up"
3. Create account with email/password
4. Verify email (check inbox)
5. Login and access dashboard

### 2. Test Controller Connection

1. Go to Controllers page
2. Click "Add Controller"
3. Select brand (AC Infinity, Inkbird, or CSV)
4. Enter credentials
5. Verify connection succeeds

### 3. Test Workflow Builder

1. Go to Automations page
2. Click "Create Automation"
3. Drag a Trigger node onto canvas
4. Drag an Action node
5. Connect them
6. Save workflow

### 4. Test API Endpoints

```bash
# Health check
curl https://your-domain.com/api/controllers/brands

# Should return list of supported brands
```

### 5. Verify Cron Job

1. Go to Vercel Dashboard → Cron Jobs
2. Check that `/api/cron/workflows` is scheduled
3. Monitor execution logs

---

## Troubleshooting

### Build Fails on Vercel

**Symptom**: Build fails with TypeScript errors

**Solution**:
1. Run `npm run build` locally first
2. Fix any TypeScript errors
3. Push and redeploy

### Database Connection Error

**Symptom**: "Invalid API key" or connection refused

**Solution**:
1. Verify Supabase URL and keys in environment variables
2. Check that migration was run successfully
3. Verify RLS policies allow access

### Cron Job Not Running

**Symptom**: Workflows not executing automatically

**Solution**:
1. Check Vercel Cron Jobs tab for errors
2. Verify `vercel.json` is in `apps/web/` directory
3. Check API route logs for errors

### Authentication Not Working

**Symptom**: Can't login or sign up

**Solution**:
1. Check Supabase Auth settings
2. Verify redirect URLs in Supabase Dashboard
3. Check browser console for CORS errors

### Push Notifications Not Working

**Symptom**: No notifications received

**Solution**:
1. Generate and set VAPID keys
2. Check browser permissions
3. Verify service worker is registered

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Next.js App                        │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │    │
│  │  │  Pages    │  │  API      │  │  Middleware   │   │    │
│  │  │  (React)  │  │  Routes   │  │  (Auth)       │   │    │
│  │  └───────────┘  └───────────┘  └───────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                    Vercel Cron                               │
│                    (every minute)                            │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                        Supabase                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  PostgreSQL │  │  Auth       │  │  Realtime           │   │
│  │  (13 tables)│  │  (email/2FA)│  │  (6 tables)         │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                    Controller APIs                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ AC Infinity │  │  Inkbird    │  │  CSV Upload         │   │
│  │ Cloud API   │  │  Cloud API  │  │  (Manual Data)      │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

---

## Support

- **Issues**: GitHub Issues
- **Documentation**: `/docs` folder
- **AI Instructions**: `CLAUDE.md`
