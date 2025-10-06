import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    const leads = await prisma.lead.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        activities: {
          orderBy: { createdAt: "desc" },
        },
        appointments: {
          orderBy: { scheduledAt: "desc" },
        },
        communications: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}
