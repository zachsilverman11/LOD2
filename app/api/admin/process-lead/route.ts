/**
 * Admin API: Manually Process Lead
 * Triggers autonomous agent for a specific lead (for retry/manual processing)
 */

import { NextRequest, NextResponse } from "next/server";
import { processLeadWithAutonomousAgent } from "@/lib/autonomous-agent";

export async function POST(request: NextRequest) {
  try {
    const { leadId } = await request.json();

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 }
      );
    }

    console.log(`[Admin API] Manually processing lead: ${leadId}`);

    // Process lead through autonomous agent
    const result = await processLeadWithAutonomousAgent(leadId);

    return NextResponse.json({
      success: true,
      leadId,
      result,
    });
  } catch (error) {
    console.error("[Admin API] Error processing lead:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
