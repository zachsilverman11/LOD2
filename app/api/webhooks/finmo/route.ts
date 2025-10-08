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

    // Verify webhook signature (security measure)
    if (signature && !verifyFinmoSignature(rawBody, signature)) {
      console.error("[Finmo Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload: FinmoWebhookPayload = JSON.parse(rawBody);
    const { event, application } = payload;

    console.log(`[Finmo Webhook] Received ${event} for ${application.email}`);

    // Find lead by email
    const lead = await prisma.lead.findUnique({
      where: { email: application.email.toLowerCase() },
    });

    if (!lead) {
      console.error(`[Finmo Webhook] Lead not found for email: ${application.email}`);
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Handle different event types
    if (event === "application.started") {
      await handleApplicationStarted(lead.id, application);
    } else if (event === "application.completed") {
      await handleApplicationCompleted(lead.id, application);
    }

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
    // Update lead with application started timestamp
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        applicationStartedAt: new Date(application.createdAt),
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
    // Update lead with application completed timestamp
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
