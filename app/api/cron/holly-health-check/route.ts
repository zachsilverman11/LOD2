import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Holly Health Check Endpoint
 *
 * This endpoint can be pinged by external cron services (like cron-job.org, UptimeRobot, etc.)
 * to ensure Holly keeps running even if Vercel's cron system fails.
 *
 * It checks:
 * 1. How long since Holly last ran
 * 2. If >20 minutes, triggers Holly manually
 * 3. Returns health status
 *
 * External service setup:
 * - URL: https://lod2.vercel.app/api/cron/holly-health-check
 * - Frequency: Every 15 minutes
 * - Method: GET
 * - Header: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check when Holly last ran by looking at recent SMS activity
    const lastSMS = await prisma.communication.findFirst({
      where: {
        direction: "OUTBOUND",
        channel: "SMS",
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        leadId: true,
      }
    });

    const now = Date.now();
    const lastActivity = lastSMS ? lastSMS.createdAt.getTime() : 0;
    const minutesSinceActivity = Math.floor((now - lastActivity) / (60 * 1000));

    // Check overdue leads
    const overdueLeads = await prisma.lead.count({
      where: {
        managedByAutonomous: true,
        nextReviewAt: { lt: new Date() },
        status: {
          notIn: ["CONVERTED", "DEALS_WON", "LOST", "APPLICATION_STARTED"]
        }
      }
    });

    const isHealthy = minutesSinceActivity < 120 || overdueLeads === 0; // Unhealthy if >2h with no activity AND overdue leads exist

    if (!isHealthy) {
      console.log(`[Holly Health Check] ⚠️  UNHEALTHY: ${minutesSinceActivity} minutes since last activity, ${overdueLeads} overdue leads`);

      // Trigger Holly manually by calling the cron endpoint
      try {
        const cronUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://lod2.vercel.app'}/api/cron/autonomous-holly`;
        console.log(`[Holly Health Check] 🔧 Triggering Holly manually: ${cronUrl}`);

        const response = await fetch(cronUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${process.env.CRON_SECRET}`
          },
          signal: AbortSignal.timeout(290000) // 4min 50sec timeout (leave 10sec buffer)
        });

        if (response.ok) {
          const result = await response.json();
          return NextResponse.json({
            status: "recovered",
            message: "Holly was inactive - manually triggered and recovered",
            minutesSinceActivity,
            overdueLeads,
            hollyResult: result,
          });
        } else {
          const error = await response.text();
          throw new Error(`Holly trigger failed: ${response.status} - ${error}`);
        }
      } catch (error) {
        console.error(`[Holly Health Check] ❌ Failed to trigger Holly:`, error);
        return NextResponse.json({
          status: "unhealthy",
          message: "Holly is inactive and manual trigger failed",
          minutesSinceActivity,
          overdueLeads,
          error: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      status: "healthy",
      message: "Holly is running normally",
      minutesSinceActivity,
      overdueLeads,
      lastActivity: lastSMS ? {
        time: lastSMS.createdAt.toISOString(),
        leadId: lastSMS.leadId,
      } : null,
    });

  } catch (error) {
    console.error("[Holly Health Check] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';
