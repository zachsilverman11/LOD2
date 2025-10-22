import { prisma } from "../lib/db";
import { sendSms } from "../lib/sms";

async function manualResponse() {
  const sarah = await prisma.lead.findFirst({
    where: { firstName: "Sarah", lastName: "Crosman" },
    include: {
      communications: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!sarah) {
    console.log("Sarah not found");
    process.exit(1);
  }

  // Her last two messages show:
  // 1. "Literally a few days" (incomplete thought)
  // 2. Full explanation about 2 properties, $400k mortgages, buyout situation

  const message = `That's actually perfect timing then! Having both properties with mortgages coming due gives us a great opportunity to restructure everything strategically.

With $400k across both properties plus the buyout and debt consolidation, there's likely some significant savings we can unlock - especially if we can time everything right with your ex's buyout agreement.

Would love to walk through the numbers with you and show you what's possible. Do you have 15 min this week for a quick call? We can map out the best approach for both properties.`;

  console.log("Sending message to Sarah...");
  console.log(message);

  if (!sarah.phone) {
    console.log("No phone number");
    process.exit(1);
  }

  // Send SMS
  await sendSms({ to: sarah.phone, body: message });

  // Log the communication
  await prisma.communication.create({
    data: {
      leadId: sarah.id,
      direction: "OUTBOUND",
      channel: "SMS",
      content: message,
    },
  });

  // Log activity
  await prisma.leadActivity.create({
    data: {
      leadId: sarah.id,
      type: "SMS_SENT",
      channel: "SMS",
      content: message,
      metadata: { manual: true, reason: "Emergency response while Holly fix deploys" },
    },
  });

  // Update lead
  await prisma.lead.update({
    where: { id: sarah.id },
    data: {
      lastContactedAt: new Date(),
      nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  });

  console.log("✅ Message sent successfully");

  await prisma.$disconnect();
}

manualResponse();
