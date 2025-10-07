/**
 * SendGrid Inbound Parse Webhook
 *
 * Receives inbound emails from leads replying to Holly's emails
 * Triggers AI to respond contextually
 *
 * Setup Instructions:
 * 1. Go to SendGrid > Settings > Inbound Parse
 * 2. Add domain: inspiredmortgage.ca (or subdomain like reply.inspiredmortgage.ca)
 * 3. Set destination URL: https://your-app.vercel.app/api/webhooks/inbound-email
 * 4. Check "POST the raw, full MIME message"
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleConversation, executeDecision } from "@/lib/ai-conversation-enhanced";
import { sendErrorAlert } from "@/lib/slack";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Parse SendGrid Inbound Parse webhook format
    const formData = await req.formData();

    const from = formData.get("from") as string;
    const to = formData.get("to") as string;
    const subject = formData.get("subject") as string;
    const text = formData.get("text") as string; // Plain text body
    const html = formData.get("html") as string; // HTML body

    console.log("[Inbound Email]", { from, to, subject });

    // Extract email address from "Name <email@domain.com>" format
    const emailMatch = from.match(/<(.+?)>/);
    const senderEmail = emailMatch ? emailMatch[1] : from.trim();

    // Find lead by email
    const lead = await prisma.lead.findFirst({
      where: {
        email: {
          equals: senderEmail,
          mode: "insensitive",
        },
      },
    });

    if (!lead) {
      console.warn(`[Inbound Email] No lead found for email: ${senderEmail}`);
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    // Store the inbound email as communication
    await prisma.communication.create({
      data: {
        leadId: lead.id,
        channel: "EMAIL",
        direction: "INBOUND",
        content: text || html || subject, // Use text if available, fallback to HTML or subject
        metadata: {
          subject,
          from: senderEmail,
          to,
        },
      },
    });

    // Use the email body (prefer plain text over HTML)
    const messageContent = text || html || subject;

    // Trigger AI conversation handler with EMAIL channel indicator
    const decision = await handleConversation(lead.id, messageContent, "EMAIL");

    // Execute the AI's decision (send SMS, email, both, etc.)
    await executeDecision(lead.id, decision);

    console.log("[Inbound Email] AI Response:", decision.action, decision.reasoning);

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      action: decision.action,
    });
  } catch (error) {
    console.error("[Inbound Email Error]", error);

    await sendErrorAlert({
      error: error instanceof Error ? error : new Error(String(error)),
      context: {
        location: "inbound-email webhook",
        details: { error: String(error) },
      },
    });

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
