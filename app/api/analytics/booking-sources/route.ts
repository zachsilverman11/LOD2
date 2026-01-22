import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BookingSource, LeadStatus } from "@/app/generated/prisma";

interface BookingSourceStats {
  source: BookingSource;
  displayName: string;
  total: number;
  scheduled: number;
  completed: number;
  noShow: number;
  cancelled: number;
  showUpRate: number;
  conversionRate: number;
}

/**
 * Booking Source Analytics API
 * Returns breakdown of appointments by booking source (HOLLY, LOD, MANUAL)
 * Supports cohort filtering via query params
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cohort = searchParams.get("cohort");

  try {
    // Build the lead filter for cohort
    const leadFilter = cohort && cohort !== "all" ? { cohort } : {};

    // Get all appointments with lead data
    const appointments = await prisma.appointment.findMany({
      where: {
        lead: leadFilter,
      },
      include: {
        lead: {
          select: {
            id: true,
            status: true,
            cohort: true,
            applicationCompletedAt: true,
          },
        },
      },
    });

    // Group appointments by booking source
    const sourceMap = new Map<BookingSource, {
      appointments: typeof appointments;
      leadsConverted: Set<string>;
    }>();

    // Initialize all sources
    const allSources: BookingSource[] = ["HOLLY", "LOD", "MANUAL"];
    allSources.forEach(source => {
      sourceMap.set(source, { appointments: [], leadsConverted: new Set() });
    });

    // Group appointments by source
    appointments.forEach(appt => {
      const source = appt.bookingSource || "HOLLY";
      const data = sourceMap.get(source)!;
      data.appointments.push(appt);

      // Track conversions (CONVERTED or DEALS_WON status, or has applicationCompletedAt)
      if (
        appt.lead.status === LeadStatus.CONVERTED ||
        appt.lead.status === LeadStatus.DEALS_WON ||
        appt.lead.applicationCompletedAt
      ) {
        data.leadsConverted.add(appt.lead.id);
      }
    });

    // Calculate stats for each source
    const sourceStats: BookingSourceStats[] = allSources.map(source => {
      const data = sourceMap.get(source)!;
      const appts = data.appointments;

      const total = appts.length;
      const scheduled = appts.filter(a => a.status === "scheduled").length;
      const completed = appts.filter(a => a.status === "completed").length;
      const noShow = appts.filter(a => a.status === "no_show").length;
      const cancelled = appts.filter(a => a.status === "cancelled").length;

      // Show-up rate: completed / (completed + no_show)
      const showUpDenominator = completed + noShow;
      const showUpRate = showUpDenominator > 0 ? (completed / showUpDenominator) * 100 : 0;

      // Conversion rate: unique leads converted / total appointments
      const conversionRate = total > 0 ? (data.leadsConverted.size / total) * 100 : 0;

      const displayNames: Record<BookingSource, string> = {
        HOLLY: "Holly (AI)",
        LOD: "System (VAPI)",
        MANUAL: "Manual",
      };

      return {
        source,
        displayName: displayNames[source],
        total,
        scheduled,
        completed,
        noShow,
        cancelled,
        showUpRate: parseFloat(showUpRate.toFixed(1)),
        conversionRate: parseFloat(conversionRate.toFixed(1)),
      };
    });

    // Calculate totals
    const totals = {
      total: sourceStats.reduce((sum, s) => sum + s.total, 0),
      scheduled: sourceStats.reduce((sum, s) => sum + s.scheduled, 0),
      completed: sourceStats.reduce((sum, s) => sum + s.completed, 0),
      noShow: sourceStats.reduce((sum, s) => sum + s.noShow, 0),
      cancelled: sourceStats.reduce((sum, s) => sum + s.cancelled, 0),
    };

    const totalShowUpDenominator = totals.completed + totals.noShow;
    const totalShowUpRate = totalShowUpDenominator > 0
      ? (totals.completed / totalShowUpDenominator) * 100
      : 0;

    // Get unique leads that converted across all sources
    const allConvertedLeads = new Set<string>();
    sourceMap.forEach(data => {
      data.leadsConverted.forEach(leadId => allConvertedLeads.add(leadId));
    });
    const totalConversionRate = totals.total > 0
      ? (allConvertedLeads.size / totals.total) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        sources: sourceStats,
        totals: {
          ...totals,
          showUpRate: parseFloat(totalShowUpRate.toFixed(1)),
          conversionRate: parseFloat(totalConversionRate.toFixed(1)),
        },
        filters: {
          cohort: cohort || "all",
        },
      },
    });
  } catch (error) {
    console.error("Booking source analytics error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch booking source analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
