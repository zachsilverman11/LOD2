import { NextRequest, NextResponse } from "next/server";
import { runSystemMonitor } from "@/lib/system-monitor";

/**
 * System Monitor Cron Job
 * Runs every 30 minutes to detect issues and create dev cards
 */
export async function GET(request: NextRequest) {
  // Vercel cron jobs are automatically secured by Vercel's infrastructure
  // No additional auth needed - only Vercel can trigger these endpoints
  console.log("🤖 Holly: System monitor cron job triggered");

  try {
    const result = await runSystemMonitor();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("Error in system monitor cron:", error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
