import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { xai } from '@ai-sdk/xai';
import { z } from 'zod';

// =============================================================================
// Configuration
// =============================================================================

/** Model to use for AI analysis. grok-4 is the recommended production model. */
const AI_MODEL = 'grok-4';

/** Enable mock responses in development when API key is not configured */
const ENABLE_DEV_MOCK = process.env.NODE_ENV === 'development';

// =============================================================================
// Authentication
// =============================================================================

/**
 * Extract and validate user ID from Bearer token authentication.
 * Uses Supabase Auth to verify the token and extract the user.
 *
 * @param request - The incoming Next.js request
 * @param supabase - Supabase client instance
 * @returns User ID if authenticated, null otherwise
 */
async function getUserId(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<string | null> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.warn('[Analyze API] Auth token validation failed:', error?.message);
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('[Analyze API] Auth error:', error);
    return null;
  }
}

// =============================================================================
// Zod Schemas for Request/Response Validation
// =============================================================================

/**
 * Schema for validating the incoming analysis request body.
 */
const AnalyzeRequestSchema = z.object({
  query: z.string().min(1, 'Query is required').max(2000, 'Query too long'),
  dataType: z.string().min(1, 'Data type is required'),
  timeRange: z.object({
    start: z.string().datetime({ message: 'Invalid start date format' }),
    end: z.string().datetime({ message: 'Invalid end date format' }),
  }).optional(),
  roomId: z.string().uuid().optional(),
});

// Type extracted from schema for internal use
// type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

/**
 * Schema for validating the structured AI response.
 * The AI is prompted to return JSON matching this structure.
 */
const AIResponseSchema = z.object({
  response: z.string().min(1, 'Response text is required'),
  confidence: z.number().min(0).max(100),
  recommendations: z.array(z.string()).default([]),
});

type AIResponse = z.infer<typeof AIResponseSchema>;

/**
 * Schema for sensor data from the database.
 */
const SensorReadingSchema = z.object({
  id: z.string().uuid(),
  controller_id: z.string().uuid(),
  sensor_type: z.string(),
  value: z.number(),
  unit: z.string(),
  port: z.number().nullable(),
  recorded_at: z.string(),
});

type SensorReading = z.infer<typeof SensorReadingSchema>;

// =============================================================================
// Supabase Client
// =============================================================================

/**
 * Initialize Supabase client with service role key for server-side operations.
 * Uses service role to bypass RLS for inserting AI insights.
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(url, serviceKey);
}

// -----------------------------------------------------------------------------
// Rate Limiting
// -----------------------------------------------------------------------------

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute for analyze
const CLEANUP_PROBABILITY = 0.1;

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  // Probabilistic cleanup of expired entries
  if (Math.random() < CLEANUP_PROBABILITY) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  // New IP or expired window
  if (!record || record.resetAt < now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  // Check if rate limit exceeded
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment and allow
  record.count++;
  return { allowed: true };
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return 'unknown';
}

// =============================================================================
// Data Fetching
// =============================================================================

/**
 * Fetch sensor data from Supabase based on data type and time range.
 * Returns up to 100 most recent readings for the specified type.
 *
 * @param dataType - The type of sensor data to fetch (temperature, humidity, vpd, etc.)
 * @param timeRange - Optional time range filter
 * @returns Array of sensor readings
 */
async function fetchSensorData(
  dataType: string,
  timeRange?: { start: string; end: string }
): Promise<SensorReading[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('sensor_readings')
    .select('*')
    .eq('sensor_type', dataType)
    .order('recorded_at', { ascending: false })
    .limit(100);

  if (timeRange) {
    query = query
      .gte('recorded_at', timeRange.start)
      .lte('recorded_at', timeRange.end);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Analyze API] Error fetching sensor data:', error.message);
    // Return empty array rather than throwing - analysis can proceed with context
    return [];
  }

  // Validate and filter data through Zod (defensive programming)
  const validData: SensorReading[] = [];
  for (const reading of data || []) {
    const result = SensorReadingSchema.safeParse(reading);
    if (result.success) {
      validData.push(result.data);
    }
  }

  return validData;
}

