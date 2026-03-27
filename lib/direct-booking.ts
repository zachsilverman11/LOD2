import { prisma } from "./db";
import { sendSms } from "./sms";
import { sendSlackNotification } from "./slack";
import { createDirectBooking, type BookingConfirmation } from "./calcom";

export interface DirectBookingDecisionInput {
  bookingStartTime: string;
  bookingLeadName?: string;
  bookingLeadEmail?: string;
  bookingLeadTimezone?: string;
  message?: string;
  reasoning?: string;
  /** Audit: executeDecision action (e.g. book_appointment_directly) */
  hollyAction?: string;
  /** Audit: decision-engine tool / original action when different from hollyAction */
  hollyIntent?: string;
  availabilitySlotsProvided?: boolean;
}

export interface DirectBookingOptions {
  sendConfirmationSms?: boolean;
  sendSlackNotification?: boolean;
  appointmentNotes?: string;
}

export interface DirectBookingResult {
  booking: BookingConfirmation;
  appointmentId: string;
  startTime: Date;
  endTime: Date;
  attendeeName: string;
  attendeeEmail: string;
  attendeeTimezone: string;
}

export async function bookLeadAppointmentDirectly(
  leadId: string,
  decision: DirectBookingDecisionInput,
  options: DirectBookingOptions = {}
): Promise<DirectBookingResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
    },
  });

  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  const attendeeName =
    decision.bookingLeadName ||
    `${lead.firstName || ""} ${lead.lastName || ""}`.trim() ||
    "Lead";
  const attendeeEmail = decision.bookingLeadEmail || lead.email || "";
  const attendeeTimezone = decision.bookingLeadTimezone || "America/Vancouver";

  if (!attendeeEmail) {
    throw new Error(`Lead ${leadId} does not have an email address for Cal.com booking`);
  }

  if (!decision.bookingStartTime) {
    throw new Error("bookingStartTime is required for direct booking");
  }

  const eventTypeId = parseInt(process.env.CALCOM_EVENT_TYPE_ID || "3298267", 10);
  const booking = await createDirectBooking({
    eventTypeId,
    start: decision.bookingStartTime,
    attendee: {
      name: attendeeName,
      email: attendeeEmail,
      timeZone: attendeeTimezone,
    },
    metadata: {
      source: "holly-direct-booking",
      leadId,
      notes: options.appointmentNotes,
    },
  });

  const startTime = new Date(booking.startTime);
  const endTime = booking.endTime
    ? new Date(booking.endTime)
    : new Date(startTime.getTime() + 15 * 60 * 1000);
  const meetingUrl = booking.meetingUrl || `https://cal.com/booking/${booking.uid}`;
  const appointmentNotes =
    options.appointmentNotes || "Booked directly by Holly via Cal.com API";

  const appointment = await prisma.appointment.upsert({
    where: { calComBookingUid: booking.uid },
    update: {
      ...(booking.id ? { calComEventId: String(booking.id) } : {}),
      scheduledAt: startTime,
      scheduledFor: startTime,
      duration: Math.round((endTime.getTime() - startTime.getTime()) / 60000),
      status: "scheduled",
      meetingUrl,
      bookingSource: "HOLLY",
      notes: appointmentNotes,
    },
    create: {
      leadId,
      ...(booking.id ? { calComEventId: String(booking.id) } : {}),
      calComBookingUid: booking.uid,
      scheduledAt: startTime,
      scheduledFor: startTime,
      duration: Math.round((endTime.getTime() - startTime.getTime()) / 60000),
      status: "scheduled",
      meetingUrl,
      bookingSource: "HOLLY",
      notes: appointmentNotes,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: "CALL_SCHEDULED",
      lastContactedAt: new Date(),
    },
  });

  if (options.sendConfirmationSms !== false) {
    if (!lead.phone) {
      throw new Error(`Lead ${leadId} does not have a phone number for booking confirmation`);
    }

    if (!decision.message) {
      throw new Error("A confirmation message is required when sendConfirmationSms is enabled");
    }

    await sendSms({
      to: lead.phone,
      body: decision.message,
    });

    await prisma.communication.create({
      data: {
        leadId,
        channel: "SMS",
        direction: "OUTBOUND",
        content: decision.message,
        intent: "booking_confirmed",
        metadata: {
          aiReasoning: decision.reasoning,
          bookingUid: booking.uid,
          bookedAt: booking.startTime,
          directBooking: true,
          hollyAction: decision.hollyAction ?? "book_appointment_directly",
          ...(decision.hollyIntent != null && { hollyIntent: decision.hollyIntent }),
          ...(decision.availabilitySlotsProvided !== undefined && {
            availabilitySlotsProvided: decision.availabilitySlotsProvided,
          }),
        },
      },
    });
  }

  if (options.sendSlackNotification !== false) {
    await sendSlackNotification({
      type: "call_booked",
      leadName: attendeeName,
      leadId,
      details: `🤖 Holly booked directly! ${startTime.toLocaleString("en-US", {
        timeZone: attendeeTimezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`,
    });
  }

  return {
    booking,
    appointmentId: appointment.id,
    startTime,
    endTime,
    attendeeName,
    attendeeEmail,
    attendeeTimezone,
  };
}
