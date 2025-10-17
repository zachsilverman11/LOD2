import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Analytics Overview API
 * Returns key metrics: total leads, pipeline value, conversion rate, calls booked
 */
export async function GET() {
  try {
    // Get total leads by status
    const leadsByStatus = await prisma.lead.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    });

    // Calculate total pipeline value (sum of loan amounts for active leads)
    const activeLeads = await prisma.lead.findMany({
      where: {
        status: {
          notIn: ["LOST", "CONVERTED"],
        },
      },
      select: {
        rawData: true,
      },
    });

    let totalPipelineValue = 0;
    activeLeads.forEach((lead) => {
      const rawData = lead.rawData as any;
      const loanAmount = parseFloat(rawData?.loanAmount || rawData?.loan_amount || "0");
      if (!isNaN(loanAmount)) {
        totalPipelineValue += loanAmount;
      }
    });

    // Get total leads
    const totalLeads = leadsByStatus.reduce((sum, status) => sum + status._count.id, 0);

    // Get converted leads
    const convertedCount = leadsByStatus.find((s) => s.status === "CONVERTED")?._count.id || 0;

    // Calculate conversion rate
    const conversionRate = totalLeads > 0 ? (convertedCount / totalLeads) * 100 : 0;

    // FIXED: Get past appointments (exclude future and cancelled) for show-up rate
    const now = new Date();
    const pastAppointments = await prisma.appointment.findMany({
      where: {
        scheduledAt: { lt: now },
        status: { not: "cancelled" },
      },
    });

    // For each past appointment, check if there's a CallOutcome
    const pastAppointmentsWithOutcome = await Promise.all(
      pastAppointments.map(async (appt) => {
        const outcome = await prisma.callOutcome.findFirst({
          where: {
            leadId: appt.leadId,
            reached: true,
            createdAt: {
              // CallOutcome should be within 24 hours of appointment
              gte: new Date(appt.scheduledAt.getTime() - 24 * 60 * 60 * 1000),
              lte: new Date(appt.scheduledAt.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        });
        return outcome !== null;
      })
    );

    const callsScheduled = pastAppointments.length;
    const callsCompleted = pastAppointmentsWithOutcome.filter(Boolean).length;

    // Calculate show-up rate (past appointments with CallOutcome / past appointments)
    const showUpRate = callsScheduled > 0 ? (callsCompleted / callsScheduled) * 100 : 0;

    // Get total appointments
    const totalAppointments = await prisma.appointment.count();

    // Get response rate (leads who have replied)
    const leadsWithInbound = await prisma.lead.count({
      where: {
        communications: {
          some: {
            direction: "INBOUND",
          },
        },
      },
    });

    const responseRate = totalLeads > 0 ? (leadsWithInbound / totalLeads) * 100 : 0;

    // Get average time to first response (for leads who responded)
    const leadsWithResponse = await prisma.lead.findMany({
      where: {
        communications: {
          some: {
            direction: "INBOUND",
          },
        },
      },
      include: {
        communications: {
          orderBy: { createdAt: "asc" },
          take: 2,
        },
      },
    });

    let totalResponseTime = 0;
    let responseCount = 0;

    leadsWithResponse.forEach((lead) => {
      const firstOutbound = lead.communications.find((c) => c.direction === "OUTBOUND");
      const firstInbound = lead.communications.find((c) => c.direction === "INBOUND");

      if (firstOutbound && firstInbound) {
        const timeToResponse =
          firstInbound.createdAt.getTime() - firstOutbound.createdAt.getTime();
        totalResponseTime += timeToResponse;
        responseCount++;
      }
    });

    const avgTimeToResponse =
      responseCount > 0 ? totalResponseTime / responseCount / 1000 / 60 / 60 : 0; // Convert to hours

    // Get leads by status for breakdown
    const statusBreakdown = leadsByStatus.map((s) => ({
      status: s.status,
      count: s._count.id,
    }));

    // Get leads with call outcomes (advisor actually spoke with them)
    const leadsWithCallOutcomes = await prisma.lead.count({
      where: {
        callOutcomes: {
          some: {
            reached: true,
          },
        },
      },
    });

    // Get APPLICATION_STARTED count
    const appsStartedCount = await prisma.lead.count({
      where: {
        applicationStartedAt: {
          not: null,
        },
      },
    });

    // Get DEALS_WON count
    const dealsWonCount = leadsByStatus.find((s) => s.status === "DEALS_WON")?._count.id || 0;

    // Calculate Engaged to Book rate (of leads who replied, % who booked a call)
    const leadsWhoBooked = await prisma.lead.count({
      where: {
        AND: [
          {
            communications: {
              some: {
                direction: "INBOUND",
              },
            },
          },
          {
            appointments: {
              some: {},
            },
          },
        ],
      },
    });
    const engagedToBookRate = leadsWithInbound > 0 ? (leadsWhoBooked / leadsWithInbound) * 100 : 0;

    // Calculate key KPIs
    const leadToCallRate = totalLeads > 0 ? (callsScheduled / totalLeads) * 100 : 0;
    const leadToAppRate = totalLeads > 0 ? (appsStartedCount / totalLeads) * 100 : 0;

    // FIXED: Call to App uses leads with CallOutcome and APPLICATION_STARTED
    const callToAppRate = leadsWithCallOutcomes > 0 ? (appsStartedCount / leadsWithCallOutcomes) * 100 : 0;

    // NEW: App to Close rate (of apps started, % that converted)
    const appToCloseRate = appsStartedCount > 0 ? (convertedCount / appsStartedCount) * 100 : 0;

    // NEW: Lead to Won rate (of total leads, % that won deals)
    const leadToWonRate = totalLeads > 0 ? (dealsWonCount / totalLeads) * 100 : 0;

    // Calculate Active Pipeline Value (only active leads, not LOST/CONVERTED/DEALS_WON)
    const activePipelineValue = activeLeads.reduce((sum, lead) => {
      const rawData = lead.rawData as any;
      const loanAmount = parseFloat(rawData?.loanAmount || rawData?.loan_amount || "0");
      return sum + (isNaN(loanAmount) ? 0 : loanAmount);
    }, 0);

    // Calculate average days in current stage for active leads
    const leadsWithDaysInStage = await prisma.lead.findMany({
      where: {
        status: {
          notIn: ["LOST", "CONVERTED", "DEALS_WON"],
        },
      },
      include: {
        activities: {
          where: {
            type: "STATUS_CHANGE",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    let totalDaysInStage = 0;
    let leadsWithStageData = 0;

    leadsWithDaysInStage.forEach((lead) => {
      const lastStatusChange = lead.activities[0];
      const stageStartDate = lastStatusChange ? lastStatusChange.createdAt : lead.createdAt;
      const daysInStage = Math.floor((now.getTime() - stageStartDate.getTime()) / (1000 * 60 * 60 * 24));
      totalDaysInStage += daysInStage;
      leadsWithStageData++;
    });

    const avgDaysInStage = leadsWithStageData > 0 ? totalDaysInStage / leadsWithStageData : 0;

    // Calculate leads stuck (> 7 days in same stage)
    const leadsStuck = leadsWithDaysInStage.filter((lead) => {
      const lastStatusChange = lead.activities[0];
      const stageStartDate = lastStatusChange ? lastStatusChange.createdAt : lead.createdAt;
      const daysInStage = Math.floor((now.getTime() - stageStartDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysInStage > 7;
    }).length;

    return NextResponse.json({
      success: true,
      data: {
        totalLeads,
        totalPipelineValue, // Keep old calculation for backwards compatibility
        activePipelineValue: parseFloat(activePipelineValue.toFixed(2)), // NEW: Only active leads
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        callsScheduled,
        callsCompleted,
        showUpRate: parseFloat(showUpRate.toFixed(2)),
        totalAppointments,
        responseRate: parseFloat(responseRate.toFixed(2)),
        avgTimeToResponse: parseFloat(avgTimeToResponse.toFixed(2)),
        avgDaysInStage: parseFloat(avgDaysInStage.toFixed(1)), // NEW
        leadsStuck, // NEW: Leads sitting > 7 days
        statusBreakdown,
        convertedCount,
        activeLeadsCount: activeLeads.length,
        // KPIs
        leadToCallRate: parseFloat(leadToCallRate.toFixed(2)),
        leadToAppRate: parseFloat(leadToAppRate.toFixed(2)),
        callToAppRate: parseFloat(callToAppRate.toFixed(2)),
        // NEW METRICS
        engagedToBookRate: parseFloat(engagedToBookRate.toFixed(2)),
        appToCloseRate: parseFloat(appToCloseRate.toFixed(2)),
        leadToWonRate: parseFloat(leadToWonRate.toFixed(2)),
        dealsWonCount,
        appsStartedCount,
        leadsWithCallOutcomes,
      },
    });
  } catch (error) {
    console.error("Analytics overview error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
