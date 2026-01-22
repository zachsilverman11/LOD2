import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ActivityType, BookingSource, CommunicationChannel } from "@/app/generated/prisma";

/**
 * Update the booking source of an appointment
 * - HOLLY: Cal.com webhook (Holly AI automated)
 * - LOD: System-booked (VAPI voice AI)
 * - MANUAL: Manually marked by adviser
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;
    const body = await request.json();
    const { bookingSource, markedBy } = body;

    // Validate booking source
    if (!bookingSource || !["HOLLY", "LOD", "MANUAL"].includes(bookingSource)) {
      return NextResponse.json(
        { error: "Invalid booking source. Must be HOLLY, LOD, or MANUAL" },
        { status: 400 }
      );
    }

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

    // Build update data
    const updateData: {
      bookingSource: BookingSource;
      markedManualAt?: Date | null;
      markedManualBy?: string | null;
    } = {
      bookingSource: bookingSource as BookingSource,
    };

    // Set audit fields when marking as MANUAL
    if (bookingSource === "MANUAL") {
      updateData.markedManualAt = new Date();
      updateData.markedManualBy = markedBy || "Unknown";
    } else {
      // Clear audit fields when changing away from MANUAL
      updateData.markedManualAt = null;
      updateData.markedManualBy = null;
    }

    // Update appointment
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
    });

    // Log activity for audit trail
    await prisma.leadActivity.create({
      data: {
        leadId: appointment.leadId,
        type: ActivityType.NOTE_ADDED,
        channel: CommunicationChannel.SYSTEM,
        subject: `Booking source changed to ${bookingSource}`,
        content: `Appointment booking source updated from ${appointment.bookingSource || "HOLLY"} to ${bookingSource}${markedBy ? ` by ${markedBy}` : ""}`,
        metadata: {
          appointmentId,
          previousSource: appointment.bookingSource,
          newSource: bookingSource,
          markedBy,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Booking source updated to ${bookingSource}`,
      appointment: {
        id: updatedAppointment.id,
        bookingSource: updatedAppointment.bookingSource,
        markedManualAt: updatedAppointment.markedManualAt,
        markedManualBy: updatedAppointment.markedManualBy,
      },
    });
  } catch (error) {
    console.error("Error updating booking source:", error);
    return NextResponse.json(
      { error: "Failed to update booking source" },
      { status: 500 }
    );
  }
}
