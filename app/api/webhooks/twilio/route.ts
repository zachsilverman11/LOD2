import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/sms";
import { ActivityType, CommunicationChannel } from "@/app/generated/prisma";
import { processLeadWithAutonomousAgent } from "@/lib/autonomous-agent";
import { sendErrorAlert } from "@/lib/slack";
import { humanDelay } from "@/lib/human-delay";

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

      // 🤖 TRIGGER AUTONOMOUS HOLLY AGENT (INSTANT RESPONSE)
      // Process this lead immediately through the intelligent autonomous agent
      // The agent will analyze, decide, and respond using Claude Sonnet 4.5 with 5-layer training
      try {
        console.log(`[Autonomous Holly] Processing incoming SMS from lead: ${lead.id}`);

        // Add small human-like delay before processing (natural feeling)
        await humanDelay(body, null);

        // Process lead through autonomous agent
        const result = await processLeadWithAutonomousAgent(lead.id);

        if (result.success) {
          console.log(`[Autonomous Holly] ✅ Response handled: ${result.action}`);
        } else {
          console.log(`[Autonomous Holly] ⏭️  Skipped or deferred: ${result.reason}`);
        }
      } catch (error) {
        console.error("[Autonomous Holly] Failed to process lead:", error);

        // Send error alert to Slack
        await sendErrorAlert({
          error: error instanceof Error ? error : new Error(String(error)),
          context: {
            location: "webhooks/twilio - Autonomous Holly handler",
            leadId: lead.id,
            details: { incomingMessage: body, phone: normalizedPhone },
          },
        });

        // Log error but don't crash
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: ActivityType.NOTE_ADDED,
            content: `AI response failed: ${error instanceof Error ? error.message : "Unknown error"}`,
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
