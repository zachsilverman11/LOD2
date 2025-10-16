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

    // Update lead to APPLICATION_STARTED
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        applicationStartedAt: new Date(),
        status: LeadStatus.APPLICATION_STARTED,
        updatedAt: new Date(),
      },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: ActivityType.NOTE_ADDED,
        channel: CommunicationChannel.SYSTEM,
        subject: "Application Started",
        content: "Lead started mortgage application via Finmo",
        metadata: {
          finmoDealId: payload.finmoDealId || payload.dealId,
          finmoId: payload.id,
          event: "application.started",
        },
      },
    });

    // Send Slack notification
    await sendSlackNotification({
      type: "lead_updated",
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadId: lead.id,
      details: "🎉 Started mortgage application via Finmo!",
    });

    // Holly sends encouragement message
    try {
      const decision = await handleConversation(lead.id);
      await executeDecision(lead.id, decision);
    } catch (error) {
      console.error("[Finmo - Started] Error sending Holly message:", error);
    }

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
