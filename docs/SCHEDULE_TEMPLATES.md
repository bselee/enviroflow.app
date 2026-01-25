# Schedule Templates & AI Recommendations

Implementation of TASK-025 (Schedule Templates) and TASK-026 (Smart Recommendations)

## Overview

This feature provides users with:
1. **Pre-configured schedule templates** for common automation scenarios
2. **AI-powered schedule recommendations** based on environmental data and growth stages

## Features Implemented

### TASK-025: Schedule Templates (Presets)

**Template Gallery**
- 8 built-in templates covering lighting, climate, and irrigation
- Featured templates highlighting
- Category-based organization (lighting, climate, irrigation, general)
- Search functionality by name, description, and tags
- Difficulty levels (beginner, intermediate, advanced)
- Required devices listing

**Template Categories:**
- **Lighting**: Day/Night cycles, sunrise/sunset simulation, natural light following
- **Climate**: Fan coordination with light schedules
- **Irrigation**: Automated watering schedules
- **General**: Custom scenarios like weekend-only operation, cloning environments

**Built-in Templates:**
1. Day/Night Mode (18/6) - Standard vegetative cycle
2. Day/Night Mode (12/12) - Flowering cycle
3. Sunrise Ramp-Up - Gradual morning light increase
4. Evening Wind-Down - Gradual evening light decrease
5. Plant Cloning Environment - 24-hour light with high humidity
6. Weekend Only Operation - Weekend-specific schedules
7. Natural Sunrise/Sunset - Location-based daylight following
8. Daily Irrigation - Morning and evening watering cycles

**User Capabilities:**
- Browse template gallery
- Filter by category
- Search templates
- View template details
- One-click application to room/controller
- Customize schedules after selection
- Save custom schedules as templates (future enhancement)
- Share templates (future enhancement)

### TASK-026: Smart Recommendations for Schedules

**AI Analysis**
- Integration with existing GROK API (xAI)
- Analysis of 7-day sensor history
- Growth stage awareness
- Target condition optimization
- Confidence scoring (0-100%)

**Recommendation Components:**
- Detailed recommendation text
- Scientific rationale explaining the "why"
- Confidence score based on data quality
- 2-5 suggested device schedules
- Context display (sensor averages, growth stage)

**User Actions:**
- Generate recommendation
- View rationale and confidence
- Accept and apply schedules
- Ignore recommendation
- Regenerate with updated data

## Architecture

### Database Schema

Uses existing `device_schedules` table from migration `20260124_add_device_schedules.sql`:

