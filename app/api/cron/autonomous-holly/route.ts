import { NextRequest, NextResponse } from "next/server";
import { runHollyAgentLoop } from "@/lib/autonomous-agent";

/**
 * Autonomous Holly Agent Cron
 *
 * Runs the intelligent agent loop that reviews leads and makes autonomous decisions
 * Using Claude Sonnet 4.5 with 5-layer training:
 * 1. Lead Journey Context
 * 2. Behavioral Intelligence
 * 3. Sales Psychology
 * 4. Training Examples
 * 5. Extended Thinking
 *
 * This cron handles SCHEDULED follow-ups (leads where nextReviewAt <= now)
 * Instant responses (SMS replies, new leads) are handled by webhooks calling the agent directly
 *
 * Vercel cron config (vercel.json):
 * Runs every 15 minutes to review leads due for follow-up
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[Autonomous Holly Cron] Starting agent loop...");

    await runHollyAgentLoop();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: "Autonomous Holly agent loop completed",
    });
  } catch (error) {
    console.error("[Autonomous Holly Cron] Error running agent loop:", error);
    return NextResponse.json(
      {
        error: "Failed to run autonomous Holly agent loop",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
