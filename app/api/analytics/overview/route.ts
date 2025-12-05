import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calculateFunnelMetrics,
  calculateKeyMetrics,
  calculateShowUpRate,
  filterByCohort,
  filterByDateRange,
  getPastAppointments,
  isCallCompleted,
  type LeadWithRelations,
} from "@/lib/analytics-helpers";

/**
 * Analytics Overview API
 * Returns key metrics: total leads, pipeline value, conversion rate, calls booked
 * Supports cohort and date range filtering via query params
 */
export async function GET(request: NextRequest) {
  // Parse query parameters for filtering
  const { searchParams } = new URL(request.url);
  const cohort = searchParams.get("cohort");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  const startDate = startDateParam ? new Date(startDateParam) : null;
  const endDate = endDateParam ? new Date(endDateParam) : null;
  try {
    // Fetch all leads with relations for comprehensive analytics
    const allLeads = await prisma.lead.findMany({
      include: {
        communications: true,
        appointments: true,
        callOutcomes: true,
      },
    }) as LeadWithRelations[];

    // Apply filters
    let filteredLeads = filterByDateRange(allLeads, startDate, endDate);
    filteredLeads = filterByCohort(filteredLeads, cohort);

    // Calculate funnel metrics using standardized helpers
    const funnelMetrics = calculateFunnelMetrics(filteredLeads);

    // Calculate key metrics (the 4 primary rates)
    const keyMetrics = calculateKeyMetrics(filteredLeads);

    // Get leads by status for breakdown
    const leadsByStatus = filteredLeads.reduce((acc, lead) => {
      const existing = acc.find(s => s.status === lead.status);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ status: lead.status, count: 1 });
      }
      return acc;
    }, [] as Array<{ status: string; count: number }>);

    // Calculate pipeline value - ACTIVE ONLY (excludes LOST and DEALS_WON)
    const activeLeads = filteredLeads.filter(
      (lead) => !["LOST", "DEALS_WON"].includes(lead.status)
    );

    let totalPipelineValue = 0;
    let activePipelineValue = 0;

    // Helper to extract mortgage balance from rawData
    // LOD sends 'balance' field which is the mortgage amount
    const extractValue = (rawData: any): number => {
      if (!rawData) return 0;
      const value = parseFloat(
        rawData?.balance ||
        rawData?.mortgage_amount ||
        rawData?.loanAmount ||
        rawData?.loan_amount ||
        "0"
      );
      return isNaN(value) ? 0 : value;
    };

    filteredLeads.forEach((lead) => {
      const value = extractValue(lead.rawData);
      totalPipelineValue += value;
    });

    activeLeads.forEach((lead) => {
      const value = extractValue(lead.rawData);
      activePipelineValue += value;
    });

    // Get all appointments from filtered leads for show-up rate calculation
    const allAppointments = filteredLeads.flatMap((lead) => lead.appointments || []);
    const showUpRate = calculateShowUpRate(allAppointments);

    // Get past appointments for call metrics
    const pastAppointments = getPastAppointments(allAppointments);
    const callsScheduled = pastAppointments.length;
    // FIXED: Use isCallCompleted (CallOutcome.reached=true) instead of appointment status
    const callsCompleted = filteredLeads.filter(isCallCompleted).length;

    // Get total appointments
    const totalAppointments = allAppointments.length;

    // Response rate is same as engagement rate from funnel metrics
    const responseRate = funnelMetrics.engagementRate;

    // Get average time to first response (for leads who responded)
    const engagedLeads = filteredLeads.filter(
      (lead) => lead.communications && lead.communications.some((c) => c.direction === "INBOUND")
    );

    let totalResponseTime = 0;
    let responseCount = 0;

    engagedLeads.forEach((lead) => {
      const comms = lead.communications || [];
      const firstOutbound = comms.find((c) => c.direction === "OUTBOUND");
      const firstInbound = comms.find((c) => c.direction === "INBOUND");

      if (firstOutbound && firstInbound) {
        const timeToResponse =
          firstInbound.createdAt.getTime() - firstOutbound.createdAt.getTime();
        totalResponseTime += timeToResponse;
        responseCount++;
      }
    });

    const avgTimeToResponse =
      responseCount > 0 ? totalResponseTime / responseCount / 1000 / 60 / 60 : 0; // Convert to hours

    // Calculate average days in current stage for active leads
    const now = new Date();
    let totalDaysInStage = 0;
    let leadsStuck = 0;

    activeLeads.forEach((lead) => {
      const daysInStage = Math.floor((now.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      totalDaysInStage += daysInStage;
      if (daysInStage > 7) {
        leadsStuck++;
      }
    });

    const avgDaysInStage = activeLeads.length > 0 ? totalDaysInStage / activeLeads.length : 0;

    // Calculate additional KPIs using funnel metrics
    const leadToCallRate = funnelMetrics.totalLeads > 0 ? (callsScheduled / funnelMetrics.totalLeads) * 100 : 0;
    const leadToAppRate = funnelMetrics.totalLeads > 0 ? (funnelMetrics.applicationStarted / funnelMetrics.totalLeads) * 100 : 0;
    const callToAppRate = funnelMetrics.callCompleted > 0 ? (funnelMetrics.applicationStarted / funnelMetrics.callCompleted) * 100 : 0;
    const appToCloseRate = funnelMetrics.applicationStarted > 0 ? (funnelMetrics.converted / funnelMetrics.applicationStarted) * 100 : 0;
    const leadToWonRate = funnelMetrics.totalLeads > 0 ? (funnelMetrics.dealsWon / funnelMetrics.totalLeads) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        // Core metrics
        totalLeads: funnelMetrics.totalLeads,
        totalPipelineValue: parseFloat(totalPipelineValue.toFixed(2)),
        activePipelineValue: parseFloat(activePipelineValue.toFixed(2)),
        conversionRate: funnelMetrics.conversionRate,

        // KEY METRICS (the 4 primary rates user cares about)
        keyMetrics: {
          totalLeads: keyMetrics.totalLeads,
          leadsBooked: keyMetrics.leadsBooked,
          appsSubmitted: keyMetrics.appsSubmitted,
          dealsWon: keyMetrics.dealsWon,
          leadToCallBookedRate: keyMetrics.leadToCallBookedRate,
          callBookedToAppRate: keyMetrics.callBookedToAppRate,
          leadToAppRate: keyMetrics.leadToAppRate,
          leadToDealsWonRate: keyMetrics.leadToDealsWonRate,
        },

        // Call metrics
        callsScheduled,
        callsCompleted,
        showUpRate: parseFloat(showUpRate.toFixed(2)),
        totalAppointments,

        // Engagement metrics
        responseRate,
        avgTimeToResponse: parseFloat(avgTimeToResponse.toFixed(2)),

        // Pipeline health
        avgDaysInStage: parseFloat(avgDaysInStage.toFixed(1)),
        leadsStuck,
        activeLeadsCount: activeLeads.length,

        // Status breakdown
        statusBreakdown: leadsByStatus,

        // Funnel counts
        contacted: funnelMetrics.contacted,
        engaged: funnelMetrics.engaged,
        booked: funnelMetrics.booked,
        callCompleted: funnelMetrics.callCompleted,
        applicationStarted: funnelMetrics.applicationStarted,
        converted: funnelMetrics.converted,
        dealsWon: funnelMetrics.dealsWon,

        // KPI rates (legacy - keeping for backwards compatibility)
        contactRate: funnelMetrics.contactRate,
        engagementRate: funnelMetrics.engagementRate,
        bookingRate: funnelMetrics.bookingRate,
        leadToCallRate: parseFloat(leadToCallRate.toFixed(2)),
        leadToAppRate: parseFloat(leadToAppRate.toFixed(2)),
        callToAppRate: parseFloat(callToAppRate.toFixed(2)),
        callCompletionRate: funnelMetrics.callCompletionRate,
        appToCloseRate: parseFloat(appToCloseRate.toFixed(2)),
        leadToWonRate: parseFloat(leadToWonRate.toFixed(2)),
        dealsWonRate: funnelMetrics.dealsWonRate,

        // Filters applied (for UI display)
        filters: {
          cohort: cohort || "all",
          startDate: startDateParam,
          endDate: endDateParam,
        },
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
