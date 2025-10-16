/**
 * READ-ONLY: Check if Finmo webhooks are working
 *
 * Checks:
 * 1. Recent leads with APPLICATION_STARTED status
 * 2. Whether they have applicationStartedAt timestamps
 * 3. Activities showing "Application Started" events
 * 4. Recent leads with CONVERTED status from applications
 */

import { prisma } from "../lib/db";

async function checkFinmoWebhooks() {
  console.log("=".repeat(80));
  console.log("FINMO WEBHOOK INTEGRATION CHECK");
  console.log("Current Time:", new Date().toLocaleString('en-US', { timeZone: 'America/Vancouver' }), "PT");
  console.log("=".repeat(80));
  console.log();

  // Check 1: Leads with APPLICATION_STARTED status
  console.log("1. CHECKING APPLICATION_STARTED LEADS");
  console.log("-".repeat(80));

  const appStartedLeads = await prisma.lead.findMany({
    where: {
      status: "APPLICATION_STARTED",
    },
    include: {
      activities: {
        where: {
          OR: [
            { content: { contains: "application", mode: "insensitive" } },
            { subject: { contains: "application", mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log(`Found ${appStartedLeads.length} leads with APPLICATION_STARTED status\n`);

  for (const lead of appStartedLeads) {
    console.log(`${lead.firstName} ${lead.lastName} (${lead.email})`);
    console.log(`  ID: ${lead.id}`);
    console.log(`  Status: ${lead.status}`);
    console.log(`  Created: ${lead.createdAt.toLocaleString()}`);
    console.log(`  applicationStartedAt: ${lead.applicationStartedAt?.toLocaleString() || "❌ NULL"}`);

    const appActivity = lead.activities.find(a =>
      a.content?.toLowerCase().includes("started") ||
      a.subject?.toLowerCase().includes("started")
    );

    if (appActivity) {
      console.log(`  ✅ Webhook Activity Found:`);
      console.log(`     Type: ${appActivity.type}`);
      console.log(`     Subject: ${appActivity.subject}`);
      console.log(`     Content: ${appActivity.content}`);
      console.log(`     Created: ${appActivity.createdAt.toLocaleString()}`);
      console.log(`     Metadata:`, appActivity.metadata);
    } else {
      console.log(`  ❌ NO webhook activity found`);
    }
    console.log();
  }

  // Check 2: Recent CONVERTED leads
  console.log("\n" + "=".repeat(80));
  console.log("2. CHECKING CONVERTED LEADS (FROM APPLICATIONS)");
  console.log("-".repeat(80));

  const convertedLeads = await prisma.lead.findMany({
    where: {
      status: "CONVERTED",
    },
    include: {
      activities: {
        where: {
          OR: [
            { content: { contains: "completed", mode: "insensitive" } },
            { subject: { contains: "completed", mode: "insensitive" } },
            { content: { contains: "submitted", mode: "insensitive" } },
            { subject: { contains: "submitted", mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { convertedAt: "desc" },
    take: 10,
  });

  console.log(`Found ${convertedLeads.length} CONVERTED leads\n`);

  for (const lead of convertedLeads) {
    console.log(`${lead.firstName} ${lead.lastName} (${lead.email})`);
    console.log(`  ID: ${lead.id}`);
    console.log(`  Status: ${lead.status}`);
    console.log(`  Created: ${lead.createdAt.toLocaleString()}`);
    console.log(`  convertedAt: ${lead.convertedAt?.toLocaleString() || "NULL"}`);
    console.log(`  applicationStartedAt: ${lead.applicationStartedAt?.toLocaleString() || "NULL"}`);
    console.log(`  applicationCompletedAt: ${lead.applicationCompletedAt?.toLocaleString() || "NULL"}`);

    const appActivity = lead.activities.find(a =>
      a.content?.toLowerCase().includes("completed") ||
      a.content?.toLowerCase().includes("submitted") ||
      a.subject?.toLowerCase().includes("completed")
    );

    if (appActivity) {
      console.log(`  ✅ Webhook Activity Found:`);
      console.log(`     Type: ${appActivity.type}`);
      console.log(`     Subject: ${appActivity.subject}`);
      console.log(`     Content: ${appActivity.content}`);
      console.log(`     Created: ${appActivity.createdAt.toLocaleString()}`);
      console.log(`     Metadata:`, appActivity.metadata);
    } else {
      console.log(`  ❌ NO webhook activity found`);
    }
    console.log();
  }

  // Check 3: Issues
  console.log("\n" + "=".repeat(80));
  console.log("3. POTENTIAL ISSUES");
  console.log("-".repeat(80));

  const issues = [];

  // Issue: APPLICATION_STARTED without applicationStartedAt
  const corruptedLeads = appStartedLeads.filter(l => !l.applicationStartedAt);
  if (corruptedLeads.length > 0) {
    issues.push({
      type: "Data Corruption",
      count: corruptedLeads.length,
      description: "Leads have APPLICATION_STARTED status but applicationStartedAt is NULL",
      leads: corruptedLeads.map(l => `${l.firstName} ${l.lastName} (${l.id})`),
    });
  }

  // Issue: APPLICATION_STARTED without webhook activity
  const noWebhookActivity = appStartedLeads.filter(l => {
    return !l.activities.some(a =>
      a.content?.toLowerCase().includes("finmo") ||
      a.metadata && JSON.stringify(a.metadata).toLowerCase().includes("finmo")
    );
  });
  if (noWebhookActivity.length > 0) {
    issues.push({
      type: "Missing Webhook Activity",
      count: noWebhookActivity.length,
      description: "APPLICATION_STARTED leads with no Finmo webhook activity logged",
      leads: noWebhookActivity.map(l => `${l.firstName} ${l.lastName} (${l.id})`),
    });
  }

  // Issue: CONVERTED without applicationCompletedAt
  const noCompletionDate = convertedLeads.filter(l => !l.applicationCompletedAt);
  if (noCompletionDate.length > 0) {
    issues.push({
      type: "Missing Completion Date",
      count: noCompletionDate.length,
      description: "CONVERTED leads without applicationCompletedAt timestamp",
      leads: noCompletionDate.map(l => `${l.firstName} ${l.lastName} (${l.id})`),
    });
  }

  if (issues.length === 0) {
    console.log("✅ NO ISSUES FOUND - All webhooks working properly");
  } else {
    issues.forEach((issue, i) => {
      console.log(`\n❌ ISSUE ${i + 1}: ${issue.type}`);
      console.log(`   Count: ${issue.count}`);
      console.log(`   Description: ${issue.description}`);
      console.log(`   Affected Leads:`);
      issue.leads.forEach(lead => console.log(`     - ${lead}`));
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("4. WEBHOOK ENDPOINTS");
  console.log("-".repeat(80));
  console.log("\nFinmo should be configured to send webhooks to:");
  console.log("  Started:   https://lod2.vercel.app/api/webhooks/finmo/started");
  console.log("  Submitted: https://lod2.vercel.app/api/webhooks/finmo/submitted");
  console.log("\n(Legacy endpoint: /api/webhooks/finmo - still exists but not recommended)");

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`APPLICATION_STARTED leads: ${appStartedLeads.length}`);
  console.log(`CONVERTED leads: ${convertedLeads.length}`);
  console.log(`Issues found: ${issues.length}`);
  console.log();

  await prisma.$disconnect();
}

checkFinmoWebhooks().catch(console.error);
