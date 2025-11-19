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
