import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calculateFunnelMetrics,
  filterByCohort,
  filterByDateRange,
  type LeadWithRelations,
} from "@/lib/analytics-helpers";

/**
 * Analytics Funnel API
 * Returns conversion funnel data: NEW -> CONTACTED -> ENGAGED -> CALL_SCHEDULED -> CONVERTED
 * Supports cohort and date range filtering via query params
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const cohort = searchParams.get("cohort");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const startDate = startDateParam ? new Date(startDateParam) : null;
    const endDate = endDateParam ? new Date(endDateParam) : null;

    // Fetch all leads with relations
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

    // Calculate funnel metrics
    const metrics = calculateFunnelMetrics(filteredLeads);

    // Get lead counts by status for visual funnel
    const leadsByStatus = filteredLeads.reduce((acc, lead) => {
      const existing = acc.find(s => s.status === lead.status);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ status: lead.status, count: 1 });
      }
      return acc;
    }, [] as Array<{ status: string; count: number }>);

    const statusMap = new Map(leadsByStatus.map((s) => [s.status, s.count]));

    const funnelData = [
      {
        stage: "NEW",
        label: "New Leads",
        count: statusMap.get("NEW") || 0,
        color: "#625FFF",
      },
      {
        stage: "CONTACTED",
        label: "Contacted",
        count: statusMap.get("CONTACTED") || 0,
        color: "#8B88FF",
      },
      {
        stage: "ENGAGED",
        label: "Engaged",
        count: statusMap.get("ENGAGED") || 0,
        color: "#FFB6E1",
      },
      {
        stage: "CALL_SCHEDULED",
        label: "Call Scheduled",
        count: statusMap.get("CALL_SCHEDULED") || 0,
        color: "#D9F36E",
      },
      {
        stage: "CALL_COMPLETED",
        label: "Call Completed",
        count: statusMap.get("CALL_COMPLETED") || 0,
        color: "#B8E986",
      },
      {
        stage: "APPLICATION_STARTED",
        label: "Application Started",
        count: statusMap.get("APPLICATION_STARTED") || 0,
        color: "#A8E86E",
      },
      {
        stage: "CONVERTED",
        label: "Converted",
        count: statusMap.get("CONVERTED") || 0,
        color: "#76C63E",
      },
      {
        stage: "DEALS_WON",
        label: "Deals Won",
        count: statusMap.get("DEALS_WON") || 0,
        color: "#2E7D32",
      },
      {
        stage: "NURTURING",
        label: "Nurturing",
        count: statusMap.get("NURTURING") || 0,
        color: "#E0BBE4",
      },
      {
        stage: "LOST",
        label: "Lost",
        count: statusMap.get("LOST") || 0,
        color: "#999999",
      },
    ];

    // Calculate conversion rates between stages
    const totalLeads = funnelData.reduce((sum, stage) => sum + stage.count, 0);

    const funnelWithRates = funnelData.map((stage, index) => {
      let conversionRate = 0;
      if (totalLeads > 0) {
        conversionRate = (stage.count / totalLeads) * 100;
      }

      // Calculate drop-off from previous stage
      let dropOff = 0;
      if (index > 0) {
        const prevCount = funnelData[index - 1].count;
        if (prevCount > 0) {
          dropOff = ((prevCount - stage.count) / prevCount) * 100;
        }
      }

      return {
        ...stage,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        dropOff: parseFloat(dropOff.toFixed(2)),
      };
    });

    // Fetch targets
    let targets = await prisma.analyticsTarget.findFirst();
    if (!targets) {
      // Create default targets if none exist
      targets = await prisma.analyticsTarget.create({
        data: {
          contactRateTarget: 80,
          engagementRateTarget: 60,
          bookingRateTarget: 40,
          conversionRateTarget: 25,
          dealsWonRateTarget: 70,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        funnel: funnelWithRates,
        metrics: {
          contactRate: metrics.contactRate,
          engagementRate: metrics.engagementRate,
          bookingRate: metrics.bookingRate,
          conversionRate: metrics.conversionRate,
          dealsWonRate: metrics.dealsWonRate,
          // Additional counts
          totalLeads: metrics.totalLeads,
          contacted: metrics.contacted,
          engaged: metrics.engaged,
          booked: metrics.booked,
          callCompleted: metrics.callCompleted,
          applicationStarted: metrics.applicationStarted,
          converted: metrics.converted,
          dealsWon: metrics.dealsWon,
        },
        targets: {
          contactRate: targets.contactRateTarget,
          engagementRate: targets.engagementRateTarget,
          bookingRate: targets.bookingRateTarget,
          conversionRate: targets.conversionRateTarget,
          dealsWonRate: targets.dealsWonRateTarget,
        },
        totalLeads: metrics.totalLeads,
        lostLeads: statusMap.get("LOST") || 0,
        filters: {
          cohort: cohort || "all",
          startDate: startDateParam,
          endDate: endDateParam,
        },
      },
    });
  } catch (error) {
    console.error("Analytics funnel error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch funnel data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
