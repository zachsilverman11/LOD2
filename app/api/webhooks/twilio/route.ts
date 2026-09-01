import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/sms";
import { ActivityType, CommunicationChannel } from "@/app/generated/prisma";
import { inngest } from "@/lib/inngest";
import { sendErrorAlert } from "@/lib/slack";
import { validateTwilioSignature } from "@/lib/twilio-signature";
import { findLeadByPhone } from "@/lib/phone-matching";

/**
 * Handle incoming SMS messages from Twilio
 * Docs: https://www.twilio.com/docs/sms/twiml
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Validate Twilio signature before processing
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    if (!authToken) {
      console.error("[Twilio] Missing TWILIO_AUTH_TOKEN - rejecting unsigned request");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const signature = request.headers.get("X-Twilio-Signature");
    if (!signature) {
      console.error("[Twilio] Missing X-Twilio-Signature header");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Parse form data to extract all parameters
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    // Build the full URL that Twilio signed
    // On Vercel/Next.js, use x-forwarded-proto and host headers
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host");
    if (!host) {
      console.error("[Twilio] Missing host header");
      return NextResponse.json(
        { error: "Bad Request" },
        { status: 400 }
      );
    }

    // Construct the full URL (path + query string)
    const { pathname, search } = new URL(request.url);
    const fullUrl = `${protocol}://${host}${pathname}${search}`;

    // Validate signature
    const isValid = validateTwilioSignature({
      signature,
      url: fullUrl,
      params,
      authToken,
    });

    if (!isValid) {
      console.error("[Twilio] Invalid signature");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Extract required fields after validation
    const from = params.From;
    const body = params.Body;
    const messageSid = params.MessageSid;

    if (!from || !body) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(from);

    // Find lead by phone number using deterministic matching
    // This prevents inbound SMS from attaching to the wrong lead when multiple leads
    // share the same last-10 digits (incident 2026-08-26: Harper Test collision)
    const lead = await findLeadByPhone(from);

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

      // 🔄 CRON FALLBACK: Set nextReviewAt to now
      // This ensures the 15-min autonomous-holly cron picks up this lead immediately
      // if Inngest fails to process the reply (incident 2026-08-26: Harper Test never got reply)
      // 
      // Important: We set nextReviewAt but NOT lastContactedAt, because:
      // - nextReviewAt = when Holly should review the lead (now = immediate)
      // - lastContactedAt = when we last sent an outbound message (unchanged, this is inbound)
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          nextReviewAt: new Date(),
        },
      });
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
