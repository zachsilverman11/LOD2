import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calculateFunnelMetrics,
  filterByCohort,
  filterByDateRange,
  filterBySource,
  filterBySegment,
  type LeadWithRelations,
} from "@/lib/analytics-helpers";

/**
 * GET /api/analytics/source-comparison
 * Returns comparison metrics between FinanceVine and LOD leads
 * Shows the funnel: SMS contacted (outbound) → lead replied → booked
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const cohort = searchParams.get("cohort");
    const segment = searchParams.get("segment");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const startDate = startDateParam ? new Date(startDateParam) : null;
    const endDate = endDateParam ? new Date(endDateParam) : null;

    // Fetch all leads with relations
    const allLeads = (await prisma.lead.findMany({
      include: {
        communications: true,
        appointments: true,
        callOutcomes: true,
      },
    })) as LeadWithRelations[];

    // Apply date, cohort, and segment filters before splitting by source
    let filteredLeads = filterByDateRange(allLeads, startDate, endDate);
    filteredLeads = filterByCohort(filteredLeads, cohort);
    filteredLeads = filterBySegment(filteredLeads, segment);

    // Split into FinanceVine and LOD groups
    // LOD includes both null source and leads_on_demand
    const financevineLeads = filterBySource(filteredLeads, "financevine");
    const lodLeads = filteredLeads.filter(
      (lead) => !lead.source || lead.source === "leads_on_demand"
    );

    // Calculate funnel metrics for each group
    const financevineMetrics = calculateFunnelMetrics(financevineLeads);
    const lodMetrics = calculateFunnelMetrics(lodLeads);

    return NextResponse.json({
      success: true,
      data: {
        financevine: {
          name: "FinanceVine",
          totalLeads: financevineMetrics.totalLeads,
          contacted: financevineMetrics.contacted,
          engaged: financevineMetrics.engaged,
          booked: financevineMetrics.booked,
          contactRate: financevineMetrics.contactRate,
          engagementRate: financevineMetrics.engagementRate,
          bookingRate: financevineMetrics.bookingRate,
        },
        lod: {
          name: "Leads On Demand",
          totalLeads: lodMetrics.totalLeads,
          contacted: lodMetrics.contacted,
          engaged: lodMetrics.engaged,
          booked: lodMetrics.booked,
          contactRate: lodMetrics.contactRate,
          engagementRate: lodMetrics.engagementRate,
          bookingRate: lodMetrics.bookingRate,
        },
        filters: {
          cohort: cohort || "all",
          segment: segment || "all",
          startDate: startDateParam,
          endDate: endDateParam,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching source comparison analytics:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch source comparison analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
