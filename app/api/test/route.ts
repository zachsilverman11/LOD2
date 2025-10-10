import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    console.log("Test endpoint called");
    const leadCount = await prisma.lead.count();
    const devCardCount = await prisma.devCard.count();
    console.log("Lead count:", leadCount);
    console.log("Dev card count:", devCardCount);
    return NextResponse.json({
      success: true,
      leadCount,
      devCardCount,
      message: "Dev Board is live!"
    });
  } catch (error) {
    console.error("Test error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
