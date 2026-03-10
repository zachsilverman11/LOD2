import { prisma } from "../lib/db";
import { handleConversation } from "../lib/ai-conversation-enhanced";
import { bookLeadAppointmentDirectly } from "../lib/direct-booking";
import { getAvailableSlots, cancelCalComBooking } from "../lib/calcom";

async function main() {
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const slots = await getAvailableSlots(start, end, "America/Vancouver");

  if (slots.length === 0) {
    throw new Error("No live Cal.com slots available for direct-booking verification");
  }

  const verificationSlot =
    [...slots]
      .reverse()
      .find(
        (slot) => new Date(slot.time).getTime() > Date.now() + 3 * 24 * 60 * 60 * 1000
      ) || slots[slots.length - 1];

  const timestamp = Date.now();
  const email = `holly-direct-booking-test+${timestamp}@example.com`;
  const priorOfferMessage = `I can do ${verificationSlot.displayTime} or another nearby time. Which works best for you?`;

  const lead = await prisma.lead.create({
    data: {
      firstName: "Holly",
      lastName: `Direct Booking Test ${timestamp}`,
      email,
      phone: "+16045550199",
      status: "ENGAGED",
      source: "direct_booking_verification_test",
      consentSms: false,
      rawData: {
        province: "BC",
        city: "Vancouver",
        loanType: "renewal",
        verificationTest: true,
      },
    },
  });

  await prisma.communication.create({
    data: {
      leadId: lead.id,
      channel: "SMS",
      direction: "OUTBOUND",
      content: priorOfferMessage,
      metadata: {
        verificationTest: true,
      },
    },
  });

  try {
    const decision = await handleConversation(
      lead.id,
      `${verificationSlot.displayTime} works for me`
    );

    if (decision.action !== "book_appointment_directly") {
      throw new Error(
        `Expected book_appointment_directly, received ${decision.action}: ${JSON.stringify(
          decision
        )}`
      );
    }

    const matchedSlot = slots.find((slot) => slot.time === decision.bookingStartTime);

    if (!matchedSlot) {
      throw new Error(
        `AI selected bookingStartTime ${decision.bookingStartTime}, which was not present in the live availability list`
      );
    }

    const result = await bookLeadAppointmentDirectly(
      lead.id,
      {
        bookingStartTime: decision.bookingStartTime,
        bookingLeadName: decision.bookingLeadName,
        bookingLeadEmail: decision.bookingLeadEmail,
        bookingLeadTimezone: decision.bookingLeadTimezone || "America/Vancouver",
        message: decision.message,
        reasoning: decision.reasoning,
      },
      {
        sendConfirmationSms: false,
        sendSlackNotification: false,
        appointmentNotes: "Automated direct booking verification test",
      }
    );

    const appointment = await prisma.appointment.findUnique({
      where: { id: result.appointmentId },
    });
    const updatedLead = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { status: true },
    });

    if (!appointment) {
      throw new Error("Direct booking succeeded in Cal.com but no appointment record was created");
    }

    let bookingCancelled = false;
    let cancellationSkippedReason: string | null = null;

    if (result.booking.id) {
      await cancelCalComBooking(
        result.booking.id,
        "Automated direct booking verification test"
      );
      bookingCancelled = true;

      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          status: "cancelled",
          notes: "Automated direct booking verification test (cancelled after verification)",
        },
      });
    } else {
      cancellationSkippedReason =
        "Cal.com returned no numeric booking id, so automatic cancellation was skipped";
    }

    console.log(
      JSON.stringify(
        {
          selectedSlot: verificationSlot,
          aiDecision: {
            action: decision.action,
            bookingStartTime: decision.bookingStartTime,
            message: decision.message,
          },
          calcomBooking: {
            id: result.booking.id || null,
            uid: result.booking.uid,
            startTime: result.booking.startTime,
            status: result.booking.status,
          },
          dbAppointment: {
            id: appointment.id,
            calComBookingUid: appointment.calComBookingUid,
            status: bookingCancelled ? "cancelled" : appointment.status,
          },
          leadStatus: updatedLead?.status,
          cleanup: {
            bookingCancelled,
            cancellationSkippedReason,
          },
        },
        null,
        2
      )
    );
  } finally {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        source: "direct_booking_verification_test_completed",
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
