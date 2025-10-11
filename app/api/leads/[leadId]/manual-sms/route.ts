import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSms, normalizePhoneNumber } from "@/lib/sms";

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const { leadId } = params;
    const { message, sentBy } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (!sentBy || !sentBy.trim()) {
      return NextResponse.json(
        { error: "Sender name is required" },
        { status: 400 }
      );
    }

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

    // Check SMS consent (CASL compliance)
    if (!lead.consentSms) {
      return NextResponse.json(
        { error: "Lead has not consented to SMS communication" },
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

    // Send SMS via Twilio
    const smsResult = await sendSms({
      to: normalizedPhone,
      body: message,
    });

    // Save to communications with manual flag
    await prisma.communication.create({
      data: {
        leadId,
        channel: "SMS",
        direction: "OUTBOUND",
        content: message,
        metadata: {
          isManual: true,
          sentBy,
          messageSid: smsResult.sid,
          status: smsResult.status,
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
      messageSid: smsResult.sid,
      message: "Manual SMS sent successfully. Holly will see this in the conversation context.",
    });
  } catch (error) {
    console.error("Error sending manual SMS:", error);
    return NextResponse.json(
      { error: "Failed to send manual SMS", details: String(error) },
      { status: 500 }
    );
  }
}
