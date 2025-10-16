/**
 * CHECK USER-MENTIONED LEADS
 * Leads that should have follow-ups but don't:
 * - Tina Dixon (Oct 12)
 * - Vinay Punjabi (Oct 12, 11:23am)
 * - Robert Grant (Oct 15, 10:30pm)
 * - John Alolar (Oct 11, 10:30am)
 * - Gabriel Lastchuck (Oct 11)
 * - Andrew VanSickle (Oct 11, 7am)
 */

import { prisma } from "../lib/db";

async function checkMentionedLeads() {
  console.log("=".repeat(80));
  console.log("CHECKING USER-MENTIONED LEADS");
  console.log("Time:", new Date().toLocaleString('en-US', { timeZone: 'America/Vancouver' }), "PT");
  console.log("=".repeat(80));
  console.log();

  const leadNames = [
    "Tina Dixon",
    "Vinay Punjabi",
    "Robert Grant",
    "John Alolar",
    "Gabriel Lastchuck",
    "Andrew VanSickle",
    "Andrew Vansickle",
  ];

  for (const fullName of leadNames) {
    const [firstName, ...lastNameParts] = fullName.split(" ");
    const lastName = lastNameParts.join(" ");

    console.log("\n" + "=".repeat(80));
    console.log(`SEARCHING FOR: ${fullName}`);
    console.log("=".repeat(80));

    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          {
            AND: [
              { firstName: { contains: firstName, mode: "insensitive" } },
              lastName ? { lastName: { contains: lastName, mode: "insensitive" } } : {},
            ],
          },
          { email: { contains: firstName.toLowerCase() } },
        ],
      },
      include: {
        communications: {
          orderBy: { createdAt: "desc" },
          take: 15,
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
      take: 3,
    });

    if (leads.length === 0) {
      console.log("❌ NOT FOUND\n");
      continue;
    }

    for (const lead of leads) {
      const now = new Date();
      const hoursSinceCreated = Math.floor((now.getTime() - lead.createdAt.getTime()) / 3600000);
      const hoursSinceContact = lead.lastContactedAt
        ? Math.floor((now.getTime() - lead.lastContactedAt.getTime()) / 3600000)
        : hoursSinceCreated;
      const daysSinceContact = Math.floor(hoursSinceContact / 24);

      const outbound = lead.communications.filter(c => c.direction === "OUTBOUND");
      const inbound = lead.communications.filter(c => c.direction === "INBOUND");

      console.log(`\n✅ FOUND: ${lead.firstName} ${lead.lastName}`);
      console.log(`   Email: ${lead.email}`);
      console.log(`   Phone: ${lead.phone}`);
      console.log(`   Status: ${lead.status}`);
      console.log(`   Created: ${lead.createdAt.toLocaleString()} (${hoursSinceCreated}h ago)`);
      console.log(`   Last Contact: ${lead.lastContactedAt?.toLocaleString() || "NEVER"} (${hoursSinceContact}h ago)`);
      console.log(`   Days Since Contact: ${daysSinceContact}`);
      console.log(`   Messages: ${outbound.length} out, ${inbound.length} in`);
      console.log(`   Has Replied: ${inbound.length > 0 ? "YES" : "NO"}`);
      console.log(`   Has Appointment: ${lead.appointments.length > 0 ? "YES" : "NO"}`);
      console.log(`   Consent SMS: ${lead.consentSms ? "YES" : "NO"}`);

      if (lead.callOutcomes.length > 0) {
        const outcome = lead.callOutcomes[0];
        console.log(`   Recent Call Outcome: ${outcome.outcome} by ${outcome.advisorName} (${outcome.createdAt.toLocaleString()})`);
      }

      // Analyze why no follow-up
      console.log(`\n   📊 AUTOMATION ANALYSIS:`);

      // Check 1: Consent
      if (!lead.consentSms) {
        console.log(`   ❌ SKIP REASON: No SMS consent`);
        continue;
      }

      // Check 2: Status
      if (!["CONTACTED", "ENGAGED", "NURTURING"].includes(lead.status)) {
        console.log(`   ❌ SKIP REASON: Status is ${lead.status} (not in CONTACTED/ENGAGED/NURTURING)`);
        continue;
      }

      // Check 3: Appointment
      if (lead.appointments.length > 0) {
        console.log(`   ⚠️  HAS APPOINTMENT: Should be handled by appointment reminders, not follow-ups`);
      }

      // Check 4: Recent call outcome
      if (lead.callOutcomes.length > 0) {
        const outcome = lead.callOutcomes[0];
        const hoursSinceCall = Math.floor(
          (now.getTime() - outcome.createdAt.getTime()) / 3600000
        );
        if (hoursSinceCall < 48) {
          console.log(`   ⚠️  RECENT CALL (${hoursSinceCall}h ago): Outcome = ${outcome.outcome}`);
          if (outcome.outcome === "FOLLOW_UP_SOON") {
            console.log(`       Waiting 48h before resuming automation`);
          }
        }
      }

      // Check 5: Should get follow-up based on schedule
      let shouldFollowUp = false;
      let reason = "";

      if (daysSinceContact === 0) {
        if (outbound.length === 1 && hoursSinceContact >= 6) {
          shouldFollowUp = true;
          reason = "Day 1: 6+ hours, only 1 message";
        } else {
          reason = `Day 1: ${hoursSinceContact}h < 6h minimum OR already sent ${outbound.length} messages`;
        }
      } else if (daysSinceContact === 1) {
        if (outbound.length <= 2) {
          shouldFollowUp = true;
          reason = "Day 2: Should get check-in";
        }
      } else if (daysSinceContact === 2) {
        if (outbound.length <= 2) {
          shouldFollowUp = true;
          reason = "Day 3: Should get follow-up";
        }
      } else if (daysSinceContact === 3 || daysSinceContact === 4) {
        if (outbound.length <= 3) {
          shouldFollowUp = true;
          reason = `Day ${daysSinceContact + 1}: Should get mid-week follow-up`;
        }
      } else if (daysSinceContact >= 5) {
        if (outbound.length <= 4) {
          shouldFollowUp = true;
          reason = `Day ${daysSinceContact + 1}: Should get week-end push`;
        }
      }

      if (shouldFollowUp) {
        console.log(`   🚨 SHOULD HAVE FOLLOW-UP: ${reason}`);
        console.log(`   ❓ WHY NO MESSAGE?: Checking recent automation...`);

        // Check if 4h minimum gap enforced
        const hoursSinceLastOut = outbound[0]
          ? Math.floor((now.getTime() - outbound[0].createdAt.getTime()) / 3600000)
          : 999;
        if (hoursSinceLastOut < 4) {
          console.log(`   ⏰ 4-HOUR GAP: Last message ${hoursSinceLastOut}h ago (< 4h minimum)`);
        } else {
          console.log(`   ⚠️  BUG?: Last message ${hoursSinceLastOut}h ago (>= 4h), should have gotten follow-up`);
        }
      } else {
        console.log(`   ✅ NO FOLLOW-UP NEEDED YET: ${reason}`);
      }

      // Show recent messages
      console.log(`\n   📨 RECENT MESSAGES (last ${Math.min(5, lead.communications.length)}):`);
      lead.communications.slice(0, 5).forEach((comm, i) => {
        console.log(`   ${i + 1}. [${comm.direction}] [${comm.channel}] ${comm.createdAt.toLocaleString()}`);
        console.log(`      "${comm.content.substring(0, 80)}${comm.content.length > 80 ? "..." : ""}"`);
      });
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log("\nAll checks complete. See above for detailed analysis of each lead.");

  await prisma.$disconnect();
}

checkMentionedLeads().catch(console.error);
