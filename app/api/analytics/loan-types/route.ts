import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calculateLoanTypeMetrics,
  calculateLoanTypeTotals,
  filterByCohort,
  filterByDateRange,
  type LeadWithRelations,
} from "@/lib/analytics-helpers";

/**
 * GET /api/analytics/loan-types
 * Returns analytics broken down by loan type (refinance, purchase, heloc, etc.)
 * Supports cohort and date range filtering via query params
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const cohort = searchParams.get("cohort");
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

    // Apply filters
    let filteredLeads = filterByDateRange(allLeads, startDate, endDate);
    filteredLeads = filterByCohort(filteredLeads, cohort);

    // Calculate loan type metrics
    const loanTypeMetrics = calculateLoanTypeMetrics(filteredLeads);
    const totals = calculateLoanTypeTotals(loanTypeMetrics);

    return NextResponse.json({
      success: true,
      data: {
        loanTypes: loanTypeMetrics,
        totals,
        filters: {
          cohort: cohort || "all",
          startDate: startDateParam,
          endDate: endDateParam,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching loan type analytics:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch loan type analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
