import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ActivityType, CommunicationChannel, LeadStatus } from "@/app/generated/prisma";
import { sendSlackNotification } from "@/lib/slack";
import { handleConversation, executeDecision } from "@/lib/ai-conversation-enhanced";

/**
 * Mark an appointment as no-show
 * - Updates appointment status
 * - Moves lead back to ENGAGED
 * - Cancels any queued post-call follow-up messages
 * - Triggers Holly's no-show recovery message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const appointmentId = params.id;

    // Find the appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { lead: true },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Update appointment status to no_show
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "no_show" },
    });

    // Move lead back to ENGAGED (they showed interest by booking, just didn't show)
    await prisma.lead.update({
      where: { id: appointment.leadId },
      data: { status: LeadStatus.ENGAGED },
    });

    // Cancel any queued post-call follow-up messages for this lead
    await prisma.scheduledMessage.deleteMany({
      where: {
        leadId: appointment.leadId,
        sent: false,
        metadata: {
          path: ["messageType"],
          equals: "post_call_followup",
        },
      },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId: appointment.leadId,
        type: ActivityType.APPOINTMENT_CANCELLED,
        channel: CommunicationChannel.SYSTEM,
        subject: "Marked as no-show",
        content: `Appointment for ${appointment.scheduledAt.toLocaleString()} marked as no-show`,
        metadata: { appointmentId },
      },
    });

    // Send Slack notification
    await sendSlackNotification({
      type: "lead_updated",
      leadName: `${appointment.lead.firstName} ${appointment.lead.lastName}`,
      leadId: appointment.lead.id,
      details: `Marked as no-show for ${appointment.scheduledAt.toLocaleString()}. Moved back to ENGAGED.`,
    });

    // Don't send Holly message for no-shows - advisor will handle re-booking
    console.log(`[Appointments] No-show marked - advisor will follow up to reschedule`);

    return NextResponse.json({
      success: true,
      message: "Appointment marked as no-show",
      appointment: {
        id: appointment.id,
        status: "no_show",
      },
      lead: {
        id: appointment.lead.id,
        status: LeadStatus.ENGAGED,
      },
    });
  } catch (error) {
    console.error("Error marking appointment as no-show:", error);
    return NextResponse.json(
      { error: "Failed to mark appointment as no-show" },
      { status: 500 }
    );
  }
}
