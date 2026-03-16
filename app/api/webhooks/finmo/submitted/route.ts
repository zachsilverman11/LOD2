import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ActivityType, CommunicationChannel, LeadStatus } from "@/app/generated/prisma";
import { sendSlackNotification } from "@/lib/slack";
import { handleConversation, executeDecision } from "@/lib/holly/conversation-handler";

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
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits.startsWith('+') ? phone : `+${digits}`;
}

/**
 * Extract ALL borrower phone numbers from Finmo payload
 */
function extractAllBorrowerPhones(payload: any): string[] {
  const phones: string[] = [];

  if (payload.mainBorrower?.phone) phones.push(normalizePhone(payload.mainBorrower.phone));
  if (payload.mainBorrower?.cellPhone) phones.push(normalizePhone(payload.mainBorrower.cellPhone));

  if (Array.isArray(payload.borrowersArray)) {
    payload.borrowersArray.forEach((b: any) => {
      if (b?.phone) phones.push(normalizePhone(b.phone));
      if (b?.cellPhone) phones.push(normalizePhone(b.cellPhone));
    });
  }

  if (payload.borrowers && typeof payload.borrowers === 'object') {
    Object.values(payload.borrowers).forEach((b: any) => {
      if (b?.phone) phones.push(normalizePhone(b.phone));
      if (b?.cellPhone) phones.push(normalizePhone(b.cellPhone));
    });
  }

  if (payload.application?.phone) phones.push(normalizePhone(payload.application.phone));
  if (payload.phone) phones.push(normalizePhone(payload.phone));

  return [...new Set(phones)];
}

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

    // Extract ALL borrower emails from payload (main + co-borrowers)
    const allEmails = extractAllBorrowerEmails(payload);
    const primaryEmail = payload.mainBorrower?.email?.toLowerCase();

    if (allEmails.length === 0) {
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

    // Extract phone numbers for fallback lookup
    const allPhones = extractAllBorrowerPhones(payload);

    console.log(`[Finmo - Submitted] All borrower emails: ${allEmails.join(', ')}`);
    console.log(`[Finmo - Submitted] All borrower phones: ${allPhones.join(', ')}`);
    console.log(`[Finmo - Submitted] Primary email: ${primaryEmail || 'N/A'}`);

    // Lead lookup includes
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
    let lead = await prisma.lead.findFirst({
      where: {
        email: {
          in: allEmails,
          mode: 'insensitive'
        }
      },
      include: leadInclude,
    });

    // FALLBACK: If no email match, try phone number
    if (!lead && allPhones.length > 0) {
      console.log(`[Finmo - Submitted] No email match, trying phone fallback...`);

      lead = await prisma.lead.findFirst({
        where: { phone: { in: allPhones } },
        include: leadInclude,
      });

      if (!lead) {
        const phoneDigits = allPhones.map(p => p.replace(/\D/g, '').slice(-10));
        const potentialLeads = await prisma.lead.findMany({
          where: { phone: { not: null } },
          include: leadInclude,
        });

        lead = potentialLeads.find(l => {
          if (!l.phone) return false;
          const leadDigits = l.phone.replace(/\D/g, '').slice(-10);
          return phoneDigits.includes(leadDigits);
        }) || null;
      }

      if (lead) {
        console.log(`[Finmo - Submitted] ✅ Found lead via PHONE FALLBACK: ${lead.firstName} ${lead.lastName}`);
      }
    }

    if (!lead) {
      console.error(`[Finmo - Submitted] Lead not found for any email or phone`);

      const allLeads = await prisma.lead.findMany({
        select: { email: true, firstName: true, lastName: true, phone: true },
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
      const recentLeads = allLeads.map(l => `${l.firstName} ${l.lastName}: ${l.email} | ${l.phone}`).join('\n');

      await sendSlackNotification({
        type: "error",
        message: "Finmo Webhook (Submitted): Lead Not Found",
        details: `**Emails from Finmo:** ${allEmails.join(', ')}\n**Phones from Finmo:** ${allPhones.join(', ')}\n\n**Recent leads:**\n${recentLeads}`,
      });
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Check if lead was matched via co-borrower email (not primary applicant)
    const matchedViaCoBorrower = primaryEmail && lead.email?.toLowerCase() !== primaryEmail;
    if (matchedViaCoBorrower) {
      console.log(`[Finmo - Submitted] ℹ️  Lead matched via CO-BORROWER email`);
      console.log(`[Finmo - Submitted]    Main applicant: ${primaryEmail}`);
      console.log(`[Finmo - Submitted]    Matched lead: ${lead.firstName} ${lead.lastName} (${lead.email})`);

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

    console.log(`[Finmo - Submitted] Found lead: ${lead.firstName} ${lead.lastName} (ID: ${lead.id})`);

    // Deal should already exist from APPLICATION_STARTED - create if missing (fallback)
    let pipedriveDealId = lead.pipedriveDealId;

    if (!pipedriveDealId) {
      console.warn(`[Finmo - Submitted] ⚠️  No Pipedrive deal found for ${lead.firstName} ${lead.lastName}`);
      console.warn(`[Finmo - Submitted] This indicates /started webhook failed to create deal. Creating now as fallback.`);

      // Send Slack alert that fallback was needed
      try {
        await sendSlackNotification({
          type: 'warning',
          message: `⚠️  Pipedrive deal created on COMPLETION (should have been on START)`,
          context: {
            lead: `${lead.firstName} ${lead.lastName} (${lead.email})`,
            leadId: lead.id,
            note: 'The /started webhook failed to create the deal. Creating deal now as fallback. Check /started endpoint logs for the root cause.',
          },
        });
      } catch (slackError) {
        console.error("[Finmo - Submitted] Failed to send Slack notification:", slackError);
      }

      // Create Pipedrive deal as fallback
      try {
        // Import the createPipedriveDeal function dynamically from started endpoint
        // This is a fallback - normally deals should be created in /started
        const { createPipedriveDeal } = await import('../started/route');
        pipedriveDealId = await createPipedriveDeal(lead.id, payload);

        if (pipedriveDealId) {
          console.log(`[Finmo - Submitted] ✅ Fallback deal created: ${pipedriveDealId}`);
        }
      } catch (error) {
        console.error("[Finmo - Submitted] ❌ Failed to create fallback deal:", error);

        // Critical alert - both /started and /submitted failed
        await sendSlackNotification({
          type: 'error',
          message: `🚨 CRITICAL: Failed to create Pipedrive deal even on completion`,
          context: {
            lead: `${lead.firstName} ${lead.lastName} (${lead.email})`,
            leadId: lead.id,
            error: error instanceof Error ? error.message : String(error),
            note: 'Both /started and /submitted webhooks failed to create deal. Manual intervention required.',
          },
        });
      }
    }

    // Update lead to CONVERTED (deal already created when application started)
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        applicationCompletedAt: new Date(),
        status: LeadStatus.CONVERTED,
        convertedAt: new Date(),
        updatedAt: new Date(),
        hollyDisabled: true,      // Stop autonomous processing - journey is complete
        nextReviewAt: null,        // Clear any scheduled reviews
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

    // 🛑 CRITICAL: DO NOT call Holly here!
    // Holly is DISABLED for CONVERTED leads (set on line 145)
    // Finmo system handles all communication from this point forward
    // Any Holly calls here would bypass safety guardrails and message completed leads!
    //
    // REMOVED (was causing Stephanie Buchanan issue):
    // const decision = await handleConversation(lead.id);
    // await executeDecision(lead.id, decision);

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
