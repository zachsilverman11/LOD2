import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/sms";
import { ActivityType, CommunicationChannel } from "@/app/generated/prisma";
import { inngest } from "@/lib/inngest";
import { sendErrorAlert } from "@/lib/slack";

/**
 * Handle incoming SMS messages from Twilio
 * Docs: https://www.twilio.com/docs/sms/twiml
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    if (!from || !body) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(from);

    // Find lead by phone number
    const lead = await prisma.lead.findFirst({
      where: {
        phone: {
          contains: normalizedPhone.replace("+", "").slice(-10), // Match last 10 digits
        },
      },
    });

    if (lead) {
      // Handle opt-out (CASL compliance)
      if (body.toLowerCase().includes("stop") || body.toLowerCase().includes("unsubscribe")) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { consentSms: false },
        });

        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: ActivityType.SMS_RECEIVED,
            channel: CommunicationChannel.SMS,
            content: "Lead opted out of SMS communication",
          },
        });

        // Respond with TwiML
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been unsubscribed from SMS messages.</Message></Response>',
          {
            headers: { "Content-Type": "text/xml" },
          }
        );
      }

      // Save incoming message to Communications
      await prisma.communication.create({
        data: {
          leadId: lead.id,
          channel: CommunicationChannel.SMS,
          direction: "INBOUND",
          content: body,
          twilioSid: messageSid,
          metadata: {
            from: normalizedPhone,
          },
        },
      });

      // Log activity
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: ActivityType.SMS_RECEIVED,
          channel: CommunicationChannel.SMS,
          content: body,
          metadata: {
            messageSid,
            from: normalizedPhone,
          },
        },
      });

      // ✅ AUTO-PROGRESS STAGE: CONTACTED → ENGAGED (if lead replies)
      if (lead.status === "CONTACTED") {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "ENGAGED" },
        });

        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: ActivityType.STATUS_CHANGE,
            channel: CommunicationChannel.SYSTEM,
            content: "Lead status changed from CONTACTED to ENGAGED (replied to message)",
          },
        });

        console.log(`[Auto-Progress] ${lead.firstName} ${lead.lastName}: CONTACTED → ENGAGED`);
      }

      // 🤖 TRIGGER AUTONOMOUS HOLLY AGENT (VIA INNGEST QUEUE)
      // Process this lead through intelligent autonomous agent using proper job queue
      // Inngest ensures the job completes even after webhook returns to Twilio
      // The agent will analyze, decide, and respond using Claude Sonnet 4.5 with 6-layer training
      try {
        await inngest.send({
          name: "lead/reply",
          data: {
            leadId: lead.id,
            message: body,
            phone: normalizedPhone,
          },
        });

        console.log(`[Inngest] ✅ Queued lead ${lead.id} for autonomous processing`);
      } catch (error) {
        console.error(`[Inngest] ❌ Failed to queue lead ${lead.id}:`, error);

        // Alert to Slack about queue failure
        await sendErrorAlert({
          error: error instanceof Error ? error : new Error(String(error)),
          context: {
            location: "webhooks/twilio - Inngest queue send",
            leadId: lead.id,
            details: { message: body, phone: normalizedPhone },
          },
        });
      }
    }

    // Log webhook event
    await prisma.webhookEvent.create({
      data: {
        source: "twilio",
        eventType: "sms.received",
        payload: {
          from,
          body,
          messageSid,
        },
        processed: true,
      },
    });

    // Respond with empty TwiML (no auto-reply)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: { "Content-Type": "text/xml" },
      }
    );
  } catch (error) {
    console.error("Twilio webhook error:", error);

    // Send critical error alert to Slack
    await sendErrorAlert({
      error: error instanceof Error ? error : new Error(String(error)),
      context: {
        location: "webhooks/twilio - Webhook processing",
        details: { message: "Failed to process incoming Twilio webhook" },
      },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
