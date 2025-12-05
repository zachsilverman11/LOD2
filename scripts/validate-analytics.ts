/**
 * Analytics Data Validation Script
 *
 * This script validates analytics data consistency and identifies potential issues.
 * Run with: npx tsx scripts/validate-analytics.ts
 */

import { prisma } from "../lib/db";

async function validateAnalytics() {
  console.log("=".repeat(60));
  console.log("ANALYTICS DATA VALIDATION");
  console.log("=".repeat(60));
  console.log();

  // 1. LEAD COUNTS BY STATUS
  console.log("1. LEAD COUNTS BY STATUS");
  console.log("-".repeat(40));

  const leadsByStatus = await prisma.lead.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  const statusOrder = [
    "NEW",
    "CONTACTED",
    "ENGAGED",
    "QUALIFIED",
    "CALL_SCHEDULED",
    "CALL_COMPLETED",
    "WAITING_FOR_APPLICATION",
    "APPLICATION_STARTED",
    "CONVERTED",
    "DEALS_WON",
    "NURTURING",
    "LOST",
  ];

  const statusMap = new Map(leadsByStatus.map((s) => [s.status, s._count.id]));
  let totalLeads = 0;

  for (const status of statusOrder) {
    const count = statusMap.get(status) || 0;
    totalLeads += count;
    console.log(`  ${status.padEnd(25)} ${count}`);
  }
  console.log(`  ${"TOTAL".padEnd(25)} ${totalLeads}`);
  console.log();

  // 2. LEAD COUNTS BY COHORT
  console.log("2. LEAD COUNTS BY COHORT");
  console.log("-".repeat(40));

  const leadsByCohort = await prisma.lead.groupBy({
    by: ["cohort"],
    _count: { id: true },
    orderBy: { cohort: "asc" },
  });

  for (const cohort of leadsByCohort) {
    const name = cohort.cohort || "NO_COHORT";
    console.log(`  ${name.padEnd(25)} ${cohort._count.id}`);
  }
  console.log();

  // 3. DATA CONSISTENCY CHECKS
  console.log("3. DATA CONSISTENCY CHECKS");
  console.log("-".repeat(40));

  // Check: DEALS_WON without convertedAt
  const dealsWonWithoutConvertedAt = await prisma.lead.count({
    where: {
      status: "DEALS_WON",
      convertedAt: null,
    },
  });
  console.log(
    `  DEALS_WON without convertedAt:     ${dealsWonWithoutConvertedAt} ${dealsWonWithoutConvertedAt > 0 ? "⚠️" : "✓"}`
  );

  // Check: CONVERTED without convertedAt
  const convertedWithoutDate = await prisma.lead.count({
    where: {
      status: "CONVERTED",
      convertedAt: null,
    },
  });
  console.log(
    `  CONVERTED without convertedAt:     ${convertedWithoutDate} ${convertedWithoutDate > 0 ? "⚠️" : "✓"}`
  );

  // Check: applicationCompletedAt without CONVERTED/DEALS_WON status
  const appCompletedWrongStatus = await prisma.lead.count({
    where: {
      applicationCompletedAt: { not: null },
      status: { notIn: ["CONVERTED", "DEALS_WON"] },
    },
  });
  console.log(
    `  App completed but wrong status:    ${appCompletedWrongStatus} ${appCompletedWrongStatus > 0 ? "⚠️" : "✓"}`
  );

  // Check: Leads with no cohort assignment
  const leadsWithoutCohort = await prisma.lead.count({
    where: { cohort: null },
  });
  console.log(
    `  Leads without cohort:              ${leadsWithoutCohort} ${leadsWithoutCohort > 0 ? "⚠️" : "✓"}`
  );

  console.log();

  // 4. BOOKING METRICS
  console.log("4. BOOKING METRICS");
  console.log("-".repeat(40));

  const leadsWithAppointments = await prisma.lead.count({
    where: {
      appointments: { some: {} },
    },
  });
  console.log(`  Leads with ANY appointment:        ${leadsWithAppointments}`);

  const leadsWithNonCancelledAppt = await prisma.lead.count({
    where: {
      appointments: { some: { status: { not: "cancelled" } } },
    },
  });
  console.log(`  Leads with non-cancelled appt:     ${leadsWithNonCancelledAppt}`);

  const totalAppointments = await prisma.appointment.count();
  console.log(`  Total appointments:                ${totalAppointments}`);

  const appointmentsByStatus = await prisma.appointment.groupBy({
    by: ["status"],
    _count: { id: true },
  });
  for (const appt of appointmentsByStatus) {
    console.log(`    - ${appt.status?.padEnd(20) || "null".padEnd(20)} ${appt._count.id}`);
  }
  console.log();

  // 5. CALL OUTCOMES
  console.log("5. CALL OUTCOMES");
  console.log("-".repeat(40));

  const callOutcomesReached = await prisma.callOutcome.count({
    where: { reached: true },
  });
  const callOutcomesNotReached = await prisma.callOutcome.count({
    where: { reached: false },
  });
  console.log(`  Call outcomes (reached=true):      ${callOutcomesReached}`);
  console.log(`  Call outcomes (reached=false):     ${callOutcomesNotReached}`);

  const uniqueLeadsWithCallOutcome = await prisma.callOutcome.groupBy({
    by: ["leadId"],
    _count: { id: true },
    where: { reached: true },
  });
  console.log(`  Unique leads with call reached:    ${uniqueLeadsWithCallOutcome.length}`);
  console.log();

  // 6. PIPELINE VALUE CHECK
  console.log("6. PIPELINE VALUE CHECK");
  console.log("-".repeat(40));

  // Sample some leads to check rawData structure
  const sampleLeads = await prisma.lead.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: { id: true, firstName: true, lastName: true, rawData: true },
  });

  console.log("  Sample rawData fields:");
  const fieldCounts: Record<string, number> = {};
  let leadsWithLoanAmount = 0;

  for (const lead of sampleLeads) {
    const rawData = lead.rawData as Record<string, unknown> | null;
    if (rawData) {
      Object.keys(rawData).forEach((key) => {
        fieldCounts[key] = (fieldCounts[key] || 0) + 1;
      });

      // Check for loan amount fields
      if (rawData.loanAmount || rawData.loan_amount || rawData.mortgage_amount) {
        leadsWithLoanAmount++;
      }
    }
  }

  // Show common fields
  const sortedFields = Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  for (const [field, count] of sortedFields) {
    console.log(`    - ${field.padEnd(25)} (${count}/10 leads)`);
  }

  console.log(`\n  Leads with loan amount field:      ${leadsWithLoanAmount}/10 sample`);

  // Check all leads for loan amount
  const allLeads = await prisma.lead.findMany({
    select: { rawData: true, status: true },
  });

  let totalWithLoanAmount = 0;
  let totalPipelineValue = 0;

  for (const lead of allLeads) {
    const rawData = lead.rawData as Record<string, unknown> | null;
    if (rawData) {
      const loanAmount =
        parseFloat(String(rawData.loanAmount || rawData.loan_amount || rawData.mortgage_amount || "0"));
      if (!isNaN(loanAmount) && loanAmount > 0) {
        totalWithLoanAmount++;
        if (!["LOST", "DEALS_WON"].includes(lead.status)) {
          totalPipelineValue += loanAmount;
        }
      }
    }
  }

  console.log(`  All leads with loan amount:        ${totalWithLoanAmount}/${allLeads.length}`);
  console.log(`  Estimated active pipeline value:   $${totalPipelineValue.toLocaleString()}`);
  console.log();

  // 7. KEY METRICS SUMMARY
  console.log("7. KEY METRICS SUMMARY");
  console.log("-".repeat(40));

  const dealsWon = statusMap.get("DEALS_WON") || 0;
  const converted = statusMap.get("CONVERTED") || 0;
  const appsSubmitted = dealsWon + converted;

  console.log(`  Total Leads:                       ${totalLeads}`);
  console.log(`  Leads Booked:                      ${leadsWithAppointments}`);
  console.log(`  Apps Submitted:                    ${appsSubmitted}`);
  console.log(`  Deals Won:                         ${dealsWon}`);
  console.log();
  console.log(`  Lead → Call Booked:                ${((leadsWithAppointments / totalLeads) * 100).toFixed(1)}%`);
  console.log(`  Call → Application:                ${((appsSubmitted / leadsWithAppointments) * 100).toFixed(1)}%`);
  console.log(`  Lead → Application:                ${((appsSubmitted / totalLeads) * 100).toFixed(1)}%`);
  console.log(`  Lead → Deals Won:                  ${((dealsWon / totalLeads) * 100).toFixed(1)}%`);
  console.log();

  console.log("=".repeat(60));
  console.log("VALIDATION COMPLETE");
  console.log("=".repeat(60));
}

validateAnalytics()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
