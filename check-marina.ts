import { PrismaClient } from "./app/generated/prisma";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  // Find Marina by first name
  const leads = await prisma.lead.findMany({
    where: {
      firstName: {
        contains: "Marina",
        mode: "insensitive"
      }
    },
    include: {
      communications: {
        orderBy: { createdAt: "asc" }
      },
      appointments: {
        orderBy: { scheduledAt: "desc" }
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20
      }
    }
  });

  console.log(`Found ${leads.length} leads with Marina in first name\n`);

  for (const lead of leads) {
    console.log("=== LEAD DETAILS ===");
    console.log(`Name: ${lead.firstName} ${lead.lastName}`);
    console.log(`Email: ${lead.email}`);
    console.log(`Status: ${lead.status}`);
    console.log(`Created: ${lead.createdAt}`);
    console.log(`\n=== APPOINTMENTS ===`);

    for (const appt of lead.appointments) {
      console.log(`Appointment ID: ${appt.id}`);
      console.log(`Scheduled For: ${appt.scheduledFor}`);
      console.log(`Status: ${appt.status}`);
      console.log(`Cal.com UID: ${appt.calComBookingUid}`);
      console.log(`Advisor: ${appt.advisorName}`);
      console.log(`---`);
    }

    console.log(`\n=== RECENT ACTIVITIES ===`);
    for (const activity of lead.activities) {
      console.log(`[${activity.createdAt.toISOString()}] ${activity.type}`);
      console.log(`Content: ${activity.content?.substring(0, 100)}`);
      console.log(`---`);
    }

    console.log("\n");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
