import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/analytics/targets
 * Fetch current analytics targets
 */
export async function GET() {
  try {
    // Get or create default targets
    let targets = await prisma.analyticsTarget.findFirst();

    if (!targets) {
      // Create default targets if none exist
      targets = await prisma.analyticsTarget.create({
        data: {
          contactRateTarget: 80,
          engagementRateTarget: 60,
          bookingRateTarget: 40,
          conversionRateTarget: 20,
          dealsWonRateTarget: 70,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: targets,
    });
  } catch (error) {
    console.error("Error fetching analytics targets:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch targets",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/analytics/targets
 * Update analytics targets
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      contactRateTarget,
      engagementRateTarget,
      bookingRateTarget,
      conversionRateTarget,
      dealsWonRateTarget,
    } = body;

    // Validate inputs
    const targets = [
      contactRateTarget,
      engagementRateTarget,
      bookingRateTarget,
      conversionRateTarget,
      dealsWonRateTarget,
    ];

    for (const target of targets) {
      if (target !== undefined && (target < 0 || target > 100)) {
        return NextResponse.json(
          { error: "Targets must be between 0 and 100" },
          { status: 400 }
        );
      }
    }

    // Get existing targets
    let existingTargets = await prisma.analyticsTarget.findFirst();

    if (!existingTargets) {
      // Create new targets
      existingTargets = await prisma.analyticsTarget.create({
        data: {
          contactRateTarget: contactRateTarget ?? 80,
          engagementRateTarget: engagementRateTarget ?? 60,
          bookingRateTarget: bookingRateTarget ?? 40,
          conversionRateTarget: conversionRateTarget ?? 20,
          dealsWonRateTarget: dealsWonRateTarget ?? 70,
        },
      });
    } else {
      // Update existing targets
      existingTargets = await prisma.analyticsTarget.update({
        where: { id: existingTargets.id },
        data: {
          ...(contactRateTarget !== undefined && { contactRateTarget }),
          ...(engagementRateTarget !== undefined && { engagementRateTarget }),
          ...(bookingRateTarget !== undefined && { bookingRateTarget }),
          ...(conversionRateTarget !== undefined && { conversionRateTarget }),
          ...(dealsWonRateTarget !== undefined && { dealsWonRateTarget }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: existingTargets,
    });
  } catch (error) {
    console.error("Error updating analytics targets:", error);
    return NextResponse.json(
      {
        error: "Failed to update targets",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
