import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ActivityType, CommunicationChannel, LeadStatus } from "@/app/generated/prisma";
import { sendSlackNotification } from "@/lib/slack";
import { handleConversation, executeDecision } from "@/lib/ai-conversation-enhanced";
import crypto from "crypto";

/**
 * Finmo Webhook Handler
 *
 * Receives application lifecycle events from Finmo mortgage application platform
 * Events: application.started, application.completed
 *
 * Documentation: https://docs.finmo.ca/webhooks
 */

interface FinmoWebhookPayload {
  event: "application.started" | "application.completed";
  timestamp: string;
  application: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * Verify Finmo webhook signature for security
 */
function verifyFinmoSignature(payload: string, signature: string): boolean {
  try {
    const publicKey = process.env.FINMO_WEBHOOK_PUBLIC_KEY;
    if (!publicKey) {
      console.error("[Finmo Webhook] FINMO_WEBHOOK_PUBLIC_KEY not configured");
      return false;
    }

    // Finmo uses RSA-SHA256 signature verification
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(payload);
    verify.end();

    return verify.verify(publicKey, signature, "base64");
  } catch (error) {
    console.error("[Finmo Webhook] Signature verification error:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-finmo-signature");
    const rawBody = await request.text();

    // 🔍 LOG: Full payload for debugging
    console.log("[Finmo Webhook] ========== INCOMING WEBHOOK ==========");
    console.log("[Finmo Webhook] Headers:", {
      signature,
      contentType: request.headers.get("content-type"),
    });
    console.log("[Finmo Webhook] Raw Body:", rawBody);

    // Verify webhook signature (security measure)
    if (signature && !verifyFinmoSignature(rawBody, signature)) {
      console.error("[Finmo Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
      console.log("[Finmo Webhook] Parsed Payload:", JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error("[Finmo Webhook] JSON Parse Error:", parseError);
      await sendSlackNotification({
        type: "error",
        message: "Finmo Webhook: JSON Parse Error",
        details: `Raw Body: ${rawBody}\nError: ${parseError}`,
      });
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const rawEvent = payload.event || payload.type || "unknown";
    const application = payload.application || payload.data || payload.deal || payload;

    // Try to find email in various possible locations
    const email = application?.email ||
                  payload.email ||
                  application?.borrower?.email ||
                  application?.user?.email ||
                  application?.contact?.email ||
                  payload.deal?.email;

    // FOR TESTING: Accept webhooks without email and just log them
    if (!email) {
      console.warn("[Finmo Webhook] ⚠️ No email found - logging payload for debugging");
      await sendSlackNotification({
        type: "lead_updated",
        leadName: "Finmo Test Webhook",
        leadId: "test",
        details: `📋 FINMO WEBHOOK TEST PAYLOAD:\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n\nEvent: ${rawEvent}\n\nPlease check this payload structure to see where the email field is located.`,
      });

      // Return success so Finmo doesn't think webhook failed
      // This allows us to see what they're sending
      return NextResponse.json({
        success: true,
        note: "Test webhook received - no email found but logged for debugging"
      });
    }

    console.log(`[Finmo Webhook] Found email: ${email}`);

    // Normalize event name to handle different formats
    // Finmo might send: "Application started", "application.started", or "application_started"
    const normalizedEvent = rawEvent.toLowerCase().replace(/[\s_]/g, ".");

    console.log(`[Finmo Webhook] Event: ${rawEvent} → Normalized: ${normalizedEvent}`);
    console.log(`[Finmo Webhook] Email: ${email}`);

    // Find lead by email
    const lead = await prisma.lead.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!lead) {
      console.error(`[Finmo Webhook] Lead not found for email: ${email}`);
      await sendSlackNotification({
        type: "error",
        message: "Finmo Webhook: Lead Not Found",
        details: `Email: ${email}\nEvent: ${rawEvent}\nSearched in database but no match found.`,
      });
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    console.log(`[Finmo Webhook] Found lead: ${lead.firstName} ${lead.lastName} (ID: ${lead.id})`);

    // Handle different event types with flexible matching
    if (normalizedEvent.includes("application.started") || normalizedEvent === "application.started") {
      console.log("[Finmo Webhook] Handling APPLICATION STARTED event");
      await handleApplicationStarted(lead.id, application);
    } else if (normalizedEvent.includes("application.submitted") || normalizedEvent.includes("application.completed")) {
      console.log("[Finmo Webhook] Handling APPLICATION COMPLETED event");
      await handleApplicationCompleted(lead.id, application);
    } else {
      console.warn(`[Finmo Webhook] Unknown event type: ${rawEvent} (normalized: ${normalizedEvent})`);
      await sendSlackNotification({
        type: "error",
        message: "Finmo Webhook: Unknown Event",
        details: `Event: ${rawEvent}\nNormalized: ${normalizedEvent}\nLead: ${lead.firstName} ${lead.lastName}`,
      });
    }

    console.log("[Finmo Webhook] ========== WEBHOOK PROCESSED SUCCESSFULLY ==========");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Finmo Webhook] Error:", error);
    await sendSlackNotification({
      type: "error",
      message: "Finmo Webhook Error",
      details: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle application.started event
 */
async function handleApplicationStarted(leadId: string, application: any) {
  try {
    // Update lead with application started timestamp and status
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        applicationStartedAt: new Date(application.createdAt),
        status: LeadStatus.APPLICATION_STARTED,
        updatedAt: new Date(),
      },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId,
        type: ActivityType.NOTE_ADDED,
        channel: CommunicationChannel.SYSTEM,
        subject: "Application Started",
        content: "Lead started mortgage application via Finmo",
        metadata: {
          finmoApplicationId: application.id,
          event: "application.started",
        },
      },
    });

    // Send Slack notification
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { firstName: true, lastName: true, email: true },
    });

    if (lead) {
      await sendSlackNotification({
        type: "lead_updated",
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadId,
        details: "🎉 Started mortgage application via Finmo!",
      });
    }

    // Holly sends encouragement message
    try {
      const decision = await handleConversation(leadId);
      await executeDecision(leadId, decision);
    } catch (error) {
      console.error("[Finmo Webhook] Error sending Holly message:", error);
    }

    console.log(`[Finmo Webhook] Application started tracked for lead ${leadId}`);
  } catch (error) {
    console.error("[Finmo Webhook] Error handling application.started:", error);
    throw error;
  }
}

/**
 * Handle application.completed event
 */
async function handleApplicationCompleted(leadId: string, application: any) {
  try {
    // Update lead with application completed timestamp and CONVERTED status
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        applicationCompletedAt: new Date(application.updatedAt),
        status: LeadStatus.CONVERTED,
        convertedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId,
        type: ActivityType.NOTE_ADDED,
        channel: CommunicationChannel.SYSTEM,
        subject: "Application Completed",
        content: "Lead completed and submitted mortgage application via Finmo",
        metadata: {
          finmoApplicationId: application.id,
          event: "application.completed",
        },
      },
    });

    // Send Slack notification
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { firstName: true, lastName: true, email: true },
    });

    if (lead) {
      await sendSlackNotification({
        type: "lead_updated",
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadId,
        details: "🚀 COMPLETED mortgage application! CONVERTED!",
      });
    }

    // Create Pipedrive deal
    try {
      await createPipedriveDeal(leadId);
    } catch (error) {
      console.error("[Finmo Webhook] Error creating Pipedrive deal:", error);
    }

    // Holly sends congratulations message
    try {
      const decision = await handleConversation(leadId);
      await executeDecision(leadId, decision);
    } catch (error) {
      console.error("[Finmo Webhook] Error sending Holly message:", error);
    }

    console.log(`[Finmo Webhook] Application completed tracked for lead ${leadId}`);
  } catch (error) {
    console.error("[Finmo Webhook] Error handling application.completed:", error);
    throw error;
  }
}

