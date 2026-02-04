import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { peekRateLimit } from "@/lib/rate-limit";

const WORKFLOW_RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: "workflow-cmd",
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Peek at rate limit status without consuming a token
    const result = peekRateLimit(user.id, WORKFLOW_RATE_LIMIT);

    return NextResponse.json({
      used: result.limit - result.remaining,
      limit: result.limit,
      resetAt: result.reset,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check rate limit" },
      { status: 500 }
    );
  }
}
