import { NextRequest, NextResponse } from "next/server";
import { deleteLeadData } from "@/lib/compliance";

/**
 * Delete personal data for a lead (PIPEDA "right to be forgotten")
 * DELETE /api/compliance/delete?leadId=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get("leadId");

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 }
      );
    }

    const result = await deleteLeadData(leadId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error deleting lead data:", error);
    return NextResponse.json(
      { error: "Failed to delete data" },
      { status: 500 }
    );
  }
}
