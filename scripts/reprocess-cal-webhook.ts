import { prisma } from "../lib/db";
import { ActivityType, CommunicationChannel, LeadStatus } from "../app/generated/prisma";

async function main() {
  // Get the most recent BOOKING_CREATED webhook
  const webhook = await prisma.webhookEvent.findFirst({
    where: {
      source: "cal_com",
      eventType: "BOOKING_CREATED",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!webhook) {
    console.log("No booking webhooks found");
    return;
  }

  console.log("Processing booking webhook:", webhook.id);

  const payload = webhook.payload as any;
  const bookingPayload = payload.payload;
  const { uid, id, startTime, endTime, attendees, responses } = bookingPayload;

  // Find lead by email or phone
  const attendeeEmail = attendees[0]?.email;
  let attendeePhone =
    responses?.location?.value ||
    responses?.attendeePhoneNumber?.value ||
    attendees[0]?.phoneNumber;

  // Handle case where phone is an object like { value: "+1234567890", optionValue: "" }
  if (typeof attendeePhone === "object" && attendeePhone?.value) {
    attendeePhone = attendeePhone.value;
  }

  console.log("Attendee email:", attendeeEmail);
  console.log("Attendee phone:", attendeePhone);

  // Try to find lead by email first
  let lead = attendeeEmail
    ? await prisma.lead.findUnique({
        where: { email: attendeeEmail.toLowerCase() },
      })
    : null;

  // If not found by email, try phone number (match last 10 digits)
  if (!lead && attendeePhone) {
    const phoneDigits = attendeePhone.replace(/\D/g, "").slice(-10);
    console.log("Searching for phone:", phoneDigits);
    lead = await prisma.lead.findFirst({
      where: {
        phone: {
          contains: phoneDigits,
        },
      },
    });
  }

  if (!lead) {
    console.log("❌ Lead not found");
    return;
  }

  console.log("✅ Found lead:", lead.id, lead.firstName, lead.lastName);

  // Check if appointment already exists
  const existing = await prisma.appointment.findUnique({
    where: { calComBookingUid: uid },
  });

  if (existing) {
    console.log("Appointment already exists:", existing.id);
    return;
  }

  // Create appointment record
  const appointment = await prisma.appointment.create({
    data: {
      leadId: lead.id,
      calComEventId: id?.toString(),
      calComBookingUid: uid,
      scheduledAt: new Date(startTime),
      duration: Math.round(
        (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
      ),
      status: "scheduled",
      meetingUrl: bookingPayload.location,
    },
  });

  console.log("✅ Created appointment:", appointment.id);

  // Update lead status
  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: LeadStatus.CALL_SCHEDULED },
  });

  console.log("✅ Updated lead status to CALL_SCHEDULED");

  // Log activity
  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: ActivityType.APPOINTMENT_BOOKED,
      channel: CommunicationChannel.SYSTEM,
      subject: "Discovery call scheduled",
      content: `Call scheduled for ${new Date(startTime).toLocaleString()}`,
      metadata: bookingPayload,
    },
  });

  console.log("✅ Logged activity");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
