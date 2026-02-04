import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(
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

    const { data: workflow, error } = await supabase
      .from("workflows")
      .select("id, execution_state")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    return NextResponse.json({
      hasActiveDelay: !!workflow.execution_state,
      executionState: workflow.execution_state,
    });
  } catch (error) {
    console.error("Error fetching execution state:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
