import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processLeadWithAutonomousAgent } from "@/lib/autonomous-agent";
import { sendSlackNotification, sendErrorAlert } from "@/lib/slack";
import { correctNames } from "@/lib/name-correction";

/**
 * Webhook endpoint for Leads on Demand
 * Receives new lead data and triggers instant AI contact
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    console.log("[Leads on Demand] Received lead:", payload);

    // Log the webhook
    await prisma.webhookEvent.create({
      data: {
        source: "leads_on_demand",
        eventType: "new_lead",
        payload,
        processed: false,
      },
    });

    // Validate required fields
    // Support both "name" field OR "first_name"+"last_name" fields
    if (!payload.email || !payload.phone) {
      return NextResponse.json(
        { error: "Missing required fields: email, phone" },
        { status: 400 }
      );
    }

    // Parse and correct names
    let firstName: string;
    let lastName: string;
    let nameCorrectionResult;

    if (payload.first_name && payload.last_name) {
      // LOD sends separate first_name and last_name fields
      nameCorrectionResult = correctNames(payload.first_name, payload.last_name);
      firstName = nameCorrectionResult.firstName;
      lastName = nameCorrectionResult.lastName;

      if (nameCorrectionResult.wasCorrected) {
        console.log(
          `[Name Correction] Reversed names detected: "${nameCorrectionResult.originalFirstName} ${nameCorrectionResult.originalLastName}" → "${firstName} ${lastName}"`
        );
        console.log(`[Name Correction] Reason: ${nameCorrectionResult.reason}`);
      }
    } else if (payload.name) {
      // Fallback: parse single name field
      const nameParts = payload.name.trim().split(" ");
      const parsedFirst = nameParts[0] || "Unknown";
      const parsedLast = nameParts.slice(1).join(" ") || "";

      nameCorrectionResult = correctNames(parsedFirst, parsedLast);
      firstName = nameCorrectionResult.firstName;
      lastName = nameCorrectionResult.lastName;

      if (nameCorrectionResult.wasCorrected) {
        console.log(
          `[Name Correction] Reversed names detected: "${nameCorrectionResult.originalFirstName} ${nameCorrectionResult.originalLastName}" → "${firstName} ${lastName}"`
        );
        console.log(`[Name Correction] Reason: ${nameCorrectionResult.reason}`);
      }
    } else {
      return NextResponse.json(
        { error: "Missing required fields: name or (first_name + last_name)" },
        { status: 400 }
      );
    }

    // Format phone (remove any non-digits, add +1 for Canada)
    let phone = payload.phone.replace(/\D/g, "");
    if (phone.length === 10) {
      phone = `+1${phone}`;
    } else if (phone.length === 11 && phone.startsWith("1")) {
      phone = `+${phone}`;
    } else {
      phone = `+${phone}`; // Assume it's formatted correctly
    }

    // Check if lead already exists
    const existingLead = await prisma.lead.findFirst({
      where: {
        OR: [{ email: payload.email }, { phone }],
      },
    });

    let lead;

    if (existingLead) {
      // Update existing lead with new data
      lead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          firstName,
          lastName,
          phone,
          email: payload.email,
          rawData: payload,
          consentSms: payload.consent === "TRUE" || payload.consent === true,
          consentEmail: payload.consent === "TRUE" || payload.consent === true,
          consentCall: payload.consent === "TRUE" || payload.consent === true,
          source: "leads_on_demand",
          updatedAt: new Date(),
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "WEBHOOK_RECEIVED",
          content: "Updated lead from Leads on Demand webhook",
          metadata: payload,
        },
      });

      console.log(`[Leads on Demand] Updated existing lead: ${lead.id}`);
    } else {
      // Get current cohort config
      const cohortConfig = await prisma.cohortConfig.findFirst({
        orderBy: { createdAt: "desc" }, // Get most recent config
      });

      // Create new lead
      lead = await prisma.lead.create({
        data: {
          firstName,
          lastName,
          email: payload.email,
          phone,
          status: "NEW",
          source: "leads_on_demand",
          rawData: payload,
          consentSms: payload.consent === "TRUE" || payload.consent === true,
          consentEmail: payload.consent === "TRUE" || payload.consent === true,
          consentCall: payload.consent === "TRUE" || payload.consent === true,
          managedByAutonomous: true, // Use new Autonomous Holly agent
          cohort: cohortConfig?.currentCohortName || "COHORT_1", // Assign current cohort
          cohortStartDate: cohortConfig?.cohortStartDate || new Date(),
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "WEBHOOK_RECEIVED",
          content: "New lead created from Leads on Demand webhook",
          metadata: payload,
        },
      });

      // Log name correction if it occurred
      if (nameCorrectionResult?.wasCorrected) {
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: "NOTE_ADDED",
            content: `✅ Name auto-corrected: "${nameCorrectionResult.originalFirstName} ${nameCorrectionResult.originalLastName}" → "${firstName} ${lastName}"`,
            metadata: {
              reason: nameCorrectionResult.reason,
              originalFirstName: nameCorrectionResult.originalFirstName,
              originalLastName: nameCorrectionResult.originalLastName,
              correctedFirstName: firstName,
              correctedLastName: lastName,
            },
          },
        });
      }

      console.log(`[Leads on Demand] Created new lead: ${lead.id}`);

      // Send Slack notification for new lead
      const loanInfo = payload.loanType === "purchase"
        ? `$${payload.loanAmount || "Unknown"} ${payload.loanType} - ${payload.propertyType || "property"} in ${payload.city || "Unknown"}`
        : payload.loanType === "refinance"
        ? `$${payload.loanAmount || "Unknown"} refinance in ${payload.city || "Unknown"}`
        : `${payload.loanType || "mortgage"} inquiry`;

      // Add name correction note to Slack if applicable
      const slackDetails = nameCorrectionResult?.wasCorrected
        ? `${loanInfo}\n\n✅ Name auto-corrected from "${nameCorrectionResult.originalFirstName} ${nameCorrectionResult.originalLastName}"`
        : loanInfo;

      await sendSlackNotification({
        type: "new_lead",
        leadName: `${firstName} ${lastName}`,
        leadId: lead.id,
        details: slackDetails,
      });
    }

    // Mark webhook as processed
    await prisma.webhookEvent.updateMany({
      where: {
        source: "leads_on_demand",
        payload: { equals: payload },
        processed: false,
      },
      data: { processed: true },
    });

    // 🚀 INSTANT AUTONOMOUS HOLLY CONTACT - Only for new leads
    if (!existingLead && lead.consentSms) {
      console.log(`[Autonomous Holly] Initiating instant contact for lead: ${lead.id}`);

      try {
        // Process new lead through autonomous agent (instant first contact)
        // The agent will analyze, decide, and send the first message using Claude Sonnet 4.5
        const result = await processLeadWithAutonomousAgent(lead.id);

        if (result.success) {
          console.log(`[Autonomous Holly] ✅ Instant contact sent successfully: ${result.action}`);
        } else {
          console.log(`[Autonomous Holly] ⏭️  First contact deferred: ${result.reason}`);
        }
      } catch (error) {
        console.error("[Autonomous Holly] Failed to send initial contact:", error);

        // Send error alert to Slack
        await sendErrorAlert({
          error: error instanceof Error ? error : new Error(String(error)),
          context: {
            location: "webhooks/leads-on-demand - Autonomous Holly instant contact",
            leadId: lead.id,
            details: { firstName, lastName, phone: lead.phone },
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
      aiContactInitiated: !existingLead && lead.consentSms,
    });
  } catch (error) {
    console.error("[Leads on Demand] Webhook error:", error);

    // Send critical error alert to Slack
    await sendErrorAlert({
      error: error instanceof Error ? error : new Error(String(error)),
      context: {
        location: "webhooks/leads-on-demand - Webhook processing",
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
    endpoint: "Leads on Demand Webhook",
    timestamp: new Date().toISOString(),
  });
}
