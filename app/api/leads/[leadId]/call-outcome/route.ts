import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ActivityType, CommunicationChannel, LeadStatus } from "@/app/generated/prisma";
import { sendSlackNotification } from "@/lib/slack";
import { handleConversation, executeDecision } from "@/lib/ai-conversation-enhanced";

type CallOutcome = "hot_lead" | "needs_followup" | "not_qualified" | "long_timeline";
type CallTimeline = "asap" | "1-2_weeks" | "1-3_months" | "3-6_months" | "6+_months";
type NextStep = "send_application" | "request_documents" | "compare_rates" | "schedule_followup" | "none";

interface CallOutcomeRequest {
  outcome: CallOutcome;
  timeline?: CallTimeline;
  nextStep?: NextStep;
  notes?: string;
  programsDiscussed?: string[];
  preferredProgram?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const body: CallOutcomeRequest = await request.json();
    const { outcome, timeline, nextStep, notes, programsDiscussed, preferredProgram } = body;

    if (!outcome) {
      return NextResponse.json(
        { error: "Call outcome is required" },
        { status: 400 }
      );
    }

    // Find the lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { appointments: true },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Prepare call outcome data
    const callOutcomeData = {
      outcome,
      timeline,
      nextStep,
      notes,
      programsDiscussed,
      preferredProgram,
      capturedAt: new Date().toISOString(),
    };

    // Update lead with call outcome in rawData
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        rawData: {
          ...(lead.rawData as object || {}),
          callOutcome: callOutcomeData,
        },
        // Update lead status based on outcome
        status: getLeadStatusForOutcome(outcome),
      },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId: leadId,
        type: ActivityType.NOTE_ADDED,
        channel: CommunicationChannel.SYSTEM,
        subject: `Call outcome: ${outcome.replace("_", " ")}`,
        content: notes || `Call marked as ${outcome.replace("_", " ")}`,
        metadata: { callOutcome: callOutcomeData },
      },
    });

    // Send Slack notification
    await sendSlackNotification({
      type: "lead_updated",
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadId: lead.id,
      details: `Call outcome captured: ${outcome.replace("_", " ").toUpperCase()}${notes ? ` - ${notes}` : ""}`,
    });

    // Schedule Holly's follow-up based on outcome
    await scheduleHollyFollowUp(leadId, outcome);

    return NextResponse.json({
      success: true,
      message: "Call outcome recorded successfully",
      lead: updatedLead,
    });
  } catch (error) {
    console.error("Error recording call outcome:", error);
    return NextResponse.json(
      { error: "Failed to record call outcome" },
      { status: 500 }
    );
  }
}

/**
 * Determine lead status based on call outcome
 */
function getLeadStatusForOutcome(outcome: CallOutcome): LeadStatus {
  switch (outcome) {
    case "hot_lead":
      return LeadStatus.CALL_COMPLETED; // Hot leads stay in CALL_COMPLETED until they submit app
    case "needs_followup":
      return LeadStatus.ENGAGED; // Back to engaged for nurturing
    case "not_qualified":
      return LeadStatus.LOST; // Mark as lost
    case "long_timeline":
      return LeadStatus.NURTURING; // Long-term nurture
    default:
      return LeadStatus.CALL_COMPLETED;
  }
}

/**
 * Schedule Holly's intelligent follow-up based on call outcome
 */
async function scheduleHollyFollowUp(leadId: string, outcome: CallOutcome) {
  try {
    // For hot leads, send follow-up with application link immediately (within 2 hours)
    // For other outcomes, send appropriate follow-up
    const scheduledFor = new Date();

    if (outcome === "hot_lead") {
      // Send hot lead follow-up within 2 hours
      scheduledFor.setHours(scheduledFor.getHours() + 2);
    } else if (outcome === "needs_followup") {
      // Send needs follow-up check-in within 4 hours
      scheduledFor.setHours(scheduledFor.getHours() + 4);
    } else if (outcome === "long_timeline") {
      // Schedule for 2 weeks from now for long timeline
      scheduledFor.setDate(scheduledFor.getDate() + 14);
    } else if (outcome === "not_qualified") {
      // Send polite close message within 1 hour
      scheduledFor.setHours(scheduledFor.getHours() + 1);
    }

    await prisma.scheduledMessage.create({
      data: {
        leadId,
        channel: "SMS",
        content: `POST_CALL_FOLLOWUP_${outcome.toUpperCase()}`, // Special marker for AI to generate message
        scheduledFor,
        metadata: {
          messageType: "post_call_followup",
          callOutcome: outcome,
          automated: true,
        },
      },
    });

    console.log(`[Call Outcome] Scheduled ${outcome} follow-up for ${scheduledFor.toLocaleString()}`);
  } catch (error) {
    console.error(`[Call Outcome] Error scheduling follow-up for ${outcome}:`, error);
  }
}
