/**
 * Look up a specific lead by name
 * Usage: npx tsx scripts/lookup-lead.ts "Debera Cannan"
 */

import { prisma } from "../lib/db";

async function lookupLead(nameQuery: string) {
  const parts = nameQuery.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";

  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { firstName: { contains: firstName, mode: "insensitive" } },
        { lastName: { contains: lastName || firstName, mode: "insensitive" } },
        { email: { contains: nameQuery.split(" ")[0], mode: "insensitive" } },
      ],
    },
    include: {
      communications: { orderBy: { createdAt: "desc" } },
      appointments: { orderBy: { scheduledAt: "desc" } },
      callOutcomes: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 10 },
      notes: { orderBy: { createdAt: "desc" }, take: 5 },
      tasks: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter to closer matches if we have first+last
  const filtered =
    firstName && lastName
      ? leads.filter(
          (l) =>
            l.firstName.toLowerCase().includes(firstName.toLowerCase()) &&
            l.lastName.toLowerCase().includes(lastName.toLowerCase())
        )
      : leads;

  const toShow = filtered.length > 0 ? filtered : leads;

  console.log("=".repeat(80));
  console.log(`LEAD LOOKUP: "${nameQuery}"`);
  console.log("=".repeat(80));
  if (toShow.length === 0) {
    console.log("❌ No leads found");
    await prisma.$disconnect();
    return;
  }

  for (const lead of toShow) {
    console.log(`\n📋 ${lead.firstName} ${lead.lastName}`);
    console.log(`   Email: ${lead.email}`);
    console.log(`   Phone: ${lead.phone || "—"}`);
    console.log(`   Status: ${lead.status}`);
    console.log(`   Holly: ${lead.hollyDisabled ? "🔕 Disabled" : "✅ Active"}`);
    console.log(`   Managed by Autonomous: ${lead.managedByAutonomous}`);
    console.log(`   Created: ${lead.createdAt.toLocaleString("en-US", { timeZone: "America/Vancouver" })}`);
    console.log(`   Last Contacted: ${lead.lastContactedAt?.toLocaleString("en-US", { timeZone: "America/Vancouver" }) || "Never"}`);
    console.log(`   Source: ${lead.source || "—"}`);
    if (lead.rawData && typeof lead.rawData === "object") {
      const raw = lead.rawData as Record<string, unknown>;
      if (Object.keys(raw).length > 0) {
        console.log(`   Raw data keys: ${Object.keys(raw).join(", ")}`);
      }
    }

    if (lead.notes.length > 0) {
      console.log(`\n   📝 Notes:`);
      lead.notes.forEach((n) => {
        console.log(`      ${n.createdAt.toLocaleString()}: ${(n.content || "").substring(0, 120)}${(n.content || "").length > 120 ? "..." : ""}`);
      });
    }

    if (lead.communications.length > 0) {
      console.log(`\n   💬 Recent Communications (${lead.communications.length} total):`);
      lead.communications.slice(0, 8).forEach((c) => {
        const dir = c.direction === "OUTBOUND" ? "→" : "←";
        const chan = c.channel || "SMS";
        console.log(`      ${dir} [${chan}] ${c.createdAt.toLocaleString()}`);
        console.log(`         "${(c.content || "").substring(0, 100)}${(c.content || "").length > 100 ? "..." : ""}"`);
      });
    }

    if (lead.appointments.length > 0) {
      console.log(`\n   📅 Appointments:`);
      lead.appointments.forEach((a) => {
        console.log(`      ${a.status} - ${a.scheduledFor?.toLocaleString() || a.scheduledAt.toLocaleString()}`);
      });
    }

    if (lead.activities.length > 0) {
      console.log(`\n   📊 Recent Activities:`);
      lead.activities.slice(0, 5).forEach((a) => {
        console.log(`      ${a.type}: ${(a.content || "").substring(0, 60)} (${a.createdAt.toLocaleString()})`);
      });
    }
  }

  await prisma.$disconnect();
}

const name = process.argv[2] || "Debera Cannan";
lookupLead(name).catch(console.error);
