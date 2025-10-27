import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ActivityType, CommunicationChannel, LeadStatus } from "@/app/generated/prisma";
import { sendSlackNotification } from "@/lib/slack";
import { handleConversation, executeDecision } from "@/lib/ai-conversation-enhanced";

/**
 * Finmo Webhook: Application Submitted
 *
 * Triggered when a borrower completes and submits the mortgage application
 * Moves lead from APPLICATION_STARTED → CONVERTED
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    console.log("[Finmo - Submitted] ========== INCOMING WEBHOOK ==========");
    console.log("[Finmo - Submitted] Raw Body:", rawBody);

    const payload: any = JSON.parse(rawBody);
    console.log("[Finmo - Submitted] Parsed Payload:", JSON.stringify(payload, null, 2));

    // Extract email from Finmo payload structure
    const email = payload.mainBorrower?.email ||
                  payload.borrowersArray?.[0]?.email ||
                  payload.borrowers?.["1"]?.email;

    if (!email) {
      console.error("[Finmo - Submitted] No email found in payload");
      await sendSlackNotification({
        type: "error",
        message: "Finmo Webhook (Submitted): No Email Found",
        details: `Payload: ${JSON.stringify(payload, null, 2)}`,
      });
      return NextResponse.json(
        { error: "No email in payload" },
        { status: 400 }
      );
    }

    console.log(`[Finmo - Submitted] Email: ${email}`);

    // Find lead by email (case-insensitive to handle R277ben vs r277ben)
    const lead = await prisma.lead.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive'
        }
      },
      include: {
        communications: {
          where: { channel: "SMS" },
          orderBy: { createdAt: "asc" },
        },
        appointments: {
          where: { advisorEmail: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!lead) {
      console.error(`[Finmo - Submitted] Lead not found for email: ${email}`);

      // Get all emails in database for debugging
      const allLeads = await prisma.lead.findMany({
        select: { email: true, firstName: true, lastName: true },
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
      const recentEmails = allLeads.map(l => `${l.firstName} ${l.lastName}: ${l.email}`).join('\n');

      await sendSlackNotification({
        type: "error",
        message: "Finmo Webhook (Submitted): Lead Not Found",
        details: `Email from Finmo: ${email}\n\nRecent leads in database:\n${recentEmails}`,
      });
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    console.log(`[Finmo - Submitted] Found lead: ${lead.firstName} ${lead.lastName} (ID: ${lead.id})`);

    // Create Pipedrive deal first to get the deal ID
    let pipedriveDealId = null;
    try {
      pipedriveDealId = await createPipedriveDeal(lead.id, payload);
    } catch (error) {
      console.error("[Finmo - Submitted] Error creating Pipedrive deal:", error);
      // Continue even if Pipedrive fails - don't block conversion
    }

    // Update lead to CONVERTED with Pipedrive deal ID
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        applicationCompletedAt: new Date(),
        status: LeadStatus.CONVERTED,
        convertedAt: new Date(),
        pipedriveDealId: pipedriveDealId,
        updatedAt: new Date(),
      },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: ActivityType.NOTE_ADDED,
        channel: CommunicationChannel.SYSTEM,
        subject: "Application Completed",
        content: "Lead completed and submitted mortgage application via Finmo",
        metadata: {
          finmoDealId: payload.finmoDealId || payload.dealId,
          finmoId: payload.id,
          event: "application.completed",
          pipedriveDealId: pipedriveDealId,
        },
      },
    });

    // Send Slack notification
    await sendSlackNotification({
      type: "lead_updated",
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadId: lead.id,
      details: `🚀 COMPLETED mortgage application! CONVERTED!${pipedriveDealId ? ` | Pipedrive deal: ${pipedriveDealId}` : ''}`,
    });

    // Holly sends congratulations message
    try {
      const decision = await handleConversation(lead.id);
      await executeDecision(lead.id, decision);
    } catch (error) {
      console.error("[Finmo - Submitted] Error sending Holly message:", error);
    }

    console.log(`[Finmo - Submitted] ✅ Lead ${lead.id} moved to CONVERTED`);
    console.log("[Finmo - Submitted] ========== WEBHOOK PROCESSED SUCCESSFULLY ==========");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Finmo - Submitted] Error:", error);
    await sendSlackNotification({
      type: "error",
      message: "Finmo Webhook (Submitted) Error",
      details: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Create deal in Pipedrive when lead converts
 */