```sql
CREATE TABLE device_schedules (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  controller_id UUID REFERENCES controllers(id),
  room_id UUID REFERENCES rooms(id),
  name TEXT NOT NULL,
  description TEXT,
  device_port INTEGER NOT NULL,
  trigger_type TEXT CHECK (trigger_type IN ('time', 'sunrise', 'sunset', 'cron')),
  schedule JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_executed TIMESTAMPTZ,
  next_execution TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### File Structure

```
apps/web/src/
├── types/
│   └── schedules.ts                    # Schedule-specific types
├── lib/
│   └── schedule-templates.ts           # Built-in template definitions
├── components/
│   └── schedules/
│       ├── index.ts                    # Export barrel
│       ├── ScheduleTemplates.tsx       # Main dialog component
│       ├── TemplateGallery.tsx         # Template browser
│       └── ScheduleRecommendation.tsx  # AI recommendation UI
├── hooks/
│   └── use-device-schedules.ts         # CRUD operations hook
├── app/
│   ├── api/
│   │   ├── templates/
│   │   │   └── route.ts                # Template API endpoint
│   │   └── schedules/
│   │       └── recommend/
│   │           └── route.ts            # AI recommendation endpoint
│   └── demo-schedules/
│       └── page.tsx                    # Demo/testing page
```

### API Endpoints

#### GET /api/templates

Fetch schedule templates with optional filtering.

**Query Parameters:**
- `featured=true` - Only featured templates
- `category=lighting` - Filter by category
- `search=sunrise` - Search by name/description/tags
- `id=template-id` - Get specific template

**Response:**
```json
{
  "templates": [...],
  "count": 8,
  "categories": [
    { "category": "lighting", "count": 5 },
    { "category": "climate", "count": 1 },
    { "category": "irrigation", "count": 1 },
    { "category": "general", "count": 2 }
  ]
}
```

#### POST /api/schedules/recommend

Generate AI-powered schedule recommendations.

**Request Body:**
```json
{
  "roomId": "uuid",
  "controllerId": "uuid",
  "growthStage": "vegetative",
  "targetConditions": {
    "temperature_min": 20,
    "temperature_max": 26,
    "humidity_min": 50,
    "humidity_max": 70,
    "vpd_min": 0.8,
    "vpd_max": 1.2
  }
}
```

**Response:**
```json
{
  "success": true,
  "recommendation": "Based on your current VPD...",
  "rationale": "Standard 18/6 light cycle...",
  "confidence": 85,
  "suggestedSchedules": [
    {
      "device_type": "light",
      "name": "Lights ON",
      "trigger_type": "time",
      "schedule": {
        "days": [0,1,2,3,4,5,6],
        "start_time": "06:00",
        "action": "on",
        "level": 100
      }
    }
  ],
  "basedOn": {
    "sensorHistory": {
      "temperature": { "avg": 22.5, "unit": "°C" },
      "humidity": { "avg": 60, "unit": "%" }
    },
    "growthStage": "vegetative"
  }
}
```

## Components

### ScheduleTemplates

Main dialog component combining template gallery and AI recommendations.

**Props:**
```typescript
interface ScheduleTemplatesProps {
  roomId: string;
  controllerId?: string;
  growthStage?: string;
  targetConditions?: {...};
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyTemplate: (template: ScheduleTemplate) => void;
  onApplyRecommendation: (recommendation: ScheduleRecommendation) => void;
}
```

**Usage:**
```tsx
const [open, setOpen] = useState(false);

<ScheduleTemplates
  roomId={roomId}
  controllerId={controllerId}
  growthStage="vegetative"
  targetConditions={room.settings}
  open={open}
  onOpenChange={setOpen}
  onApplyTemplate={handleApplyTemplate}
  onApplyRecommendation={handleApplyRecommendation}
/>
```

### TemplateGallery

Browse and select from pre-configured templates.

**Features:**
- Category tabs
- Search input
- Template cards with metadata
- One-click selection

### ScheduleRecommendation

AI-powered recommendation interface.

**Features:**
- Generate recommendation button
- Loading state with spinner
- Confidence badge with color coding
- Detailed rationale display
- Suggested schedules preview
- Accept/Ignore/Regenerate actions

## Hooks

### useDeviceSchedules

CRUD operations for device schedules.

**Usage:**
```tsx
const {
  schedules,
  loading,
  error,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  toggleActive,
  getScheduleById,
  getSchedulesByController,
  activeCount,
} = useDeviceSchedules({ roomId, controllerId });
```

**Operations:**
- `createSchedule(input)` - Create new schedule
- `updateSchedule(id, input)` - Update existing schedule
- `deleteSchedule(id)` - Delete schedule
- `toggleActive(id, isActive)` - Enable/disable schedule
- Real-time updates via Supabase subscriptions

## AI Integration

### GROK API Integration

The recommendation system uses the existing xAI/GROK integration from `/api/analyze`.

**System Prompt:**
```
You are an expert environmental automation consultant specializing in
controlled environment agriculture (CEA).

