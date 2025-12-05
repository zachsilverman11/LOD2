import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calculateAllCohortMetrics,
  calculateCohortTotals,
  type LeadWithRelations,
} from "@/lib/analytics-helpers";

/**
 * GET /api/analytics/cohort-comparison
 * Returns side-by-side comparison of all cohorts with key metrics:
 * - Total leads
 * - Booked (unique leads with appointments)
 * - Apps Submitted
 * - Deals Won
 * - Conversion rates
 */
export async function GET() {
  try {
    // Fetch all leads with relations
    const allLeads = await prisma.lead.findMany({
      include: {
        communications: true,
        appointments: true,
        callOutcomes: true,
      },
    }) as LeadWithRelations[];

    // Calculate metrics for ALL cohorts using the new helper
    const cohortMetrics = calculateAllCohortMetrics(allLeads);

    // Calculate totals row
    const totals = calculateCohortTotals(cohortMetrics);

    // Get cohort start dates from CohortConfig for enrichment
    const cohortConfigs = await prisma.cohortConfig.findMany({
      orderBy: { cohortNumber: "asc" },
    });

    // Enrich with start dates from CohortConfig if available
    const enrichedCohorts = cohortMetrics.map((cohort) => {
      const config = cohortConfigs.find((c) => c.currentCohortName === cohort.cohort);
      return {
        ...cohort,
        startDate: config?.cohortStartDate || cohort.startDate,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        cohorts: enrichedCohorts,
        totals,
        totalCohorts: enrichedCohorts.length,
      },
    });
  } catch (error) {
    console.error("Error fetching cohort comparison:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch cohort comparison",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