async function createPipedriveDeal(leadId: string, finmoPayload: any) {
  const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
  const PIPEDRIVE_COMPANY_DOMAIN = process.env.PIPEDRIVE_COMPANY_DOMAIN || "api";

  if (!PIPEDRIVE_API_TOKEN) {
    console.log("[Pipedrive] API token not configured, skipping deal creation");
    return null;
  }

  const API_BASE = `https://${PIPEDRIVE_COMPANY_DOMAIN}.pipedrive.com`;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        communications: {
          where: { channel: "SMS" },
          orderBy: { createdAt: "asc" },
        },
        appointments: {
          where: { advisorEmail: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        activities: {
          where: { type: "NOTE_ADDED" },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!lead) {
      throw new Error("Lead not found");
    }

    const rawData = lead.rawData as any || {};
    const mainBorrower = finmoPayload.mainBorrower || {};

    // Create person in Pipedrive
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

    // Look up advisor user ID
    let assignedUserId = null;
    const advisorEmail = lead.appointments[0]?.advisorEmail;

    if (advisorEmail) {
      try {
        const userSearchResponse = await fetch(
          `${API_BASE}/v1/users/find?term=${encodeURIComponent(advisorEmail)}&api_token=${PIPEDRIVE_API_TOKEN}`
        );
        const userData = await userSearchResponse.json();

        if (userData?.data && userData.data.length > 0) {
          const exactMatch = userData.data.find(
            (user: any) => user.email?.toLowerCase() === advisorEmail.toLowerCase()
          );
          if (exactMatch) {
            assignedUserId = exactMatch.id;
          }
        }
      } catch (error) {
        console.error("[Pipedrive] Error looking up advisor user:", error);
      }
    }

    // Create deal
    const dealTitle = `${lead.firstName} ${lead.lastName} - ${mainBorrower.city || rawData.city || "Unknown"} Deal`;

    const dealResponse = await fetch(
      `${API_BASE}/v1/deals?api_token=${PIPEDRIVE_API_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dealTitle,
          person_id: personId,
          value: finmoPayload.purchasePrice || rawData.loanAmount || 0,
          currency: "CAD",
          status: "open",
          pipeline_id: 22,
          stage_id: 223, // Application stage in Active Mortgage Pipeline
          ...(assignedUserId && { user_id: assignedUserId }),
        }),
      }
    );

    const dealData = await dealResponse.json();

    if (!dealData?.success) {
      throw new Error(`Pipedrive API error: ${JSON.stringify(dealData)}`);
    }

    // Format SMS history
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

    // Format notes history
    const notesHistory = lead.activities && lead.activities.length > 0
      ? lead.activities
          .map((activity) => {
            const timestamp = new Date(activity.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });
            const subject = activity.subject ? `[${activity.subject}] ` : "";
            return `[${timestamp}] ${subject}${activity.content}`;
          })
          .join("\n\n")
      : "No notes recorded";

    // Add note with context
    const noteContent = `
Lead converted from LOD2 system:

**Advisor:**
${lead.appointments[0]?.advisorName ? `- Discovery Call with: ${lead.appointments[0].advisorName}` : "- No advisor information available"}

**Finmo Details:**
- Deal ID: ${finmoPayload.finmoDealId || finmoPayload.dealId}
- Purchase Price: $${finmoPayload.purchasePrice?.toLocaleString() || "N/A"}
- Down Payment: $${finmoPayload.downPayment?.toLocaleString() || "N/A"}
- Goal: ${finmoPayload.goal || "N/A"}

**Application:**
- Started: ${lead.applicationStartedAt ? new Date(lead.applicationStartedAt).toLocaleString() : "N/A"}
- Completed: ${lead.applicationCompletedAt ? new Date(lead.applicationCompletedAt).toLocaleString() : "N/A"}

**Notes History:**
${notesHistory}

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

    // Return the Pipedrive deal ID
    return dealData.data.id.toString();
  } catch (error) {
    console.error("[Pipedrive] Error creating deal:", error);
    throw error;
  }
}
