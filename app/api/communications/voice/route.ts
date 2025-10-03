import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { initiateCall } from "@/lib/voice-ai";
import { normalizePhoneNumber } from "@/lib/sms";
import { ActivityType, CommunicationChannel } from "@/app/generated/prisma";
import { z } from "zod";

const initiateCallSchema = z.object({
  leadId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = initiateCallSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { leadId } = validationResult.data;

    // Get lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Check call consent
    if (!lead.consentCall) {
      return NextResponse.json(
        { error: "Lead has not consented to call communication" },
        { status: 403 }
      );
    }

    // Check phone number
    if (!lead.phone) {
      return NextResponse.json(
        { error: "Lead has no phone number" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(lead.phone);

    // Initiate call via Vapi
    const callResult = await initiateCall({
      phoneNumber: normalizedPhone,
      metadata: {
        leadId,
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadEmail: lead.email,
      },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId,
        type: ActivityType.CALL_INITIATED,
        channel: CommunicationChannel.VOICE,
        content: "Outbound call initiated via AI assistant",
        metadata: {
          callId: callResult.id,
          status: callResult.status,
        },
      },
    });

    // Update last contacted
    await prisma.lead.update({
      where: { id: leadId },
      data: { lastContactedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      callId: callResult.id,
      status: callResult.status,
    });
  } catch (error) {
    console.error("Error initiating call:", error);
    return NextResponse.json(
      { error: "Failed to initiate call" },
      { status: 500 }
    );
  }
}
