import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { sendSMS } from "./sms";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface LeadContext {
  leadId: string;
  leadData: any;
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }>;
  pipelineStatus: {
    stage: string;
    daysInStage: number;
    totalMessages: number;
    lastActivity: Date | null;
  };
  appointments: any[];
}

interface AIDecision {
  action:
    | "send_sms"
    | "schedule_followup"
    | "send_booking_link"
    | "escalate"
    | "do_nothing"
    | "move_stage";
  message?: string;
  followupHours?: number;
  newStage?: string;
  reasoning: string;
}

/**
 * Build complete context for AI decision making
 */
export async function buildLeadContext(leadId: string): Promise<LeadContext> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      communications: {
        orderBy: { createdAt: "desc" },
        take: 20, // Last 20 messages
      },
      appointments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  // Calculate days in current stage
  const stageActivity = await prisma.leadActivity.findFirst({
    where: {
      leadId,
      type: "STATUS_CHANGE",
    },
    orderBy: { createdAt: "desc" },
  });

  const daysInStage = stageActivity
    ? Math.floor(
        (Date.now() - stageActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  // Build conversation history
  const conversationHistory = lead.communications.map((comm) => ({
    role: comm.direction === "OUTBOUND" ? ("assistant" as const) : ("user" as const),
    content: comm.content,
    timestamp: comm.createdAt,
  }));

  return {
    leadId: lead.id,
    leadData: lead.rawData || {},
    conversationHistory,
    pipelineStatus: {
      stage: lead.status,
      daysInStage,
      totalMessages: lead.communications.length,
      lastActivity: lead.lastContactedAt,
    },
    appointments: lead.appointments,
  };
}

/**
 * Generate system prompt with full lead context
 */
function generateSystemPrompt(context: LeadContext): string {
  const data = context.leadData;

  return `You are an expert mortgage lead conversion specialist for a Canadian mortgage brokerage.

# LEAD PROFILE
Name: ${data.name || "Unknown"}
Phone: ${data.phone || "Unknown"}
Email: ${data.email || "Unknown"}
Location: ${data.city ? `${data.city}, ${data.province}` : data.province || "Unknown"}

# MORTGAGE INQUIRY DETAILS
Type: ${data.lead_type || "Unknown"} ${data.lead_type === "Home Purchase" ? "(PURCHASE)" : data.lead_type === "Refinance" ? "(REFI)" : data.lead_type === "Renewal" ? "(RENEWAL)" : ""}
Property Type: ${data.prop_type || "Unknown"}
${data.lead_type === "Home Purchase" ? `
Purchase Details:
- Home Value: $${data.home_value || "Unknown"}
- Down Payment: $${data.down_payment || "Unknown"}
- Urgency: ${data.motivation_level || "Unknown"}
` : ""}
${data.lead_type === "Refinance" ? `
Refinance Details:
- Home Value: $${data.home_value || "Unknown"}
- Current Balance: $${data.balance || "Unknown"}
- Withdrawal Amount: $${data.withdraw_amount || "Unknown"}
- Current Lender: ${data.lender || "Unknown"}
` : ""}
${data.lead_type === "Renewal" ? `
Renewal Details:
- Current Balance: $${data.balance || "Unknown"}
- Timeframe: ${data.timeframe || "Unknown"}
- Extend Amortization: ${data.extend_amortization || "No"}
- Current Lender: ${data.lender || "Unknown"}
` : ""}
Will Live in Property: ${data.rent_check || "Unknown"}
Lead Source: ${data.ad_source || "Unknown"}
Captured: ${data.capture_time || "Unknown"}

# PIPELINE STATUS
Current Stage: ${context.pipelineStatus.stage}
Days in Stage: ${context.pipelineStatus.daysInStage}
Total Messages Exchanged: ${context.pipelineStatus.totalMessages}
Has Appointment: ${context.appointments.length > 0 ? "Yes" : "No"}

# YOUR GOALS (in priority order)
1. **Build Rapport** - Be warm, professional, and helpful
2. **Qualify the Lead** - Understand timeline, seriousness, and fit
3. **Book Discovery Call** - Get them scheduled when ready
4. **Nurture** - If not ready, stay top-of-mind with value

# CONVERSATION RULES
- Keep SMS messages SHORT (1-2 sentences, max 160 chars when possible)
- Be conversational, not salesy or scripted
- Reference their specific situation (property type, location, timeline)
- Use their first name occasionally (not every message)
- Ask ONE question at a time
- Provide value and education when appropriate
- Handle objections with empathy
- If they're ready to book, send the booking link immediately
- If they need time, schedule an appropriate follow-up

# QUALIFICATION CRITERIA
A lead is QUALIFIED when:
- Timeline is clear (within 90 days is ideal)
- They have realistic budget/down payment
- They're motivated (responding quickly, asking good questions)
- No major red flags (bad credit mentioned, unrealistic expectations)

# STAGE PROGRESSION
- NEW → CONTACTED: After first message sent
- CONTACTED → ENGAGED: After they reply
- ENGAGED → QUALIFIED: After they answer key qualifying questions
- QUALIFIED → CALL_SCHEDULED: After they book
- If not ready: Move to NURTURING

# TOOLS AVAILABLE
You have access to these tools:
1. **send_sms**: Send an immediate SMS response
2. **schedule_followup**: Schedule a follow-up message (specify hours to wait)
3. **send_booking_link**: Send Cal.com booking link when they're ready
4. **move_stage**: Move them to a different pipeline stage
5. **escalate**: Flag for human intervention
6. **do_nothing**: No action needed right now

# CONVERSATION HISTORY
${context.conversationHistory.length === 0 ? "This is the first contact." : context.conversationHistory.reverse().map((msg, i) => `${msg.role === "assistant" ? "You" : "Lead"}: ${msg.content}`).join("\n")}

Based on the above context and conversation, decide the best next action.`;
}

/**
 * Main AI conversation handler
 */
export async function handleConversation(
  leadId: string,
  incomingMessage?: string
): Promise<AIDecision> {
  // Build full context
  const context = await buildLeadContext(leadId);

  // Generate system prompt
  const systemPrompt = generateSystemPrompt(context);

  // Prepare messages
  const messages: Anthropic.Messages.MessageParam[] = [];

  if (incomingMessage) {
    messages.push({
      role: "user",
      content: `The lead just sent this message: "${incomingMessage}"\n\nAnalyze this message and decide what action to take. Consider:\n- Their intent and sentiment\n- Where they are in the pipeline\n- What information you still need\n- Whether they're ready to book or need more nurturing\n\nUse one of the available tools to respond.`,
    });
  } else {
    // Initial contact
    messages.push({
      role: "user",
      content: `This is a brand new lead. Craft a warm, personalized initial SMS that:\n- References their specific inquiry (${context.leadData.lead_type})\n- Mentions something specific from their submission\n- Is conversational and helpful\n- Asks an engaging question\n- Is SHORT (under 160 characters)\n\nUse the send_sms tool.`,
    });
  }

  // Call Claude with tool use
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    tools: [
      {
        name: "send_sms",
        description: "Send an immediate SMS response to the lead",
        input_schema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The SMS message to send (keep under 160 chars when possible)",
            },
            reasoning: {
              type: "string",
              description: "Why you're sending this message and what you hope to achieve",
            },
          },
          required: ["message", "reasoning"],
        },
      },
      {
        name: "schedule_followup",
        description: "Schedule a follow-up message for later",
        input_schema: {
          type: "object",
          properties: {
            hours: {
              type: "number",
              description: "How many hours to wait before sending",
            },
            message: {
              type: "string",
              description: "The follow-up message to send",
            },
            reasoning: {
              type: "string",
              description: "Why schedule this follow-up",
            },
          },
          required: ["hours", "message", "reasoning"],
        },
      },
      {
        name: "send_booking_link",
        description: "Send the Cal.com booking link when lead is ready to schedule",
        input_schema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Message to accompany the booking link",
            },
            reasoning: {
              type: "string",
              description: "Why they're ready to book now",
            },
          },
          required: ["message", "reasoning"],
        },
      },
      {
        name: "move_stage",
        description: "Move the lead to a different pipeline stage",
        input_schema: {
          type: "object",
          properties: {
            stage: {
              type: "string",
              enum: ["NEW", "CONTACTED", "ENGAGED", "QUALIFIED", "NURTURING", "CALL_SCHEDULED", "LOST"],
              description: "The new stage",
            },
            reasoning: {
              type: "string",
              description: "Why move to this stage",
            },
          },
          required: ["stage", "reasoning"],
        },
      },
      {
        name: "escalate",
        description: "Flag this lead for human intervention",
        input_schema: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Why this needs human attention",
            },
          },
          required: ["reason"],
        },
      },
      {
        name: "do_nothing",
        description: "No action needed right now",
        input_schema: {
          type: "object",
          properties: {
            reasoning: {
              type: "string",
              description: "Why no action is needed",
            },
          },
          required: ["reasoning"],
        },
      },
    ],
  });

  // Parse AI response
  const toolUse = response.content.find((block) => block.type === "tool_use");

  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI did not use a tool");
  }

  // Map tool use to decision
  const decision: AIDecision = {
    action: toolUse.name as any,
    reasoning: (toolUse.input as any).reasoning || "",
  };

  switch (toolUse.name) {
    case "send_sms":
      decision.message = (toolUse.input as any).message;
      break;
    case "schedule_followup":
      decision.message = (toolUse.input as any).message;
      decision.followupHours = (toolUse.input as any).hours;
      break;
    case "send_booking_link":
      decision.message = (toolUse.input as any).message;
      break;
    case "move_stage":
      decision.newStage = (toolUse.input as any).stage;
      break;
  }

  return decision;
}