// =============================================================================
// Prompt Building
// =============================================================================

/**
 * System prompt that establishes the AI's role and response format.
 * This prompt is designed to elicit structured, actionable responses.
 */
const SYSTEM_PROMPT = `You are an expert environmental monitoring analyst specializing in indoor agriculture, controlled environment agriculture (CEA), and facility management.

Your expertise includes:
- VPD (Vapor Pressure Deficit) optimization for different growth stages
- Temperature and humidity management
- CO2 supplementation strategies
- Lighting schedules and DLI (Daily Light Integral) calculations
- Plant stress indicators and preventive measures

IMPORTANT: You MUST respond with valid JSON in exactly this format:
{
  "response": "Your detailed analysis here...",
  "confidence": 85,
  "recommendations": ["Recommendation 1", "Recommendation 2", "..."]
}

Guidelines for your response:
1. The "response" field should contain your complete analysis in natural language
2. The "confidence" field should be a number from 0-100 reflecting your certainty
3. The "recommendations" array should contain 3-5 specific, actionable suggestions
4. Be specific about thresholds and values when discussing environmental parameters
5. Reference industry best practices and scientific research when applicable`;

/**
 * Build a user prompt that includes the query and any available sensor data.
 *
 * @param query - The user's analysis question
 * @param sensorData - Recent sensor readings for context
 * @returns Formatted prompt string
 */
function buildAnalysisPrompt(query: string, sensorData: SensorReading[]): string {
  const dataContext = sensorData.length > 0
    ? `Recent sensor data (${sensorData.length} readings):\n${JSON.stringify(
        sensorData.slice(0, 10).map(r => ({
          type: r.sensor_type,
          value: r.value,
          unit: r.unit,
          recorded_at: r.recorded_at,
        })),
        null,
        2
      )}`
    : 'No recent sensor data available for this query.';

  return `User Query: ${query}

${dataContext}

Please analyze the environmental conditions and provide:
1. Key findings and patterns in the data
2. Any potential issues or concerns identified
3. Actionable recommendations for optimization
4. Your confidence level in this analysis (0-100)

Remember to respond in the required JSON format.`;
}

// =============================================================================
// AI Integration
// =============================================================================

/**
 * Check if the xAI API key is configured.
 *
 * The @ai-sdk/xai provider reads from the XAI_API_KEY environment variable.
 * We also support GROK_API_KEY for backward compatibility, but XAI_API_KEY
 * is preferred as it follows Vercel's standard naming convention for xAI.
 *
 * @returns true if either XAI_API_KEY or GROK_API_KEY is set
 */
function isApiKeyConfigured(): boolean {
  return !!(process.env.XAI_API_KEY || process.env.GROK_API_KEY);
}

/**
 * Generate a mock response for development when API key is not configured.
 * This allows frontend development to proceed without API access.
 */
function generateMockResponse(query: string): AIResponse {
  console.warn('[Analyze API] Using mock response (API key not configured)');
  return {
    response: `Mock analysis for query: "${query.slice(0, 50)}..."\n\n` +
      'Based on typical environmental patterns, your conditions appear nominal. ' +
      'This is a development mock response - configure XAI_API_KEY (preferred) ' +
      'or GROK_API_KEY to enable real AI analysis.',
    confidence: 50,
    recommendations: [
      'Configure XAI_API_KEY for real analysis',
      'Monitor VPD levels regularly',
      'Check sensor calibration weekly',
      'Review historical data for seasonal patterns',
    ],
  };
}

/**
 * Call the xAI/Grok API using Vercel AI SDK's generateText function.
 * Handles API errors and parses the structured response.
 *
 * @param prompt - The user prompt to send to the AI
 * @returns Validated AI response object
 * @throws Error with appropriate status code for different failure modes
 */
