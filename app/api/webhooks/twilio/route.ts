import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/sms";
import { ActivityType, CommunicationChannel } from "@/app/generated/prisma";
import { handleConversation, executeDecision } from "@/lib/ai-conversation-enhanced";
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

      // 🤖 TRIGGER AI RESPONSE
      // Must await in serverless environment (can't use setImmediate)
      try {
        console.log(`[AI] Processing incoming SMS from lead: ${lead.id}`);

        // Generate AI response
        const decision = await handleConversation(lead.id, body);

        // Execute the decision
        await executeDecision(lead.id, decision);

        // NOTE: Stage progression (CONTACTED -> ENGAGED/NURTURING/LOST) is now handled
        // by Holly via the move_stage tool based on response sentiment. She decides if
        // the reply is positive (ENGAGED), hesitant (NURTURING), or negative (LOST).

        console.log(`[AI] ✅ Response handled: ${decision.action}`);
      } catch (error) {
        console.error("[AI] Failed to handle conversation:", error);

        // Send error alert to Slack
        await sendErrorAlert({
          error: error instanceof Error ? error : new Error(String(error)),
          context: {
            location: "webhooks/twilio - AI conversation handler",
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
