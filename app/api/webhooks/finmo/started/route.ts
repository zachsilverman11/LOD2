import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ActivityType, CommunicationChannel, LeadStatus } from "@/app/generated/prisma";
import { sendSlackNotification } from "@/lib/slack";
import { handleConversation, executeDecision } from "@/lib/ai-conversation-enhanced";

/**
 * Extract ALL borrower emails from Finmo payload
 * Handles multiple payload structures and returns all unique emails
 */
function extractAllBorrowerEmails(payload: any): string[] {
  const emails: string[] = [];

  // Main borrower
  if (payload.mainBorrower?.email) {
    emails.push(payload.mainBorrower.email.toLowerCase());
  }

  // borrowersArray (array format)
  if (Array.isArray(payload.borrowersArray)) {
    payload.borrowersArray.forEach((b: any) => {
      if (b?.email) emails.push(b.email.toLowerCase());
    });
  }

  // borrowers object (keyed by "1", "2", etc.)
  if (payload.borrowers && typeof payload.borrowers === 'object') {
    Object.values(payload.borrowers).forEach((b: any) => {
      if (b?.email) emails.push(b.email.toLowerCase());
    });
  }

  // Legacy/fallback fields
  if (payload.application?.email) {
    emails.push(payload.application.email.toLowerCase());
  }
  if (payload.email) {
    emails.push(payload.email.toLowerCase());
  }

  // Deduplicate
  return [...new Set(emails)];
}

/**
 * Normalize phone number to E.164 format for comparison
 * Strips all non-digit characters and ensures +1 prefix for North American numbers
 */
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Handle North American numbers
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Return with + prefix if not already
  return digits.startsWith('+') ? phone : `+${digits}`;
}

/**
 * Extract ALL borrower phone numbers from Finmo payload
 * Handles multiple payload structures and returns all unique normalized phones
 */
