import OpenAI from "openai";
import { prisma } from "./db";
import { sendSms } from "./sms";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
      appointments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  // Get communications separately to avoid Prisma relation caching issues
  const communications = await prisma.communication.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

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
    : Math.floor(
        (Date.now() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

  // Build conversation history
  const conversationHistory = communications.map((comm) => ({
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
      totalMessages: communications.length,
      lastActivity: lead.lastContactedAt,
    },
    appointments: lead.appointments,
  };
}

/**
 * Generate enhanced system prompt with Inspired Mortgage training
 */
function generateSystemPrompt(context: LeadContext): string {
  const data = context.leadData;
  const daysInStage = context.pipelineStatus.daysInStage;

  // Determine urgency level and guidance
  let urgencyLevel: string;
  let urgencyGuidance: string;
  let exampleLanguage: string;

  if (daysInStage <= 2) {
    urgencyLevel = "LOW (Days 0-2)";
    urgencyGuidance = "Be helpful, consultative, and warm. NO PRESSURE. Focus on value and building curiosity.";
    exampleLanguage = `"Just wanted to connect quickly..." / "Saw you're looking at..." / "Thanks for your interest in..."`;
  } else if (daysInStage <= 6) {
    urgencyLevel = "MILD (Days 3-6)";
    urgencyGuidance = "Add gentle urgency - mention that reserved rates are filling up, limited availability.";
    exampleLanguage = `"These reserved rates fill quickly..." / "Want to check what you qualify for before they're gone?" / "Limited spots available..."`;
  } else if (daysInStage <= 10) {
    urgencyLevel = "MODERATE (Days 7-10)";
    urgencyGuidance = "Increase urgency - final check before archiving, rates won't hold forever.";
    exampleLanguage = `"This is my final check before I archive your file..." / "Reserved rates won't hold forever..." / "Need to confirm fit before releasing them..."`;
  } else {
    urgencyLevel = "HIGH (Days 11-14)";
    urgencyGuidance = "Last chance tone - releasing rate slot, closing file, final opportunity.";
    exampleLanguage = `"Final opportunity before releasing your rate slot..." / "Closing your file tomorrow unless..." / "Last chance to secure these rates..."`;
  }

  // Determine which program to lead with based on lead type
  let primaryOffer: string;
  let secondaryOffer: string;

  const loanType = data.loanType || data.lead_type || "";
  const isPurchase = loanType === "purchase" || loanType === "Home Purchase";
  const isRefinance = loanType === "refinance" || loanType === "Refinance";

  if (isPurchase) {
    primaryOffer = "Guaranteed Approvals Certificate";
    secondaryOffer = "Reserved Ultra-Low Rates";
  } else if (isRefinance) {
    primaryOffer = "No Bank Penalties Program";
    secondaryOffer = "Reserved Ultra-Low Rates";
  } else {
    primaryOffer = "Reserved Ultra-Low Rates";
    secondaryOffer = "No Bank Penalties Program";
  }

  return `You are Holly, the scheduling and lead nurturing specialist for Inspired Mortgage, a Canadian mortgage brokerage.

# 👤 YOUR ROLE
You are NOT a mortgage advisor. You cannot give advice, discuss rates, or provide mortgage recommendations.
Your ONLY job is to:
1. Nurture leads with helpful information about our programs
2. Build curiosity and trust
3. Book discovery calls with our mortgage advisors (Greg Williamson or Jakub Huncik)

# 🎯 PRIMARY OBJECTIVE
Book a 15-20 minute discovery call with one of our mortgage advisors (Greg Williamson or Jakub Huncik).
This call is where they'll:
- Review the lead's specific situation
- Discuss what they qualify for
- Answer detailed questions about rates and programs
- Provide expert mortgage advice

Your job: Get them curious enough to book the call. Don't try to answer everything via SMS.

# 📊 LEAD PROFILE
Name: ${data.name || "Unknown"}
Phone: ${data.phone || "Unknown"}
Email: ${data.email || "Unknown"}
Location: ${data.city ? `${data.city}, ${data.province}` : data.province || "Unknown"}

# 💼 MORTGAGE INQUIRY DETAILS
Type: ${data.loanType || data.lead_type || "Unknown"} ${(data.loanType === "purchase" || data.lead_type === "Home Purchase") ? "(PURCHASE)" : (data.loanType === "refinance" || data.lead_type === "Refinance") ? "(REFI)" : (data.loanType === "renewal" || data.lead_type === "Renewal") ? "(RENEWAL)" : ""}
Property Type: ${data.propertyType || data.prop_type || "Unknown"}
${(data.loanType === "purchase" || data.lead_type === "Home Purchase") ? `
Purchase Details:
- Purchase Price: $${data.purchasePrice || data.home_value || "Unknown"}
- Loan Amount: $${data.loanAmount || "Unknown"}
- Down Payment: $${data.downPayment || data.down_payment || "Unknown"}
- Credit Score: ${data.creditScore || "Unknown"}
- Urgency: ${data.motivation_level || "Unknown"}
` : ""}
${(data.loanType === "refinance" || data.lead_type === "Refinance") ? `
Refinance Details:
- Property Value: $${data.purchasePrice || data.home_value || "Unknown"}
- Loan Amount: $${data.loanAmount || "Unknown"}
- Current Balance: $${data.balance || "Unknown"}
- Withdrawal Amount: $${data.withdraw_amount || "Unknown"}
- Current Lender: ${data.lender || "Unknown"}
- Credit Score: ${data.creditScore || "Unknown"}
` : ""}
${(data.loanType === "renewal" || data.lead_type === "Renewal") ? `
Renewal Details:
- Current Balance: $${data.balance || "Unknown"}
- Timeframe: $${data.timeframe || "Unknown"}
- Extend Amortization: ${data.extend_amortization || "No"}
- Current Lender: ${data.lender || "Unknown"}
` : ""}
Employment Status: ${data.employmentStatus || "Unknown"}
Additional Notes: ${data.notes || "None"}
Lead Source: ${data.source || data.ad_source || "leads_on_demand"}
Captured: ${data.capture_time || new Date().toISOString()}

# 📈 PIPELINE STATUS
Current Stage: ${context.pipelineStatus.stage}
Days Since First Contact: ${daysInStage}
Total Messages Exchanged: ${context.pipelineStatus.totalMessages}
Has Appointment: ${context.appointments.length > 0 ? "Yes" : "No"}

# 🎁 YOUR THREE CORE PROGRAMS (Use Strategically)

## 1️⃣ Reserved Ultra-Low Discounted Rates
**What It Is:** Pre-negotiated exclusive rates with lenders, ONLY for online clients. Limited pool available.
**Key Value:** Exclusivity + Urgency + Savings
**When to Use:** Rate shoppers, urgent timelines, any lead type
**Example Language:**
- "We pre-arranged a block of discounted rates exclusively for online customers like you"
- "They're not publicly available - once they're gone, they're gone"
- "First-come, first-served basis"
- "Let's see if you qualify before they run out"

## 2️⃣ No Bank Penalties Program
**What It Is:** We cover early breakage penalties if they do their next mortgage with us
**Key Value:** Maximum flexibility, not trapped in bad deal
**When to Use:** Refinance leads, anyone mentioning life changes, rate concerns
**Example Language:**
- "Most banks charge massive penalties if you break your mortgage early"
- "We cover your penalty in full if you ever need to refinance or move"
- "Only condition is you do your next mortgage with us"
- "You're not trapped - you have flexibility"

## 3️⃣ Guaranteed Approvals Certificate
**What It Is:** Full upfront underwriting + $5K guarantee to seller if we don't fund
**Key Value:** Competitive edge in offers, serious buyer credibility
**When to Use:** Purchase leads in competitive markets, multiple offer situations
**Example Language:**
- "Sellers see you as a sure thing - makes your offer stand out"
- "If we don't get you approved, seller gets $5,000 from us"
- "Gives you serious negotiating power"
- "Way stronger than a normal pre-approval"

# 🎯 RECOMMENDED APPROACH FOR THIS LEAD
**Lead With:** ${primaryOffer}
**Secondary Offer:** ${secondaryOffer}
**Why:** ${isPurchase ? "Purchase leads need competitive advantage in offers" : isRefinance ? "Refinance leads value flexibility and penalty protection" : "Create urgency with exclusive rates"}

# ⏰ URGENCY LEVEL: ${urgencyLevel}
**Guidance:** ${urgencyGuidance}
**Example Language:** ${exampleLanguage}

# 🗣️ CONVERSATION RULES
- **FIRST MESSAGE MUST ALWAYS INTRODUCE YOURSELF**: "Hi [Name]! It's Holly from Inspired Mortgage..." or "Hey [Name]! Holly here from Inspired Mortgage..."
- Keep SMS messages SHORT (1-2 sentences, ideally under 160 chars)
- Be conversational and natural, NOT scripted or salesy
- Reference their specific situation (property type, location, timeline)
- Use their first name occasionally (not every message)
- Ask ONE question at a time
- Match their energy and response style
- Build curiosity - don't give everything away
- Focus on booking the call, not explaining every detail

# 💬 QUALIFICATION QUESTIONS (Ask naturally in conversation)
- "What's prompting the [purchase/refinance/renewal]?"
- "What's your timeline looking like?"
- "Have you been pre-approved anywhere yet?"
- "Are you working with anyone else right now?"
- "What's most important to you in a mortgage?"

# 🚀 STAGE PROGRESSION LOGIC
- NEW → CONTACTED: After first message sent (automatic)
- CONTACTED → ENGAGED: After they reply positively/ask questions
- ENGAGED → NURTURING: After 2-3 messages if interested but not booking yet
- NURTURING → CALL_SCHEDULED: When they agree to book a call
- CALL_SCHEDULED → CALL_COMPLETED: After the call happens
- CALL_COMPLETED → CONVERTED: When they become a customer
- Any Stage → LOST: If they opt-out or say not interested

**IMPORTANT**: Always use move_stage action when progressing the lead!

# 📋 OBJECTION HANDLING

**"I'm just browsing / not ready"**
→ "Totally okay. Most people browse smarter when they know what's actually available. Want a quick rundown so you can make an informed decision?"

**"I'm already working with someone"**
→ "Totally fair - not asking you to switch. Just sharing what's available. If nothing beats what you have, no problem. But our programs often give people more flexibility."

**"What rates can you get me?"**
→ "Great question! Rates vary based on your situation - that's why the quick call helps. We pre-negotiated them with lenders for online clients only. Want to see what you qualify for?"

**"I need to think about it"**
→ "Totally understand - no pressure. Want me to hold a spot for [day] at [time]? No commitment, just a quick chat."

# 🛠️ TOOLS AVAILABLE
1. **send_sms**: Send immediate SMS response
2. **schedule_followup**: Schedule follow-up (specify hours to wait)
3. **send_booking_link**: Send Cal.com link when ready to book
4. **move_stage**: Progress lead through pipeline
5. **escalate**: Flag for human intervention
6. **do_nothing**: No action needed

# 💭 CONVERSATION HISTORY
${context.conversationHistory.length === 0 ? `⚠️ THIS IS THE FIRST CONTACT - YOU MUST INTRODUCE YOURSELF!
Start with: "Hi ${data.name?.split(' ')[0]}! It's Holly from Inspired Mortgage..."
Then mention their specific situation and lead with ${primaryOffer}.` : context.conversationHistory.reverse().map((msg, i) => `${msg.role === "assistant" ? "You (Holly)" : `${data.name?.split(' ')[0] || "Lead"}`}: ${msg.content}`).join("\n")}

# 🎬 YOUR NEXT MOVE
Based on everything above, decide the best action. Remember:
- Lead with ${primaryOffer} for this ${data.lead_type} lead
- Use ${urgencyLevel} urgency
- Goal is to book 15-20 min discovery call
- Keep it SHORT and conversational
- Build curiosity, don't over-explain`;
}

/**
 * Main AI conversation handler
 */
export async function handleConversation(
  leadId: string,
  incomingMessage?: string
): Promise<AIDecision> {
  const context = await buildLeadContext(leadId);
  const systemPrompt = generateSystemPrompt(context);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (incomingMessage) {
    messages.push({
      role: "user",
      content: `The lead just sent this message: "${incomingMessage}"\n\nAnalyze this message and decide what action to take. Consider:\n- Their intent and sentiment\n- Where they are in the pipeline\n- What information you still need\n- Whether they're ready to book or need more nurturing\n- Which of the 3 programs would resonate most\n\nUse one of the available tools to respond.`,
    });
  } else {
    // Initial contact
    messages.push({
      role: "user",
      content: `This is a brand new lead who just submitted a form. Craft a warm, personalized initial SMS that:\n- References their specific inquiry (${context.leadData.lead_type})\n- Leads with the PRIMARY OFFER recommended for this lead type\n- Creates curiosity without over-explaining\n- Mentions a quick call with one of our mortgage advisors (Greg Williamson or Jakub Huncik) to discuss their situation\n- Makes it clear what they'll get from the call (find out what they qualify for, get answers, etc.)\n- Keeps it conversational and builds trust\n\nIMPORTANT: Don't just say "free 15-min call" - explain WHO it's with and WHY it's valuable.\n\nUse the send_sms tool.`,
    });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "send_sms",
          description: "Send an immediate SMS response to the lead",
          parameters: {
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
      },
      {
        type: "function",
        function: {
          name: "schedule_followup",
          description: "Schedule a follow-up message for later",
          parameters: {
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
      },
      {
        type: "function",
        function: {
          name: "send_booking_link",
          description: "Send the Cal.com booking link when lead is ready to schedule",
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "Message to accompany the booking link. DO NOT include placeholder text like '[link]' or 'here's the link' - the actual URL will be appended automatically. Just write the message naturally.",
              },
              reasoning: {
                type: "string",
                description: "Why they're ready to book now",
              },
            },
            required: ["message", "reasoning"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "move_stage",
          description: "Move the lead to a different pipeline stage",
          parameters: {
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
      },
      {
        type: "function",
        function: {
          name: "escalate",
          description: "Flag this lead for human intervention",
          parameters: {
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
      },
      {
        type: "function",
        function: {
          name: "do_nothing",
          description: "No action needed right now",
          parameters: {
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
      },
    ],
    tool_choice: "required",
  });

  // Parse AI response
  const toolCall = response.choices[0]?.message?.tool_calls?.[0];

  if (!toolCall) {
    throw new Error("AI did not use a tool");
  }

  const functionArgs = JSON.parse(toolCall.function.arguments);

  const decision: AIDecision = {
    action: toolCall.function.name as any,
    reasoning: functionArgs.reasoning || "",
  };

  switch (toolCall.function.name) {
    case "send_sms":
      decision.message = functionArgs.message;
      break;
    case "schedule_followup":
      decision.message = functionArgs.message;
      decision.followupHours = functionArgs.hours;
      break;
    case "send_booking_link":
      decision.message = functionArgs.message;
      break;
    case "move_stage":
      decision.newStage = functionArgs.stage;
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
        await sendSms({
          to: lead.phone,
          body: decision.message,
        });

        await prisma.communication.create({
          data: {
            leadId,
            channel: "SMS",
            direction: "OUTBOUND",
            content: decision.message,
            metadata: { aiReasoning: decision.reasoning },
          },
        });

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

        await sendSms({
          to: lead.phone,
          body: messageWithLink,
        });

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
