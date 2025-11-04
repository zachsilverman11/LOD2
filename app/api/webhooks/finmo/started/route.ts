import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ActivityType, CommunicationChannel, LeadStatus } from "@/app/generated/prisma";
import { sendSlackNotification } from "@/lib/slack";
import { handleConversation, executeDecision } from "@/lib/ai-conversation-enhanced";

/**
 * Finmo Webhook: Application Started
 *
 * Triggered when a borrower starts filling out the mortgage application
 * Moves lead from CALL_COMPLETED → APPLICATION_STARTED
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    console.log("[Finmo - Started] ========== INCOMING WEBHOOK ==========");
    console.log("[Finmo - Started] Raw Body:", rawBody);

    const payload: any = JSON.parse(rawBody);
    console.log("[Finmo - Started] Parsed Payload:", JSON.stringify(payload, null, 2));

    // Extract email from Finmo payload structure
    const email = payload.mainBorrower?.email ||
                  payload.borrowersArray?.[0]?.email ||
                  payload.borrowers?.["1"]?.email;

    if (!email) {
      console.error("[Finmo - Started] No email found in payload");
      await sendSlackNotification({
        type: "error",
        message: "Finmo Webhook (Started): No Email Found",
        details: `Payload: ${JSON.stringify(payload, null, 2)}`,
      });
      return NextResponse.json(
        { error: "No email in payload" },
        { status: 400 }
      );
    }

    console.log(`[Finmo - Started] Email: ${email}`);

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
      console.error(`[Finmo - Started] Lead not found for email: ${email}`);

      // Get all emails in database for debugging (first 100 chars each)
      const allLeads = await prisma.lead.findMany({
        select: { email: true, firstName: true, lastName: true },
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
      const recentEmails = allLeads.map(l => `${l.firstName} ${l.lastName}: ${l.email}`).join('\n');

      await sendSlackNotification({
        type: "error",
        message: "Finmo Webhook (Started): Lead Not Found",
        details: `Email from Finmo: ${email}\n\nRecent leads in database:\n${recentEmails}`,
      });
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    console.log(`[Finmo - Started] Found lead: ${lead.firstName} ${lead.lastName} (ID: ${lead.id})`);

    // Create Pipedrive deal first to get the deal ID
    let pipedriveDealId = null;
    try {
      // Only create if deal doesn't already exist
      if (!lead.pipedriveDealId) {
        pipedriveDealId = await createPipedriveDeal(lead.id, payload);
      } else {
        console.log(`[Finmo - Started] Lead already has Pipedrive deal: ${lead.pipedriveDealId}`);
        pipedriveDealId = lead.pipedriveDealId;
      }
    } catch (error) {
      console.error("[Finmo - Started] Error creating Pipedrive deal:", error);

      // Send Slack alert for deal creation failure
      try {
        await sendSlackNotification({
          type: 'error',
          message: `⚠️  Failed to create Pipedrive deal on application start`,
          context: {
            lead: `${lead.firstName} ${lead.lastName} (${lead.email})`,
            leadId: lead.id,
            error: error instanceof Error ? error.message : String(error),
            note: 'Deal creation failed but lead will be marked as APPLICATION_STARTED. Fallback in /submitted endpoint will attempt to create deal.',
          },
        });
      } catch (slackError) {
        console.error("[Finmo - Started] Failed to send Slack notification:", slackError);
      }

      // Continue even if Pipedrive fails - don't block status update
      // pipedriveDealId will remain null, fallback in /submitted will create deal
    }

    // Update lead to APPLICATION_STARTED with Pipedrive deal ID
    // CRITICAL: Set nextReviewAt to far future (1 year) to prevent Holly from ever contacting again
    // Finmo system handles ALL communication from this point forward
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        applicationStartedAt: new Date(),
        status: LeadStatus.APPLICATION_STARTED,
        pipedriveDealId: pipedriveDealId,
        nextReviewAt: oneYearFromNow, // Holly will never review this lead again
        updatedAt: new Date(),
      },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: ActivityType.NOTE_ADDED,
        channel: CommunicationChannel.SYSTEM,
        subject: "🚦 APPLICATION STARTED - Finmo Handoff Complete",
        content: "Lead started mortgage application via Finmo.\n\n🛑 HOLLY PERMANENTLY DISABLED 🛑\n\nAll communication from this point forward is handled by the Finmo automated system.\n\nHolly will NOT:\n- Send any messages\n- Follow up or nurture\n- Move stages\n- Take any automated actions\n\nFinmo owns this relationship until application is completed or abandoned.",
        metadata: {
          finmoDealId: payload.finmoDealId || payload.dealId,
          finmoId: payload.id,
          event: "application.started",
          hollyDisabled: true,
          hollyNextReviewAt: oneYearFromNow.toISOString(),
          pipedriveDealId: pipedriveDealId,
        },
      },
    });

    // Send Slack notification
    await sendSlackNotification({
      type: "lead_updated",
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadId: lead.id,
      details: `🎉 Started mortgage application via Finmo!${pipedriveDealId ? ` | Pipedrive deal: ${pipedriveDealId}` : ''}\n\n🛑 Holly's messaging is now PERMANENTLY DISABLED. Finmo system has taken over all communication.`,
    });

    // 🚫 DO NOT send Holly message - Finmo handles all communication from this point
    // Previous behavior: Holly would send encouragement message
    // NEW behavior: Complete handoff - Holly stops all contact
    console.log(`[Finmo - Started] 🚫 Holly messaging disabled - Finmo has taken over communication`);

    console.log(`[Finmo - Started] ✅ Lead ${lead.id} moved to APPLICATION_STARTED`);
    console.log("[Finmo - Started] ========== WEBHOOK PROCESSED SUCCESSFULLY ==========");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Finmo - Started] Error:", error);
    await sendSlackNotification({
      type: "error",
      message: "Finmo Webhook (Started) Error",
      details: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Create deal in Pipedrive when application starts
 */
export async function createPipedriveDeal(leadId: string, finmoPayload: any) {
  const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
  const PIPEDRIVE_COMPANY_DOMAIN = process.env.PIPEDRIVE_COMPANY_DOMAIN || "api";

  if (!PIPEDRIVE_API_TOKEN) {
    console.error("[Pipedrive] CRITICAL: PIPEDRIVE_API_TOKEN environment variable is not set");
    throw new Error("PIPEDRIVE_API_TOKEN environment variable is not set. Cannot create Pipedrive deal.");
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
