import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    console.log("Fetching leads...");
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    // Try a simple query first to test connection
    const count = await prisma.lead.count();
    console.log("Lead count:", count);

    const leads = await prisma.lead.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        activities: {
          orderBy: { createdAt: "desc" },
          take: 10, // Limit to prevent timeout
        },
        appointments: {
          orderBy: { scheduledAt: "desc" },
          take: 10,
        },
        communications: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        notes: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit total leads
    });

    console.log("Fetched leads:", leads.length);
    return NextResponse.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads", details: String(error) },
      { status: 500 }
    );
  }
}
