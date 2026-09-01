import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ActivityType, CommunicationChannel, LeadStatus } from "@/app/generated/prisma";
import { sendSlackNotification } from "@/lib/slack";
import { handleConversation, executeDecision } from "@/lib/holly/conversation-handler";
import { findLeadByPhone } from "@/lib/phone-matching";
import { getTimezoneForProvince } from "@/lib/calcom";
import { buildCancellationSlackDetails, POST_CANCELLATION_HOLD_HOURS } from "@/lib/holly/post-cancellation";

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
  const { uid, id, startTime, endTime, attendees, metadata, responses, organizer } = payload;

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

  // Try to find lead by email first (case-insensitive to handle mismatched casing)
  let lead = attendeeEmail
    ? await prisma.lead.findFirst({
        where: { email: { equals: attendeeEmail, mode: "insensitive" } },
      })
    : null;

  // If not found by email, try phone number (deterministic matching)
  // CRITICAL: Only match if we have a real phone number (at least 10 digits)
  // This prevents false matches when Cal.com sends "integrations:daily" or similar non-phone values
  if (!lead && attendeePhone) {
    const phoneDigits = attendeePhone.replace(/\D/g, "");
    if (phoneDigits.length >= 10) {
      lead = await findLeadByPhone(attendeePhone);
    }
  }

  // If not found by email or phone, try matching by attendee name
  if (!lead && attendees[0]?.name) {
    const nameParts = attendees[0].name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");
      lead = await prisma.lead.findFirst({
        where: {
          firstName: { equals: firstName, mode: "insensitive" },
          lastName: { equals: lastName, mode: "insensitive" },
        },
      });
      if (lead) {
        console.log(`[Cal.com] Matched lead by name fallback: ${firstName} ${lastName} -> ${lead.id}`);
      }
    }
  }

  if (!lead) {
    console.error("Lead not found for booking. Email:", attendeeEmail, "Phone:", attendeePhone);

    // Log to database for investigation
    await prisma.webhookEvent.create({
      data: {
        source: "cal_com",
        eventType: "BOOKING_CREATED_ORPHAN",
        payload: {
          error: "Lead not found",
          attendeeEmail,
          attendeePhone,
          bookingUid: uid,
          bookingId: id,
          startTime,
        },
        processed: false,
        error: "No matching lead in database",
      },
    });

    // Alert via Slack
    await sendSlackNotification({
      type: "lead_escalated",
      leadName: `Unknown Lead (${attendeeEmail || attendeePhone})`,
      leadId: "unknown",
      details: `❌ Cal.com booking for unknown lead\n\nEmail: ${attendeeEmail || "N/A"}\nPhone: ${attendeePhone || "N/A"}\nBooking UID: ${uid}\n\nThis booking exists in Cal.com but no matching lead in LOD2!`,
    });

    return;
  }

  // CRITICAL: Check if lead is in a prohibited status (CONVERTED, DEALS_WON)
  // These leads should NOT be reactivated by bookings
  // NOTE: LOST leads ARE allowed to book - they may want to re-engage
  const prohibitedStatuses: LeadStatus[] = [LeadStatus.CONVERTED, LeadStatus.DEALS_WON];

  if (prohibitedStatuses.includes(lead.status)) {
    console.warn(`[Cal.com] BLOCKED booking for ${lead.status} lead:`, lead.id, lead.firstName, lead.lastName);

    // Log the blocked booking attempt
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: ActivityType.NOTE_ADDED,
        channel: CommunicationChannel.SYSTEM,
        subject: `⚠️ Booking Blocked - Lead is ${lead.status}`,
        content: `A Cal.com booking was received but BLOCKED because this lead is ${lead.status}.\n\nBooking UID: ${uid}\nScheduled for: ${new Date(startTime).toLocaleString()}\n\nThis lead should not be reactivated automatically. Manual review required.`,
        metadata: { bookingUid: uid, bookingPayload: payload, blockedStatus: lead.status },
      },
    });

    // Alert team via Slack
    await sendSlackNotification({
      type: "lead_escalated",
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadId: lead.id,
      details: `⚠️ ${lead.status} lead tried to book a call\n\nStatus: ${lead.status}\nBooking: ${new Date(startTime).toLocaleString()}\n\nBooking was BLOCKED - please review manually and decide if this lead should be reactivated.`,
    });

    return; // Don't create appointment or change status
  }

  // Create or reconcile appointment record.
  // Direct bookings can already exist in our DB before the webhook arrives.
  const existingAppointment = await prisma.appointment.findUnique({
    where: { calComBookingUid: uid },
  });

  // For phone meetings, Cal.com provides location as phone number
  // For video meetings, there's a meetingUrl field
  const meetingUrl = payload.meetingUrl || `https://cal.com/booking/${uid}`;
  const appointmentData = {
    leadId: lead.id,
    calComEventId: id?.toString(),
    calComBookingUid: uid,
    scheduledAt: new Date(startTime),
    scheduledFor: new Date(startTime),
    duration: Math.round(
      (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
    ),
    status: "scheduled",
    meetingUrl,
    advisorName: organizer?.name || null,
    advisorEmail: organizer?.email || null,
    bookingSource: "HOLLY" as const,
    notes: payload.location
      ? `Meeting location: ${
          typeof payload.location === "string"
            ? payload.location
            : JSON.stringify(payload.location)
        }`
      : undefined,
  };

  if (existingAppointment) {
    await prisma.appointment.update({
      where: { id: existingAppointment.id },
      data: appointmentData,
    });
  } else {
    await prisma.appointment.create({
      data: appointmentData,
    });
  }

  // Update lead status - Holly stays enabled with appointment context
  // She knows about the scheduled appointment and won't try to book again
  // Safety guardrails + POST-CALL CONTEXT keep her contextually aware
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: LeadStatus.CALL_SCHEDULED,
      // Holly stays enabled - existing safeguards prevent booking hallucinations:
      // 1. Safety guardrails pattern-match "did you book?" type messages
      // 2. Appointment query only finds SCHEDULED/CONFIRMED appointments
      // 3. POST-CALL CONTEXT provides call outcome details after call
    },
  });

  if (existingAppointment) {
    console.log(
      `[Cal.com] Reconciled existing appointment for booking UID ${uid}; skipping duplicate confirmation flow`
    );
    return;
  }

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
    details: `Scheduled for ${new Date(startTime).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Vancouver",
    })} PT`,
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
      // Holly sends a booking confirmation — pass specialContext so she doesn't treat this as first contact
      const bookingTime = new Date(payload.startTime || payload.start).toLocaleString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const advisorName = payload.organizer?.name || "your advisor";
      const bookingContext = `The lead just booked a discovery call! Appointment details:\n- Time: ${bookingTime}\n- Advisor: ${advisorName}\n\nSend a SHORT, warm booking confirmation SMS. Do NOT re-introduce yourself if you've already been in conversation with this lead. Just confirm the booking, tell them what to expect, and build excitement. Keep it under 160 chars.\n\nIMPORTANT: Use the advisor name above ONLY when it's a specific person (e.g. Greg, Jakub). If Advisor is "your advisor", do NOT guess a name - just say "your call" or "your discovery call".\n\nUse the send_sms tool.`;
      const decision = await handleConversation(lead.id, undefined, bookingContext);
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
  const { uid, startTime, endTime, organizer } = payload;

  const appointment = await prisma.appointment.findUnique({
    where: { calComBookingUid: uid },
    include: { lead: true },
  });

  if (!appointment) {
    console.log("Appointment not found for rescheduling:", uid);
    return;
  }

  const lead = appointment.lead;

  // Update appointment
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      scheduledAt: new Date(startTime),
      scheduledFor: new Date(startTime),
      duration: Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000),
      reminder24hSent: false, // Reset reminders when rescheduled
      reminder1hSent: false,
      advisorName: organizer?.name || appointment.advisorName,
      advisorEmail: organizer?.email || appointment.advisorEmail,
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

  // Send SMS notification of the new time to the borrower
  // Skip if Holly is disabled, no SMS consent, or no phone
  if (lead.hollyDisabled || !lead.consentSms || !lead.phone) {
    console.log(
      `[Cal.com] Skipping reschedule SMS - hollyDisabled: ${lead.hollyDisabled}, consentSms: ${lead.consentSms}, hasPhone: ${!!lead.phone}`
    );
    return;
  }

  try {
    // Format the new appointment time in the lead's timezone
    const leadTimezone = getTimezoneForProvince((lead.rawData as any)?.province);
    const newTime = new Date(startTime).toLocaleString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: leadTimezone,
    });

    const advisorName = organizer?.name || appointment.advisorName || "your advisor";

    // Use Holly's conversational system to notify about the reschedule
    const rescheduleContext = `The discovery call has been rescheduled to a new time. Appointment details:
- New time: ${newTime}
- Advisor: ${advisorName}

Send a SHORT SMS confirming the new appointment time. Let them know the call has been moved and confirm the new date/time. Keep it warm and concise (under 160 chars).

IMPORTANT: Use the advisor name above ONLY when it's a specific person (e.g. Greg, Jakub). If Advisor is "your advisor", do NOT guess a name - just say "your call" or "your discovery call".

Use the send_sms tool.`;

    const decision = await handleConversation(lead.id, undefined, rescheduleContext);
    await executeDecision(lead.id, decision);
    console.log(`[Cal.com] Sent reschedule notification SMS to lead ${lead.id}`);
  } catch (error) {
    console.error("Failed to send reschedule notification via Holly:", error);
    // Don't throw - appointment is already updated, this is just a nice-to-have
  }
}

