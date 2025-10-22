import { NextRequest, NextResponse } from "next/server";
import { runHollyAgentLoop } from "@/lib/autonomous-agent";

/**
 * Autonomous Holly Agent Cron
 *
 * Runs the intelligent agent loop that reviews leads and makes autonomous decisions
 * Using Claude Sonnet 4.5 with 6-layer training:
 * 1. Lead Journey Context
 * 2. Behavioral Intelligence
 * 3. Sales Psychology
 * 4. Training Examples
 * 5. Learned Examples (from outcomes)
 * 6. Extended Thinking
 *
 * This cron handles SCHEDULED follow-ups (leads where nextReviewAt <= now)
 * Instant responses (SMS replies, new leads) are handled by webhooks calling the agent directly
 *
 * Vercel cron config (vercel.json):
 * - Runs every 15 minutes to review leads due for follow-up
 * - maxDuration: 300s (requires Pro plan)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("[Autonomous Holly Cron] Starting agent loop...");

    const result = await runHollyAgentLoop();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`[Autonomous Holly Cron] ✅ Completed in ${duration}s`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      message: "Autonomous Holly agent loop completed",
      ...result,
    });
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.error(`[Autonomous Holly Cron] ❌ Error after ${duration}s:`, error);

    return NextResponse.json(
      {
        error: "Failed to run autonomous Holly agent loop",
        duration: `${duration}s`,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Vercel serverless function configuration
export const maxDuration = 300; // 5 minutes (requires Pro plan)
export const dynamic = 'force-dynamic';
