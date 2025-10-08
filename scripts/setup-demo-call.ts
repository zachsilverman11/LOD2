import { prisma } from "../lib/db";

async function main() {
  // Find Greg's lead
  const greg = await prisma.lead.findUnique({
    where: { email: "greg@inspired.mortgage" },
    include: { appointments: true },
  });

  if (greg && greg.appointments.length > 0) {
    // Mark the appointment as completed and set time to 10 minutes ago
    const appt = greg.appointments[0];
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        status: "completed",
        scheduledAt: tenMinutesAgo,
        scheduledFor: tenMinutesAgo,
      },
    });

    // Clear any existing call outcome from rawData
    const rawData = greg.rawData as any;
    if (rawData?.callOutcome) {
      delete rawData.callOutcome;
    }

    await prisma.lead.update({
      where: { id: greg.id },
      data: {
        status: "CALL_COMPLETED",
        rawData: rawData,
      },
    });

    console.log("✅ Updated Greg's appointment to completed (10 min ago)");
    console.log("✅ Cleared call outcome - you can now see the quick action buttons!");
  } else {
    console.log("❌ Greg's lead or appointment not found");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
