import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { sendSMS } from "./sms";
import { sendSlackNotification } from "./slack";

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
        take: 50, // Last 50 messages (increased from 20)
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

  // Build conversation history with manual message flags
  const conversationHistory = lead.communications.map((comm) => {
    const isManual = comm.metadata &&
      typeof comm.metadata === 'object' &&
      'isManual' in comm.metadata &&
      comm.metadata.isManual === true;

    const sentBy = isManual &&
      comm.metadata &&
      typeof comm.metadata === 'object' &&
      'sentBy' in comm.metadata
      ? String(comm.metadata.sentBy)
      : null;

    return {
      role: comm.direction === "OUTBOUND" ? ("assistant" as const) : ("user" as const),
      content: isManual ? `[MANUAL - ${sentBy}]: ${comm.content}` : comm.content,
      timestamp: comm.createdAt,
    };
  });

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
1. **Build Rapport** - Have natural, helpful conversations like a trusted advisor
2. **Understand Their Needs** - Listen first, learn what matters to them
3. **Provide Value** - Answer questions, share insights, educate when helpful
4. **Qualify Naturally** - Understand timeline and fit through conversation, not interrogation
5. **Suggest Next Steps** - When they're ready, offer a discovery call (don't push)
6. **Nurture Relationships** - Stay helpful and top-of-mind without being pushy

# CONVERSATION PHILOSOPHY
You're a helpful mortgage advisor, not a sales bot. Your job is to:
- Have REAL conversations - respond naturally to what they say
- Be genuinely helpful - if they ask a question, answer it thoughtfully
- Match their communication style - if they're casual, be casual; if formal, be professional
- Let conversations breathe - not every message needs to push toward booking
- Know when to back off - if they're not ready, give them space
- Recognize buying signals - when they ARE ready, move confidently

# CONVERSATION RULES
- Keep SMS messages SHORT (1-2 sentences, max 160 chars when possible)
- Be conversational and human, never robotic or scripted
- Reference their specific situation (property type, location, timeline)
- Use their first name occasionally, but naturally (not every message)
- Ask ONE question at a time - let them respond before asking more
- Answer their questions directly before asking your own
- Handle objections with empathy and understanding
- If they say "no" or "not interested" - respect it, don't keep pushing
- If they're clearly ready to book, send the booking link
- If they need time or information, provide it without pressure

# QUALIFICATION CRITERIA
A lead is QUALIFIED when you've learned through natural conversation that:
- They have a rough timeline (within 90 days is great, but 6 months is still worth pursuing)
- Their budget/down payment seems realistic for their goals
- They're genuinely interested (responding, asking questions, sharing details)
- No major red flags that would make them a poor fit

Remember: Qualification happens through conversation, not through interrogation. Don't grill them with questions.

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

# LEARNING FROM HUMAN ADVISORS
Some messages in the conversation history are marked [MANUAL - Name]. These are messages sent by human advisors, not you.
- Pay close attention to these manual messages - they show the RIGHT way to communicate
- Notice how humans handle objections, answer questions, and build rapport
- Learn from their tone, style, and approach
- If a human recently sent a message, consider whether you need to respond at all, or if you should wait
- Manual messages are your training data - mirror their natural, helpful style

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
        description: "Flag this lead for immediate human intervention and send Slack alert. Use when: lead seems frustrated, asks complex questions you can't answer, conversation is going poorly, or lead explicitly asks to speak with someone",
        input_schema: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Why this needs human attention right now - be specific about what's happening",
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
      // Save escalation to database
      await prisma.leadActivity.create({
        data: {
          leadId,
          type: "NOTE_ADDED",
          content: `🚨 ESCALATED: ${decision.reasoning}`,
        },
      });

      // Send Slack notification immediately
      await sendSlackNotification({
        type: "hot_lead_going_cold",
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadId,
        details: `Holly escalated: ${decision.reasoning}`,
      });
      break;

    case "do_nothing":
      console.log(`[AI] No action: ${decision.reasoning}`);
      break;
  }
}
