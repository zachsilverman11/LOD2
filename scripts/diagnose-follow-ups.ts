/**
 * READ-ONLY DIAGNOSTIC SCRIPT
 *
 * This script analyzes why leads aren't getting follow-ups.
 * NO DATABASE UPDATES - READ ONLY
 */

import { prisma } from "../lib/db";

async function diagnoseFollowUps() {
  console.log("=".repeat(80));
  console.log("HOLLY FOLLOW-UP DIAGNOSTIC REPORT");
  console.log("Time:", new Date().toLocaleString('en-US', { timeZone: 'America/Vancouver' }), "PT");
  console.log("=".repeat(80));
  console.log();

  // Get all CONTACTED, ENGAGED, NURTURING leads
  const leads = await prisma.lead.findMany({
    where: {
      status: {
        in: ["CONTACTED", "ENGAGED", "NURTURING"],
      },
      consentSms: true,
    },
    include: {
      communications: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      appointments: {
        where: {
          status: { in: ["scheduled", "SCHEDULED", "CONFIRMED"] },
        },
      },
      callOutcomes: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: {
      lastContactedAt: "asc", // Oldest first = most urgent
    },
  });

  console.log(`Found ${leads.length} leads in CONTACTED/ENGAGED/NURTURING with SMS consent\n`);

  const now = new Date();
  const issues = {
    hasAppointmentButGettingMessages: [],
    askedForEmailNoResponse: [],
    manualMessageNotTracked: [],
    longSilence: [],
    backToBackMessages: [],
    wrongStage: [],
  };

  for (const lead of leads) {
    const name = `${lead.firstName} ${lead.lastName}`;
    const hoursSinceContact = lead.lastContactedAt
      ? Math.floor((now.getTime() - lead.lastContactedAt.getTime()) / 3600000)
      : Math.floor((now.getTime() - lead.createdAt.getTime()) / 3600000);

    const daysSinceContact = Math.floor(hoursSinceContact / 24);

    const outboundMessages = lead.communications.filter(c => c.direction === "OUTBOUND");
    const inboundMessages = lead.communications.filter(c => c.direction === "INBOUND");

    const lastOutbound = outboundMessages[0];
    const lastInbound = inboundMessages[0];
    const hasReplied = inboundMessages.length > 0;

    // Check for specific issues

    // Issue 1: Has appointment but still getting messages
    if (lead.appointments.length > 0 && lead.status !== "CALL_SCHEDULED") {
      issues.hasAppointmentButGettingMessages.push({
        name,
        id: lead.id,
        status: lead.status,
        appointmentTime: lead.appointments[0].scheduledFor || lead.appointments[0].scheduledAt,
        lastMessage: lastOutbound?.createdAt,
        shouldBe: "CALL_SCHEDULED",
      });
    }

    // Issue 2: Asked for email, didn't get it
    const askedForEmail = lead.communications.some(c =>
      c.direction === "INBOUND" &&
      (c.content.toLowerCase().includes("email") || c.content.toLowerCase().includes("e-mail"))
    );
    const sentEmail = lead.communications.some(c =>
      c.direction === "OUTBOUND" && c.channel === "EMAIL"
    );
    if (askedForEmail && !sentEmail && hoursSinceContact > 24) {
      issues.askedForEmailNoResponse.push({
        name,
        id: lead.id,
        askedWhen: lead.communications.find(c =>
          c.direction === "INBOUND" &&
          (c.content.toLowerCase().includes("email") || c.content.toLowerCase().includes("e-mail"))
        )?.createdAt,
        lastContact: lead.lastContactedAt,
        hoursAgo: hoursSinceContact,
      });
    }

    // Issue 3: Long silence (should have follow-up by now)
    const shouldHaveFollowUp = (
      (daysSinceContact === 0 && hoursSinceContact >= 6 && outboundMessages.length === 1) ||
      (daysSinceContact === 1 && outboundMessages.length <= 2) ||
      (daysSinceContact === 2 && outboundMessages.length <= 2) ||
      (daysSinceContact >= 3 && daysSinceContact <= 4 && outboundMessages.length <= 3) ||
      (daysSinceContact >= 5 && daysSinceContact <= 6 && outboundMessages.length <= 4)
    );

    if (shouldHaveFollowUp && hoursSinceContact >= 4) {
      issues.longSilence.push({
        name,
        id: lead.id,
        status: lead.status,
        daysSinceContact,
        hoursSinceContact,
        outboundCount: outboundMessages.length,
        lastMessage: lastOutbound?.createdAt,
        lastMessageContent: lastOutbound?.content.substring(0, 50) + "...",
        hasReplied,
      });
    }

    // Issue 4: Back-to-back messages (within 1 hour)
    if (outboundMessages.length >= 2) {
      const timeBetween = Math.abs(
        outboundMessages[0].createdAt.getTime() - outboundMessages[1].createdAt.getTime()
      ) / 60000; // minutes
      if (timeBetween < 60) {
        issues.backToBackMessages.push({
          name,
          id: lead.id,
          message1: outboundMessages[0].content.substring(0, 50),
          message2: outboundMessages[1].content.substring(0, 50),
          minutesApart: Math.floor(timeBetween),
        });
      }
    }

    // Issue 5: Wrong stage (has replied but still CONTACTED)
    if (lead.status === "CONTACTED" && hasReplied) {
      issues.wrongStage.push({
        name,
        id: lead.id,
        currentStage: "CONTACTED",
        shouldBe: "ENGAGED",
        repliedAt: lastInbound?.createdAt,
        repliedWith: lastInbound?.content.substring(0, 50),
      });
    }
  }

  // Print results
  console.log("\n" + "=".repeat(80));
  console.log("ISSUE 1: HAS APPOINTMENT BUT STILL GETTING BOOKING MESSAGES");
  console.log("=".repeat(80));
  if (issues.hasAppointmentButGettingMessages.length === 0) {
    console.log("✅ No issues found");
  } else {
    console.log(`❌ Found ${issues.hasAppointmentButGettingMessages.length} leads with this issue:\n`);
    issues.hasAppointmentButGettingMessages.forEach(issue => {
      console.log(`  ${issue.name} (${issue.id})`);
      console.log(`    Current Status: ${issue.status} (should be ${issue.shouldBe})`);
      console.log(`    Appointment: ${issue.appointmentTime.toLocaleString()}`);
      console.log(`    Last Message: ${issue.lastMessage?.toLocaleString() || "N/A"}`);
      console.log();
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("ISSUE 2: ASKED FOR EMAIL, DIDN'T RECEIVE IT");
  console.log("=".repeat(80));
  if (issues.askedForEmailNoResponse.length === 0) {
    console.log("✅ No issues found");
  } else {
    console.log(`❌ Found ${issues.askedForEmailNoResponse.length} leads with this issue:\n`);
    issues.askedForEmailNoResponse.forEach(issue => {
      console.log(`  ${issue.name} (${issue.id})`);
      console.log(`    Asked for email: ${issue.askedWhen?.toLocaleString() || "N/A"}`);
      console.log(`    Last contact: ${issue.lastContact?.toLocaleString() || "N/A"}`);
      console.log(`    Hours ago: ${issue.hoursAgo}`);
      console.log();
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("ISSUE 3: LONG SILENCE (SHOULD HAVE FOLLOW-UP)");
  console.log("=".repeat(80));
  if (issues.longSilence.length === 0) {
    console.log("✅ No issues found");
  } else {
    console.log(`❌ Found ${issues.longSilence.length} leads with this issue:\n`);
    issues.longSilence.forEach(issue => {
      console.log(`  ${issue.name} (${issue.id})`);
      console.log(`    Status: ${issue.status}`);
      console.log(`    Days since contact: ${issue.daysSinceContact} (${issue.hoursSinceContact}h)`);
      console.log(`    Outbound messages: ${issue.outboundCount}`);
      console.log(`    Last message: ${issue.lastMessage?.toLocaleString() || "N/A"}`);
      console.log(`    Last message text: "${issue.lastMessageContent}"`);
      console.log(`    Has replied: ${issue.hasReplied ? "Yes" : "No"}`);
      console.log();
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("ISSUE 4: BACK-TO-BACK MESSAGES (DOUBLE-TEXTING)");
  console.log("=".repeat(80));
  if (issues.backToBackMessages.length === 0) {
    console.log("✅ No issues found");
  } else {
    console.log(`❌ Found ${issues.backToBackMessages.length} leads with this issue:\n`);
    issues.backToBackMessages.forEach(issue => {
      console.log(`  ${issue.name} (${issue.id})`);
      console.log(`    Message 1: "${issue.message1}"`);
      console.log(`    Message 2: "${issue.message2}"`);
      console.log(`    Time apart: ${issue.minutesApart} minutes`);
      console.log();
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("ISSUE 5: WRONG PIPELINE STAGE");
  console.log("=".repeat(80));
  if (issues.wrongStage.length === 0) {
    console.log("✅ No issues found");
  } else {
    console.log(`❌ Found ${issues.wrongStage.length} leads with this issue:\n`);
    issues.wrongStage.forEach(issue => {
      console.log(`  ${issue.name} (${issue.id})`);
      console.log(`    Current: ${issue.currentStage} → Should be: ${issue.shouldBe}`);
      console.log(`    Replied at: ${issue.repliedAt?.toLocaleString() || "N/A"}`);
      console.log(`    Replied with: "${issue.repliedWith}"`);
      console.log();
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total leads analyzed: ${leads.length}`);
  console.log(`Has appointment but getting messages: ${issues.hasAppointmentButGettingMessages.length}`);
  console.log(`Asked for email, didn't get it: ${issues.askedForEmailNoResponse.length}`);
  console.log(`Long silence (needs follow-up): ${issues.longSilence.length}`);
  console.log(`Back-to-back messages: ${issues.backToBackMessages.length}`);
  console.log(`Wrong pipeline stage: ${issues.wrongStage.length}`);
  console.log();

  await prisma.$disconnect();
}

diagnoseFollowUps().catch(console.error);
