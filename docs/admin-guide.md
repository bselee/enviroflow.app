# EnviroFlow Administrator Guide

This guide covers deployment, configuration, performance tuning, troubleshooting, and maintenance for EnviroFlow administrators.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Database Management](#database-management)
5. [Performance Tuning](#performance-tuning)
6. [Monitoring & Logging](#monitoring--logging)
7. [Security](#security)
8. [Backup & Recovery](#backup--recovery)
9. [Troubleshooting](#troubleshooting)
10. [Scaling](#scaling)

## System Requirements

### Minimum Requirements

For small deployments (1-10 controllers):

- **Runtime:** Node.js 18.x or higher
- **Database:** PostgreSQL 14+ (Supabase recommended)
- **Memory:** 2GB RAM
- **Storage:** 10GB SSD
- **Network:** 10 Mbps upload/download

### Recommended Requirements

For production deployments (10-100 controllers):

- **Runtime:** Node.js 20.x LTS
- **Database:** PostgreSQL 15+ with connection pooling
- **Memory:** 8GB RAM
- **Storage:** 50GB SSD
- **Network:** 100 Mbps upload/download
- **CPU:** 4+ cores

### Large Deployments

For enterprise deployments (100+ controllers):

- **Runtime:** Node.js 20.x LTS on multiple instances
- **Database:** PostgreSQL 15+ with read replicas
- **Memory:** 16GB+ RAM per instance
- **Storage:** 200GB+ SSD
- **Network:** 1 Gbps
- **Load Balancer:** Required
- **CDN:** Recommended for static assets

## Installation

### Option 1: Vercel Deployment (Recommended)

1. **Fork the Repository**

```bash
git clone https://github.com/yourusername/enviroflow.git
cd enviroflow
```

2. **Install Dependencies**

```bash
npm install
```

3. **Configure Environment Variables**

Create `apps/web/.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# Encryption (CRITICAL - Generate: openssl rand -hex 32)
ENCRYPTION_KEY=YOUR_64_CHARACTER_HEX_STRING

# AI Integration (Optional)
XAI_API_KEY=xai-YOUR_KEY

# App Configuration
NEXT_PUBLIC_APP_URL=https://enviroflow.app

# Cron Protection
CRON_SECRET=YOUR_RANDOM_SECRET
```

4. **Deploy to Vercel**

```bash
npm install -g vercel
vercel deploy --prod
```

5. **Configure Cron Jobs**

In Vercel dashboard, add cron configuration to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/workflows",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/poll-sensors",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Option 2: Self-Hosted

1. **Clone and Install**

```bash
git clone https://github.com/yourusername/enviroflow.git
cd enviroflow
npm install
```

2. **Build**

```bash
npm run build
```

3. **Start Production Server**

```bash
cd apps/web
npm run start
```

4. **Configure Reverse Proxy (Nginx)**

```nginx
server {
    listen 80;
    server_name enviroflow.app;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

5. **Setup SSL (Let's Encrypt)**

```bash
sudo certbot --nginx -d enviroflow.app
```

6. **Setup Cron Jobs**

```bash
# Edit crontab
crontab -e

# Add cron jobs
* * * * * curl -X GET http://localhost:3000/api/cron/workflows?secret=YOUR_CRON_SECRET
*/5 * * * * curl -X GET http://localhost:3000/api/cron/poll-sensors?secret=YOUR_CRON_SECRET
```

### Option 3: Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

RUN npm install --workspace=apps/web

COPY . .

RUN npm run build --workspace=apps/web

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=apps/web"]
```

```bash
# Build and run
docker build -t enviroflow .
docker run -p 3000:3000 --env-file .env enviroflow
```

## Configuration

### Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL | `https://abc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) | `eyJ...` |
| `ENCRYPTION_KEY` | Yes | 64-char hex string for credential encryption | Generate with `openssl rand -hex 32` |
| `XAI_API_KEY` | No | Grok AI API key for AI features | `xai-...` |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of your deployment | `https://enviroflow.app` |
| `CRON_SECRET` | Yes | Secret for cron endpoint protection | Random string |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Push notification public key | Generate with web-push |
| `VAPID_PRIVATE_KEY` | No | Push notification private key | Generate with web-push |
| `NODE_ENV` | Auto | Environment mode | `production` |

### Generating Encryption Key

**CRITICAL:** The encryption key must be exactly 64 hexadecimal characters (32 bytes).

```bash
# Generate a secure encryption key
openssl rand -hex 32

# Output example:
# a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890
```

**Never commit this key to version control.** Store it securely in environment variables.

### Configuring Push Notifications

```bash
# Install web-push
npm install -g web-push

# Generate VAPID keys
web-push generate-vapid-keys

# Add to .env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
```

## Database Management

### Initial Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Note your project URL and keys

2. **Run Migrations**

Navigate to Supabase SQL Editor and run these migrations in order:

```bash
apps/automation-engine/supabase/migrations/20260121_complete_schema.sql
apps/automation-engine/supabase/migrations/20260121_notifications.sql
apps/automation-engine/supabase/migrations/20260124_add_ecowitt_sensor_types.sql
```

3. **Enable Realtime**

In Supabase dashboard:
- Go to Database > Replication
- Enable replication for these tables:
  - `ai_insights`
  - `automation_actions`
  - `controllers`
  - `sensor_readings`

### Database Maintenance

#### Sensor Data Retention

By default, sensor readings are retained for 30 days. To configure:

```sql
-- Update retention policy
UPDATE system_settings
SET value = '90'
WHERE key = 'sensor_retention_days';

-- Manual cleanup (runs automatically via cron)
DELETE FROM sensor_readings
WHERE created_at < NOW() - INTERVAL '30 days';
```

#### Activity Log Retention

Activity logs are retained for 90 days:

```sql
-- Update retention
UPDATE system_settings
SET value = '180'
WHERE key = 'activity_retention_days';

-- Manual cleanup
DELETE FROM activity_logs
WHERE created_at < NOW() - INTERVAL '90 days';
```

#### Vacuum and Analyze

For optimal performance, regularly vacuum and analyze:

```sql
-- Vacuum all tables
VACUUM ANALYZE;

-- Vacuum specific large tables
VACUUM ANALYZE sensor_readings;
VACUUM ANALYZE activity_logs;
```

#### Index Maintenance

Monitor and rebuild indexes:

```sql
-- Check index bloat
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan < 50;

-- Rebuild bloated indexes
REINDEX INDEX idx_sensor_readings_timestamp;
REINDEX INDEX idx_sensor_readings_controller_id;
```

## Performance Tuning

### Database Performance

#### Connection Pooling

Configure Supabase connection pooling:

1. Go to Supabase Dashboard > Database > Connection Pooling
2. Enable pooling mode: **Transaction**
3. Pool size: **15-30** for production

#### Query Optimization

Monitor slow queries:

```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

#### Materialized Views

For analytics, use materialized views:

```sql
-- Create materialized view for daily aggregates
CREATE MATERIALIZED VIEW daily_sensor_aggregates AS
SELECT
  controller_id,
  DATE_TRUNC('day', timestamp) as day,
  sensor_type,
  AVG(value) as avg_value,
  MIN(value) as min_value,
  MAX(value) as max_value
FROM sensor_readings
GROUP BY controller_id, day, sensor_type;

-- Refresh daily
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_sensor_aggregates;
```

### Application Performance

#### Next.js Configuration

Optimize `next.config.js`:

```javascript
module.exports = {
  // Enable SWC minification
  swcMinify: true,

  // Optimize images
  images: {
    domains: ['vhlnnfmuhttjpwyobklu.supabase.co'],
    formats: ['image/avif', 'image/webp'],
  },

  // Compress output
  compress: true,

  // Enable experimental features
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['recharts', '@xyflow/react'],
  },
};
```

#### Caching Strategy

Implement aggressive caching:

```javascript
// API route example with caching
export async function GET(request) {
  // Cache for 5 minutes
  return new Response(JSON.stringify(data), {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
```

#### Rate Limiting

Implement rate limiting to prevent abuse:

```javascript
// apps/web/src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, "1 m"),
});

export async function checkRateLimit(identifier: string) {
  const { success, reset } = await ratelimit.limit(identifier);
  return { success, reset };
}
```

## Monitoring & Logging

### Application Monitoring

#### Vercel Analytics

Enable Vercel Analytics in `apps/web/src/app/layout.tsx`:

```tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

#### Error Tracking (Sentry)

```bash
npm install @sentry/nextjs
```

Configure `sentry.client.config.js`:

```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

### Database Monitoring

Monitor key metrics:

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Database size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Lock monitoring
SELECT * FROM pg_locks WHERE NOT granted;
```

### Logging Configuration

Set up structured logging:

```typescript
// apps/web/src/lib/logger.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

export default logger;
```

Usage:

```typescript
import logger from '@/lib/logger';

logger.info({ controllerId }, 'Controller connected');
logger.error({ error }, 'Failed to connect controller');
```

## Security

### Encryption

#### Credential Encryption

All controller credentials are encrypted using AES-256-GCM:

```typescript
// Encryption happens in API routes
import { encryptCredentials, decryptCredentials } from '@/lib/server-encryption';

// Store
const encrypted = await encryptCredentials(credentials);
await supabase.from('controllers').insert({
  encrypted_credentials: encrypted
});

// Retrieve
const { encrypted_credentials } = await supabase
  .from('controllers')
  .select('encrypted_credentials')
  .eq('id', controllerId)
  .single();

const credentials = await decryptCredentials(encrypted_credentials);
```

**IMPORTANT:** Never log or expose decrypted credentials.

### Row-Level Security (RLS)

All database tables use RLS:

```sql
-- Example RLS policy
CREATE POLICY "Users can only see their own controllers"
ON controllers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own controllers"
ON controllers FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### API Security

#### Protect Cron Endpoints

```typescript
// apps/web/src/app/api/cron/workflows/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Execute workflow logic
}
```

#### CORS Configuration

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://enviroflow.app' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
        ],
      },
    ];
  },
};
```

### Security Checklist

- [ ] `ENCRYPTION_KEY` is 64 characters and securely stored
- [ ] Supabase RLS policies enabled on all tables
- [ ] Cron endpoints protected with `CRON_SECRET`
- [ ] HTTPS enforced (redirect HTTP to HTTPS)
- [ ] Rate limiting implemented on sensitive endpoints
- [ ] Credentials never logged or exposed in responses
- [ ] Environment variables not committed to git
- [ ] Database backups enabled and tested
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Dependencies regularly updated (`npm audit`)

## Backup & Recovery

### Database Backups

Supabase provides automatic backups:

1. **Automatic Daily Backups**
   - Go to Supabase Dashboard > Database > Backups
   - Backups retained for 7 days (Free tier) or 30 days (Pro tier)

2. **Manual Backups**

```bash
# Export entire database
pg_dump -h db.YOUR_PROJECT.supabase.co \
        -U postgres \
        -d postgres \
        -F c \
        -f backup_$(date +%Y%m%d).dump

# Export specific tables
pg_dump -h db.YOUR_PROJECT.supabase.co \
        -U postgres \
        -d postgres \
        -t controllers -t sensor_readings \
        -F c \
        -f partial_backup_$(date +%Y%m%d).dump
```

3. **Restore from Backup**

```bash
pg_restore -h db.YOUR_PROJECT.supabase.co \
           -U postgres \
           -d postgres \
           -c \
           backup_20260124.dump
```

### Application Backups

Backup critical data:

1. **Workflows**

```sql
-- Export workflows to JSON
COPY (
  SELECT json_agg(row_to_json(workflows))
  FROM workflows
) TO '/tmp/workflows_backup.json';
```

2. **Configuration**

Backup environment variables and configuration files:

```bash
# Create backup
tar -czf config_backup_$(date +%Y%m%d).tar.gz \
    .env.local \
    vercel.json \
    next.config.js

# Encrypt backup
openssl enc -aes-256-cbc \
    -in config_backup_20260124.tar.gz \
    -out config_backup_20260124.tar.gz.enc
```

## Troubleshooting

### Common Issues

#### High Memory Usage

**Symptoms:** Application crashes, slow response times

**Diagnosis:**

```bash
# Check Node.js memory
node --max-old-space-size=4096 index.js

# Monitor memory in production
pm2 start app.js --max-memory-restart 1G
```

**Solutions:**
1. Increase Node.js heap size
2. Optimize database queries
3. Implement pagination for large datasets
4. Use streaming for large exports

#### Database Connection Pool Exhausted

**Symptoms:** `Error: too many connections`

**Diagnosis:**

```sql
-- Check active connections
SELECT count(*) as connections, state
FROM pg_stat_activity
GROUP BY state;
```

**Solutions:**
1. Enable Supabase connection pooling
2. Reduce pool size in application
3. Close unused connections
4. Implement connection retry logic

#### Slow API Responses

**Symptoms:** API requests taking > 2 seconds

**Diagnosis:**

```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Solutions:**
1. Add database indexes
2. Implement caching
3. Optimize queries (avoid N+1)
4. Use pagination

#### Workflow Not Executing

**Symptoms:** Workflows not triggering

**Diagnosis:**

```bash
# Check cron execution
curl https://enviroflow.app/api/cron/workflows?secret=YOUR_SECRET

# Check activity logs
SELECT * FROM activity_logs
WHERE workflow_id = 'uuid'
ORDER BY created_at DESC
LIMIT 10;
```

**Solutions:**
1. Verify cron jobs are running
2. Check workflow is_active = true
3. Verify controller is online
4. Check error logs in activity_logs table

### Debug Mode

Enable debug logging:

```bash
# .env.local
LOG_LEVEL=debug
NEXT_PUBLIC_DEBUG=true
```

### Health Check Endpoint

Implement health check:

```typescript
// apps/web/src/app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    supabase: await checkSupabase(),
    encryption: await checkEncryption(),
  };

  const healthy = Object.values(checks).every(check => check.status === 'ok');

  return Response.json(
    { healthy, checks },
    { status: healthy ? 200 : 503 }
  );
}
```

## Scaling

### Horizontal Scaling

For large deployments:

1. **Load Balancing**

```nginx
upstream enviroflow {
    least_conn;
    server app1.enviroflow.app:3000;
    server app2.enviroflow.app:3000;
    server app3.enviroflow.app:3000;
}

server {
    listen 443 ssl;
    server_name enviroflow.app;

    location / {
        proxy_pass http://enviroflow;
    }
}
```

2. **Database Read Replicas**

Configure read replicas in Supabase and route read queries:

```typescript
const writeDb = createClient(SUPABASE_PRIMARY_URL, KEY);
const readDb = createClient(SUPABASE_REPLICA_URL, KEY);

// Use read replica for queries
const { data } = await readDb.from('sensor_readings').select('*');

// Use primary for writes
await writeDb.from('controllers').insert(data);
```

3. **CDN for Static Assets**

Use Vercel Edge Network or Cloudflare CDN for static assets.

### Vertical Scaling

For single-server deployments:

1. **Increase Resources**
   - More CPU cores
   - More RAM (4GB → 8GB → 16GB)
   - Faster storage (SSD → NVMe)

2. **Optimize Node.js**

```bash
# Increase heap size
NODE_OPTIONS="--max-old-space-size=8192"

# Use clustering
pm2 start app.js -i max
```

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time | < 200ms | p95 latency |
| Dashboard Load Time | < 2s | Time to Interactive |
| Database Query Time | < 50ms | p95 latency |
| Sensor Reading Latency | < 5s | Time from device to dashboard |
| Workflow Execution | < 1s | Trigger to action |
| Uptime | > 99.9% | Monthly availability |

## Support

For administrator support:

- **Email:** admin@enviroflow.app
- **Documentation:** [docs.enviroflow.app](https://docs.enviroflow.app)
- **Status Page:** [status.enviroflow.app](https://status.enviroflow.app)
- **GitHub Issues:** [github.com/yourusername/enviroflow/issues](https://github.com/yourusername/enviroflow/issues)