async function callGrokAPI(prompt: string): Promise<AIResponse> {
  try {
    const result = await generateText({
      model: xai(AI_MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0.7,
      maxOutputTokens: 1500,
    });

    // Extract the text response
    const responseText = result.text;

    if (!responseText) {
      throw new Error('Empty response from AI model');
    }

    // Parse JSON from the response
    // The AI is prompted to return JSON, but we need to handle cases where
    // it includes markdown code blocks or extra text
    let jsonText = responseText;

    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    // Attempt to parse as JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // If JSON parsing fails, try to construct a valid response from the text
      console.warn('[Analyze API] Failed to parse JSON, constructing response from text');
      return {
        response: responseText,
        confidence: 70,
        recommendations: [
          'Review the analysis above for insights',
          'Consider providing more specific data for better recommendations',
        ],
      };
    }

    // Validate against our schema
    const validated = AIResponseSchema.safeParse(parsed);

    if (!validated.success) {
      console.warn('[Analyze API] Response validation failed:', validated.error.message);
      // Return a sanitized response if validation fails
      return {
        response: typeof (parsed as Record<string, unknown>)?.response === 'string'
          ? (parsed as Record<string, unknown>).response as string
          : responseText,
        confidence: typeof (parsed as Record<string, unknown>)?.confidence === 'number'
          ? Math.min(100, Math.max(0, (parsed as Record<string, unknown>).confidence as number))
          : 70,
        recommendations: Array.isArray((parsed as Record<string, unknown>)?.recommendations)
          ? ((parsed as Record<string, unknown>).recommendations as unknown[]).filter(
              (r): r is string => typeof r === 'string'
            )
          : [],
      };
    }

    return validated.data;
  } catch (error) {
    // Handle specific error types from the AI SDK
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Rate limiting
      if (message.includes('rate limit') || message.includes('429')) {
        const rateLimitError = new Error('Rate limit exceeded. Please try again later.');
        (rateLimitError as Error & { statusCode: number }).statusCode = 429;
        throw rateLimitError;
      }

      // Authentication errors
      if (message.includes('unauthorized') || message.includes('401') || message.includes('api key')) {
        const authError = new Error('AI service authentication failed');
        (authError as Error & { statusCode: number }).statusCode = 503;
        throw authError;
      }

      // Model not found or unavailable
      if (message.includes('model') || message.includes('404')) {
        const modelError = new Error('AI model unavailable');
        (modelError as Error & { statusCode: number }).statusCode = 503;
        throw modelError;
      }
    }

    // Generic error - don't expose internal details
    console.error('[Analyze API] Grok API error:', error);
    throw new Error('AI analysis failed. Please try again.');
  }
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Store the AI insight in the database.
 * Returns the inserted record or null if insert fails.
 *
 * @param userId - The user who requested the analysis
 * @param roomId - Optional room context
 * @param query - The original query
 * @param dataType - Type of data analyzed
 * @param analysis - The AI response
 * @param sensorData - Sensor data used for context
 */
async function storeInsight(
  userId: string,
  roomId: string | undefined,
  query: string,
  dataType: string,
  analysis: AIResponse,
  sensorData: SensorReading[]
): Promise<{ id: string } | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ai_insights')
    .insert({
      user_id: userId,
      room_id: roomId || null,
      query,
      insight_text: analysis.response,
      data_type: dataType,
      confidence: analysis.confidence / 100, // Convert to decimal (0-1 range)
      recommendations: analysis.recommendations,
      sensor_data: sensorData.slice(0, 20), // Store up to 20 readings for context
      model_used: AI_MODEL,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Analyze API] Error storing insight:', error.message);
    return null;
  }

  return data;
}

/**
 * Broadcast the new insight to subscribed clients via Supabase Realtime.
 */
async function broadcastInsight(insightId: string): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    await supabase
      .channel('ai-insights')
      .send({
        type: 'broadcast',
        event: 'new-insight',
        payload: { id: insightId },
      });
  } catch (error) {
    // Non-critical - log but don't fail the request
    console.warn('[Analyze API] Broadcast failed:', error);
  }
}

// =============================================================================
// API Route Handlers
// =============================================================================

