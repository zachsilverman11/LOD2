import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Analytics Metrics API
 *
 * Returns 5 key metrics for weekly tracking:
 * 1. Direct booking rate - % of leads who booked via LOD
 * 2. Holly response rate - % of non-direct-book leads who reply
 * 3. Call-to-app rate - % of completed calls that result in app started
 * 4. Cohort performance - Lead conversion by month
 * 5. Show-up rate - % of scheduled calls marked as no-show
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days

    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : new Date(); // Default: today

    // Fetch all leads within date range
    const leads = await prisma.lead.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        appointments: true,
        communications: true,
        callOutcomes: true,
      },
    });

    // 1. DIRECT BOOKING RATE
    // Leads who had calComBookingUid when first appointment was created within 5 minutes of lead creation
    const directBookings = leads.filter((lead) => {
      if (lead.appointments.length === 0) return false;

      const firstAppointment = lead.appointments.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      )[0];

      // Check if appointment was created within 5 minutes of lead creation (direct booking from LOD)
      const timeDiff = firstAppointment.createdAt.getTime() - lead.createdAt.getTime();
      const wasDirectBooked = timeDiff < 5 * 60 * 1000; // 5 minutes

      return wasDirectBooked && firstAppointment.calComBookingUid;
    });

    const directBookingRate = leads.length > 0
      ? (directBookings.length / leads.length) * 100
      : 0;

    // 2. HOLLY RESPONSE RATE
    // Of leads who didn't direct book, % who replied to Holly at least once
    const nonDirectBookLeads = leads.filter((lead) => !directBookings.includes(lead));
    const leadsWhoReplied = nonDirectBookLeads.filter((lead) =>
      lead.communications.some((comm) => comm.direction === "INBOUND")
    );

    const hollyResponseRate = nonDirectBookLeads.length > 0
      ? (leadsWhoReplied.length / nonDirectBookLeads.length) * 100
      : 0;

    // 3. CALL-TO-APP RATE
    // Of leads with call outcomes (advisor spoke with them), % who started application
    // CRITICAL FIX: Use CallOutcome records where reached=true, not appointment status
    const leadsWithCompletedCalls = leads.filter((lead) =>
      lead.callOutcomes && lead.callOutcomes.some((outcome) => outcome.reached === true)
    );

    const leadsWhoStartedApp = leadsWithCompletedCalls.filter(
      (lead) => lead.applicationStartedAt !== null
    );

    const callToAppRate = leadsWithCompletedCalls.length > 0
      ? (leadsWhoStartedApp.length / leadsWithCompletedCalls.length) * 100
      : 0;

    // 4. COHORT PERFORMANCE
    // Group leads by NAMED cohorts (COHORT_1, COHORT_2, etc.) - NOT by month
    const cohortMap = new Map<string, {
      total: number;
      booked: number;
      appsSubmitted: number;
      dealsWon: number;
    }>();

    leads.forEach((lead) => {
      const cohortName = lead.cohort || 'NO_COHORT';

      if (!cohortMap.has(cohortName)) {
        cohortMap.set(cohortName, { total: 0, booked: 0, appsSubmitted: 0, dealsWon: 0 });
      }

      const cohort = cohortMap.get(cohortName)!;
      cohort.total += 1;

      // Count booked leads (any appointment)
      if (lead.appointments && lead.appointments.length > 0) {
        cohort.booked += 1;
      }

      // Count apps submitted
      if (lead.status === "CONVERTED" || lead.status === "DEALS_WON" || lead.applicationCompletedAt) {
        cohort.appsSubmitted += 1;
      }

      // Track deals won
      if (lead.status === "DEALS_WON") {
        cohort.dealsWon += 1;
      }
    });

    const cohortPerformance = Array.from(cohortMap.entries())
      .filter(([name]) => name !== 'NO_COHORT')
      .map(([cohortName, data]) => ({
        cohort: cohortName,
        totalLeads: data.total,
        booked: data.booked,
        appsSubmitted: data.appsSubmitted,
        dealsWon: data.dealsWon,
        leadToCallRate: data.total > 0 ? (data.booked / data.total) * 100 : 0,
        leadToAppRate: data.total > 0 ? (data.appsSubmitted / data.total) * 100 : 0,
        leadToDealsWonRate: data.total > 0 ? (data.dealsWon / data.total) * 100 : 0,
      }))
      .sort((a, b) => a.cohort.localeCompare(b.cohort));

    // 5. SHOW-UP RATE (INVERSE - LOWER IS BETTER)
    // Of all scheduled appointments, % marked as no-show
    const allAppointments = leads.flatMap((lead) => lead.appointments);
    const scheduledOrCompleted = allAppointments.filter(
      (appt) => appt.status === "scheduled" || appt.status === "completed" || appt.status === "no_show"
    );
    const noShows = allAppointments.filter((appt) => appt.status === "no_show");

    const noShowRate = scheduledOrCompleted.length > 0
      ? (noShows.length / scheduledOrCompleted.length) * 100
      : 0;

    // ADDITIONAL FUNNEL METRICS
    const totalLeads = leads.length;
    const leadsContacted = leads.filter((l) => l.status !== "NEW").length;
    const leadsWithCalls = leadsWithCompletedCalls.length;
    const leadsWithAppsStarted = leads.filter((l) => l.applicationStartedAt).length;
    const leadsWithAppsCompleted = leads.filter((l) => l.applicationCompletedAt).length;

    return NextResponse.json({
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      metrics: {
        directBookingRate: {
          value: Math.round(directBookingRate * 10) / 10,
          target: 25,
          status: directBookingRate >= 25 ? "good" : "needs-improvement",
          count: directBookings.length,
          total: leads.length,
        },
        hollyResponseRate: {
          value: Math.round(hollyResponseRate * 10) / 10,
          target: 40,
          status: hollyResponseRate >= 40 ? "good" : "needs-improvement",
          count: leadsWhoReplied.length,
          total: nonDirectBookLeads.length,
        },
        callToAppRate: {
          value: Math.round(callToAppRate * 10) / 10,
          target: 45,
          status: callToAppRate >= 45 ? "good" : "needs-improvement",
          count: leadsWhoStartedApp.length,
          total: leadsWithCompletedCalls.length,
        },
        noShowRate: {
          value: Math.round(noShowRate * 10) / 10,
          target: 15,
          status: noShowRate <= 15 ? "good" : "needs-improvement",
          count: noShows.length,
          total: scheduledOrCompleted.length,
        },
        cohortPerformance,
      },
      funnel: {
        totalLeads,
        contacted: leadsContacted,
        completedCalls: leadsWithCalls,
        appsStarted: leadsWithAppsStarted,
        appsCompleted: leadsWithAppsCompleted,
        // Conversion rates at each stage
        contactRate: totalLeads > 0 ? (leadsContacted / totalLeads) * 100 : 0,
        callBookingRate: leadsContacted > 0 ? (leadsWithCalls / leadsContacted) * 100 : 0,
        appStartRate: leadsWithCalls > 0 ? (leadsWithAppsStarted / leadsWithCalls) * 100 : 0,
        appCompleteRate: leadsWithAppsStarted > 0 ? (leadsWithAppsCompleted / leadsWithAppsStarted) * 100 : 0,
        overallConversionRate: totalLeads > 0 ? (leadsWithAppsCompleted / totalLeads) * 100 : 0,
      },
    });
  } catch (error) {
    console.error("[Analytics] Error calculating metrics:", error);
    return NextResponse.json(
      { error: "Failed to calculate metrics" },
      { status: 500 }
    );
  }
}
