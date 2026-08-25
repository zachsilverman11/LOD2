import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processLeadWithAutonomousAgent } from "@/lib/holly/agent";
import { sendSlackNotification, sendErrorAlert } from "@/lib/slack";
import { correctNames } from "@/lib/name-correction";
import { deriveLeadSegment, formatPhoneE164 } from "@/lib/lead-segmentation";

/**
 * Webhook endpoint for rates.ca leads
 * 
 * Stub implementation ready for rates.ca integration.
 * These are typically prime rate-shopping leads.
 * 
 * Payload structure TBD - will be updated when rates.ca provides schema.
 */
export async function POST(req: NextRequest) {
  try {
    // Optional webhook authentication
    const webhookSecret = process.env.RATES_CA_WEBHOOK_SECRET;
    if (webhookSecret) {
      const headerSecret = req.headers.get("X-Webhook-Secret");
      const querySecret = req.nextUrl.searchParams.get("key");
      const providedSecret = headerSecret || querySecret;

      if (providedSecret !== webhookSecret) {
        console.warn("[rates.ca] Webhook authentication failed - invalid secret");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    } else {
      console.warn("[rates.ca] RATES_CA_WEBHOOK_SECRET not set - webhook is unauthenticated");
    }

    const payload = await req.json();

    console.log("[rates.ca] Received lead - processing");

    // Log the webhook
    await prisma.webhookEvent.create({
      data: {
        source: "rates_ca",
        eventType: "new_lead",
        payload,
        processed: false,
      },
    });

    // Extract fields (schema TBD - using common field names as placeholders)
    const firstName = payload.first_name || payload.firstName || "Unknown";
    const lastName = payload.last_name || payload.lastName || "";
    const email = payload.email;
    const rawPhone = payload.phone || payload.phone_number;

    // Validate required fields
    if (!email || !rawPhone) {
      return NextResponse.json(
        { error: "Missing required fields: email, phone" },
        { status: 400 }
      );
    }

    // Normalize phone to E.164
    const phone = formatPhoneE164(rawPhone);

    // Parse and correct names
    const nameCorrectionResult = correctNames(firstName, lastName);
    const correctedFirstName = nameCorrectionResult.firstName;
    const correctedLastName = nameCorrectionResult.lastName;

    // Derive segment, intent, bankability
    const segmentation = deriveLeadSegment({
      source: "rates_ca",
      rawData: payload,
    });

    // Check if lead already exists
    const existingLead = await prisma.lead.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    let lead;

    if (existingLead) {
      // Update existing lead with new data
      lead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          firstName: correctedFirstName,
          lastName: correctedLastName,
          phone,
          email,
          source: "rates_ca",
          segment: segmentation.segment,
          intent: segmentation.intent,
          bankability: segmentation.bankability,
          rawData: payload,
          consentSms: payload.consent === "TRUE" || payload.consent === true,
          consentEmail: payload.consent === "TRUE" || payload.consent === true,
          consentCall: payload.consent === "TRUE" || payload.consent === true,
          updatedAt: new Date(),
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "WEBHOOK_RECEIVED",
          content: "Updated lead from rates.ca webhook",
          metadata: payload,
        },
      });

      console.log(`[rates.ca] Updated existing lead: ${lead.id}, source: rates_ca`);
    } else {
      // Get current cohort config
      const cohortConfig = await prisma.cohortConfig.findFirst({
        orderBy: { createdAt: "desc" },
      });

      // Create new lead
      lead = await prisma.lead.create({
        data: {
          firstName: correctedFirstName,
          lastName: correctedLastName,
          email,
          phone,
          status: "NEW",
          source: "rates_ca",
          segment: segmentation.segment,
          intent: segmentation.intent,
          bankability: segmentation.bankability,
          rawData: payload,
          consentSms: payload.consent === "TRUE" || payload.consent === true,
          consentEmail: payload.consent === "TRUE" || payload.consent === true,
          consentCall: payload.consent === "TRUE" || payload.consent === true,
          managedByAutonomous: true,
          cohort: cohortConfig?.currentCohortName || "COHORT_1",
          cohortStartDate: cohortConfig?.cohortStartDate || new Date(),
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "WEBHOOK_RECEIVED",
          content: "New lead created from rates.ca webhook",
          metadata: payload,
        },
      });

      // Log name correction if it occurred
      if (nameCorrectionResult.wasCorrected) {
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: "NOTE_ADDED",
            content: `✅ Name auto-corrected: "${nameCorrectionResult.originalFirstName} ${nameCorrectionResult.originalLastName}" → "${correctedFirstName} ${correctedLastName}"`,
            metadata: {
              reason: nameCorrectionResult.reason,
              originalFirstName: nameCorrectionResult.originalFirstName,
              originalLastName: nameCorrectionResult.originalLastName,
              correctedFirstName,
              correctedLastName,
            },
          },
        });
      }

      console.log(`[rates.ca] Created new lead: ${lead.id}, source: rates_ca`);

      // Send Slack notification for new lead
      const slackDetails = nameCorrectionResult.wasCorrected
        ? `Rate shopping lead\n\n✅ Name auto-corrected from "${nameCorrectionResult.originalFirstName} ${nameCorrectionResult.originalLastName}"`
        : "Rate shopping lead";

      await sendSlackNotification({
        type: "new_lead",
        leadName: `${correctedFirstName} ${correctedLastName}`,
        leadId: lead.id,
        details: slackDetails,
      });
    }

    // Mark webhook as processed
    await prisma.webhookEvent.updateMany({
      where: {
        source: "rates_ca",
        payload: { equals: payload },
        processed: false,
      },
      data: { processed: true },
    });

    // 🚀 AUTONOMOUS HOLLY CONTACT - Only for new leads
    if (!existingLead && lead.consentSms) {
      console.log(`[Autonomous Holly] Initiating instant contact for rates.ca lead: ${lead.id}`);

      try {
        const result = await processLeadWithAutonomousAgent(lead.id);

        if (result.success) {
          console.log(`[Autonomous Holly] ✅ rates.ca lead contacted: ${result.action}`);
        } else {
          console.log(`[Autonomous Holly] ⏭️  rates.ca lead deferred: ${result.reason}`);
        }
      } catch (error) {
        console.error("[Autonomous Holly] Failed to contact rates.ca lead:", error);

        // Send error alert to Slack
        await sendErrorAlert({
          error: error instanceof Error ? error : new Error(String(error)),
          context: {
            location: "webhooks/rates-ca - Autonomous Holly contact",
            leadId: lead.id,
            details: { firstName: correctedFirstName, lastName: correctedLastName, phone: lead.phone },
          },
        });

        // Don't fail the webhook - just log the error
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: "NOTE_ADDED",
            content: `Failed to send initial autonomous message: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      status: existingLead ? "updated" : "created",
      segment: segmentation.segment,
      aiContactInitiated: !existingLead && lead.consentSms,
    });
  } catch (error) {
    console.error("[rates.ca] Webhook error:", error);

    // Send critical error alert to Slack
    await sendErrorAlert({
      error: error instanceof Error ? error : new Error(String(error)),
      context: {
        location: "webhooks/rates-ca - Webhook processing",
        details: { message: "Failed to process incoming webhook" },
      },
    });

    return NextResponse.json(
      {
        error: "Failed to process webhook",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "rates.ca Webhook (Stub)",
    timestamp: new Date().toISOString(),
    note: "Stub implementation ready for rates.ca integration. Payload schema TBD.",
  });
}