function extractAllBorrowerPhones(payload: any): string[] {
  const phones: string[] = [];

  // Main borrower
  if (payload.mainBorrower?.phone) {
    phones.push(normalizePhone(payload.mainBorrower.phone));
  }
  if (payload.mainBorrower?.cellPhone) {
    phones.push(normalizePhone(payload.mainBorrower.cellPhone));
  }

  // borrowersArray (array format)
  if (Array.isArray(payload.borrowersArray)) {
    payload.borrowersArray.forEach((b: any) => {
      if (b?.phone) phones.push(normalizePhone(b.phone));
      if (b?.cellPhone) phones.push(normalizePhone(b.cellPhone));
    });
  }

  // borrowers object (keyed by "1", "2", etc.)
  if (payload.borrowers && typeof payload.borrowers === 'object') {
    Object.values(payload.borrowers).forEach((b: any) => {
      if (b?.phone) phones.push(normalizePhone(b.phone));
      if (b?.cellPhone) phones.push(normalizePhone(b.cellPhone));
    });
  }

  // Legacy/fallback fields
  if (payload.application?.phone) {
    phones.push(normalizePhone(payload.application.phone));
  }
  if (payload.phone) {
    phones.push(normalizePhone(payload.phone));
  }

  // Deduplicate
  return [...new Set(phones)];
}

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

    // Extract ALL borrower emails from payload (main + co-borrowers)
    const allEmails = extractAllBorrowerEmails(payload);
    const primaryEmail = payload.mainBorrower?.email?.toLowerCase();

    if (allEmails.length === 0) {
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

    // Extract phone numbers for fallback lookup
    const allPhones = extractAllBorrowerPhones(payload);

    console.log(`[Finmo - Started] All borrower emails: ${allEmails.join(', ')}`);
    console.log(`[Finmo - Started] All borrower phones: ${allPhones.join(', ')}`);
    console.log(`[Finmo - Started] Primary email: ${primaryEmail || 'N/A'}`);

    // Lead lookup includes for all queries
    const leadInclude = {
      communications: {
        where: { channel: "SMS" as const },
        orderBy: { createdAt: "asc" as const },
      },
      appointments: {
        where: { advisorEmail: { not: null } },
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
    };

    // Find lead by ANY borrower email (case-insensitive)
    // This handles cases where the lead is a co-borrower, not the main applicant
    let lead = await prisma.lead.findFirst({
      where: {
        email: {
          in: allEmails,
          mode: 'insensitive'
        }
      },
      include: leadInclude,
    });

    // Track how we matched the lead
    let matchedViaPhone = false;

    // FALLBACK: If no email match, try phone number
    if (!lead && allPhones.length > 0) {
      console.log(`[Finmo - Started] No email match, trying phone fallback...`);

      // Try exact match first
      lead = await prisma.lead.findFirst({
        where: {
          phone: { in: allPhones }
        },
        include: leadInclude,
      });

      // If still no match, try normalized comparison (handles format differences)
      if (!lead) {
        // Get leads with similar phone patterns
        const phoneDigits = allPhones.map(p => p.replace(/\D/g, '').slice(-10));
        const potentialLeads = await prisma.lead.findMany({
          where: {
            phone: { not: null }
          },
          include: leadInclude,
        });

        // Find a lead whose normalized phone matches any of our phones
        lead = potentialLeads.find(l => {
          if (!l.phone) return false;
          const leadDigits = l.phone.replace(/\D/g, '').slice(-10);
          return phoneDigits.includes(leadDigits);
        }) || null;
      }

      if (lead) {
        matchedViaPhone = true;
        console.log(`[Finmo - Started] ✅ Found lead via PHONE FALLBACK: ${lead.firstName} ${lead.lastName}`);

        // Send Slack notification about phone match
        await sendSlackNotification({
          type: "lead_updated",
          leadName: `${lead.firstName} ${lead.lastName}`,
          leadId: lead.id,
          details: `📱 **PHONE FALLBACK MATCH**\n\nFinmo used different email(s): ${allEmails.join(', ')}\nMatched via phone: ${lead.phone}\nLOD email: ${lead.email}\n\nProceeding with application started flow.`,
        });
      }
    }

    if (!lead) {
      console.error(`[Finmo - Started] Lead not found for any email or phone`);
      console.error(`[Finmo - Started]   Emails tried: ${allEmails.join(', ')}`);
      console.error(`[Finmo - Started]   Phones tried: ${allPhones.join(', ')}`);

      // Get all emails in database for debugging
      const allLeads = await prisma.lead.findMany({
        select: { email: true, firstName: true, lastName: true, phone: true },
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
      const recentLeads = allLeads.map(l => `${l.firstName} ${l.lastName}: ${l.email} | ${l.phone}`).join('\n');

      await sendSlackNotification({
        type: "error",
        message: "Finmo Webhook (Started): Lead Not Found",
        details: `**Emails from Finmo:** ${allEmails.join(', ')}\n**Phones from Finmo:** ${allPhones.join(', ')}\n\n**Recent leads in database:**\n${recentLeads}`,
      });
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Check if lead was matched via co-borrower email (not primary applicant)
    const matchedViaCoBorrower = primaryEmail && lead.email?.toLowerCase() !== primaryEmail;
    if (matchedViaCoBorrower) {
      console.log(`[Finmo - Started] ℹ️  Lead matched via CO-BORROWER email`);
      console.log(`[Finmo - Started]    Main applicant: ${primaryEmail}`);
      console.log(`[Finmo - Started]    Matched lead: ${lead.firstName} ${lead.lastName} (${lead.email})`);

      await sendSlackNotification({
        type: "lead_updated",
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadId: lead.id,
        details: `ℹ️  **Co-Borrower Match**: Lead found via co-borrower email.\n\n` +
                 `Main applicant email: ${primaryEmail}\n` +
                 `Matched lead email: ${lead.email}\n\n` +
                 `The lead in our system is a co-borrower on this Finmo application.`,
      });
    }

    console.log(`[Finmo - Started] Found lead: ${lead.firstName} ${lead.lastName} (ID: ${lead.id})`);
    console.log(`[Finmo - Started] Current lead status: ${lead.status}`);

    // IMPORTANT: We process ALL leads regardless of their current status.
    // Even leads in NURTURING or LOST stages should be moved to APPLICATION_STARTED
    // and get a Pipedrive deal created when they start an application via Finmo.
    // This is intentional - a lead re-engaging with the application process is a
    // significant event that overrides their previous "cold" status.
    const isReEngagement = lead.status === LeadStatus.NURTURING || lead.status === LeadStatus.LOST;

    if (isReEngagement) {
      console.log(`[Finmo - Started] 🔥 RE-ENGAGEMENT: Lead was in ${lead.status} status and is now starting an application!`);

      // Send special Slack notification for re-engaged leads
      await sendSlackNotification({
        type: "lead_updated",
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadId: lead.id,
        details: `🔥 **RE-ENGAGEMENT ALERT** 🔥\n\nLead was previously in **${lead.status}** status but just started a Finmo application!\n\nThis is a "cold" lead coming back to life. Moving to APPLICATION_STARTED and creating Pipedrive deal.`,
      });
    }

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
    const reEngagementNote = isReEngagement
      ? `\n\n🔥 RE-ENGAGEMENT: This lead was previously in ${lead.status} status and has come back to start an application!`
      : "";
    const phoneMatchNote = matchedViaPhone
      ? `\n\n📱 PHONE FALLBACK: Lead was matched via phone number because Finmo used a different email (${allEmails.join(', ')}).`
      : "";

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: ActivityType.NOTE_ADDED,
        channel: CommunicationChannel.SYSTEM,
        subject: isReEngagement
          ? `🔥 RE-ENGAGEMENT: APPLICATION STARTED (was ${lead.status})`
          : matchedViaPhone
            ? "📱 APPLICATION STARTED (Phone Match)"
            : "🚦 APPLICATION STARTED - Finmo Handoff Complete",
        content: `Lead started mortgage application via Finmo.${reEngagementNote}${phoneMatchNote}\n\n🛑 HOLLY PERMANENTLY DISABLED 🛑\n\nAll communication from this point forward is handled by the Finmo automated system.\n\nHolly will NOT:\n- Send any messages\n- Follow up or nurture\n- Move stages\n- Take any automated actions\n\n📧 Post-call email/SMS sequences will auto-cancel (applicationStartedAt is set).\n\nFinmo owns this relationship until application is completed or abandoned.`,
        metadata: {
          finmoDealId: payload.finmoDealId || payload.dealId,
          finmoId: payload.id,
          event: "application.started",
          hollyDisabled: true,
          hollyNextReviewAt: oneYearFromNow.toISOString(),
          matchedViaPhone: matchedViaPhone,
          finmoEmails: allEmails,
          finmoPhones: allPhones,
          pipedriveDealId: pipedriveDealId,
          previousStatus: lead.status,
          isReEngagement: isReEngagement,
        },
      },
    });

    // Send Slack notification (only if not already sent for re-engagement or phone match)
    if (!isReEngagement && !matchedViaPhone) {
      await sendSlackNotification({
        type: "lead_updated",
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadId: lead.id,
        details: `🎉 Started mortgage application via Finmo!${pipedriveDealId ? ` | Pipedrive deal: ${pipedriveDealId}` : ''}\n\n🛑 Holly's messaging is now PERMANENTLY DISABLED. Finmo system has taken over all communication.`,
      });
    }

    // 🚫 DO NOT send Holly message - Finmo handles all communication from this point
    // Previous behavior: Holly would send encouragement message
    // NEW behavior: Complete handoff - Holly stops all contact
    console.log(`[Finmo - Started] 🚫 Holly messaging disabled - Finmo has taken over communication`);

    const matchInfo = matchedViaPhone ? ' - PHONE MATCH' : '';
    console.log(`[Finmo - Started] ✅ Lead ${lead.id} moved to APPLICATION_STARTED (was: ${lead.status}${isReEngagement ? ' - RE-ENGAGEMENT!' : ''}${matchInfo})`);
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
          pipeline_id: 33, // Leads on Demand (Engaged)
          stage_id: 239, // App Started (first stage)
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
