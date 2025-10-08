import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Analytics Funnel API
 * Returns conversion funnel data: NEW -> CONTACTED -> ENGAGED -> CALL_SCHEDULED -> CONVERTED
 */
export async function GET() {
  try {
    // Get lead counts by status
    const leadsByStatus = await prisma.lead.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    });

    // Map to funnel stages
    const statusMap = new Map(leadsByStatus.map((s) => [s.status, s._count.id]));

    const funnelData = [
      {
        stage: "NEW",
        label: "New Leads",
        count: statusMap.get("NEW") || 0,
        color: "#625FFF",
      },
      {
        stage: "CONTACTED",
        label: "Contacted",
        count: statusMap.get("CONTACTED") || 0,
        color: "#8B88FF",
      },
      {
        stage: "ENGAGED",
        label: "Engaged",
        count: statusMap.get("ENGAGED") || 0,
        color: "#FFB6E1",
      },
      {
        stage: "CALL_SCHEDULED",
        label: "Call Scheduled",
        count: statusMap.get("CALL_SCHEDULED") || 0,
        color: "#D9F36E",
      },
      {
        stage: "CALL_COMPLETED",
        label: "Call Completed",
        count: statusMap.get("CALL_COMPLETED") || 0,
        color: "#B8E986",
      },
      {
        stage: "APPLICATION_STARTED",
        label: "Application Started",
        count: statusMap.get("APPLICATION_STARTED") || 0,
        color: "#A8E86E",
      },
      {
        stage: "CONVERTED",
        label: "Converted",
        count: statusMap.get("CONVERTED") || 0,
        color: "#76C63E",
      },
      {
        stage: "NURTURING",
        label: "Nurturing",
        count: statusMap.get("NURTURING") || 0,
        color: "#E0BBE4",
      },
      {
        stage: "LOST",
        label: "Lost",
        count: statusMap.get("LOST") || 0,
        color: "#999999",
      },
    ];

    // Calculate conversion rates between stages
    const totalLeads = funnelData.reduce((sum, stage) => sum + stage.count, 0);

    const funnelWithRates = funnelData.map((stage, index) => {
      let conversionRate = 0;
      if (totalLeads > 0) {
        conversionRate = (stage.count / totalLeads) * 100;
      }

      // Calculate drop-off from previous stage
      let dropOff = 0;
      if (index > 0) {
        const prevCount = funnelData[index - 1].count;
        if (prevCount > 0) {
          dropOff = ((prevCount - stage.count) / prevCount) * 100;
        }
      }

      return {
        ...stage,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        dropOff: parseFloat(dropOff.toFixed(2)),
      };
    });

    // Calculate key funnel metrics
    const newLeads = statusMap.get("NEW") || 0;
    const contacted = statusMap.get("CONTACTED") || 0;
    const engaged = (statusMap.get("ENGAGED") || 0) + (statusMap.get("NURTURING") || 0);
    const callScheduled = statusMap.get("CALL_SCHEDULED") || 0;
    const converted = statusMap.get("CONVERTED") || 0;

    const metrics = {
      contactRate: newLeads > 0 ? ((contacted / newLeads) * 100).toFixed(2) : "0",
      engagementRate: contacted > 0 ? ((engaged / contacted) * 100).toFixed(2) : "0",
      bookingRate: engaged > 0 ? ((callScheduled / engaged) * 100).toFixed(2) : "0",
      conversionRate: totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(2) : "0",
    };

    return NextResponse.json({
      success: true,
      data: {
        funnel: funnelWithRates,
        metrics,
        totalLeads,
        lostLeads: statusMap.get("LOST") || 0,
      },
    });
  } catch (error) {
    console.error("Analytics funnel error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch funnel data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
