import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/analyze
 * Analyzes environmental data using Grok API and returns insights
 * 
 * Body:
 * - query: string - Analysis query (e.g., "Analyze VPD for ag yield")
 * - dataType: string - Type of data to analyze (vpd, temperature, humidity, etc.)
 * - timeRange?: object - Optional time range for data filtering
 */
export async function POST(request: NextRequest) {
  try {
    const { query, dataType, timeRange } = await request.json();

    if (!query || !dataType) {
      return NextResponse.json(
        { error: 'Missing required fields: query, dataType' },
        { status: 400 }
      );
    }

    // Step 1: Fetch relevant data from Supabase
    const sensorData = await fetchSensorData(dataType, timeRange);

    // Step 2: Prepare prompt for Grok API
    const prompt = buildAnalysisPrompt(query, sensorData);

    // Step 3: Call Grok API for analysis
    const analysis = await callGrokAPI(prompt);

    // Step 4: Store insights in Supabase
    const { data: insight, error: insertError } = await supabase
      .from('ai_insights')
      .insert({
        query,
        data_type: dataType,
        analysis: analysis.response,
        confidence: analysis.confidence,
        recommendations: analysis.recommendations,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing insight:', insertError);
    }

    // Step 5: Push insights via Realtime (broadcast to subscribed clients)
    if (insight) {
      await supabase
        .channel('ai-insights')
        .send({
          type: 'broadcast',
          event: 'new-insight',
          payload: insight,
        });
    }

    return NextResponse.json({
      success: true,
      insight,
      analysis: analysis.response,
      recommendations: analysis.recommendations,
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Fetch sensor data from Supabase based on data type and time range
 */
async function fetchSensorData(dataType: string, timeRange?: { start: string; end: string }) {
  let query = supabase
    .from('sensor_logs')
    .select('*')
    .eq('data_type', dataType)
    .order('timestamp', { ascending: false })
    .limit(100);

  if (timeRange) {
    query = query
      .gte('timestamp', timeRange.start)
      .lte('timestamp', timeRange.end);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching sensor data:', error);
    throw new Error('Failed to fetch sensor data');
  }

  return data || [];
}

/**
 * Build analysis prompt for Grok API
 */
function buildAnalysisPrompt(query: string, sensorData: any[]) {
  const dataContext = sensorData.length > 0
    ? `Recent sensor data:\n${JSON.stringify(sensorData.slice(0, 10), null, 2)}`
    : 'No recent sensor data available.';

  return `
You are an expert environmental monitoring analyst specializing in agricultural and facility management.

User Query: ${query}

${dataContext}

Please analyze the data and provide:
1. Key findings and patterns
2. Potential issues or concerns
3. Actionable recommendations
4. Confidence level (0-100)

Respond in JSON format with: { "response": "...", "confidence": 85, "recommendations": ["...", "..."] }
`;
}

/**
 * Call Grok API for AI analysis
 * TODO: Replace with actual Grok API integration
 */
async function callGrokAPI(prompt: string) {
  // Placeholder for Grok API integration
  // For now, using OpenAI-compatible endpoint structure
  
  const GROK_API_KEY = process.env.GROK_API_KEY;
  const GROK_API_ENDPOINT = process.env.GROK_API_ENDPOINT || 'https://api.x.ai/v1/chat/completions';

  if (!GROK_API_KEY) {
    // Fallback to mock response for development
    console.warn('GROK_API_KEY not set, using mock response');
    return {
      response: 'Mock analysis: Data looks nominal. Consider monitoring trends over next 24 hours.',
      confidence: 75,
      recommendations: [
        'Continue monitoring VPD levels',
        'Check sensor calibration weekly',
        'Review historical patterns for seasonal variations'
      ]
    };
  }

  try {
    const response = await fetch(GROK_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          { role: 'system', content: 'You are an expert environmental analyst.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response from Grok
    const parsed = JSON.parse(content);
    return {
      response: parsed.response,
      confidence: parsed.confidence,
      recommendations: parsed.recommendations,
    };

  } catch (error) {
    console.error('Grok API call failed:', error);
    throw error;
  }
}

/**
 * GET /api/analyze
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    service: 'EnviroFlow AI Analysis',
    features: {
      grok_integration: !!process.env.GROK_API_KEY,
      supabase_realtime: true,
      tool_calls: 'planned',
      robotics_apis: 'planned',
    }
  });
}
