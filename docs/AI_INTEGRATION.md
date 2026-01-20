# EnviroFlow AI Analysis Integration

## Overview
Server-side AI analysis using Vercel AI SDK + Grok API for environmental data insights.

## Architecture

### Data Flow
```
Supabase Sensor Logs → API Route (/api/analyze) → Grok AI Analysis → 
Insights Storage (Supabase) → Realtime Push → Dashboard
```

### Components

#### 1. API Route: `/api/analyze`
- **Location**: `apps/web/src/app/api/analyze/route.ts`
- **Purpose**: Server-side AI analysis endpoint
- **Features**:
  - Fetches sensor data from Supabase
  - Sends data + query to Grok API
  - Stores insights in database
  - Broadcasts via Realtime

#### 2. Database Tables
- **ai_insights**: Stores analysis results
- **sensor_logs**: Environmental sensor data
- **automation_actions**: Robotics control commands

#### 3. Client Hook: `useAIInsights()`
- **Location**: `apps/web/src/lib/ai-insights.ts`
- **Purpose**: React hook for real-time insights
- **Features**:
  - Subscribe to new insights
  - Automatic UI updates
  - Trigger new analysis

## Usage

### Trigger Analysis
```typescript
import { triggerAnalysis } from '@/lib/ai-insights';

const result = await triggerAnalysis(
  "Analyze VPD for ag yield optimization",
  "vpd",
  { start: "2026-01-19", end: "2026-01-20" }
);
```

### Subscribe to Insights
```tsx
import { useAIInsights } from '@/lib/ai-insights';

function Dashboard() {
  const { insights, loading } = useAIInsights();
  
  return (
    <div>
      {insights.map(insight => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
}
```

### API Request
```bash
curl -X POST https://enviroflow.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Analyze VPD for ag yield",
    "dataType": "vpd",
    "timeRange": { "start": "2026-01-19", "end": "2026-01-20" }
  }'
```

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://vhlnnfmuhttjpwyobklu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Grok API (x.ai)
GROK_API_KEY=xai-your_key
GROK_API_ENDPOINT=https://api.x.ai/v1/chat/completions
```

## Future Enhancements

### 1. Tool Calls for DB Queries
```typescript
// Grok can call tools to query specific data
const tools = [
  {
    name: 'query_sensor_data',
    description: 'Query sensor data from database',
    parameters: { timeRange, sensorType }
  }
];
```

### 2. Robotics APIs for Automated Control
```typescript
// AI triggers automation actions
await supabase.from('automation_actions').insert({
  action_type: 'adjust_air_injection',
  target_device: 'hvac-zone-1',
  parameters: { co2_ppm: 1200, duration_minutes: 30 }
});
```

### 3. Continuous Monitoring
- Background jobs analyzing data
- Automated alerts for anomalies
- Predictive maintenance recommendations

## Database Schema

### ai_insights
- `id`: UUID
- `query`: TEXT
- `data_type`: TEXT
- `analysis`: TEXT
- `confidence`: INTEGER (0-100)
- `recommendations`: JSONB
- `created_at`: TIMESTAMPTZ

### sensor_logs
- `id`: UUID
- `sensor_id`: TEXT
- `data_type`: TEXT (vpd, temperature, humidity, co2, etc.)
- `value`: NUMERIC
- `unit`: TEXT
- `timestamp`: TIMESTAMPTZ

### automation_actions
- `id`: UUID
- `action_type`: TEXT
- `target_device`: TEXT
- `parameters`: JSONB
- `status`: TEXT (pending, processing, completed, failed)
- `triggered_by`: UUID (references ai_insights)
- `executed_at`: TIMESTAMPTZ

## Deployment

1. **Run migrations**:
   ```bash
   cd apps/automation-engine
   supabase db push
   ```

2. **Set environment variables** in Vercel dashboard

3. **Deploy**:
   ```bash
   git push origin main
   ```

## Testing

```bash
# Health check
curl https://enviroflow.app/api/analyze

# Test analysis
curl -X POST https://enviroflow.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "Test analysis", "dataType": "test"}'
```