/**
 * Create deal in Pipedrive when lead converts
 */
async function createPipedriveDeal(leadId: string) {
  const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
  const PIPEDRIVE_COMPANY_DOMAIN = process.env.PIPEDRIVE_COMPANY_DOMAIN || "api";

  if (!PIPEDRIVE_API_TOKEN) {
    console.log("[Pipedrive] API token not configured, skipping deal creation");
    return;
  }

  // Build API base URL
  const API_BASE = `https://${PIPEDRIVE_COMPANY_DOMAIN}.pipedrive.com`;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        communications: {
          where: {
            channel: "SMS",
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        appointments: {
          where: {
            advisorEmail: { not: null },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new Error("Lead not found");
    }

    const rawData = lead.rawData as any || {};
    const callOutcome = rawData.callOutcome || {};

    // Create person in Pipedrive first
    const personResponse = await fetch(
      `${API_BASE}/v1/persons?api_token=${PIPEDRIVE_API_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${lead.firstName} ${lead.lastName}`,
          email: [{ value: lead.email, primary: true }],
          phone: lead.phone ? [{ value: lead.phone, primary: true }] : [],
        }),
      }
    );

    const personData = await personResponse.json();
    const personId = personData?.data?.id;

    if (!personId) {
      throw new Error("Failed to create Pipedrive person");
    }

    // Look up Pipedrive user ID by advisor email (if available)
    let assignedUserId = null;
    const advisorEmail = lead.appointments[0]?.advisorEmail;

    if (advisorEmail) {
      try {
        const userSearchResponse = await fetch(
          `${API_BASE}/v1/users/find?term=${encodeURIComponent(advisorEmail)}&api_token=${PIPEDRIVE_API_TOKEN}`
        );
        const userData = await userSearchResponse.json();

        if (userData?.data && userData.data.length > 0) {
          // Find exact email match
          const exactMatch = userData.data.find(
            (user: any) => user.email?.toLowerCase() === advisorEmail.toLowerCase()
          );
          if (exactMatch) {
            assignedUserId = exactMatch.id;
            console.log(`[Pipedrive] Found advisor ${exactMatch.name} (${advisorEmail}) - ID: ${assignedUserId}`);
          }
        }
      } catch (error) {
        console.error("[Pipedrive] Error looking up advisor user:", error);
        // Continue without assignment - don't fail the whole deal creation
      }
    }

    // Create deal in Pipedrive
    const dealTitle = `${lead.firstName} ${lead.lastName} - ${rawData.propertyType || "Property"} in ${rawData.city || "Unknown"}`;

    const dealResponse = await fetch(
      `${API_BASE}/v1/deals?api_token=${PIPEDRIVE_API_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dealTitle,
          person_id: personId,
          value: rawData.loanAmount || 0,
          currency: "CAD",
          status: "open",
          pipeline_id: 22, // Active Mortgage Pipeline
          stage_id: 152, // Doc Collection stage
          ...(assignedUserId && { user_id: assignedUserId }), // Assign to advisor if found
        }),
      }
    );

    const dealData = await dealResponse.json();

    if (!dealData?.success) {
      throw new Error(`Pipedrive API error: ${JSON.stringify(dealData)}`);
    }

    // Format SMS conversation history
    const smsHistory = lead.communications
      .map((comm) => {
        const timestamp = new Date(comm.createdAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        const direction = comm.direction === "OUTBOUND" ? "Holly →" : "Lead →";
        return `[${timestamp}] ${direction}\n${comm.content}`;
      })
      .join("\n\n");

    // Add note to deal with full context
    const noteContent = `
Lead converted from LOD2 system:

**Advisor:**
${lead.appointments[0]?.advisorName ? `- Discovery Call with: ${lead.appointments[0].advisorName}` : "- No advisor information available"}

**Loan Details:**
- Loan Type: ${rawData.loanType || "N/A"}
- Loan Amount: $${rawData.loanAmount?.toLocaleString() || "N/A"}
- Property Type: ${rawData.propertyType || "N/A"}
- Property City: ${rawData.city || "N/A"}, ${rawData.province || "N/A"}
- Purchase Price: $${rawData.purchasePrice?.toLocaleString() || "N/A"}
- Down Payment: $${rawData.downPayment?.toLocaleString() || "N/A"}
- Credit Score: ${rawData.creditScore || "N/A"}

**Call Outcome:**
${callOutcome.outcome ? `- Outcome: ${callOutcome.outcome}` : ""}
${callOutcome.notes ? `- Notes: ${callOutcome.notes}` : ""}
${callOutcome.programsDiscussed?.length ? `- Programs Discussed: ${callOutcome.programsDiscussed.join(", ")}` : ""}
${callOutcome.preferredProgram ? `- Preferred Program: ${callOutcome.preferredProgram}` : ""}

**Application:**
- Started: ${lead.applicationStartedAt ? new Date(lead.applicationStartedAt).toLocaleString() : "N/A"}
- Completed: ${lead.applicationCompletedAt ? new Date(lead.applicationCompletedAt).toLocaleString() : "N/A"}

**SMS Conversation History:**
${smsHistory || "No SMS conversations recorded"}
    `.trim();

    await fetch(
      `${API_BASE}/v1/notes?api_token=${PIPEDRIVE_API_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_id: dealData.data.id,
          content: noteContent,
        }),
      }
    );

    console.log(`[Pipedrive] Deal created successfully: ${dealData.data.id}`);

    await sendSlackNotification({
      type: "lead_updated",
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadId: lead.id,
      details: `💼 Pipedrive deal created: ${dealTitle}`,
    });
  } catch (error) {
    console.error("[Pipedrive] Error creating deal:", error);
    throw error;
  }
}
