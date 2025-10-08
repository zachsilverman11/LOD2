import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ActivityType, CommunicationChannel, LeadStatus } from "@/app/generated/prisma";
import { sendSlackNotification } from "@/lib/slack";
import { handleConversation, executeDecision } from "@/lib/ai-conversation-enhanced";

/**
 * Handle Cal.com webhook events
 * Webhook events: booking.created, booking.rescheduled, booking.cancelled
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { triggerEvent, payload } = body;

    // Log webhook event
    await prisma.webhookEvent.create({
      data: {
        source: "cal_com",
        eventType: triggerEvent,
        payload: body,
        processed: false,
      },
    });

    switch (triggerEvent) {
      case "BOOKING_CREATED":
        await handleBookingCreated(payload);
        break;
      case "BOOKING_RESCHEDULED":
        await handleBookingRescheduled(payload);
        break;
      case "BOOKING_CANCELLED":
        await handleBookingCancelled(payload);
        break;
      default:
        console.log("Unknown Cal.com event:", triggerEvent);
    }

    // Mark webhook as processed
    await prisma.webhookEvent.updateMany({
      where: {
        source: "cal_com",
        eventType: triggerEvent,
        processed: false,
      },
      data: {
        processed: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cal.com webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleBookingCreated(payload: any) {
  const { uid, id, startTime, endTime, attendees, metadata, responses } = payload;

  // Find lead by email or phone
  const attendeeEmail = attendees[0]?.email;
  // Cal.com stores phone in responses.location.value for phone meetings
  let attendeePhone =
    responses?.location?.value ||
    responses?.attendeePhoneNumber?.value ||
    attendees[0]?.phoneNumber;

  // Handle case where phone is an object like { value: "+1234567890", optionValue: "" }
  if (typeof attendeePhone === "object" && attendeePhone?.value) {
    attendeePhone = attendeePhone.value;
  }

  if (!attendeeEmail && !attendeePhone) {
    console.log("No email or phone in booking payload");
    return;
  }

  // Try to find lead by email first
  let lead = attendeeEmail
    ? await prisma.lead.findUnique({
        where: { email: attendeeEmail.toLowerCase() },
      })
    : null;

  // If not found by email, try phone number (match last 10 digits)
  if (!lead && attendeePhone) {
    const phoneDigits = attendeePhone.replace(/\D/g, "").slice(-10);
    lead = await prisma.lead.findFirst({
      where: {
        phone: {
          contains: phoneDigits,
        },
      },
    });
  }

  if (!lead) {
    console.log("Lead not found for booking. Email:", attendeeEmail, "Phone:", attendeePhone);
    return;
  }

  // Create appointment record
  // For phone meetings, Cal.com provides location as phone number
  // For video meetings, there's a meetingUrl field
  const meetingUrl = payload.meetingUrl || `https://cal.com/booking/${uid}`;

  await prisma.appointment.create({
    data: {
      leadId: lead.id,
      calComEventId: id?.toString(),
      calComBookingUid: uid,
      scheduledAt: new Date(startTime),
      scheduledFor: new Date(startTime),
      duration: Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000),
      status: "scheduled",
      meetingUrl: meetingUrl,
      notes: payload.location ? `Meeting location: ${typeof payload.location === 'string' ? payload.location : JSON.stringify(payload.location)}` : undefined,
    },
  });

  // Update lead status
  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: LeadStatus.CALL_SCHEDULED },
  });

  // Log activity
  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: ActivityType.APPOINTMENT_BOOKED,
      channel: CommunicationChannel.SYSTEM,
      subject: "Discovery call scheduled",
      content: `Call scheduled for ${new Date(startTime).toLocaleString()}`,
      metadata: payload,
    },
  });

  // Send Slack notification
  await sendSlackNotification({
    type: "call_booked",
    leadName: `${lead.firstName} ${lead.lastName}`,
    leadId: lead.id,
    details: `Scheduled for ${new Date(startTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`,
  });

  // Only send booking confirmation if this is their first appointment
  // OR if they haven't been contacted in the last hour (prevents spam)
  const recentCommunications = await prisma.communication.findMany({
    where: {
      leadId: lead.id,
      direction: "OUTBOUND",
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      },
    },
  });

  if (recentCommunications.length === 0) {
    try {
      const decision = await handleConversation(lead.id);
      await executeDecision(lead.id, decision);
    } catch (error) {
      console.error("Failed to send appointment confirmation via Holly:", error);
      // Don't throw - appointment is already created, this is just a nice-to-have
    }
  } else {
    console.log(`[Cal.com] Skipping booking confirmation - lead contacted within last hour`);
  }
}

async function handleBookingRescheduled(payload: any) {
  const { uid, startTime, endTime } = payload;

  const appointment = await prisma.appointment.findUnique({
    where: { calComBookingUid: uid },
    include: { lead: true },
  });

  if (!appointment) {
    console.log("Appointment not found for rescheduling:", uid);
    return;
  }

  // Update appointment
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      scheduledAt: new Date(startTime),
      scheduledFor: new Date(startTime),
      duration: Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000),
      reminder24hSent: false, // Reset reminders when rescheduled
      reminder1hSent: false,
    },
  });

  // Log activity
  await prisma.leadActivity.create({
    data: {
      leadId: appointment.leadId,
      type: ActivityType.APPOINTMENT_BOOKED,
      channel: CommunicationChannel.SYSTEM,
      subject: "Call rescheduled",
      content: `Call rescheduled to ${new Date(startTime).toLocaleString()}`,
    },
  });

  // Don't send Holly message for reschedules - advisor will communicate directly
  console.log(`[Cal.com] Appointment rescheduled - advisor will follow up directly`);
}

async function handleBookingCancelled(payload: any) {
  const { uid } = payload;

  const appointment = await prisma.appointment.findUnique({
    where: { calComBookingUid: uid },
    include: { lead: true },
  });

  if (!appointment) {
    console.log("Appointment not found for cancellation:", uid);
    return;
  }

  // Update appointment status
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "cancelled" },
  });

  // Update lead status back to qualified
  await prisma.lead.update({
    where: { id: appointment.leadId },
    data: { status: LeadStatus.QUALIFIED },
  });

  // Log activity
  await prisma.leadActivity.create({
    data: {
      leadId: appointment.leadId,
      type: ActivityType.APPOINTMENT_CANCELLED,
      channel: CommunicationChannel.SYSTEM,
      subject: "Call cancelled",
      content: "Discovery call was cancelled",
    },
  });

  // Don't send Holly message for cancellations - advisor will handle re-booking
  console.log(`[Cal.com] Appointment cancelled - advisor will follow up to reschedule`);
}
