import { NextRequest, NextResponse } from "next/server";
import { exportLeadData } from "@/lib/compliance";

/**
 * Export personal data for a lead (PIPEDA compliance)
 * GET /api/compliance/export?leadId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get("leadId");

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 }
      );
    }

    const data = await exportLeadData(leadId);

    return NextResponse.json(data, {
      headers: {
        "Content-Disposition": `attachment; filename="lead-data-${leadId}.json"`,
      },
    });
  } catch (error) {
    console.error("Error exporting lead data:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
