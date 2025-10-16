/**
 * CHECK SPECIFIC PROBLEM LEADS
 * Read-only analysis of Milo Anstey, Andrew Van Sickle, and recently created leads
 */

import { prisma } from "../lib/db";

async function checkSpecificLeads() {
  console.log("=".repeat(80));
  console.log("SPECIFIC LEAD INVESTIGATION");
  console.log("Time:", new Date().toLocaleString('en-US', { timeZone: 'America/Vancouver' }), "PT");
  console.log("=".repeat(80));
  console.log();

  // Search for Milo Anstey
  const milo = await prisma.lead.findMany({
    where: {
      OR: [
        { firstName: { contains: "Milo", mode: "insensitive" } },
        { email: { contains: "milo", mode: "insensitive" } },
      ],
    },
    include: {
      communications: {
        orderBy: { createdAt: "desc" },
      },
      appointments: true,
      callOutcomes: true,
      activities: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  // Search for Andrew Van Sickle
  const andrew = await prisma.lead.findMany({
    where: {
      OR: [
        { firstName: { contains: "Andrew", mode: "insensitive" } },
        { lastName: { contains: "Van", mode: "insensitive" } },
        { lastName: { contains: "Sickle", mode: "insensitive" } },
        { email: { contains: "andrew", mode: "insensitive" } },
      ],
    },
    include: {
      communications: {
        orderBy: { createdAt: "desc" },
      },
      appointments: true,
      callOutcomes: true,
      activities: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  // Get all leads from last 48 hours
  const twoDaysAgo = new Date(Date.now() - 48 * 3600000);
  const recentLeads = await prisma.lead.findMany({
    where: {
      createdAt: { gte: twoDaysAgo },
      status: { notIn: ["LOST", "CONVERTED", "DEALS_WON"] },
    },
    include: {
      communications: {
        orderBy: { createdAt: "desc" },
      },
      appointments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log("\n" + "=".repeat(80));
  console.log("LEAD: MILO ANSTEY");
  console.log("=".repeat(80));
  if (milo.length === 0) {
    console.log("❌ NOT FOUND in database");
  } else {
    milo.forEach(lead => {
      console.log(`\nName: ${lead.firstName} ${lead.lastName}`);
      console.log(`Email: ${lead.email}`);
      console.log(`Phone: ${lead.phone}`);
      console.log(`Status: ${lead.status}`);
      console.log(`Created: ${lead.createdAt.toLocaleString()}`);
      console.log(`Last Contacted: ${lead.lastContactedAt?.toLocaleString() || "NEVER"}`);
      console.log(`\nCommunications (${lead.communications.length} total):`);
      lead.communications.forEach((comm, i) => {
        console.log(`  ${i + 1}. [${comm.direction}] [${comm.channel}] ${comm.createdAt.toLocaleString()}`);
        console.log(`     "${comm.content.substring(0, 100)}${comm.content.length > 100 ? "..." : ""}"`);
      });
      if (lead.activities.length > 0) {
        console.log(`\nRecent Activities:`);
        lead.activities.forEach(act => {
          console.log(`  - ${act.type}: ${act.content?.substring(0, 80) || "N/A"} (${act.createdAt.toLocaleString()})`);
        });
      }
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("LEAD: ANDREW VAN SICKLE");
  console.log("=".repeat(80));
  if (andrew.length === 0) {
    console.log("❌ NOT FOUND in database");
  } else {
    andrew.forEach(lead => {
      console.log(`\nName: ${lead.firstName} ${lead.lastName}`);
      console.log(`Email: ${lead.email}`);
      console.log(`Phone: ${lead.phone}`);
      console.log(`Status: ${lead.status}`);
      console.log(`Created: ${lead.createdAt.toLocaleString()}`);
      console.log(`Last Contacted: ${lead.lastContactedAt?.toLocaleString() || "NEVER"}`);
      console.log(`\nCommunications (${lead.communications.length} total):`);
      lead.communications.forEach((comm, i) => {
        console.log(`  ${i + 1}. [${comm.direction}] [${comm.channel}] ${comm.createdAt.toLocaleString()}`);
        console.log(`     "${comm.content.substring(0, 100)}${comm.content.length > 100 ? "..." : ""}"`);
      });
      if (lead.activities.length > 0) {
        console.log(`\nRecent Activities:`);
        lead.activities.forEach(act => {
          console.log(`  - ${act.type}: ${act.content?.substring(0, 80) || "N/A"} (${act.createdAt.toLocaleString()})`);
        });
      }

      // Check for "email" mention
      const askedForEmail = lead.communications.some(c =>
        c.direction === "INBOUND" &&
        (c.content.toLowerCase().includes("email") || c.content.toLowerCase().includes("e-mail"))
      );
      const sentEmail = lead.communications.some(c =>
        c.direction === "OUTBOUND" && c.channel === "EMAIL"
      );
      console.log(`\n❓ Asked for email: ${askedForEmail ? "YES" : "NO"}`);
      console.log(`❓ Sent email: ${sentEmail ? "YES" : "NO"}`);
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("ALL LEADS FROM LAST 48 HOURS");
  console.log("=".repeat(80));
  console.log(`Found ${recentLeads.length} leads created in last 48 hours\n`);

  const now = new Date();
  recentLeads.forEach(lead => {
    const hoursSinceCreated = Math.floor((now.getTime() - lead.createdAt.getTime()) / 3600000);
    const hoursSinceContact = lead.lastContactedAt
      ? Math.floor((now.getTime() - lead.lastContactedAt.getTime()) / 3600000)
      : hoursSinceCreated;

    const outboundCount = lead.communications.filter(c => c.direction === "OUTBOUND").length;
    const inboundCount = lead.communications.filter(c => c.direction === "INBOUND").length;
    const hasAppointment = lead.appointments.length > 0;

    console.log(`${lead.firstName} ${lead.lastName} (${lead.status})`);
    console.log(`  Created: ${lead.createdAt.toLocaleString()} (${hoursSinceCreated}h ago)`);
    console.log(`  Last Contact: ${lead.lastContactedAt?.toLocaleString() || "NEVER"} (${hoursSinceContact}h ago)`);
    console.log(`  Messages: ${outboundCount} out, ${inboundCount} in`);
    console.log(`  Appointment: ${hasAppointment ? "YES" : "NO"}`);

    if (lead.communications.length > 0) {
      const lastComm = lead.communications[0];
      console.log(`  Last message: [${lastComm.direction}] "${lastComm.content.substring(0, 60)}..." (${lastComm.createdAt.toLocaleString()})`);
    }
    console.log();
  });

  await prisma.$disconnect();
}

checkSpecificLeads().catch(console.error);
