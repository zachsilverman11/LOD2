import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/cohorts
 * Returns current cohort configuration and statistics
 */
export async function GET() {
  try {
    // Get current cohort config
    const cohortConfig = await prisma.cohortConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!cohortConfig) {
      return NextResponse.json({
        error: "No cohort configuration found. Run setup script first.",
      }, { status: 404 });
    }

    // Get lead counts by cohort
    const cohortCounts = await prisma.lead.groupBy({
      by: ["cohort"],
      _count: true,
    });

    const cohortStats = cohortCounts.map((c) => ({
      cohort: c.cohort || "Unknown",
      count: c._count,
    }));

    // Get total leads
    const totalLeads = await prisma.lead.count();

    return NextResponse.json({
      success: true,
      data: {
        currentCohort: cohortConfig.currentCohortName,
        cohortNumber: cohortConfig.cohortNumber,
        cohortStartDate: cohortConfig.cohortStartDate,
        totalLeads,
        cohortStats,
      },
    });
  } catch (error) {
    console.error("Error fetching cohort info:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch cohort information",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cohorts/advance
 * Advances to the next cohort
 */
export async function POST(request: NextRequest) {
  try {
    // Get current cohort config
    const currentConfig = await prisma.cohortConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!currentConfig) {
      return NextResponse.json({
        error: "No cohort configuration found. Cannot advance.",
      }, { status: 404 });
    }

    // Calculate next cohort
    const nextNumber = currentConfig.cohortNumber + 1;
    const nextCohortName = `COHORT_${nextNumber}`;

    // Create new cohort config
    const newConfig = await prisma.cohortConfig.create({
      data: {
        currentCohortName: nextCohortName,
        cohortNumber: nextNumber,
        cohortStartDate: new Date(),
      },
    });

    // Get count of leads in previous cohort
    const previousCohortCount = await prisma.lead.count({
      where: { cohort: currentConfig.currentCohortName },
    });

    return NextResponse.json({
      success: true,
      data: {
        previousCohort: currentConfig.currentCohortName,
        previousCohortLeadCount: previousCohortCount,
        newCohort: newConfig.currentCohortName,
        newCohortNumber: newConfig.cohortNumber,
        newCohortStartDate: newConfig.cohortStartDate,
      },
      message: `Successfully advanced from ${currentConfig.currentCohortName} to ${nextCohortName}. All new leads will now be assigned to ${nextCohortName}.`,
    });
  } catch (error) {
    console.error("Error advancing cohort:", error);
    return NextResponse.json(
      {
        error: "Failed to advance cohort",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
