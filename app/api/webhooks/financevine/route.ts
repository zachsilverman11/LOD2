import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processLeadWithAutonomousAgent } from "@/lib/holly/agent";
import { sendSlackNotification, sendErrorAlert } from "@/lib/slack";
import { correctNames } from "@/lib/name-correction";
import { deriveLeadSegment, formatPhoneE164 } from "@/lib/lead-segmentation";

/**
 * Webhook endpoint for FinanceVine leads via Zapier
 * 
 * These are typically private/alternative leads:
 * - Income issues
 * - Bruised credit
 * - Need funds ASAP
 * - Construction/unusual property
 * - Bank said no or borrower unsure
 * 
 * Exclusive Google-search leads, SMS-verified.
 * 
 * Handoff timing:
 * - Wait 5 minutes after ingest (FinanceVine processes opt-outs on their number)
 * - If lead hasn't inbound-replied to us, wait ~30 minutes before first Inspired SMS
 * - If they inbound on our number sooner, reply immediately
 */
export async function POST(req: NextRequest) {
  try {
    // Optional webhook authentication
    const webhookSecret = process.env.FINANCEVINE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const headerSecret = req.headers.get("X-Webhook-Secret");
      const querySecret = req.nextUrl.searchParams.get("key");
      const providedSecret = headerSecret || querySecret;

      if (providedSecret !== webhookSecret) {
        console.warn("[FinanceVine] Webhook authentication failed - invalid secret");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    } else {
      console.warn("[FinanceVine] FINANCEVINE_WEBHOOK_SECRET not set - webhook is unauthenticated");
    }

    const payload = await req.json();

    console.log("[FinanceVine] Received lead - processing");

    // Log the webhook
    await prisma.webhookEvent.create({
      data: {
        source: "financevine",
        eventType: "new_lead",
        payload,
        processed: false,
      },
    });

    // Normalize Zapier payload shapes (flat, nested data, or query-ish keys)
    const data = payload.data || payload;

    // Extract fields (map what we can, rest goes in rawData)
    const firstName = data.first_name || data.firstName || data["First Name"] || "Unknown";
    const lastName = data.last_name || data.lastName || data["Last Name"] || "";
    const email = data.email || data.Email;
    const rawPhone = data.phone || data.Phone || data.phone_number;
    const mortgageType = data.mortgage_type || data["Mortgage Type"] || data.loan_type;
    const primaryGoal = data.primary_goal || data["Primary Goal"] || data.goal;
    const borrowerProfile = data.borrower_profile || data["Borrower Profile"];
    const timeline = data.timeline || data.Timeline;
    const age55Plus = data.age_55_plus || data["55+"] || false;
    const openToSelling = data.open_to_selling || data["Open to Selling"];
    const propertyValue = data.property_value || data["Property Value"];
    const mortgageBalance = data.mortgage_balance || data["Mortgage Balance"];
    const equityTakeOut = data.equity_take_out || data["Equity Take-Out"];
    const ltvPercent = data.ltv_percent || data["LTV%"];
    const province = data.province || data.Province;
    const zoning = data.zoning || data.Zoning;
    const propertyConditions = data.property_conditions || data["Property Conditions"];
    const trustedFormCert = data.trusted_form_cert || data.xxTrustedFormCertUrl;
    const leadId = data.lead_id || data.Lead_ID || data.unique_id;

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
      source: "financevine",
      rawData: {
        mortgage_type: mortgageType,
        primary_goal: primaryGoal,
        borrower_profile: borrowerProfile,
        age_55_plus: age55Plus,
      },
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
          source: "financevine",
          segment: segmentation.segment,
          intent: segmentation.intent,
          bankability: segmentation.bankability,
          rawData: {
            ...payload,
            ingestTimestamp: new Date().toISOString(), // For timing logic
          },
          consentSms: true, // FinanceVine leads are SMS-verified
          consentEmail: true,
          consentCall: true,
          updatedAt: new Date(),
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "WEBHOOK_RECEIVED",
          content: "Updated lead from FinanceVine webhook",
          metadata: payload,
        },
      });

      console.log(`[FinanceVine] Updated existing lead: ${lead.id}, source: financevine`);
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
          source: "financevine",
          segment: segmentation.segment,
          intent: segmentation.intent,
          bankability: segmentation.bankability,
          rawData: {
            ...payload,
            ingestTimestamp: new Date().toISOString(), // For timing logic
          },
          consentSms: true, // FinanceVine leads are SMS-verified
          consentEmail: true,
          consentCall: true,
          managedByAutonomous: true,
          cohort: cohortConfig?.currentCohortName || "COHORT_1",
          cohortStartDate: cohortConfig?.cohortStartDate || new Date(),
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "WEBHOOK_RECEIVED",
          content: "New lead created from FinanceVine webhook",
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

      console.log(`[FinanceVine] Created new lead: ${lead.id}, source: financevine`);

      // Send Slack notification for new lead
      const goalInfo = primaryGoal || mortgageType || "mortgage inquiry";
      const bankabilityNote =
        borrowerProfile && borrowerProfile.toLowerCase().includes("not approved")
          ? " (bank said no)"
          : borrowerProfile && borrowerProfile.toLowerCase().includes("unsure")
          ? " (unsure about bank approval)"
          : "";

      const slackDetails = nameCorrectionResult.wasCorrected
        ? `${goalInfo}${bankabilityNote}\n\n✅ Name auto-corrected from "${nameCorrectionResult.originalFirstName} ${nameCorrectionResult.originalLastName}"`
        : `${goalInfo}${bankabilityNote}`;

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
        source: "financevine",
        payload: { equals: payload },
        processed: false,
      },
      data: { processed: true },
    });

    // 🚀 AUTONOMOUS HOLLY CONTACT - Only for new leads
    // FinanceVine timing: 5-min opt-out window + 30-min handoff delay
    // Set nextReviewAt to ~30 minutes from now so the cron will pick it up after the handoff delay
    if (!existingLead && lead.consentSms) {
      console.log(`[Autonomous Holly] Scheduling FinanceVine lead for first contact in ~30 minutes: ${lead.id}`);

      try {
        const FINANCEVINE_HANDOFF_DELAY_MINUTES = 30;
        const nextReviewAt = new Date(Date.now() + FINANCEVINE_HANDOFF_DELAY_MINUTES * 60 * 1000);

        await prisma.lead.update({
          where: { id: lead.id },
          data: { nextReviewAt },
        });

        console.log(`[Autonomous Holly] ✅ FinanceVine lead scheduled for review at ${nextReviewAt.toISOString()}`);
      } catch (error) {
        console.error("[Autonomous Holly] Failed to schedule FinanceVine lead:", error);

        // Send error alert to Slack
        await sendErrorAlert({
          error: error instanceof Error ? error : new Error(String(error)),
          context: {
            location: "webhooks/financevine - Autonomous Holly scheduling",
            leadId: lead.id,
            details: { firstName: correctedFirstName, lastName: correctedLastName, phone: lead.phone },
          },
        });

        // Don't fail the webhook - just log the error
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: "NOTE_ADDED",
            content: `Failed to schedule with autonomous agent: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      status: existingLead ? "updated" : "created",
      segment: segmentation.segment,
      aiContactScheduled: !existingLead && lead.consentSms,
    });
  } catch (error) {
    console.error("[FinanceVine] Webhook error:", error);

    // Send critical error alert to Slack
    await sendErrorAlert({
      error: error instanceof Error ? error : new Error(String(error)),
      context: {
        location: "webhooks/financevine - Webhook processing",
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
    endpoint: "FinanceVine Webhook",
    timestamp: new Date().toISOString(),
    note: "FinanceVine leads via Zapier. Typical profile: alt/private (income, credit, speed, construction, bank said no). Handoff timing: 5min opt-out + 30min delay before first Inspired SMS.",
  });
}
