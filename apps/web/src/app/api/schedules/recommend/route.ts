import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';
import { z } from 'zod';

// =============================================================================
// Configuration
// =============================================================================

const AI_MODEL = 'grok-4';
const ENABLE_DEV_MOCK = process.env.NODE_ENV === 'development';

// =============================================================================
// Request/Response Schemas
// =============================================================================

const RecommendRequestSchema = z.object({
  roomId: z.string().uuid(),
  controllerId: z.string().uuid().optional(),
  growthStage: z.string().optional(),
  targetConditions: z.object({
    temperature_min: z.number().optional(),
    temperature_max: z.number().optional(),
    humidity_min: z.number().optional(),
    humidity_max: z.number().optional(),
    vpd_min: z.number().optional(),
    vpd_max: z.number().optional(),
  }).optional(),
});

const AIScheduleRecommendationSchema = z.object({
  recommendation: z.string(),
  rationale: z.string(),
  confidence: z.number().min(0).max(100),
  suggestedSchedules: z.array(z.object({
    device_type: z.string(),
    name: z.string(),
    trigger_type: z.enum(['time', 'sunrise', 'sunset', 'cron']),
    schedule: z.object({
      days: z.array(z.number()).optional(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      action: z.enum(['on', 'off', 'set_level']),
      level: z.number().min(0).max(100).optional(),
    }),
    description: z.string().optional(),
  })),
});

type RecommendRequest = z.infer<typeof RecommendRequestSchema>;
type AIScheduleRecommendation = z.infer<typeof AIScheduleRecommendationSchema>;

// =============================================================================
// Supabase Client
// =============================================================================

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(url, serviceKey);
}

// =============================================================================
// Data Fetching
// =============================================================================

async function fetchRoomData(roomId: string) {
  const supabase = getSupabaseClient();

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (roomError) {
    console.error('[Recommend API] Error fetching room:', roomError.message);
    return null;
  }

  return room;
}

async function fetchSensorHistory(roomId: string, controllerId?: string) {
  const supabase = getSupabaseClient();

  // Get controllers in the room
  let controllerQuery = supabase
    .from('controllers')
    .select('id')
    .eq('room_id', roomId);

  if (controllerId) {
    controllerQuery = controllerQuery.eq('id', controllerId);
  }

  const { data: controllers, error: controllerError } = await controllerQuery;

  if (controllerError || !controllers || controllers.length === 0) {
    return null;
  }

  const controllerIds = controllers.map((c) => c.id);

  // Fetch sensor readings from the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: readings, error: readingsError } = await supabase
    .from('sensor_readings')
    .select('sensor_type, value, unit, recorded_at')
    .in('controller_id', controllerIds)
    .gte('recorded_at', sevenDaysAgo.toISOString())
    .order('recorded_at', { ascending: false })
    .limit(500);

  if (readingsError) {
    console.error('[Recommend API] Error fetching sensor history:', readingsError.message);
    return null;
  }

  // Calculate averages
  const aggregated: Record<string, { sum: number; count: number; unit: string }> = {};

  readings?.forEach((r) => {
    if (!aggregated[r.sensor_type]) {
      aggregated[r.sensor_type] = { sum: 0, count: 0, unit: r.unit };
    }
    aggregated[r.sensor_type].sum += r.value;
    aggregated[r.sensor_type].count += 1;
  });

  const averages: Record<string, { avg: number; unit: string }> = {};
  Object.entries(aggregated).forEach(([type, data]) => {
    averages[type] = {
      avg: Math.round((data.sum / data.count) * 100) / 100,
      unit: data.unit,
    };
  });

  return {
    averages,
    sampleCount: readings?.length || 0,
    timeRange: '7 days',
  };
}

// =============================================================================
// AI Recommendation
// =============================================================================

const SYSTEM_PROMPT = `You are an expert environmental automation consultant specializing in controlled environment agriculture (CEA).

Your expertise includes:
- Optimal lighting schedules for different growth stages
- Temperature and humidity management through automated devices
- VPD (Vapor Pressure Deficit) optimization
- Energy-efficient scheduling strategies
- Device coordination for holistic environmental control

IMPORTANT: You MUST respond with valid JSON in exactly this format:
{
  "recommendation": "Your detailed recommendation here...",
  "rationale": "Why this schedule configuration is optimal...",
  "confidence": 85,
  "suggestedSchedules": [
    {
      "device_type": "light",
      "name": "Morning Lights",
      "trigger_type": "time",
      "schedule": {
        "days": [0,1,2,3,4,5,6],
        "start_time": "06:00",
        "action": "on",
        "level": 100
      },
      "description": "Turn lights on at 6am daily"
    }
  ]
}

Guidelines:
1. Recommend 2-5 specific schedules based on the environmental data
2. Consider growth stage when making recommendations
3. Coordinate devices (e.g., increase fans when lights turn on)
4. Be specific about timings and levels
5. Explain the science behind your recommendations
6. Confidence should reflect data quality and applicability`;

