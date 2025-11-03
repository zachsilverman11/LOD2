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
    const { advisorName, reached, outcome, notes, leadQuality, appointmentId } = body;

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

    // 🛡️ DEDUPLICATION: Check if a call outcome was already submitted in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentCallOutcome = await prisma.callOutcome.findFirst({
      where: {
        leadId,
        createdAt: { gte: fiveMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentCallOutcome) {
      console.log(`[Call Outcome] ⚠️  Duplicate detected - call outcome already submitted ${Math.floor((Date.now() - recentCallOutcome.createdAt.getTime()) / 1000)}s ago`);
      return NextResponse.json(
        {
          error: "Duplicate submission detected",
          message: `A call outcome for this lead was already submitted ${Math.floor((Date.now() - recentCallOutcome.createdAt.getTime()) / 60000)} minute(s) ago. Please refresh the page.`,
          existingOutcome: {
            id: recentCallOutcome.id,
            outcome: recentCallOutcome.outcome,
            createdAt: recentCallOutcome.createdAt,
          }
        },
        { status: 409 }
      );
    }

    // Create the call outcome record
    const callOutcome = await prisma.callOutcome.create({
      data: {
        leadId,
        appointmentId: appointmentId || null,
        advisorName,
        reached,
        outcome,
        notes,
        leadQuality,
      },
    });

    // Save call outcome to lead.rawData so Holly has full context
    const currentRawData = (lead.rawData as any) || {};
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        rawData: {
          ...currentRawData,
          lastCallOutcome: {
            id: callOutcome.id,
            advisorName,
            reached,
            outcome,
            notes,
            leadQuality,
            timestamp: new Date().toISOString(),
          },
        },
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
        actionTaken = "Moved to CALL_COMPLETED. Holly sending application link now...";

        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "CALL_COMPLETED" },
        });

        // 🚀 SEND APPLICATION LINK IMMEDIATELY via SMS + EMAIL
        try {
          console.log(`[Call Outcome] Triggering immediate application link for lead ${leadId}`);

          // 🛡️ DEDUPLICATION CHECK: Don't send if we already sent app link recently (within 15 min)
          const appUrl = process.env.MORTGAGE_APPLICATION_URL || "https://stressfree.mtg-app.com/";
          const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

          const recentAppLink = await prisma.communication.findFirst({
            where: {
              leadId,
              direction: "OUTBOUND",
              content: { contains: appUrl },
              createdAt: { gte: fifteenMinutesAgo },
            },
            orderBy: { createdAt: "desc" },
          });

          if (recentAppLink) {
            const minutesAgo = Math.floor((Date.now() - recentAppLink.createdAt.getTime()) / 60000);
            console.log(`[Call Outcome] ⚠️  Application link already sent ${minutesAgo} minutes ago, skipping duplicate`);
            actionTaken = `Moved to CALL_COMPLETED. Holly already sent application link ${minutesAgo} min ago.`;
          } else {
            // No recent app link, safe to send
            const applicationContext = `The advisor ${advisorName} just completed a discovery call with this lead and marked them as READY FOR APPLICATION.

🎯 CALL OUTCOME DETAILS (USE THIS CONTEXT!):
- Outcome: ${outcome}
- Lead Quality: ${leadQuality || "Not specified"}
- Reached: ${reached ? "Yes" : "No"}

📝 ADVISOR'S CALL NOTES (CRITICAL - READ CAREFULLY):
"${notes || "No notes provided"}"

Your job is to send them the secure mortgage application link RIGHT NOW with a helpful, encouraging message that REFERENCES THE CALL NOTES.

IMPORTANT CONTEXT:
- Lead name: ${lead.firstName}
- Advisor who just spoke with them: ${advisorName}
- Application portal URL: ${appUrl}

The message should:
- Acknowledge the call with ${advisorName} (but don't just say "great call" - be specific!)
- Reference something specific from the call notes above (e.g., their situation, what was discussed, why they're ready)
- Express genuine excitement about helping them
- Include the secure application portal link
- Mention it takes about 15-20 minutes to complete
- List what they'll need ready: income docs, ID, property details
- Reassure them you're available if they get stuck
- Sound warm and human, NOT robotic

🚨 CRITICAL RULES:
1. DO NOT use generic phrases like "Great call with ${advisorName}"
2. DO reference specific details from the call notes (renewal date, property plans, rate type, concerns, timeline, etc.)
3. DO acknowledge any concerns or next steps the advisor mentioned
4. Use the send_both tool to send via SMS + Email for maximum delivery!

EXAMPLE GOOD MESSAGE (if notes mention "December renewal, variable rate, no bank penalties"):
"Hi ${lead.firstName}! ${advisorName} mentioned you're looking at a variable rate for your December renewal - the no bank penalties program is perfect for your situation! Ready to start your application? Takes 15 mins: [link]. Questions? Just text!"

EXAMPLE BAD MESSAGE:
"Hi ${lead.firstName}! Great call with ${advisorName}. Ready for your application? [link]" ❌ TOO GENERIC

SMS GUIDELINES (under 160 chars):
- Keep it brief and friendly but specific
- Reference something from call notes
- Include the link
- Be conversational

EMAIL GUIDELINES:
Subject: Keep it personal and clear (e.g., "Let's Get Your Mortgage Application Started, ${lead.firstName}!")

Body should include:
- Warm greeting referencing specifics from the call (not just "great call")
- Clear next step: "Click below to access your secure application portal"
- Time estimate: "Takes about 15-20 minutes"
- What to have ready:
  • Recent pay stubs or income verification
  • Government-issued ID
  • Property details (address, purchase price/value)
  • Down payment information (if applicable)
- Clickable link prominently displayed
- Reassurance: "I'm here if you have any questions - just reply!"
- Sign as Holly from Inspired Mortgage

DO NOT mention "Finmo" or any technical platform names - customers don't need to know the backend.`;

            // Generate AI message with application link
            const decision = await handleConversation(leadId, undefined, applicationContext);

            // Send immediately
            await executeDecision(leadId, decision);

            actionTaken = "Moved to CALL_COMPLETED. Holly sent application link! ✅";

            console.log(`[Call Outcome] ✅ Application link sent successfully to lead ${leadId}`);
          }
        } catch (error) {
          console.error(`[Call Outcome] Error sending application link:`, error);
          actionTaken = "Moved to CALL_COMPLETED. Holly will send application link on next automation run.";
        }
        break;

      case "BOOK_DISCOVERY":
        // Keep current status, Holly will send Cal.com link immediately
        actionTaken = "Holly sending Cal.com booking link now...";

        // 📅 SEND CAL.COM LINK IMMEDIATELY via SMS + EMAIL
        try {
          console.log(`[Call Outcome] Triggering immediate Cal.com link for lead ${leadId}`);

          const calContext = `The advisor ${advisorName} just spoke with this lead and they want to book a discovery call.

Your job is to send them the Cal.com booking link RIGHT NOW with a brief, friendly message.

The message should:
- Acknowledge the conversation with ${advisorName}
- Include the Cal.com booking link: ${process.env.CAL_COM_BOOKING_URL || "https://cal.com/inspired-mortgage"}
- Make it easy for them to pick a time
- Be SHORT and action-oriented (under 160 chars for SMS)

🚨 CRITICAL: Use the send_both tool to send via SMS + Email for maximum delivery!

SMS: Keep it brief (under 160 chars)
Email Subject: Something like "Book Your Discovery Call - Link Inside"
Email Body: More detailed with HTML formatting, include the link prominently`;

          // Generate AI message with Cal.com link
          const decision = await handleConversation(leadId, undefined, calContext);

          // Send immediately
          await executeDecision(leadId, decision);

          actionTaken = "Holly sent Cal.com booking link! ✅";

          console.log(`[Call.com] ✅ Cal.com link sent successfully to lead ${leadId}`);
        } catch (error) {
          console.error(`[Call Outcome] Error sending Cal.com link:`, error);
          actionTaken = "Holly will send Cal.com link on next automation run.";
        }
        break;

      case "FOLLOW_UP_SOON":
        // Move to NURTURING - they need time to think
        newStatus = "NURTURING";
        actionTaken = "Moved to NURTURING. Holly will pause automation for 48h, then resume nurturing.";

        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "NURTURING" },
        });
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
        // Flag for review, move to LOST
        newStatus = "LOST";
        actionTaken = "Flagged for contact info review. Moved to LOST.";

        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "LOST" },
        });
        break;

      case "NO_ANSWER":
        // Move to NURTURING - voicemail left, Holly will continue nurturing
        newStatus = "NURTURING";
        actionTaken = "Moved to NURTURING. Holly will continue nurturing schedule.";

        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "NURTURING" },
        });
        break;

      default:
        // For any other outcome (or successful calls without specific outcome), move to CALL_COMPLETED
        if (reached) {
          newStatus = "CALL_COMPLETED";
          actionTaken = "Moved to CALL_COMPLETED. Holly will follow up based on call notes.";

          await prisma.lead.update({
            where: { id: leadId },
            data: { status: "CALL_COMPLETED" },
          });
        }
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
