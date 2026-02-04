import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify workflow exists and belongs to user
    const { data: workflow, error: fetchError } = await supabase
      .from("workflows")
      .select("id, execution_state, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    if (workflow.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate execution_state is an object with expected shape before accessing properties
    const state = workflow.execution_state;
    if (!state || typeof state !== "object" || !("paused_at_node" in state)) {
      return NextResponse.json({ error: "No active delay to cancel" }, { status: 400 });
    }

    // Clear execution state
    const { error: updateError } = await supabase
      .from("workflows")
      .update({ execution_state: null })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to cancel delay" }, { status: 500 });
    }

    // Log the cancellation (best-effort, ignore errors)
    try {
      // Use correct activity_logs schema columns: action_type (NOT event_type), result
      const execState = state as Record<string, unknown>;
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        workflow_id: id,
        action_type: "delay_cancelled",
        result: "success",
        details: {
          cancelled_node: execState.paused_at_node,
          was_resume_after: execState.resume_after,
        },
      });
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling delay:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