Your expertise includes:
- Optimal lighting schedules for different growth stages
- Temperature and humidity management through automated devices
- VPD optimization
- Energy-efficient scheduling strategies
- Device coordination for holistic environmental control
```

**Data Provided to AI:**
- Room configuration
- 7-day sensor history averages
- Growth stage
- Target environmental conditions

**AI Output:**
- Recommendation text
- Rationale explaining the science
- Confidence score (0-100)
- 2-5 specific device schedules

### Mock Mode

For development without API key:
- Set `XAI_API_KEY` or `GROK_API_KEY` environment variable
- Without key: Returns mock recommendations in development
- Mock includes basic day/night schedule suggestions

## Demo Page

Visit `/demo-schedules` to test the implementation.

**Features:**
- Overview statistics
- Template gallery trigger
- Current schedules list
- Toggle/delete schedule actions
- API endpoint documentation
- Feature checklist

## Future Enhancements

### Community Templates
- User-submitted templates
- Rating and review system
- Template marketplace
- Version control for templates

### Advanced Features
- Schedule conflict detection
- Multi-room schedule coordination
- Schedule versioning and rollback
- A/B testing of schedules
- Schedule effectiveness analytics

### Template Creation
- Save current schedules as template
- Template customization wizard
- Share link generation
- Import/export templates

### AI Improvements
- Historical effectiveness learning
- Seasonal adjustments
- Weather integration
- Energy cost optimization

## Testing

### Manual Testing Checklist

**Template Gallery:**
- [ ] Browse all templates
- [ ] Filter by category
- [ ] Search functionality
- [ ] Select and apply template
- [ ] View template details

**AI Recommendations:**
- [ ] Generate recommendation
- [ ] View confidence score
- [ ] Read rationale
- [ ] Accept recommendation
- [ ] Ignore recommendation
- [ ] Regenerate recommendation

**Schedule Management:**
- [ ] Create schedule from template
- [ ] View schedule list
- [ ] Toggle schedule active/inactive
- [ ] Delete schedule
- [ ] Real-time updates

### API Testing

```bash
# Get all templates
curl http://localhost:3000/api/templates

# Get featured templates
curl http://localhost:3000/api/templates?featured=true

# Get templates by category
curl http://localhost:3000/api/templates?category=lighting

# Generate recommendation
curl -X POST http://localhost:3000/api/schedules/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "uuid",
    "growthStage": "vegetative",
    "targetConditions": {
      "temperature_min": 20,
      "temperature_max": 26
    }
  }'
```

## Performance Considerations

### Template Loading
- Templates are static and loaded from memory
- No database queries for template browsing
- Fast initial load time

### AI Recommendations
- Async generation with loading state
- 7-day sensor window limits data size
- Caching opportunity for repeated requests
- Timeout handling for slow AI responses

### Real-time Updates
- Supabase Realtime for schedule changes
- Efficient subscriptions scoped to user
- Optimistic UI updates for better UX

## Security

### Authentication
- All API routes require user authentication
- RLS policies on device_schedules table
- Service role for AI recommendations

### Data Validation
- Zod schemas for request validation
- Input sanitization
- Safe JSON parsing for AI responses

### Rate Limiting
- Consider rate limiting for AI recommendations
- Monitor API usage costs
- Implement request throttling if needed

## Accessibility

### Keyboard Navigation
- Full keyboard support in dialogs
- Tab navigation through templates
- Enter key to select templates

### Screen Readers
- Semantic HTML structure
- ARIA labels on interactive elements
- Status announcements for actions

### Visual Design
- Color-coded confidence scores
- Clear hierarchy and spacing
- Responsive layout for mobile

## Documentation

See also:
- [Database Schema](/apps/automation-engine/supabase/migrations/20260124_add_device_schedules.sql)
- [API Integration](/apps/web/src/app/api/analyze/route.ts)
- [Component Library](/apps/web/src/components/ui/)

## Support

For issues or questions:
1. Check demo page at `/demo-schedules`
2. Review API endpoint health checks
3. Check browser console for errors
4. Verify API key configuration for AI features
