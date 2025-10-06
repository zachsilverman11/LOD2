import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    // Temporarily fetch without notes/tasks to diagnose
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

    // Add empty arrays for notes and tasks for now
    const leadsWithExtras = leads.map(lead => ({
      ...lead,
      notes: [],
      tasks: [],
    }));

    return NextResponse.json(leadsWithExtras);
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads", details: String(error) },
      { status: 500 }
    );
  }
}
