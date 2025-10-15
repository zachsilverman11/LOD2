import { NextRequest, NextResponse } from "next/server";
import { cleanupOldData } from "@/lib/compliance";

/**
 * Cron endpoint for cleaning up old data (PIPEDA compliance)
 *
 * Recommended frequency: Daily
 *
 * Example Vercel cron config (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel cron jobs are automatically secured by Vercel's infrastructure
    // No additional auth needed - only Vercel can trigger these endpoints
    console.log("Running data cleanup...");
    const result = await cleanupOldData();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error during cleanup:", error);
    return NextResponse.json(
      { error: "Failed to cleanup data" },
      { status: 500 }
    );
  }
}
