import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    console.log("Test endpoint called");
    const count = await prisma.lead.count();
    console.log("Count:", count);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Test error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
