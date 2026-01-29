import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { pollController } from '@/lib/poll-sensors';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { id } = params;

  try {
    // 1. Get controller details
    const { data: controller, error } = await supabase
      .from('controllers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !controller) {
      return NextResponse.json(
        { success: false, error: 'Controller not found' },
        { status: 404 }
      );
    }

    // 2. Poll the controller immediately
    // pollController handles connecting, reading, and saving to DB
    const result = await pollController(supabase, controller);

    if (result.status === 'success' || result.status === 'degraded') {
       return NextResponse.json({ success: true, result });
    } else {
       return NextResponse.json({ success: false, error: result.error || 'Sync failed' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
