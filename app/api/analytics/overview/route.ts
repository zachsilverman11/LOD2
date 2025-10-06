import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Analytics Overview API
 * Returns key metrics: total leads, pipeline value, conversion rate, calls booked
 */
export async function GET() {
  try {
    // Get total leads by status
    const leadsByStatus = await prisma.lead.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    });

    // Calculate total pipeline value (sum of loan amounts for active leads)
    const activeLeads = await prisma.lead.findMany({
      where: {
        status: {
          notIn: ["LOST", "CONVERTED"],
        },
      },
      select: {
        rawData: true,
      },
    });

    let totalPipelineValue = 0;
    activeLeads.forEach((lead) => {
      const rawData = lead.rawData as any;
      const loanAmount = parseFloat(rawData?.loanAmount || rawData?.loan_amount || "0");
      if (!isNaN(loanAmount)) {
        totalPipelineValue += loanAmount;
      }
    });

    // Get total leads
    const totalLeads = leadsByStatus.reduce((sum, status) => sum + status._count.id, 0);

    // Get converted leads
    const convertedCount = leadsByStatus.find((s) => s.status === "CONVERTED")?._count.id || 0;

    // Calculate conversion rate
    const conversionRate = totalLeads > 0 ? (convertedCount / totalLeads) * 100 : 0;

    // Get calls booked (CALL_SCHEDULED + CALL_COMPLETED + CONVERTED)
    const callsBooked =
      (leadsByStatus.find((s) => s.status === "CALL_SCHEDULED")?._count.id || 0) +
      (leadsByStatus.find((s) => s.status === "CALL_COMPLETED")?._count.id || 0) +
      convertedCount;

    // Get total appointments
    const totalAppointments = await prisma.appointment.count();

    // Get response rate (leads who have replied)
    const leadsWithInbound = await prisma.lead.count({
      where: {
        communications: {
          some: {
            direction: "INBOUND",
          },
        },
      },
    });

    const responseRate = totalLeads > 0 ? (leadsWithInbound / totalLeads) * 100 : 0;

    // Get average time to first response (for leads who responded)
    const leadsWithResponse = await prisma.lead.findMany({
      where: {
        communications: {
          some: {
            direction: "INBOUND",
          },
        },
      },
      include: {
        communications: {
          orderBy: { createdAt: "asc" },
          take: 2,
        },
      },
    });

    let totalResponseTime = 0;
    let responseCount = 0;

    leadsWithResponse.forEach((lead) => {
      const firstOutbound = lead.communications.find((c) => c.direction === "OUTBOUND");
      const firstInbound = lead.communications.find((c) => c.direction === "INBOUND");

      if (firstOutbound && firstInbound) {
        const timeToResponse =
          firstInbound.createdAt.getTime() - firstOutbound.createdAt.getTime();
        totalResponseTime += timeToResponse;
        responseCount++;
      }
    });

    const avgTimeToResponse =
      responseCount > 0 ? totalResponseTime / responseCount / 1000 / 60 / 60 : 0; // Convert to hours

    // Get leads by status for breakdown
    const statusBreakdown = leadsByStatus.map((s) => ({
      status: s.status,
      count: s._count.id,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalLeads,
        totalPipelineValue,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        callsBooked,
        totalAppointments,
        responseRate: parseFloat(responseRate.toFixed(2)),
        avgTimeToResponse: parseFloat(avgTimeToResponse.toFixed(2)),
        statusBreakdown,
        convertedCount,
        activeLeadsCount: activeLeads.length,
      },
    });
  } catch (error) {
    console.error("Analytics overview error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
