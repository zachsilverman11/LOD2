import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calculateCohortMetrics,
  type LeadWithRelations,
} from "@/lib/analytics-helpers";

/**
 * GET /api/analytics/cohort-comparison
 * Returns side-by-side comparison of all cohorts
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

    // Get all unique cohorts
    const uniqueCohorts = [...new Set(allLeads.map((l) => l.cohort).filter(Boolean))];

    // Sort cohorts (COHORT_1, COHORT_2, etc.)
    uniqueCohorts.sort();

    // Calculate metrics for each cohort
    const cohortComparison = await calculateCohortMetrics(allLeads);

    // Filter to only cohorts that exist
    const existingCohorts = cohortComparison.filter((c) =>
      uniqueCohorts.includes(c.cohort)
    );

    // Get cohort start dates from CohortConfig
    const cohortConfigs = await prisma.cohortConfig.findMany({
      orderBy: { cohortNumber: "asc" },
    });

    // Enrich with start dates
    const enrichedCohorts = existingCohorts.map((cohort) => {
      const config = cohortConfigs.find((c) => c.currentCohortName === cohort.cohort);
      return {
        ...cohort,
        startDate: config?.cohortStartDate || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        cohorts: enrichedCohorts,
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
