import { PrismaClient } from "./app/generated/prisma";
import { handleConversation, executeDecision } from "./lib/ai-conversation-enhanced";
import { sendSlackNotification } from "./lib/slack";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  console.log("=== FIXING LEADS WITH CANCELLED APPOINTMENTS ===\n");

  // Find leads that are stuck in CALL_SCHEDULED with cancelled appointments
  const leads = await prisma.lead.findMany({
    where: {
      status: "CALL_SCHEDULED",
      appointments: {
        some: {
          status: "cancelled"
        }
      }
    },
    include: {
      appointments: {
        where: { status: "cancelled" },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  console.log(`Found ${leads.length} leads stuck in CALL_SCHEDULED with cancelled appointments\n`);

  for (const lead of leads) {
    console.log(`\n--- Processing: ${lead.firstName} ${lead.lastName} (${lead.email}) ---`);
    console.log(`Current Status: ${lead.status}`);
    console.log(`Cancelled Appointments: ${lead.appointments.length}`);

    try {
      // Update lead status to NURTURING
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "NURTURING" }
      });
      console.log("✓ Updated status to NURTURING");

      // Log the fix activity
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "STATUS_CHANGE",
          channel: "SYSTEM",
          subject: "Fixed orphaned cancelled appointment",
          content: "Lead was stuck in CALL_SCHEDULED with cancelled appointment. Moving to NURTURING and triggering re-engagement."
        }
      });
      console.log("✓ Logged fix activity");

      // Send Slack notification
      await sendSlackNotification({
        type: "lead_rotting",
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadId: lead.id,
        details: `Fixed orphaned cancelled appointment. Holly reaching out to re-engage.`
      });
      console.log("✓ Sent Slack notification");

      // Have Holly reach out
      const decision = await handleConversation(lead.id);
      await executeDecision(lead.id, decision);
      console.log("✓ Holly sent re-engagement message");

      console.log(`✅ Successfully fixed ${lead.firstName} ${lead.lastName}`);

    } catch (error) {
      console.error(`❌ Error processing ${lead.firstName} ${lead.lastName}:`, error);
    }

    // Small delay between leads
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log("\n=== CLEANUP COMPLETE ===");
  await prisma.$disconnect();
}

main().catch(console.error);