/**
 * POST /api/analyze
 *
 * Analyzes environmental data using xAI/Grok and returns actionable insights.
 *
 * Request Body:
 * - query: string - The analysis question (required)
 * - dataType: string - Type of data to analyze: vpd, temperature, humidity, etc. (required)
 * - timeRange?: { start: string, end: string } - Optional ISO datetime range
 * - roomId?: string - Optional room UUID for context
 *
 * Response (200):
 * {
 *   success: true,
 *   insight: { id: string },
 *   analysis: string,
 *   confidence: number,
 *   recommendations: string[]
 * }
 *
 * Error Responses:
 * - 400: Invalid request (validation failed)
 * - 401: Unauthorized (missing or invalid Bearer token)
 * - 429: Rate limit exceeded
 * - 500: Internal server error
 * - 503: AI service unavailable (API key not configured or auth failed)
 *
 * Authentication:
 * - Requires Bearer token in Authorization header
 * - Token must be a valid Supabase Auth JWT
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit check - must be first
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(clientIp);

    if (!rateCheck.allowed) {
      console.warn(`[Analyze] Rate limit exceeded: ip=${clientIp}, retryAfter=${rateCheck.retryAfter}s`);
      return NextResponse.json(
        {
          error: 'Too many analysis requests. Please wait before trying again.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfter),
          },
        }
      );
    }

    // Initialize Supabase client for authentication
    const supabase = getSupabaseClient();

    // Authenticate the user via Bearer token
    // SECURITY: This is required - no placeholder/bypass allowed in production
    const userId = await getUserId(request, supabase);

    if (!userId) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Valid Authorization Bearer token required.',
        },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = AnalyzeRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { query, dataType, timeRange, roomId } = validation.data;

    // Check API key configuration
    if (!isApiKeyConfigured()) {
      if (ENABLE_DEV_MOCK) {
        // Return mock response for development
        const mockAnalysis = generateMockResponse(query);
        return NextResponse.json({
          success: true,
          insight: null,
          analysis: mockAnalysis.response,
          confidence: mockAnalysis.confidence,
          recommendations: mockAnalysis.recommendations,
          _mock: true,
        });
      }

      return NextResponse.json(
        {
          error: 'AI service not configured',
          message: 'Please configure the XAI_API_KEY environment variable (or GROK_API_KEY for backward compatibility).',
        },
        { status: 503 }
      );
    }

    // Fetch relevant sensor data for context
    // timeRange is validated by Zod - when present, start and end are both required
    const sensorData = await fetchSensorData(
      dataType,
      timeRange as { start: string; end: string } | undefined
    );

    // Build the prompt and call the AI
    const prompt = buildAnalysisPrompt(query, sensorData);
    const analysis = await callGrokAPI(prompt);

    // Store the insight in the database
    // userId is already authenticated and validated at the top of this handler
    const insight = await storeInsight(
      userId,
      roomId,
      query,
      dataType,
      analysis,
      sensorData
    );

    // Broadcast to realtime subscribers
    if (insight) {
      await broadcastInsight(insight.id);
    }

    // Return the response
    return NextResponse.json({
      success: true,
      insight,
      analysis: analysis.response,
      confidence: analysis.confidence,
      recommendations: analysis.recommendations,
    });

  } catch (error) {
    // Handle known error types with appropriate status codes
    if (error instanceof Error) {
      const statusCode = (error as Error & { statusCode?: number }).statusCode;

      if (statusCode === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded', message: 'Please wait before making another request.' },
          { status: 429 }
        );
      }

      if (statusCode === 503) {
        return NextResponse.json(
          { error: 'AI service unavailable', message: error.message },
          { status: 503 }
        );
      }
    }

    // Log internal errors but don't expose details to client
    console.error('[Analyze API] Unexpected error:', error);

    return NextResponse.json(
      { error: 'Analysis failed', message: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analyze
 *
 * Health check endpoint that returns service status and feature availability.
 */
export async function GET() {
  const apiKeyConfigured = isApiKeyConfigured();

  return NextResponse.json({
    status: apiKeyConfigured ? 'ready' : 'limited',
    service: 'EnviroFlow AI Analysis',
    model: AI_MODEL,
    features: {
      ai_analysis: apiKeyConfigured,
      mock_mode: !apiKeyConfigured && ENABLE_DEV_MOCK,
      supabase_realtime: true,
      structured_output: true,
    },
    // Don't expose which key is configured for security
    configuration: {
      api_key_configured: apiKeyConfigured,
    },
  });
}
