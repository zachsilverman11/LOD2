import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ActivityType, CommunicationChannel, LeadStatus } from "@/app/generated/prisma";
import { sendSlackNotification } from "@/lib/slack";

/**
 * Admin endpoint to manually move a lead to APPLICATION_STARTED status
 * Used when Finmo webhook wasn't triggered or needs manual correction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Find lead by email
    const lead = await prisma.lead.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!lead) {
      return NextResponse.json(
        { error: `Lead not found with email: ${email}` },
        { status: 404 }
      );
    }

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
        subject: "Application Started (Manual)",
        content: "Lead manually moved to APPLICATION_STARTED status via admin endpoint",
        metadata: {
          source: "admin_api",
          previousStatus: lead.status,
        },
      },
    });

    // Send Slack notification
    await sendSlackNotification({
      type: "lead_updated",
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadId: lead.id,
      details: `🎉 Manually moved to APPLICATION_STARTED (from ${lead.status})`,
    });

    console.log(`[Admin] Moved lead ${lead.id} (${lead.email}) to APPLICATION_STARTED`);

    return NextResponse.json({
      success: true,
      lead: {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        previousStatus: lead.status,
        newStatus: "APPLICATION_STARTED",
      },
    });
  } catch (error) {
    console.error("[Admin] Error moving lead to APPLICATION_STARTED:", error);
    return NextResponse.json(
      {
        error: "Failed to move lead",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
