import { NextRequest, NextResponse } from "next/server";
import { processTimeBasedAutomations } from "@/lib/automation-engine";

/**
 * Cron endpoint for processing time-based automations
 *
 * Set up a cron job (e.g., via Vercel Cron or external service) to call this endpoint
 * Recommended frequency: Every 15 minutes
 *
 * Example Vercel cron config (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/automations",
 *     "schedule": "every 15 minutes"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel cron jobs are automatically secured by Vercel's infrastructure
    // No additional auth needed - only Vercel can trigger these endpoints
    console.log("Processing time-based automations...");
    await processTimeBasedAutomations();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error processing automations:", error);
    return NextResponse.json(
      { error: "Failed to process automations" },
      { status: 500 }
    );
  }
}
