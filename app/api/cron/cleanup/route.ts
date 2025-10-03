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
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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