function buildRecommendationPrompt(
  request: RecommendRequest,
  roomData: unknown,
  sensorHistory: unknown
): string {
  return `Please recommend optimal device schedules for this growing environment:

ROOM CONFIGURATION:
${JSON.stringify(roomData, null, 2)}

SENSOR HISTORY (7-day averages):
${JSON.stringify(sensorHistory, null, 2)}

GROWTH STAGE: ${request.growthStage || 'Not specified'}

TARGET CONDITIONS:
${JSON.stringify(request.targetConditions || {}, null, 2)}

Based on this data, please recommend:
1. Optimal lighting schedule
2. Fan/ventilation schedule
3. Any other device schedules that would improve environmental control
4. Explain why each schedule is recommended
5. Provide your confidence level (0-100)

Remember to respond in the required JSON format.`;
}

async function getScheduleRecommendation(
  request: RecommendRequest,
  roomData: unknown,
  sensorHistory: unknown
): Promise<AIScheduleRecommendation> {
  const prompt = buildRecommendationPrompt(request, roomData, sensorHistory);

  try {
    const result = await generateText({
      model: xai(AI_MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    const responseText = result.text;

    if (!responseText) {
      throw new Error('Empty response from AI model');
    }

    // Extract JSON from response
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText);
    const validated = AIScheduleRecommendationSchema.safeParse(parsed);

    if (!validated.success) {
      console.warn('[Recommend API] Validation failed:', validated.error.message);
      // Return a fallback response
      return {
        recommendation: typeof parsed?.recommendation === 'string'
          ? parsed.recommendation
          : 'Unable to generate detailed recommendation',
        rationale: typeof parsed?.rationale === 'string'
          ? parsed.rationale
          : 'Insufficient data for detailed analysis',
        confidence: typeof parsed?.confidence === 'number'
          ? Math.min(100, Math.max(0, parsed.confidence))
          : 50,
        suggestedSchedules: [],
      };
    }

    return validated.data;
  } catch (error) {
    console.error('[Recommend API] AI error:', error);
    throw new Error('Failed to generate schedule recommendation');
  }
}

function generateMockRecommendation(_request: RecommendRequest): AIScheduleRecommendation {
  console.warn('[Recommend API] Using mock recommendation (API key not configured)');

  return {
    recommendation: 'Based on typical growing environments, I recommend a balanced lighting and ventilation schedule. ' +
      'Consider implementing a day/night cycle with coordinated fan control. ' +
      'This is a development mock - configure XAI_API_KEY for real AI recommendations.',
    rationale: 'Standard 18/6 light cycle promotes healthy vegetative growth. Increased fan speed during ' +
      'light hours helps manage heat from lights and maintains optimal VPD. Lower fan speed at night ' +
      'reduces stress and maintains humidity.',
    confidence: 50,
    suggestedSchedules: [
      {
        device_type: 'light',
        name: 'Lights ON',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '06:00',
          action: 'on',
          level: 100,
        },
        description: 'Turn lights on at 6am daily',
      },
      {
        device_type: 'light',
        name: 'Lights OFF',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '00:00',
          action: 'off',
        },
        description: 'Turn lights off at midnight',
      },
      {
        device_type: 'fan',
        name: 'Fan HIGH - Day',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '06:00',
          action: 'set_level',
          level: 75,
        },
        description: 'Increase fan speed during light hours',
      },
      {
        device_type: 'fan',
        name: 'Fan LOW - Night',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '00:00',
          action: 'set_level',
          level: 25,
        },
        description: 'Lower fan speed at night',
      },
    ],
  };
}

// =============================================================================
// API Route Handler
// =============================================================================

/**
 * POST /api/schedules/recommend
 *
 * Get AI-powered schedule recommendations based on room conditions
 */
export async function POST(_request: NextRequest) {
  try {
    // Parse and validate request
    const body = await _request.json();
    const validation = RecommendRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const requestData = validation.data;

    // Fetch room data and sensor history
    const roomData = await fetchRoomData(requestData.roomId);
    const sensorHistory = await fetchSensorHistory(
      requestData.roomId,
      requestData.controllerId
    );

    if (!roomData) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Check API key configuration
    const hasApiKey = !!(process.env.XAI_API_KEY || process.env.GROK_API_KEY);

    let recommendation: AIScheduleRecommendation;

    if (!hasApiKey && ENABLE_DEV_MOCK) {
      recommendation = generateMockRecommendation(requestData);
    } else if (!hasApiKey) {
      return NextResponse.json(
        {
          error: 'AI service not configured',
          message: 'Please configure XAI_API_KEY environment variable',
        },
        { status: 503 }
      );
    } else {
      recommendation = await getScheduleRecommendation(
        requestData,
        roomData,
        sensorHistory
      );
    }

    return NextResponse.json({
      success: true,
      recommendation: recommendation.recommendation,
      rationale: recommendation.rationale,
      confidence: recommendation.confidence,
      suggestedSchedules: recommendation.suggestedSchedules,
      basedOn: {
        sensorHistory: sensorHistory?.averages,
        growthStage: requestData.growthStage,
        targetConditions: requestData.targetConditions,
      },
      _mock: !hasApiKey && ENABLE_DEV_MOCK,
    });
  } catch (error) {
    console.error('[Recommend API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate recommendation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/schedules/recommend
 * Health check
 */
export async function GET() {
  const hasApiKey = !!(process.env.XAI_API_KEY || process.env.GROK_API_KEY);

  return NextResponse.json({
    status: hasApiKey ? 'ready' : 'limited',
    service: 'EnviroFlow Schedule Recommendations',
    model: AI_MODEL,
    features: {
      ai_recommendations: hasApiKey,
      mock_mode: !hasApiKey && ENABLE_DEV_MOCK,
    },
  });
}
