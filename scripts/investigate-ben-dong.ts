/**
 * INVESTIGATION: Ben Dong Issues
 *
 * Issue 1: Started application but didn't move to APPLICATION_STARTED status
 * Issue 2: Got two repeat texts 3 minutes apart
 * Issue 3: Post-call message is generic "great call with Greg" instead of using call context
 */

import { prisma } from "../lib/db";

async function investigateBenDong() {
  console.log("=".repeat(80));
  console.log("BEN DONG INVESTIGATION");
  console.log("Time:", new Date().toLocaleString('en-US', { timeZone: 'America/Vancouver' }), "PT");
  console.log("=".repeat(80));
  console.log();

  const ben = await prisma.lead.findFirst({
    where: {
      firstName: { contains: "Ben", mode: "insensitive" },
      lastName: { contains: "Dong", mode: "insensitive" },
    },
    include: {
      communications: {
        orderBy: { createdAt: "asc" },
      },
      activities: {
        orderBy: { createdAt: "asc" },
      },
      callOutcomes: {
        orderBy: { createdAt: "desc" },
      },
      appointments: true,
    },
  });

  if (!ben) {
    console.log("❌ Ben Dong not found");
    await prisma.$disconnect();
    return;
  }

  console.log("BASIC INFO:");
  console.log("-----------");
  console.log(`Name: ${ben.firstName} ${ben.lastName}`);
  console.log(`Email: ${ben.email}`);
  console.log(`Phone: ${ben.phone}`);
  console.log(`Status: ${ben.status}`);
  console.log(`Created: ${ben.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' })}`);
  console.log(`Application Started At: ${ben.applicationStartedAt?.toLocaleString('en-US', { timeZone: 'America/Vancouver' }) || "NULL"}`);
  console.log(`Application Completed At: ${ben.applicationCompletedAt?.toLocaleString('en-US', { timeZone: 'America/Vancouver' }) || "NULL"}`);
  console.log();

  // ISSUE 1: Application started but status not updated
  console.log("=".repeat(80));
  console.log("ISSUE 1: APPLICATION STARTED BUT STATUS NOT UPDATED");
  console.log("=".repeat(80));
  console.log();

  const appStartedActivity = ben.activities.find(a =>
    a.type === "NOTE_ADDED" &&
    a.content?.includes("application")
  );

  if (appStartedActivity) {
    console.log("✅ Found application.started event:");
    console.log(`   Type: ${appStartedActivity.type}`);
    console.log(`   Content: ${appStartedActivity.content}`);
    console.log(`   Created: ${appStartedActivity.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' })}`);
    console.log(`   Metadata:`, JSON.stringify(appStartedActivity.metadata, null, 2));
    console.log();
  }

  console.log("Current Status in Database:");
  console.log(`   status: "${ben.status}"`);
  console.log(`   applicationStartedAt: ${ben.applicationStartedAt ? ben.applicationStartedAt.toISOString() : "NULL"}`);
  console.log();

  if (ben.applicationStartedAt && ben.status !== "APPLICATION_STARTED") {
    console.log("🚨 BUG CONFIRMED:");
    console.log(`   applicationStartedAt is SET (${ben.applicationStartedAt.toISOString()})`);
    console.log(`   but status is "${ben.status}" instead of "APPLICATION_STARTED"`);
    console.log();
  }

  // ISSUE 2: Duplicate messages 3 minutes apart
  console.log("=".repeat(80));
  console.log("ISSUE 2: DUPLICATE MESSAGES");
  console.log("=".repeat(80));
  console.log();

  console.log("ALL COMMUNICATIONS (chronological):");
  console.log();

  let lastOutbound: any = null;
  let duplicates: any[] = [];

  ben.communications.forEach((comm, i) => {
    console.log(`${i + 1}. [${comm.direction}] [${comm.channel}] ${comm.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' })}`);
    console.log(`   Content: "${comm.content.substring(0, 100)}${comm.content.length > 100 ? "..." : ""}"`);

    if (comm.metadata) {
      console.log(`   Metadata:`, JSON.stringify(comm.metadata, null, 2));
    }

    // Check for duplicates
    if (comm.direction === "OUTBOUND" && lastOutbound) {
      const timeDiff = Math.abs(comm.createdAt.getTime() - lastOutbound.createdAt.getTime()) / 60000; // minutes
      if (timeDiff <= 5) {
        console.log(`   ⚠️  ONLY ${timeDiff.toFixed(1)} MINUTES after previous outbound message`);
        duplicates.push({
          msg1: lastOutbound,
          msg2: comm,
          minutesApart: timeDiff,
        });
      }
    }

    if (comm.direction === "OUTBOUND") {
      lastOutbound = comm;
    }

    console.log();
  });

  if (duplicates.length > 0) {
    console.log("🚨 DUPLICATES FOUND:");
    duplicates.forEach((dup, i) => {
      console.log(`\nDuplicate ${i + 1}:`);
      console.log(`  Time apart: ${dup.minutesApart.toFixed(1)} minutes`);
      console.log(`  Message 1: "${dup.msg1.content.substring(0, 80)}"`);
      console.log(`  Message 2: "${dup.msg2.content.substring(0, 80)}"`);
      console.log(`  Same content? ${dup.msg1.content === dup.msg2.content ? "YES" : "NO"}`);
    });
    console.log();
  }

  // ISSUE 3: Post-call message quality
  console.log("=".repeat(80));
  console.log("ISSUE 3: POST-CALL MESSAGE QUALITY");
  console.log("=".repeat(80));
  console.log();

  const callOutcome = ben.callOutcomes[0];
  if (callOutcome) {
    console.log("CALL OUTCOME DATA:");
    console.log(`  Advisor: ${callOutcome.advisorName}`);
    console.log(`  Outcome: ${callOutcome.outcome}`);
    console.log(`  Reached: ${callOutcome.reached}`);
    console.log(`  Lead Quality: ${callOutcome.leadQuality || "Not set"}`);
    console.log(`  Timestamp: ${callOutcome.createdAt.toLocaleString('en-US', { timeZone: 'America/Vancouver' })}`);
    console.log(`  Notes: ${callOutcome.notes || "No notes"}`);
    console.log();

    // Find post-call messages
    const postCallMessages = ben.communications.filter(c =>
      c.direction === "OUTBOUND" &&
      c.createdAt > callOutcome.createdAt
    );

    if (postCallMessages.length > 0) {
      console.log("POST-CALL MESSAGES:");
      postCallMessages.forEach((msg, i) => {
        const minutesAfterCall = Math.floor(
          (msg.createdAt.getTime() - callOutcome.createdAt.getTime()) / 60000
        );
        console.log(`\n  Message ${i + 1} (${minutesAfterCall} minutes after call):`);
        console.log(`  Content: "${msg.content}"`);
        console.log(`  Reasoning: ${msg.metadata?.aiReasoning || "No reasoning"}`);
      });
      console.log();

      // Analyze quality
      console.log("MESSAGE QUALITY ANALYSIS:");
      postCallMessages.forEach((msg, i) => {
        const hasGenericGreatCall = msg.content.toLowerCase().includes("great call");
        const mentionsAdvisorName = msg.content.includes(callOutcome.advisorName || "");
        const usesCallNotes = callOutcome.notes && msg.content.toLowerCase().includes(
          callOutcome.notes.toLowerCase().split(" ").slice(0, 3).join(" ")
        );

        console.log(`\n  Message ${i + 1}:`);
        console.log(`    ❓ Generic "great call"? ${hasGenericGreatCall ? "YES ❌" : "NO ✅"}`);
        console.log(`    ❓ Mentions advisor? ${mentionsAdvisorName ? "YES ✅" : "NO ❌"}`);
        console.log(`    ❓ Uses call notes? ${usesCallNotes ? "YES ✅" : "NO ❌"}`);

        if (hasGenericGreatCall && !usesCallNotes) {
          console.log(`    🚨 PROBLEM: Generic message, not using call context`);
        }
      });
    } else {
      console.log("⚠️  No post-call messages found");
    }
  } else {
    console.log("⚠️  No call outcomes found");
  }

  console.log();
  console.log("=".repeat(80));
  console.log("INVESTIGATION COMPLETE");
  console.log("=".repeat(80));

  await prisma.$disconnect();
}

investigateBenDong().catch(console.error);
