import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST - Create a new report
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      leadId,
      advisorId,
      consultantName,
      bullets,
      mortgageAmount,
      scenario,
      includeDebtConsolidation,
      includeCashBack,
      applicationLink,
      partnerName,
      extractedData,
    } = body;

    // Validate required fields
    if (!leadId || !advisorId || !consultantName || !bullets || mortgageAmount === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate scenario is exactly 1, 2, or 3
    if (scenario !== undefined && ![1, 2, 3].includes(scenario)) {
      return NextResponse.json(
        { error: "Scenario must be 1, 2, or 3" },
        { status: 400 }
      );
    }

    // Verify the lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Create the report
    const report = await prisma.report.create({
      data: {
        leadId,
        generatedById: advisorId,
        consultantName,
        bullets: bullets as string[],
        mortgageAmount: parseFloat(String(mortgageAmount)),
        scenario: scenario || 1,
        includeDebtConsolidation: includeDebtConsolidation || false,
        includeCashBack: includeCashBack || false,
        applicationLink: applicationLink || "https://stressfree.mtg-app.com/signup",
        partnerName: partnerName || null,
        extractedData: extractedData || null,
      },
      include: {
        generatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            calLink: true,
          },
        },
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Error creating report:", error);
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    );
  }
}

// GET - List reports for a lead
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("leadId");

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId query parameter is required" },
        { status: 400 }
      );
    }

    // Fetch reports for this lead
    const reports = await prisma.report.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      include: {
        generatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            calLink: true,
          },
        },
      },
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