async function handleBookingCancelled(payload: any) {
  const { uid, cancelledBy, cancellationReason, organizer, attendees } = payload;

  const appointment = await prisma.appointment.findUnique({
    where: { calComBookingUid: uid },
    include: { lead: true },
  });

  if (!appointment) {
    console.log("Appointment not found for cancellation:", uid);
    return;
  }

  const lead = appointment.lead;

  // Determine who cancelled the appointment
  // Compare cancelledBy email to organizer and attendee emails
  let cancelledByAdvisor = false;
  let cancelledByLead = false;

  if (cancelledBy) {
    const cancellerEmail = cancelledBy.toLowerCase();
    const organizerEmail = (organizer?.email || appointment.advisorEmail || "").toLowerCase();
    const attendeeEmail = (attendees?.[0]?.email || lead.email || "").toLowerCase();

    if (organizerEmail && cancellerEmail === organizerEmail) {
      cancelledByAdvisor = true;
    } else if (attendeeEmail && cancellerEmail === attendeeEmail) {
      cancelledByLead = true;
    }
  }

  // If we can't determine who cancelled, treat as advisor cancellation (safer than accusing the lead)
  if (!cancelledByAdvisor && !cancelledByLead) {
    console.log(
      `[Cal.com] Unable to determine who cancelled booking ${uid} - treating as advisor cancellation (fallback)`
    );
    cancelledByAdvisor = true;
  }

  // Update appointment status
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "cancelled" },
  });

  // Update lead status back to NURTURING (they need to be re-engaged)
  await prisma.lead.update({
    where: { id: appointment.leadId },
    data: { status: LeadStatus.NURTURING },
  });

  // Log activity
  await prisma.leadActivity.create({
    data: {
      leadId: appointment.leadId,
      type: ActivityType.APPOINTMENT_CANCELLED,
      channel: CommunicationChannel.SYSTEM,
      subject: "Call cancelled",
      content: `Discovery call was cancelled${cancellationReason ? `: ${cancellationReason}` : ""}${cancelledByAdvisor ? " (by advisor)" : cancelledByLead ? " (by lead)" : ""}`,
      metadata: {
        cancelledBy,
        cancellationReason,
        cancelledByAdvisor,
        cancelledByLead,
        appointmentId: appointment.id,
        payload,
      },
    },
  });

  // Notify the team. On an advisor cancellation the person who cancelled owns
  // the apology; Holly sends one short apology, then holds (see
  // lib/holly/post-cancellation.ts).
  const slackAlert = buildCancellationSlackDetails({
    cancelledByAdvisor,
    advisorName: organizer?.name || appointment.advisorName,
    cancellationReason,
    hollyDisabled: lead.hollyDisabled,
  });
  await sendSlackNotification({
    type: slackAlert.type,
    leadName: `${lead.firstName} ${lead.lastName}`,
    leadId: appointment.leadId,
    details: slackAlert.details,
  });

  // Skip SMS if Holly is disabled, no SMS consent, or no phone
  if (lead.hollyDisabled || !lead.consentSms || !lead.phone) {
    console.log(
      `[Cal.com] Skipping cancellation SMS - hollyDisabled: ${lead.hollyDisabled}, consentSms: ${lead.consentSms}, hasPhone: ${!!lead.phone}`
    );
    return;
  }

  // Have Holly reach out with context-appropriate messaging
  try {
    let cancellationContext: string;

    if (cancelledByLead) {
      // Lead cancelled - acknowledge they cancelled, ask if we can help
      cancellationContext = `The lead cancelled their scheduled discovery call. They had booked the appointment but then cancelled it.

Your job is to:
1. Acknowledge the cancellation empathetically (be honest that they cancelled)
2. Ask if there's anything we can help with or if they have questions
3. Offer to help them rebook if they're still interested
4. Be understanding - maybe the time didn't work, or they're not ready yet

DO NOT just pitch the same "ultra-low rates" message. This is about understanding what happened and being helpful.

Keep it SHORT (under 160 chars), conversational, and human. Use the send_sms tool.`;
    } else {
      // Advisor cancelled - apologize and offer to rebook
      const advisorName = organizer?.name || appointment.advisorName || "your advisor";
      cancellationContext = `The advisor had to cancel the scheduled discovery call. This was NOT the lead's fault - the advisor/team had to cancel.

Appointment was with: ${advisorName}

Your job is to:
1. Let them know the advisor had to cancel that time slot (be apologetic, this is on us)
2. Offer to help them pick a new time that works for them
3. Keep it brief and action-oriented

DO NOT say the lead cancelled. DO NOT blame them. This was an advisor-initiated cancellation.

This is the ONE apology. Apologise once, plainly, then move to the rebook offer. Do NOT promise when you will follow up next, do NOT say this is your last message, and do NOT pile on reassurance. The advisor will also reach out personally.

IMPORTANT: Use the advisor name above ONLY when it's a specific person (e.g. Greg, Jakub). If Advisor is "your advisor", do NOT guess a name - just say "we" or "the team".

Keep it SHORT (under 160 chars), warm and helpful. Use the send_sms tool.`;
    }

    const decision = await handleConversation(lead.id, undefined, cancellationContext);
    await executeDecision(lead.id, decision);

    // Advisor cancellation: the apology is the only automated touch for the
    // next POST_CANCELLATION_HOLD_HOURS. Without this the lead's stale
    // nextReviewAt (set while the call was booked) is already due, so the
    // 15-minute cron would re-review immediately (observed: 13 minutes after
    // the apology on 2026-08-27, then hourly until the 4h guardrail let a
    // second message through).
    if (cancelledByAdvisor) {
      await prisma.lead.update({
        where: { id: appointment.leadId },
        data: { nextReviewAt: new Date(Date.now() + POST_CANCELLATION_HOLD_HOURS * 60 * 60 * 1000) },
      });
    }
    console.log(
      `[Cal.com] Holly reaching out after ${cancelledByAdvisor ? "advisor" : "lead"} cancellation`
    );
  } catch (error) {
    console.error("Failed to send re-engagement message via Holly:", error);
    // Still notify in Slack even if Holly message fails
  }
}
