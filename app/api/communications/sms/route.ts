import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSms, normalizePhoneNumber } from "@/lib/sms";
import { interpolateTemplate } from "@/lib/email";
import { ActivityType, CommunicationChannel } from "@/app/generated/prisma";
import { z } from "zod";

const sendSmsSchema = z.object({
  leadId: z.string(),
  body: z.string().max(1600), // Twilio limit
  variables: z.record(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = sendSmsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { leadId, body: messageBody, variables } = validationResult.data;

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

    // Interpolate variables if provided
    const finalBody = variables ? interpolateTemplate(messageBody, variables) : messageBody;

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(lead.phone);

    // Send SMS
    const smsResult = await sendSms({
      to: normalizedPhone,
      body: finalBody,
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId,
        type: ActivityType.SMS_SENT,
        channel: CommunicationChannel.SMS,
        content: finalBody,
        metadata: {
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

    return NextResponse.json({ success: true, messageSid: smsResult.sid });
  } catch (error) {
    console.error("Error sending SMS:", error);
    return NextResponse.json(
      { error: "Failed to send SMS" },
      { status: 500 }
    );
  }
}