/**
 * Execute the AI's decision
 */
export async function executeDecision(
  leadId: string,
  decision: AIDecision
): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || !lead.phone) throw new Error("Lead not found or no phone");

  console.log(`[AI Decision] ${decision.action}: ${decision.reasoning}`);

  switch (decision.action) {
    case "send_sms":
      if (decision.message) {
        await sendSMS(lead.phone, decision.message);

        // Save to communications
        await prisma.communication.create({
          data: {
            leadId,
            channel: "SMS",
            direction: "OUTBOUND",
            content: decision.message,
            metadata: { aiReasoning: decision.reasoning },
          },
        });

        // Update last contacted
        await prisma.lead.update({
          where: { id: leadId },
          data: { lastContactedAt: new Date() },
        });
      }
      break;

    case "schedule_followup":
      if (decision.message && decision.followupHours) {
        const scheduledFor = new Date();
        scheduledFor.setHours(scheduledFor.getHours() + decision.followupHours);

        await prisma.scheduledMessage.create({
          data: {
            leadId,
            channel: "SMS",
            content: decision.message,
            scheduledFor,
            metadata: { aiReasoning: decision.reasoning },
          },
        });
      }
      break;

    case "send_booking_link":
      if (decision.message) {
        const bookingUrl = process.env.CAL_COM_BOOKING_URL || "https://cal.com/your-link";
        const messageWithLink = `${decision.message}\n\n${bookingUrl}`;

        await sendSMS(lead.phone, messageWithLink);

        await prisma.communication.create({
          data: {
            leadId,
            channel: "SMS",
            direction: "OUTBOUND",
            content: messageWithLink,
            intent: "booking_link_sent",
            metadata: { aiReasoning: decision.reasoning },
          },
        });
      }
      break;

    case "move_stage":
      if (decision.newStage) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: decision.newStage as any },
        });

        await prisma.leadActivity.create({
          data: {
            leadId,
            type: "STATUS_CHANGE",
            content: `Stage changed to ${decision.newStage}: ${decision.reasoning}`,
          },
        });
      }
      break;

    case "escalate":
      await prisma.leadActivity.create({
        data: {
          leadId,
          type: "NOTE_ADDED",
          content: `🚨 ESCALATED: ${decision.reasoning}`,
        },
      });
      break;

    case "do_nothing":
      console.log(`[AI] No action: ${decision.reasoning}`);
      break;
  }
}
