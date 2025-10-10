import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSlackNotification } from "@/lib/slack";
import { handleConversation, executeDecision } from "@/lib/ai-conversation-enhanced";

/**
 * POST /api/leads/[leadId]/call-outcome
 * Log the outcome of an advisor phone call with a lead
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const body = await req.json();
    const { advisorName, reached, outcome, notes, leadQuality } = body;

    // Validate required fields
    if (!advisorName || reached === undefined || !outcome) {
      return NextResponse.json(
        { error: "Missing required fields: advisorName, reached, outcome" },
        { status: 400 }
      );
    }

    // Get the lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Create the call outcome record
    const callOutcome = await prisma.callOutcome.create({
      data: {
        leadId,
        advisorName,
        reached,
        outcome,
        notes,
        leadQuality,
      },
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId,
        type: "CALL_COMPLETED",
        content: `${advisorName} ${reached ? "spoke with" : "attempted to reach"} lead. Outcome: ${outcome}${notes ? `. Notes: ${notes}` : ""}`,
        metadata: {
          callOutcomeId: callOutcome.id,
          reached,
          outcome,
          leadQuality,
        },
      },
    });

    // Take action based on outcome
    let newStatus = lead.status;
    let actionTaken = "";

    switch (outcome) {
      case "READY_FOR_APP":
        // Move to CALL_COMPLETED (they're ready for app, skip formal discovery)
        newStatus = "CALL_COMPLETED";
        actionTaken = "Moved to CALL_COMPLETED. Holly sending Finmo application link now...";

        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "CALL_COMPLETED" },
        });

        // 🚀 SEND FINMO LINK IMMEDIATELY (within 5 minutes)
        try {
          console.log(`[Call Outcome] Triggering immediate Finmo link for lead ${leadId}`);

          // Generate AI message with Finmo link
          const decision = await handleConversation(leadId);

          // Send immediately
          await executeDecision(leadId, decision);

          actionTaken = "Moved to CALL_COMPLETED. Holly sent Finmo application link! ✅";

          console.log(`[Call Outcome] ✅ Finmo link sent successfully to lead ${leadId}`);
        } catch (error) {
          console.error(`[Call Outcome] Error sending Finmo link:`, error);
          actionTaken = "Moved to CALL_COMPLETED. Holly will send Finmo link on next automation run.";
        }
        break;

      case "BOOK_DISCOVERY":
        // Keep current status, Holly will send Cal.com link immediately
        actionTaken = "Holly sending Cal.com booking link now...";

        // 📅 SEND CAL.COM LINK IMMEDIATELY
        try {
          console.log(`[Call Outcome] Triggering immediate Cal.com link for lead ${leadId}`);

          // Generate AI message with Cal.com link
          const decision = await handleConversation(leadId);

          // Send immediately
          await executeDecision(leadId, decision);

          actionTaken = "Holly sent Cal.com booking link! ✅";

          console.log(`[Call Outcome] ✅ Cal.com link sent successfully to lead ${leadId}`);
        } catch (error) {
          console.error(`[Call Outcome] Error sending Cal.com link:`, error);
          actionTaken = "Holly will send Cal.com link on next automation run.";
        }
        break;

      case "FOLLOW_UP_SOON":
        // Keep current status, Holly will pause for 48h then resume
        actionTaken = "Holly will pause automation for 48h, then resume nurturing.";
        break;

      case "NOT_INTERESTED":
        // Move to LOST
        newStatus = "LOST";
        actionTaken = "Moved to LOST. Holly will stop all automation.";

        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "LOST" },
        });
        break;

      case "WRONG_NUMBER":
        // Flag for review
        actionTaken = "Flagged for contact info review. Holly will pause SMS.";
        break;

      case "NO_ANSWER":
        // Continue normal automation
        actionTaken = "Holly will continue normal nurturing schedule.";
        break;
    }

    // Send Slack notification
    const loanAmount = (lead.rawData as any)?.loanAmount;
    const loanType = (lead.rawData as any)?.loanType;

    await sendSlackNotification({
      type: "call_booked",
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadId: lead.id,
      details: `📞 ${advisorName} ${reached ? "spoke with" : "called"} lead\n\n**Outcome:** ${outcome.replace(/_/g, " ")}\n**Quality:** ${leadQuality || "Not assessed"}\n**Action:** ${actionTaken}${notes ? `\n\n**Notes:** ${notes}` : ""}\n\n${loanAmount ? `Loan: $${parseInt(loanAmount).toLocaleString()} ${loanType}` : ""}`,
    });

    return NextResponse.json({
      success: true,
      callOutcome,
      newStatus,
      actionTaken,
    });
  } catch (error) {
    console.error("[Call Outcome] Error logging call outcome:", error);
    return NextResponse.json(
      {
        error: "Failed to log call outcome",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leads/[leadId]/call-outcome
 * Get call outcomes for a lead
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;

    const callOutcomes = await prisma.callOutcome.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, callOutcomes });
  } catch (error) {
    console.error("[Call Outcome] Error fetching call outcomes:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch call outcomes",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
