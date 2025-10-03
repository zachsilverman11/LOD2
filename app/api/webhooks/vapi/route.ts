import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCalComBooking } from "@/lib/calcom";
import { ActivityType, CommunicationChannel, LeadStatus } from "@/app/generated/prisma";

/**
 * Handle Vapi.ai webhook events
 * Events: call-started, call-ended, function-call
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    // Log webhook event
    await prisma.webhookEvent.create({
      data: {
        source: "vapi",
        eventType: message.type,
        payload: body,
        processed: false,
      },
    });

    switch (message.type) {
      case "function-call":
        await handleFunctionCall(body);
        break;
      case "end-of-call-report":
        await handleCallEnded(body);
        break;
      default:
        console.log("Unhandled Vapi event:", message.type);
    }

    // Mark webhook as processed
    await prisma.webhookEvent.updateMany({
      where: {
        source: "vapi",
        eventType: message.type,
        processed: false,
      },
      data: {
        processed: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Vapi webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleFunctionCall(payload: any) {
  const { call, message } = payload;
  const { functionCall } = message;

  if (functionCall.name === "bookAppointment") {
    const { name, email, preferredDate, notes } = functionCall.parameters;
    const leadId = call.metadata?.leadId;

    if (!leadId) {
      console.error("No leadId in call metadata");
      return;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      console.error("Lead not found:", leadId);
      return;
    }

    try {
      // Book appointment via Cal.com
      const eventTypeId = parseInt(process.env.CALCOM_EVENT_TYPE_ID || "");
      if (!eventTypeId) {
        throw new Error("CALCOM_EVENT_TYPE_ID not configured");
      }

      const booking = await createCalComBooking({
        eventTypeId,
        start: preferredDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default to tomorrow
        responses: {
          name: name || `${lead.firstName} ${lead.lastName}`,
          email: email || lead.email,
          notes: notes || "Booked via AI voice assistant",
        },
        timeZone: "America/Toronto",
        metadata: {
          leadId,
          source: "voice_ai",
          callId: call.id,
        },
      });

      // Create appointment record
      await prisma.appointment.create({
        data: {
          leadId,
          calComEventId: booking.id.toString(),
          calComBookingUid: booking.uid,
          scheduledAt: new Date(booking.startTime),
          duration: Math.round(
            (new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000
          ),
          status: "scheduled",
          notes: notes,
        },
      });

      // Update lead status
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: LeadStatus.CALL_SCHEDULED },
      });

      // Log activity
      await prisma.leadActivity.create({
        data: {
          leadId,
          type: ActivityType.APPOINTMENT_BOOKED,
          channel: CommunicationChannel.VOICE,
          subject: "Appointment booked during AI call",
          content: `Discovery call scheduled for ${new Date(booking.startTime).toLocaleString()}`,
          metadata: {
            callId: call.id,
            bookingUid: booking.uid,
          },
        },
      });

      // Return success to Vapi (this will be spoken to the caller)
      return {
        result: `Great! I've scheduled your discovery call for ${new Date(
          booking.startTime
        ).toLocaleString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}. You'll receive a confirmation email shortly.`,
      };
    } catch (error) {
      console.error("Error booking appointment:", error);
      return {
        result:
          "I'm sorry, I had trouble booking that time. Let me have one of our advisors reach out to you directly to schedule.",
      };
    }
  }
}

async function handleCallEnded(payload: any) {
  const { call } = payload;
  const leadId = call.metadata?.leadId;

  if (!leadId) {
    console.error("No leadId in call metadata");
    return;
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    console.error("Lead not found:", leadId);
    return;
  }

  // Extract call summary
  const duration = call.endedAt
    ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
    : 0;

  const transcript = call.transcript || "No transcript available";
  const summary = call.summary || call.analysis?.summary || "No summary available";

  // Log call completion
  await prisma.leadActivity.create({
    data: {
      leadId,
      type: ActivityType.CALL_COMPLETED,
      channel: CommunicationChannel.VOICE,
      subject: `Call completed (${Math.floor(duration / 60)}m ${duration % 60}s)`,
      content: summary,
      metadata: {
        callId: call.id,
        duration,
        transcript,
        cost: call.cost,
      },
    },
  });

  // If call was successful and no appointment was booked, update status
  if (lead.status === "NEW" || lead.status === "CONTACTED") {
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: LeadStatus.CONTACTED },
    });
  }
}
