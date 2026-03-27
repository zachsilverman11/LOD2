import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db";
import { sendSms } from "../sms";
import { sendEmail } from "../email";
import { sendErrorAlert, sendSlackNotification } from "../slack";
import { quickDelay } from "../human-delay";
import {
  getAvailableSlots,
  getTimezoneForProvince,
  type TimeSlot,
} from "../calcom";
import { ACTIVE_APPOINTMENT_STATUSES } from "../appointment-status";
import { bookLeadAppointmentDirectly } from "../direct-booking";
import {
  buildHollyBriefing,
  selectBookingHook,
  fetchYouTubeLinkForBriefing,
  ADVISOR_TEAM_PROFILE,
  CASH_BACK_PROGRAM,
  REPORT_PRESELL_FRAMINGS,
  PROGRAMS,
  HOLLY_ROLE,
  CONVERSATION_PRINCIPLES,
  SIGNAL_AWARENESS,
  type ConversationContext,
} from "./brain";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface LeadContext {
  lead: any;
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
    outboundCount: number;
    inboundCount: number;
    lastActivity: Date | null;
  };
  appointments: any[];
  applicationStatus?: {
    started: Date | null;
    completed: Date | null;
  };
}

interface AIDecision {
  action:
    | "send_sms"
    | "send_email"
    | "send_both"
    | "schedule_followup"
    | "send_booking_link"
    | "send_application_link"
    | "escalate"
    | "do_nothing"
    | "move_stage"
    | "book_appointment_directly";
  message?: string;
  emailSubject?: string;
  emailBody?: string;
  followupHours?: number;
  newStage?: string;
  reasoning: string;
  bookingStartTime?: string;
  bookingLeadName?: string;
  bookingLeadEmail?: string;
  bookingLeadTimezone?: string;
}

interface BookingAvailabilityContext {
  timeZone: string;
  slots: TimeSlot[];
  promptBlock: string;
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
    lead,
    leadId: lead.id,
    leadData: lead.rawData || {},
    conversationHistory,
    pipelineStatus: {
      stage: lead.status,
      daysInStage,
      totalMessages: communications.length,
      outboundCount: communications.filter((c) => c.direction === "OUTBOUND").length,
      inboundCount: communications.filter((c) => c.direction === "INBOUND").length,
      lastActivity: lead.lastContactedAt,
    },
    appointments: lead.appointments,
    applicationStatus: {
      started: lead.applicationStartedAt,
      completed: lead.applicationCompletedAt,
    },
  };
}

/**
 * Generate enhanced system prompt with Inspired Mortgage training
 */
function buildRepresentativeSlotList(slots: TimeSlot[]): TimeSlot[] {
  const representativeSlots: TimeSlot[] = [];
  const slotsPerDay = new Map<string, number>();

  for (const slot of slots) {
    const dayKey = slot.time.slice(0, 10);
    const dayCount = slotsPerDay.get(dayKey) || 0;

    if (dayCount >= 2) continue;

    representativeSlots.push(slot);
    slotsPerDay.set(dayKey, dayCount + 1);

    if (representativeSlots.length >= 14) {
      break;
    }
  }

  return representativeSlots;
}

function buildAvailabilityPromptBlock(timeZone: string, slots: TimeSlot[]): string {
  if (slots.length === 0) {
    return `# LIVE CALENDAR AVAILABILITY
Availability data is unavailable right now.

If the lead is ready to book, use \`send_booking_link\` as the fallback.`;
  }

  const representativeSlots = buildRepresentativeSlotList(slots);
  const slotLines = representativeSlots
    .map(
      (slot, index) =>
        `${index + 1}. ${slot.displayTime} (${timeZone}) | ${slot.time}`
    )
    .join("\n");

  return `# LIVE CALENDAR AVAILABILITY
These are REAL live Cal.com slots for the next 7 days.

Use this timezone when speaking to the lead: ${timeZone}

🚨 DIRECT BOOKING RULES:
- Your default booking behavior is to OFFER 2-3 specific times from this list and book the lead directly
- When the lead clearly chooses one of these times, use \`book_appointment_directly\`
- \`bookingStartTime\` MUST be one exact ISO time from the list below
- Only use \`send_booking_link\` as a fallback when:
  1. availability is unavailable
  2. they want a time outside this 7-day window
  3. you have already offered multiple options and none work

LIVE SLOT LIST:
${slotLines}`;
}

async function getBookingAvailabilityContext(
  context: LeadContext,
  existingAppointment?: any
): Promise<BookingAvailabilityContext | null> {
  if (existingAppointment) {
    return null;
  }

  const province =
    context.leadData?.province ||
    (context.lead.rawData as { province?: string } | null)?.province;
  const timeZone = getTimezoneForProvince(province);

  try {
    const startDate = new Date().toISOString();
    const endDate = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const slots = await getAvailableSlots(startDate, endDate, timeZone);

    return {
      timeZone,
      slots,
      promptBlock: buildAvailabilityPromptBlock(timeZone, slots),
    };
  } catch (error) {
    console.error("[Cal.com] Failed to load booking availability:", error);

    return {
      timeZone,
      slots: [],
      promptBlock: buildAvailabilityPromptBlock(timeZone, []),
    };
  }
}

function generateSystemPrompt(
  context: LeadContext,
  existingAppointment?: any,
  bookingAvailability?: BookingAvailabilityContext | null
): string {
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
    urgencyGuidance =
      "Firmer but honest urgency: reserved-rate pool, timing, value of a quick call. Do NOT say you are archiving their file, sending a final message, or that you will never follow up. Automation may reach out again; false finality breaks trust.";
    exampleLanguage = `"Wanted to bump this up - reserved spots have been moving..." / "If timing's tight I can grab you a quick slot..." / "No pressure, but worth locking in while this pool's open..."`;
  } else {
    urgencyLevel = "HIGH (Days 11-14)";
    urgencyGuidance =
      "Direct, respectful urgency without lying about closure. Never promise a 'last' message or that their file is closing. You may check in again later at lower frequency.";
    exampleLanguage = `"I'll stay brief - if you still want better numbers than the bank showed, I'm here..." / "Happy to pause if now's not the time - just say the word..."`;
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

# 🗓️ APPOINTMENT STATUS
${existingAppointment ? `
⚠️ **CONFIRMATION MODE ACTIVE** ⚠️

This lead ALREADY HAS A CALL SCHEDULED:
- Date/Time: ${(existingAppointment.scheduledFor || existingAppointment.scheduledAt).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Vancouver' })} Pacific Time
- Status: ${existingAppointment.status}
- Meeting ID: ${existingAppointment.externalId || 'N/A'}

🎯 YOUR OBJECTIVE HAS CHANGED:
- DO NOT try to book them for a call - they're already booked!
- CONFIRM they know when their call is
- PREPARE them for what to expect
- BUILD EXCITEMENT about the call
- ENSURE THEY SHOW UP (80%+ show-up rate target)
- Answer any pre-call questions

📋 CONFIRMATION MODE STRATEGY:
1. **Initial Contact**: Welcome them, confirm their call time, explain what to expect
2. **Pre-Call Preparation**: Share what to have ready (property details, questions, concerns)
3. **Value Reminder**: Build excitement about the programs they'll learn about
4. **Logistics**: Ensure they have calendar invite, phone number, etc.
5. **Day-Of Reminder**: "Looking forward to our call today at [time]!"

💬 CONFIRMATION MODE LANGUAGE:
- "Your call with [advisor] is confirmed for [date/time]"
- "Looking forward to discussing your [mortgage type]"
- "Quick tip: Have your property details handy for the call"
- "Can't wait to share these programs with you on [day]"
- "See you on the call [date/time]!"

⚠️ NEVER use phrases like:
- "Want to schedule a call?"
- "Let's book a time"
- "Here's my calendar link"
- "When works for you?"
` : `
✅ **BOOKING MODE ACTIVE** ✅

This lead DOES NOT have a call scheduled yet.

🎯 YOUR PRIMARY OBJECTIVE:
Book a 15-20 minute discovery call with one of our mortgage advisors (Greg Williamson or Jakub Huncik).

This call is where they'll:
- Review the lead's specific situation
- Discuss what they qualify for
- Answer detailed questions about rates and programs
- Provide expert mortgage advice

Your job: Get them curious enough to book the call. Don't try to answer everything via SMS.
`}

${!existingAppointment ? `${bookingAvailability?.promptBlock || buildAvailabilityPromptBlock("America/Vancouver", [])}
` : ""}

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
Messages Sent (You): ${context.pipelineStatus.outboundCount}
Messages Received (Them): ${context.pipelineStatus.inboundCount}
Total Conversation: ${context.pipelineStatus.totalMessages} messages
Has Appointment: ${context.appointments.length > 0 ? "Yes" : "No"}

${data.lastCallOutcome ? `
# 📞 POST-CALL CONTEXT (CRITICAL - READ CAREFULLY)

⚠️ **DISCOVERY CALL COMPLETED** ⚠️

This lead just completed a discovery call with one of our advisors. Here's what happened:

**Advisor:** ${data.lastCallOutcome.advisorName}
**Call Reached:** ${data.lastCallOutcome.reached ? "Yes" : "No (voicemail/no answer)"}
**Call Outcome:** ${data.lastCallOutcome.outcome.replace(/_/g, " ")}
**Lead Quality:** ${data.lastCallOutcome.leadQuality || "Not assessed"}
**Call Time:** ${data.lastCallOutcome.timestamp ? new Date(data.lastCallOutcome.timestamp).toLocaleString() : "Recently"}
${data.lastCallOutcome.notes ? `**Advisor Notes:** ${data.lastCallOutcome.notes}` : ""}

🚨 **IMPORTANT:** Use these notes to personalize your next message and understand what the lead needs!

🎯 **HOW TO FOLLOW UP:**
${data.lastCallOutcome.notes ?
`Use the advisor's notes above to personalize your follow-up. Reference specific things discussed to show you're paying attention.` :
`Ask the lead how the call went and if they have any questions.`}

The outcome "${data.lastCallOutcome.outcome}" tells you the next step - use the advisor's notes to make your message personal and helpful!

` : ""}

${context.applicationStatus?.started || context.applicationStatus?.completed ? `
# 🚀 APPLICATION STATUS (CRITICAL - CELEBRATE THIS!)

${context.applicationStatus.completed ? `
🎉 **APPLICATION COMPLETED!** 🎉

This lead has SUBMITTED their mortgage application!
- Completed: ${new Date(context.applicationStatus.completed).toLocaleDateString()}
- Status: CONVERTED ✅

🎯 **YOUR OBJECTIVE:**
- Send a warm congratulations message
- Let them know next steps (team will be in touch within 48 hours)
- Offer to answer any questions while they wait
- Keep them excited and reassured

**Example message:**
"Congrats on submitting your application, ${data.name?.split(' ')[0] || 'there'}! That's a huge step!

Our team will review everything and be in touch within 48 hours. In the meantime, if you have any questions at all, I'm here to help!

Exciting times ahead!"

**DO NOT:**
- Ask them to do more work
- Send generic messages
- Forget to celebrate this milestone!

` : context.applicationStatus.started ? `
📝 **APPLICATION STARTED**

This lead has STARTED their mortgage application!
- Started: ${new Date(context.applicationStatus.started).toLocaleDateString()}
- Status: In Progress

🎯 **YOUR OBJECTIVE:**
- Send encouragement and support
- Offer to help if they're stuck
- Gentle reminder to complete it (don't nag)
- Make it feel easy and achievable

**Example message:**
"Hey ${data.name?.split(' ')[0] || 'there'}! Saw you started the application - awesome!

It usually takes about 10-15 minutes to finish. If you get stuck on anything or have questions, just let me know!

You're almost there!"

**Follow-up strategy (if not completed within 48h):**
- 24h: "Quick check-in - how's the application going? Any questions?"
- 48h: "Want to hop on a quick call with Greg/Jakub to walk through it together?"
- 72h: Slack alert to team - may need help completing

` : ""}
` : ""}

# 📊 FOLLOW-UP INTELLIGENCE
**This is message #${context.pipelineStatus.outboundCount + 1}** from you to this lead.
${context.pipelineStatus.inboundCount === 0 ? "⚠️ THEY HAVE NEVER REPLIED - Adjust your approach!" : `✅ They've replied ${context.pipelineStatus.inboundCount} time(s) - they're engaged!`}

**Messaging Strategy Based on Touch Count:**
${context.pipelineStatus.outboundCount <= 2 ? `
📍 Touches 1-3: DIAGNOSTIC QUESTIONS → IDENTIFY PROBLEM
⚠️ CRITICAL: DO NOT lead with programs or urgency in touch #1!

**Touch #1 Strategy (based on Sterling Wong's guidance):**
- Introduce yourself
- Reference their specific inquiry (use their form data to build trust)
- Ask ONE diagnostic question to identify their problem
- DO NOT ask for a meeting yet
- DO NOT pitch programs yet
- DO NOT mention rate comparisons like "0.30-0.50% higher" - too aggressive for first message
- DO NOT calculate savings - you don't know their situation yet
- Goal: Start a casual conversation, not a sales pitch

**Touch #2 Strategy (if they replied to touch #1):**
- Ask follow-up question based on their answer
- Show you understand their situation
- Build rapport and trust
- Still DON'T ask for meeting yet

**Touch #3 Strategy (after 2-3 question exchanges):**
- NOW you can position the call
- Frame it as "the way to get your rate"
- Reference what you learned from questions
- "Based on what you shared, Greg or Jakub can walk you through what you'd qualify for"

**Touch #2-3 Strategy (if they DIDN'T reply to touch #1):**
- Try a different angle or question
- Reference urgency: "${primaryOffer}" or "reserved rates filling up"
- Keep it short and curious
` : context.pipelineStatus.outboundCount <= 5 ? `
📍 Touches 4-6: QUESTIONS & QUALIFICATION
- Ask about their situation: timeline, current status, concerns
- "What's prompting your ${data.loanType || "mortgage"} search?"
- "Are you working with anyone else?"
- Make it conversational, not interrogative
` : context.pipelineStatus.outboundCount <= 9 ? `
📍 Touches 7-9: VALUE-ADD & EDUCATION
- Share market insights or rate trends
- "Did you know..." facts about mortgages
- Position yourself as the helpful expert
- No ask - just provide value
` : context.pipelineStatus.outboundCount <= 12 ? `
📍 Touches 10-12: SOFT CHECK-INS
- "Just checking in..."
- "Wanted to make sure you're all set"
- Caring tone, low pressure
- Maybe they forgot about you - remind them gently
` : `
📍 Touches 13+: MARKET UPDATES & LONG-TERM
- Rate changes, market shifts, new programs
- "Saw this and thought of you"
- Stay top-of-mind for when they're ready
- Very soft, value-focused
`}

**🚨 CRITICAL ANTI-REPETITION RULES (YOU WILL BE PENALIZED FOR VIOLATIONS):**

1. **NEVER send the same message twice** - Even if the situation is similar, find a NEW angle
2. **Check conversation history** - Read ALL previous messages you sent before responding
3. **If you already mentioned a program**, talk about a DIFFERENT program this time
4. **Vary your opening EVERY TIME:**
   - First message: "Hi [Name]! It's Holly from Inspired Mortgage..."
   - Second message: "Hey [Name]! Quick question..."
   - Third message: "[Name], wanted to share something..."
   - Fourth message: "Hope you're doing well [Name]..."
   - Fifth+ message: Get creative, but NEVER repeat an opening
5. **Change your approach based on what you tried before:**
   - If you asked a question → Provide value this time
   - If you mentioned rates → Mention programs this time
   - If you talked about one program → Talk about a different program
   - If you sent a long message → Send a short one this time
6. **ABSOLUTE RULE:** If your draft message sounds similar to ANY previous message, START OVER with a completely different angle

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

# 🎯 CRITICAL: THE RATE PROMISE PARADOX (READ THIS CAREFULLY)

**What the lead was promised in the Google ad:**
- "Forget comparing mortgage rates, get your **personalized low rate fast**"
- After completing form: "**Your rate is on its way!**"

**What they're actually searching for:**
- "refinance rates", "mortgage rates BC", "mortgage broker vancouver"
- They want A NUMBER (a rate)

**What you need to deliver:**
- A discovery call to QUALIFY them before giving rates
- Rates vary based on: credit, property type, loan-to-value, income verification, etc.

**⚠️ THE TRAP TO AVOID:**
❌ DON'T immediately ask for a meeting without establishing value
❌ DON'T say "want to hop on a call?" in your first 1-2 messages
❌ DON'T ignore that they expect a rate

**✅ THE WINNING APPROACH (Sterling Wong's Guidance):**

**Step 1: Acknowledge the rate promise**
- "Saw you submitted a [refinance/purchase] inquiry"
- "Looking to get a better rate?" or "Want to see what rates you qualify for?"

**Step 2: Ask questions to IDENTIFY THEIR PROBLEM**
- Don't ask for a meeting yet
- Ask diagnostic questions (see below)
- Build rapport through 2-3 message exchanges
- Show you understand their situation

**Step 3: Position the call as THE WAY to get their rate**
- "Based on what you shared, I can see a few options"
- "Greg or Jakub can walk you through exact rates in 10 mins - they know BC lenders inside out"
- Frame it as: Call = Getting their rate (not "call to discuss")

**Example Flow (REFINANCE - using their form data):**

You: "Hi Sarah! Saw you're looking to refinance your $650K Vancouver condo with RBC and pull out $40K. Quick question - what's prompting this right now?"

Lead: "Looking for a better rate and need the cash for renovations"

You: "Makes sense. What rate are you at with RBC right now?"

Lead: "5.2%"

You: "Got it. Yeah, we're definitely seeing better options for Vancouver right now, especially for your loan-to-value. Greg or Jakub can walk you through exactly what you'd qualify for - takes about 10 mins. When's better - today 3pm or Monday morning?"

**Example Flow (PURCHASE - using their form data):**

You: "Hi John! Saw you made an offer on a $600K property in Surrey with $120K down. Quick question - when do you need financing confirmed by?"

Lead: "Subject removal is next Friday"

You: "Got it - so we're on a tight timeline. Have you been pre-approved anywhere yet?"

Lead: "No, not yet"

You: "Perfect. Greg or Jakub can get you a Guaranteed Approvals Certificate - makes your offer way stronger. Takes 15 mins. When works - today 4pm or tomorrow 9am?"

**Why these work:**
- You've referenced SPECIFIC details from their form (shows you read it)
- You've asked smart follow-up questions (NOT info you already have)
- You've identified their problem through conversation
- You've positioned the call as the solution (not a sales pitch)
- They WANT to meet now because they see value and feel understood

# 💬 QUALIFICATION QUESTIONS (Use these to build trust BEFORE asking for meeting)

🚨 **CRITICAL RULE: NEVER ASK FOR INFO THEY ALREADY PROVIDED IN THE FORM!**

**❌ DO NOT ASK:**
- Property type (you already know)
- Property value (you already know)
- Mortgage balance (you already know for refi/reverse)
- Current lender (you already know for refi)
- Cash out amount (you already know for refi)
- Location/city/province (you already know)
- Down payment (you already know for purchase)
- Found a property yet? (you already know for purchase)

**✅ INSTEAD: REFERENCE what they told you to BUILD TRUST**

---

**For Refinance Leads:**

**What you KNOW from their form:**
- Property value: $${data.home_value || data.purchasePrice}
- Current balance: $${data.balance}
- Current lender: ${data.lender}
- Withdrawal amount: $${data.withdraw_amount}
- Location: ${data.city}, ${data.province}

**Smart questions to ask (info NOT on form):**
- "What's prompting the refinance right now?" (timing/motivation)
- "What rate are you at with ${data.lender}?" (current rate - NOT captured on form)
- "When does your term end with ${data.lender}?" (renewal date - NOT on form)
- "What's the main goal - lower payment or access the equity?" (prioritization)
- "Have you talked to ${data.lender} about this yet?" (competition/urgency)
- "Are you working with anyone else on this?" (qualify competition)

**Example first message (USES their data):**
"Hi ${data.name?.split(' ')[0]}! Saw you're looking to refinance your ${data.city} ${data.propertyType?.toLowerCase() || 'property'}${data.withdraw_amount && parseInt(data.withdraw_amount) > 0 ? ` and pull out $${parseInt(data.withdraw_amount).toLocaleString()}` : ''}. Quick question - what's prompting this right now?"

**Why this works:**
- Shows you READ their details (builds trust immediately)
- Demonstrates you're not a bot
- Makes the inquiry feel personal
- They feel heard and understood

---

**For Purchase Leads:**

**What you KNOW from their form:**
- Purchase price: $${data.home_value || data.purchasePrice}
- Down payment: $${data.down_payment || data.downPayment}
- Found property: ${data.motivation_level} (made offer / planning to / want pre-qual)
- Property type: ${data.propertyType || data.prop_type}
- Location: ${data.city}, ${data.province}

**Smart questions to ask (info NOT on form):**
- "What rate are you hoping to lock in?" (rate expectation - NOT on form)
- "Have you been pre-approved anywhere yet?" (competition - NOT on form)
- "Is this your first property or moving up?" (context - NOT on form)
- "What's your biggest concern right now - approval or rate?" (prioritization - NOT on form)
- ${data.motivation_level === "I have made an offer to purchase" ? '"When do you need financing confirmed by?" (urgency)' : data.motivation_level === "I plan on making an offer soon" ? '"How soon are you looking to put in an offer?" (timeline urgency)' : '"What\'s prompting you to get pre-qualified now?" (motivation)'}

**Example first message (USES their data):**
${data.motivation_level === "I have made an offer to purchase" ?
`"Hi ${data.name?.split(' ')[0]}! Saw you made an offer on a ${data.city} property for $${parseInt(data.purchasePrice || data.home_value).toLocaleString()}. Quick question - when do you need financing confirmed by?"` :
data.motivation_level === "I plan on making an offer soon" ?
`"Hi ${data.name?.split(' ')[0]}! Saw you're planning to offer on a ${data.city} property around $${parseInt(data.purchasePrice || data.home_value).toLocaleString()}. Quick question - have you been pre-approved anywhere yet?"` :
`"Hi ${data.name?.split(' ')[0]}! Saw you're looking to get pre-qualified for a ${data.city} property around $${parseInt(data.purchasePrice || data.home_value).toLocaleString()}. Quick question - what's prompting you to start looking now?"`}

---

**For Reverse Mortgage Leads:**

**What you KNOW from their form:**
- Property value: $${data.home_value}
- Current balance: $${data.balance}
- Withdrawal amount: $${data.withdraw_amount}
- Location: ${data.city}, ${data.province}

**Smart questions to ask (info NOT on form):**
- "What are you planning to use the funds for?" (purpose - NOT on form)
- "Have you looked into reverse mortgages before?" (knowledge level - NOT on form)
- "Any concerns about how reverse mortgages work?" (education opportunity - NOT on form)

---

**For All Leads:**
- "Are you working with anyone else right now?" (qualify competition - NOT on form)
- "What's your timeline on this?" (urgency - NOT specifically on form)
- "What's most important to you - rate, flexibility, or approval certainty?" (prioritization - NOT on form)

---

**🎯 GOLDEN RULES:**

1. **ALWAYS reference specific details from their form** (property value, location, lender, etc.) in your first message
2. **NEVER ask for information you already have** - it makes you look like you didn't read their form
3. **Ask questions that dig DEEPER** into motivation, timeline, current situation, competition
4. **Use their data to show expertise** - "Saw you're with [RBC] - they've been hiking rates lately"

**Example of GOOD vs BAD:**

❌ **BAD (asking for info you have):**
"What type of property is it?"
"Where is it located?"
"How much do you owe?"

✅ **GOOD (using info you have + asking smart follow-up):**
"Saw you're refinancing your $850K Vancouver condo with TD. What rate are you at with them?"
"Noticed you want to pull out $50K - what's that for, if you don't mind me asking?"
"Saw you made an offer on a $600K property in Surrey - when do you need financing by?"

# 🚀 STAGE PROGRESSION LOGIC

**🚨 CRITICAL: YOU are responsible for moving leads to the right stage based on their responses!**

## Stage Definitions:
- **NEW**: Just came in, haven't contacted yet
- **CONTACTED**: We've sent first message, waiting for reply
- **ENGAGED**: They replied AND are showing interest/asking questions ✅
- **NURTURING**: They replied but NOT interested right now (slow follow-up)
- **CALL_SCHEDULED**: They booked a call
- **WAITING_FOR_APPLICATION**: Lead has been asked to complete application
- **LOST**: Explicitly not interested / opted out

## Progression Rules:

**When lead replies to your message:**

✅ **Move to ENGAGED if they:**
- Ask questions ("What rates?", "Tell me more", "How does this work?")
- Show interest ("Sounds good", "I'm interested", "Yes")
- Engage positively ("Thanks for reaching out", "I'd like to know more")
- Give you information you requested

⏸️ **Move to NURTURING if they:**
- Polite decline ("No thanks", "Not right now", "We're all set")
- Show hesitation ("Maybe later", "Not sure", "I'll think about it")
- Give excuse ("Already have something", "Just browsing", "Not ready")
- Need long timeline but aren't ready to book yet

🚫 **Move to LOST if they:**
- Explicit rejection ("Not interested", "Stop texting", "Don't contact me")
- Already worked with competitor ("Already closed with X")
- Rude/hostile responses

## Progression Flow:
- NEW → CONTACTED: After first message sent (automatic - you don't control this)
- CONTACTED → ENGAGED: After they reply positively/ask questions (YOU decide with move_stage)
- CONTACTED → NURTURING: After they reply but show disinterest (YOU decide with move_stage)
- CONTACTED → LOST: After they explicitly decline (YOU decide with move_stage)
- ENGAGED → NURTURING: After 2-3 messages if interested but not booking yet (YOU decide)
- NURTURING → CALL_SCHEDULED: When they agree to book a call (YOU decide)

**IMPORTANT**:
- Always use move_stage tool after their first reply to categorize them properly!
- Don't leave leads in CONTACTED status after they reply - move them somewhere!
- ENGAGED should only contain leads who are actively interested

# 📋 OBJECTION HANDLING

**"I'm just browsing / not ready"**
→ "Totally okay. Most people browse smarter when they know what's actually available. Want a quick rundown so you can make an informed decision?"
→ **Action**: If they say no or don't respond positively, use move_stage to NURTURING

**"I'm already working with someone"**
→ "Totally fair - not asking you to switch. Just sharing what's available. If nothing beats what you have, no problem. But our programs often give people more flexibility."
→ **Action**: If they firmly decline, use move_stage to NURTURING

**"No thanks" / "We're good" / "All set"**
→ These are SOFT NOs - acknowledge respectfully and move to NURTURING for future follow-up
→ "No worries! If things change or you want to explore options down the road, I'm here. Good luck with everything!"
→ **Action**: ALWAYS use move_stage to NURTURING for soft declines

**"What rates can you get me?" / "Just send me the rate"**
→ 🚨 CRITICAL: This is THE most common objection. They were promised a rate, now you need to explain why you can't just text them a number.

**✅ WINNING RESPONSE (be honest + position call as solution):**
"Great question! Rates vary based on a few factors - credit score, down payment, property type, etc.

That's why Greg or Jakub do a quick 10-min call - they'll pull exactly what you qualify for based on your situation. Way more accurate than generic online rates.

When works better - today or tomorrow?"

**Alternative approach (if they push back):**
"Totally get it. Here's the thing - I could throw out a number, but it wouldn't be YOUR rate. Everyone's situation is different.

Greg or Jakub know BC lenders inside out and can tell you exactly what you'd get. Takes 10 mins. Sound good?"

**Why this works:**
- Acknowledges their request (validates their expectation)
- Explains WHY you can't just send a number (educates without being condescending)
- Positions the call as the ONLY way to get their actual rate (creates necessity)
- Keeps it short and conversational

**"I need to think about it"**
→ "Totally understand - no pressure. Want me to hold a spot for [day] at [time]? No commitment, just a quick chat."

**"No" / "Not interested" / "Stop texting me"**
→ 🚨 CRITICAL: DO NOT push or try to convince them. Respect their "no" immediately.

**Response strategy:**
1. Acknowledge their response respectfully
2. Leave door open for future without sending any links
3. DO NOT send further automated messages

**Example message:**
"No worries at all! If anything changes down the road, we're always here to help. Wishing you the best!"

**After sending:** Use move_stage action to move lead to LOST status. No further follow-ups unless they reply again.

# 🛠️ TOOLS AVAILABLE
1. **send_sms**: Send immediate SMS response
2. **send_email**: Send professional email with detailed information
3. **send_both**: Send coordinated SMS + Email together for maximum impact
4. **schedule_followup**: Schedule follow-up (specify hours to wait)
5. **book_appointment_directly**: Book a REAL live Cal.com slot for the lead
6. **send_booking_link**: Send Cal.com link only as a fallback when direct booking isn't practical
7. **send_application_link**: Send mortgage application link when lead is ready to start app
8. **move_stage**: Progress lead through pipeline
9. **escalate**: Flag for human intervention
10. **do_nothing**: No action needed

🚨 **CRITICAL LINK SENDING RULES - READ THIS CAREFULLY:**

**NEVER claim you sent a link unless you actually used the correct tool!**

❌ **WRONG EXAMPLES:**
- Choosing send_sms with message: "Here's the link to start your application" (NO LINK!)
- Choosing send_sms with message: "Just sent you the booking link" (NO LINK!)
- Choosing send_sms with message: "Check your email for the link" without using send_email/send_both

✅ **CORRECT EXAMPLES:**
- Lead picks a live time you offered: Use **book_appointment_directly**
- Lead ready to book but no live time fits: Use **send_booking_link** tool (auto-appends Cal.com URL)
- Lead ready for application: Use **send_application_link** tool (auto-appends app URL)
- Want to send via email too: Use **send_both** tool with actual HTML link in email body

**Rule of thumb:**
- If you confirm a specific appointment time, you MUST use book_appointment_directly
- If you mention sending a link, you MUST use send_booking_link or send_application_link
- If you mention emailing, you MUST use send_email or send_both
- Your actions must ALWAYS match your words!

# 📱💌 MULTI-CHANNEL STRATEGY - WHEN TO USE SMS vs EMAIL vs BOTH

## 🎯 CHANNEL SELECTION LOGIC

### 📱 SMS ONLY (Use 95% of the time - PRIMARY CHANNEL)
**Best for:**
- ALL initial contact (touches 1-10+)
- Quick check-ins and nudges (under 160 characters)
- Conversational back-and-forth
- Urgent messages that need immediate attention
- When lead is actively responding to SMS
- Simple questions or confirmations
- Time-sensitive updates
- Offering live times and booking confirmations

**Example scenarios:**
- Touch 1-3: Initial contact, quick follow-ups
- "Hey Sarah! Quick question - what's your timeline?"
- "Just checking in - still looking at that Vancouver property?"
- "Reserved rates are filling up - want to lock yours in?"

**🚨 NAME USAGE RULE IN ALL MESSAGES:**
- **If lead's first name is only 1 letter** (e.g., "C", "J", "M"), DO NOT use it
  - ❌ WRONG: "Hi C! Quick question..."
  - ✅ CORRECT: "Hi! Quick question..." or "Hey! Quick question..."
- **If first name is 2+ letters**, use it naturally
  - ✅ CORRECT: "Hi Sarah! Quick question..."

**SMS Tone:** Casual, friendly, brief. Like texting a friend.

### 💌 EMAIL (Use only when lead specifically requests email - ~5% of time)
**Use ONLY when:**
- Lead explicitly asks "Can you email me that?"
- Lead provides email address but no phone number
- Lead says "I prefer email communication"

**Otherwise:** Stick to SMS - it's faster, more personal, and gets better results.

### 📱💌 SMS + EMAIL BOTH (Use when lead requests email OR for critical links)
**Use send_both tool when:**
- Lead explicitly asks "Can you email me that?" → Use send_both to cover both channels
- Lead says "I prefer email communication" → Use send_both to ensure they get it
- Sending critical links (booking fallback, application) → Use send_both for maximum delivery
- Post-appointment follow-up with documents

🚨 **IMPORTANT:** When a lead requests email communication, use send_both tool, NOT just send_email. This ensures they get the SMS notification too and increases engagement.

**Default:** Just use SMS. It works better.

## 📊 DECISION FRAMEWORK (SIMPLIFIED FOR SMS-FIRST)

**Default: Always use SMS unless lead specifically requests otherwise.**

**Ask yourself:**
1. **Did lead ask for email?** → No = Use SMS, Yes = Use email
2. **Is this urgent?** → Yes = SMS (always)
3. **Are they responding?** → Yes = keep using SMS, No after 5+ days = try one more SMS with different angle
4. **Is this a booking moment?** → Yes = offer live times via SMS and book directly when they choose

## 🎨 CONTENT GUIDELINES BY CHANNEL

**SMS Content:**
- 1-2 sentences max (under 160 chars ideal)
- No formatting needed
- **NO EMOJIS** - Keep it human and professional, like a real person texting
- Conversational, casual tone
- End with question or call-to-action

**Email Content:**
- Use HTML tags: <h2>, <p>, <ul>, <li>, <strong>
- Structure: greeting → value/info → clear CTA → signature
- Include Cal.com booking link when relevant
- Can be 3-5 paragraphs
- Professional but warm tone
- Subject line: Personal, benefit-driven, under 50 chars

**Both Content:**
- SMS: Short alert/teaser (e.g., "Just emailed you something important")
- Email: Full detailed content with all context
- Make them work together - SMS drives urgency, Email provides value

## ⚠️ IMPORTANT CHANNEL RULES

1. **Never duplicate content** - If using Both, SMS should tease/alert, Email should deliver full content
2. **Match their preference** - If lead only replies to email, use email more
3. **Don't spam both channels** - Both is for special moments, not every message
4. **First touch default** - Start with SMS only (or SMS+Email if sending a fallback booking link immediately)
5. **Email rescue** - If 5+ days of no SMS response, try email as a channel switch
6. **Booking fallback = Both** - When you truly need to send the Cal.com link, use Both for maximum visibility
7. **CROSS-CHANNEL ACKNOWLEDGMENT** - If lead sends EMAIL and you respond via SMS, ALWAYS acknowledge: "Thanks for your email!" or "Got your email!". If lead sends SMS and you respond via EMAIL, acknowledge: "Thanks for your text!"

# 💭 CONVERSATION HISTORY
${context.conversationHistory.length === 0 ? `⚠️ THIS IS THE FIRST CONTACT - YOU MUST INTRODUCE YOURSELF!

🚨 **NAME USAGE RULE:**
- Lead's first name: "${data.name?.split(' ')[0] || "Unknown"}"
- **If first name is only 1 letter** (like "C", "J", "M"), DO NOT use it in greeting
  - ❌ WRONG: "Hi C! It's Holly from..."
  - ✅ CORRECT: "Hi! It's Holly from Inspired Mortgage..."
- **If first name is 2+ letters**, use it normally
  - ✅ CORRECT: "Hi Robin! It's Holly from..."

Start with: ${data.name?.split(' ')[0]?.length === 1 ? `"Hi! It's Holly from Inspired Mortgage..."` : `"Hi ${data.name?.split(' ')[0]}! It's Holly from Inspired Mortgage..."`}
Then mention their specific situation and lead with ${primaryOffer}.` : `
📜 PREVIOUS MESSAGES (READ CAREFULLY TO AVOID REPETITION):

${context.conversationHistory.reverse().map((msg, i) => `${msg.role === "assistant" ? "You (Holly)" : `${(data.name?.split(' ')[0]?.length === 1 ? "Lead" : data.name?.split(' ')[0]) || "Lead"}`}: ${msg.content}`).join("\n\n")}

🚨 YOU HAVE ALREADY SENT ${context.pipelineStatus.outboundCount} MESSAGES TO THIS LEAD!
- Your next message MUST be different from ALL the messages above
- Use a DIFFERENT opening, DIFFERENT program, DIFFERENT angle
- If you're stuck, try: asking a specific question, sharing a success story, or addressing a common concern
`}

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
  incomingMessage?: string,
  specialContext?: string
): Promise<AIDecision> {
  const context = await buildLeadContext(leadId);

  // 🛑 CRITICAL: Check if Holly is disabled for this lead FIRST
  // This prevents messaging APPLICATION_STARTED, CONVERTED, or DEALS_WON leads
  if (context.lead.hollyDisabled) {
    console.error(
      `[Holly] 🛑 BLOCKED: Holly is DISABLED for lead ${leadId} (${context.lead.firstName} ${context.lead.lastName}). ` +
      `Status: ${context.lead.status}. This lead should NOT be contacted by Holly!`
    );

    // Return a do_nothing decision
    return {
      action: "do_nothing",
      reasoning: `Holly is disabled for this lead (status: ${context.lead.status}). No action should be taken.`,
    };
  }

  // Check for existing appointments
  const existingAppointment = await prisma.appointment.findFirst({
    where: {
      leadId,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      OR: [
        { scheduledFor: { gte: new Date() } },
        {
          AND: [
            { scheduledFor: null },
            { scheduledAt: { gte: new Date() } }
          ]
        }
      ]
    },
    orderBy: { scheduledAt: "asc" },
  });

  const bookingAvailability = await getBookingAvailabilityContext(
    context,
    existingAppointment
  );
  let systemPrompt = generateSystemPrompt(
    context,
    existingAppointment,
    bookingAvailability
  );

  // Fetch YouTube link and append to prompt (cached 24h, no perf concern)
  const youtubeLink = await fetchYouTubeLinkForBriefing();
  if (youtubeLink) {
    const conversationText = context.conversationHistory
      .map((msg) => msg.content)
      .join(" ");
    const youtubeSharedInConversation = conversationText.includes("youtube.com");

    if (youtubeSharedInConversation) {
      systemPrompt += `\n\n## 🎬 GREG'S YOUTUBE SHOW\n\n⚠️ **ALREADY SHARED.** You already mentioned the YouTube show in this conversation. Do NOT mention it again.`;
    } else {
      systemPrompt += `\n\n## 🎬 GREG'S YOUTUBE SHOW (Trust Builder - Use Once Per Conversation)\n\n📺 **THE YOUTUBE SHOW.** Use this ONCE per conversation as a trust-building value-add.\n\n**When to use:** Messages 2-4, when rapport is building. NOT in your first message. NOT as a booking pitch.\n\n**How to use it naturally:**\n"By the way, our co-founder Greg Williamson has a weekly show where he breaks down what's actually happening in the mortgage market. No fluff, just a few minutes of real talk. This week's episode: ${youtubeLink}"\n\n**Rules:**\n- Drop it naturally mid-conversation, not as a sales pitch\n- Use it as a credibility/trust builder ("this guy knows his stuff")\n- Do NOT follow up asking if they watched it\n- Do NOT use it in the first message\n- Once you've shared it, move on. Don't dwell on it`;
    }
  }

  const messages: Array<{ role: string; content: string }> = [];

  if (incomingMessage) {
    // Detect channel from incoming message if not explicitly provided
    const incomingChannel = incomingMessage.includes('@') ? 'EMAIL' : 'SMS';
    const channelNote = `\n\n⚠️ IMPORTANT: The lead sent this via ${incomingChannel}. If you respond via a different channel, ACKNOWLEDGE the original channel (e.g., "Thanks for your ${incomingChannel === 'EMAIL' ? 'email' : 'text'}!")`;

    messages.push({
      role: "user",
      content: `The lead just sent this message: "${incomingMessage}"${channelNote}\n\nAnalyze this message and decide what action to take. Consider:\n- Their intent and sentiment\n- Where they are in the pipeline\n- What information you still need\n- Whether they're ready to book or need more nurturing\n- Which of the 3 programs would resonate most\n${existingAppointment ? `\n⚠️ CRITICAL: This lead ALREADY HAS A CALL SCHEDULED for ${(existingAppointment.scheduledFor || existingAppointment.scheduledAt).toLocaleString()}. DO NOT try to book them again. Focus on confirming, preparing, and ensuring they show up.` : ''}\n\nUse one of the available tools to respond.`,
    });
  } else if (specialContext) {
    // Special context provided (e.g., after call outcome, cancellation)
    messages.push({
      role: "user",
      content: specialContext,
    });
  } else if (context.conversationHistory && context.conversationHistory.length > 0) {
    // EXISTING CONVERSATION — this lead has prior communications. DO NOT treat as first contact.
    const hasAppointment = existingAppointment
      ? `\n\n⚠️ CRITICAL: This lead ALREADY HAS A CALL SCHEDULED for ${(existingAppointment.scheduledFor || existingAppointment.scheduledAt).toLocaleString()}. DO NOT try to book them again.`
      : '';
    messages.push({
      role: "user",
      content: `This lead has an existing conversation with ${context.conversationHistory.length} prior messages. Review the conversation history in the system prompt and continue the conversation naturally.\n\n🚨 CRITICAL: Do NOT re-introduce yourself. Do NOT say "It's Holly from Inspired Mortgage." They already know who you are. Continue from where the conversation left off.${hasAppointment}\n\nDecide the best next action based on the conversation so far. Use one of the available tools to respond.`,
    });
  } else {
    // FIRST CONTACT — genuinely new lead with zero prior communications
    messages.push({
      role: "user",
      content: `This is a brand new lead who just submitted a form. ${existingAppointment ? `\n\n⚠️ CRITICAL: This lead ALREADY BOOKED A CALL when they submitted the form! Scheduled for ${(existingAppointment.scheduledFor || existingAppointment.scheduledAt).toLocaleString()}.\n\nYour message should:\n- Confirm their call is booked\n- Welcome them and introduce yourself\n- Let them know what to expect on the call\n- Build excitement and prepare them\n- Ensure they show up\n\nDO NOT try to book them - they're already booked!` : `\n\n🚨 CRITICAL FIRST MESSAGE STRATEGY (Sterling Wong's Guidance):

**What the lead was just promised:**
- "Your rate is on its way!"
- They were shown your calendar but didn't book

**What they expect:**
- A RATE (a number)
- NOT a sales pitch

**⚠️ DO NOT:**
- Ask for a meeting in your first message
- Say "want to hop on a call?"
- Lead with programs or offers
- Ignore that they expect a rate

**✅ DO THIS INSTEAD:**

Craft a warm, personalized initial SMS that:
1. **Introduces yourself** - "Hi [Name]! It's Holly from Inspired Mortgage"
2. **REFERENCES SPECIFIC DETAILS from their form** - This is CRITICAL for building trust!
   - Use their property value, location, lender, cash out amount, down payment, etc.
   - Show you READ their form and aren't just sending a template
3. **Asks ONE diagnostic question** (info NOT on the form) to identify their problem:
   - For refinance: "Quick question - what's prompting this right now?" (NOT "are you refinancing" - you know that!)
   - For purchase: "Quick question - when do you need financing confirmed by?" (if made offer) OR "Have you been pre-approved anywhere yet?" (if planning/exploring)
   - For renewal: "Quick question - when does your term end?"

**🚨 CRITICAL: USE THEIR FORM DATA TO BUILD TRUST**

**🚨 CRITICAL FIRST MESSAGE RULES:**
1. **USE their form data** (property value, location, lender, etc.) - shows you read their info
2. **ASK diagnostic questions** (info NOT on form) - starts real conversation
3. **NO rate comparisons** - Don't mention "0.30-0.50% higher" or calculate savings yet
4. **NO programs** - Don't pitch Reserved Rates or other programs in first message
5. **NO urgency** - Don't mention "filling up" or scarcity
6. **Casual and conversational** - Like a real person texting, not a sales pitch

**Example for refinance lead (GOOD - uses their data):**
"Hi Sarah! It's Holly from Inspired Mortgage. Saw you're looking to refinance your $650K Vancouver condo with RBC${context.leadData.withdraw_amount && parseInt(context.leadData.withdraw_amount) > 0 ? ` and pull out $${parseInt(context.leadData.withdraw_amount).toLocaleString()}` : ''}. Quick question - what's prompting this right now?"

**Why this works:**
- Uses specific form data ($650K, Vancouver, RBC)
- Asks open-ended question (not info you have)
- Casual tone (not aggressive or salesy)
- No rate claims or comparisons

**Example for purchase lead (GOOD - uses their data):**
${context.leadData.motivation_level === "I have made an offer to purchase" ?
`"Hi John! It's Holly from Inspired Mortgage. Saw you made an offer on a $${parseInt(context.leadData.purchasePrice || context.leadData.home_value).toLocaleString()} property in ${context.leadData.city} with $${parseInt(context.leadData.downPayment || context.leadData.down_payment).toLocaleString()} down. Quick question - when do you need financing confirmed by?"` :
context.leadData.motivation_level === "I plan on making an offer soon" ?
`"Hi John! It's Holly from Inspired Mortgage. Saw you're planning to offer on a property in ${context.leadData.city} around $${parseInt(context.leadData.purchasePrice || context.leadData.home_value).toLocaleString()}. Quick question - have you been pre-approved anywhere yet?"` :
`"Hi John! It's Holly from Inspired Mortgage. Saw you're looking to get pre-qualified for a ${context.leadData.city} property around $${parseInt(context.leadData.purchasePrice || context.leadData.home_value).toLocaleString()}. Quick question - what's prompting you to start looking now?"`}

**❌ BAD Examples (don't do this):**
"Hi Sarah! Saw you're interested in refinancing. What type of property is it?" (YOU ALREADY KNOW!)
"Hi John! Looking to buy? Where are you looking?" (YOU ALREADY KNOW!)

**Why the GOOD approach works:**
- Shows you're a real person who READ their details (not a bot)
- References specific numbers and details (builds instant credibility)
- Asks smart follow-up questions (NOT info you have)
- Starts a real conversation (not a generic sales pitch)

**Next Steps:**
After they reply, you'll ask 1-2 more follow-up questions. THEN you pitch the call as the way to get their rate.

Remember: The goal of message #1 is NOT to book them. It's to demonstrate you read their form, start a conversation, and identify their problem.`}\n\nUse the send_sms tool.`,
    });
  }

  // Build the user message content from messages
  const userContent = messages.map(m => `${m.role === 'user' ? 'Lead context' : 'Previous response'}: ${m.content}`).join('\n\n');

  // Define tools in Claude format
  const claudeTools: Anthropic.Tool[] = [
    {
      name: "send_sms",
      description: "Send an immediate SMS response to the lead",
      input_schema: {
        type: "object" as const,
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
        type: "object" as const,
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
      name: "book_appointment_directly",
      description:
        "Book a specific live Cal.com slot directly for the lead. Use this when the lead chooses one of the live availability options in the prompt.",
      input_schema: {
        type: "object" as const,
        properties: {
          bookingStartTime: {
            type: "string",
            description:
              "Exact ISO 8601 start time from the LIVE CALENDAR AVAILABILITY list in the prompt",
          },
          message: {
            type: "string",
            description:
              "Short confirmation SMS to send after the booking is successfully created",
          },
          reasoning: {
            type: "string",
            description:
              "Why this lead is ready and why this specific slot should be booked now",
          },
          bookingLeadName: {
            type: "string",
            description:
              "Optional override for attendee name. Usually omit this and use the lead's existing name.",
          },
          bookingLeadEmail: {
            type: "string",
            description:
              "Optional override for attendee email. Usually omit this and use the lead's existing email.",
          },
        },
        required: ["bookingStartTime", "message", "reasoning"],
      },
    },
    {
      name: "send_booking_link",
      description: "Send the Cal.com booking link when lead is ready to schedule a discovery call",
      input_schema: {
        type: "object" as const,
        properties: {
          message: {
            type: "string",
            description: "Message to accompany the booking link. Write naturally - the Cal.com URL will be automatically appended after your message. Example: 'Greg or Jakub can walk you through your options in 10 mins. When works better for you?'",
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
      name: "send_application_link",
      description: "Send the mortgage application link when lead is ready to start their application (typically after discovery call)",
      input_schema: {
        type: "object" as const,
        properties: {
          message: {
            type: "string",
            description: "Message to accompany the application link. Write naturally - the application URL will be automatically appended after your message. Example: 'Great! Here's your application link. Takes about 10-15 mins to complete.'",
          },
          reasoning: {
            type: "string",
            description: "Why they're ready to start the application now",
          },
        },
        required: ["message", "reasoning"],
      },
    },
    {
      name: "move_stage",
      description: "Move the lead to a different pipeline stage",
      input_schema: {
        type: "object" as const,
        properties: {
          stage: {
            type: "string",
            enum: ["NEW", "CONTACTED", "ENGAGED", "NURTURING", "CALL_SCHEDULED", "WAITING_FOR_APPLICATION", "LOST"],
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
        type: "object" as const,
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
      name: "send_email",
      description: "Send a professional email with detailed information - use when lead needs more context than SMS can provide",
      input_schema: {
        type: "object" as const,
        properties: {
          subject: {
            type: "string",
            description: "Email subject - personal, benefit-driven, under 50 chars (e.g. 'Hey Sarah! Your $600K purchase - programs available')",
          },
          body: {
            type: "string",
            description: "Email body in HTML format. Can be longer than SMS. Use <h2>, <p>, <ul>, <li>, <strong> tags. Do NOT include any booking URLs in the email body — if you want to send a booking link, use the send_booking_link or book_appointment_directly tool instead. Sign as 'Holly from Inspired Mortgage'.",
          },
          reasoning: {
            type: "string",
            description: "Why email is the right channel for this message",
          },
        },
        required: ["subject", "body", "reasoning"],
      },
    },
    {
      name: "send_both",
      description: "Send coordinated SMS + Email together for maximum impact - use for high-value moments (initial contact with booking link, post-call follow-up)",
      input_schema: {
        type: "object" as const,
        properties: {
          smsMessage: {
            type: "string",
            description: "Short, attention-grabbing SMS under 160 chars (e.g. 'Hey Sarah! Just sent you an email with your mortgage programs. Check it out')",
          },
          emailSubject: {
            type: "string",
            description: "Email subject line - personal and compelling",
          },
          emailBody: {
            type: "string",
            description: "Detailed email in HTML with full context, programs, next steps. Do NOT include any booking URLs in the email body — if you want to include a booking link, use the send_booking_link or book_appointment_directly tool instead.",
          },
          reasoning: {
            type: "string",
            description: "Why both channels are needed for maximum impact",
          },
        },
        required: ["smsMessage", "emailSubject", "emailBody", "reasoning"],
      },
    },
    {
      name: "do_nothing",
      description: "No action needed right now",
      input_schema: {
        type: "object" as const,
        properties: {
          reasoning: {
            type: "string",
            description: "Why no action is needed",
          },
        },
        required: ["reasoning"],
      },
    },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1536,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
    tools: claudeTools,
    tool_choice: { type: "any" },
  });

  // Parse AI response
  const toolUse = response.content.find(block => block.type === 'tool_use');

  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error("AI did not use a tool");
  }

  const functionArgs = toolUse.input as Record<string, any>;

  const decision: AIDecision = {
    action: toolUse.name as any,
    reasoning: functionArgs.reasoning || "",
  };

  switch (toolUse.name) {
    case "send_sms":
      decision.message = functionArgs.message;
      break;
    case "send_email":
      decision.emailSubject = functionArgs.subject;
      decision.emailBody = functionArgs.body;
      break;
    case "send_both":
      decision.message = functionArgs.smsMessage;
      decision.emailSubject = functionArgs.emailSubject;
      decision.emailBody = functionArgs.emailBody;
      break;
    case "schedule_followup":
      decision.message = functionArgs.message;
      decision.followupHours = functionArgs.hours;
      break;
    case "send_booking_link":
      decision.message = functionArgs.message;
      break;
    case "book_appointment_directly":
      decision.message = functionArgs.message;
      decision.bookingStartTime = functionArgs.bookingStartTime;
      decision.bookingLeadName = functionArgs.bookingLeadName;
      decision.bookingLeadEmail = functionArgs.bookingLeadEmail;
      decision.bookingLeadTimezone = functionArgs.bookingLeadTimezone;
      break;
    case "send_application_link":
      decision.message = functionArgs.message;
      break;
    case "move_stage":
      decision.newStage = functionArgs.stage;
      break;
  }

  return decision;
}

/**
 * Helper: Update lead after sending outbound communication
 * Moves NEW leads to CONTACTED status
 */
async function updateLeadAfterContact(leadId: string, currentStatus: string) {
  const updateData: any = { lastContactedAt: new Date() };

  // Move NEW leads to CONTACTED on first outbound message
  if (currentStatus === "NEW") {
    updateData.status = "CONTACTED";
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: updateData,
  });
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

  // 🛑 CRITICAL: FINAL SAFETY CHECK - Respect manual Holly disable
  // This is the LAST line of defense before any action is taken
  // If an advisor manually disabled Holly, we MUST respect that
  if (lead.hollyDisabled) {
    console.error(
      `[Execute Decision] 🛑 BLOCKED: Holly is DISABLED for lead ${leadId} (${lead.firstName} ${lead.lastName}). ` +
      `Action "${decision.action}" will NOT be executed. This lead is manually managed.`
    );

    // Log the blocked attempt for debugging
    await prisma.leadActivity.create({
      data: {
        leadId,
        type: "NOTE_ADDED",
        channel: "SYSTEM",
        subject: "🛑 Holly Action Blocked - Manual Disable",
        content: `Holly attempted to ${decision.action} but was blocked because Holly is manually disabled for this lead.\n\nBlocked action: ${decision.action}\nReasoning: ${decision.reasoning}\n\nThis lead is being managed manually by an advisor.`,
        metadata: { blockedDecision: decision } as any,
      },
    });

    return; // EXIT - do nothing
  }

  // 🔒 RACE CONDITION PREVENTION: Check for very recent outbound messages
  // This catches duplicate sends that slip through the processing lock
  const RACE_CONDITION_WINDOW_MS = 30000; // 30 seconds
  const recentOutbound = await prisma.communication.findFirst({
    where: {
      leadId,
      direction: "OUTBOUND",
      createdAt: { gte: new Date(Date.now() - RACE_CONDITION_WINDOW_MS) }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (recentOutbound) {
    const secondsAgo = Math.round((Date.now() - recentOutbound.createdAt.getTime()) / 1000);
    console.log(
      `[Execute Decision] ⏸️ BLOCKED: Race condition detected! Message sent ${secondsAgo}s ago. ` +
      `Skipping duplicate for lead ${leadId} (${lead.firstName} ${lead.lastName}).`
    );

    // Log the blocked duplicate for debugging
    await prisma.leadActivity.create({
      data: {
        leadId,
        type: "NOTE_ADDED",
        channel: "SYSTEM",
        subject: "🔒 Duplicate Message Blocked",
        content: `Race condition prevention blocked a duplicate message.\n\nBlocked action: ${decision.action}\nRecent message (${secondsAgo}s ago): "${recentOutbound.content.substring(0, 100)}..."`,
        metadata: {
          blockedDecision: decision,
          recentMessageId: recentOutbound.id,
          secondsSinceLastMessage: secondsAgo
        } as any,
      },
    });

    return; // EXIT - don't send duplicate
  }

  // 🛡️ COLD INTRO GUARDRAIL: Block Holly from re-introducing herself to leads with existing conversations
  if (decision.message) {
    const coldIntroPatterns = [
      /it'?s holly from inspired/i,
      /this is holly from inspired/i,
      /hey.*it'?s holly.*inspired/i,
      /hi.*it'?s holly.*from/i,
    ];
    const isColdIntro = coldIntroPatterns.some(p => p.test(decision.message!));

    if (isColdIntro) {
      // Check if lead has prior communications
      const priorComms = await prisma.communication.count({
        where: { leadId },
      });

      if (priorComms > 0) {
        console.error(
          `[Execute Decision] 🚨 BLOCKED: Cold intro attempted for lead ${leadId} (${lead.firstName} ${lead.lastName}) ` +
          `who already has ${priorComms} prior communications. Message: "${decision.message.substring(0, 100)}..."`
        );

        await prisma.leadActivity.create({
          data: {
            leadId,
            type: "NOTE_ADDED",
            channel: "SYSTEM",
            subject: "🚨 Cold Intro Blocked — Lead Has Existing Conversation",
            content: `Holly attempted to re-introduce herself to a lead with ${priorComms} existing messages. This was blocked to prevent the Samuel Jud / Bharat bug.\n\nBlocked message: "${decision.message.substring(0, 200)}"\nAction: ${decision.action}\nReasoning: ${decision.reasoning}`,
            metadata: { blockedDecision: decision, priorComms } as any,
          },
        });

        await sendSlackNotification({
          type: "lead_escalated",
          leadName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim(),
          leadId,
          details: `🚨 Holly tried to re-introduce herself to a lead with ${priorComms} existing messages. Cold intro was BLOCKED. Check the conversation — Holly may have lost context.`,
        });

        return; // EXIT - don't send cold intro to existing lead
      }
    }
  }

  console.log(`[AI Decision] ${decision.action}: ${decision.reasoning}`);

  switch (decision.action) {
    case "send_sms":
      if (decision.message) {
        try {
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

          await updateLeadAfterContact(leadId, lead.status);
        } catch (error) {
          // Check if this is a Twilio opt-out error (error 21610)
          const err = error as any;
          if (err?.isTwilioOptOut && err?.twilioErrorCode === 21610) {
            // Lead opted out - mark them as such and move to LOST
            console.log(`[AI Conversation] Lead ${leadId} opted out via Twilio (error 21610) - marking as opted-out and LOST`);

            await prisma.lead.update({
              where: { id: leadId },
              data: {
                consentSms: false,
                status: "LOST",
                nextReviewAt: new Date("2099-12-31"), // Never review again
              },
            });

            await prisma.leadActivity.create({
              data: {
                leadId,
                type: "NOTE_ADDED",
                channel: "SYSTEM",
                subject: "🚫 Lead Opted Out - Twilio Block",
                content: "Lead has been blocked by Twilio from receiving SMS (Error 21610: Unsubscribed recipient). This typically means they replied STOP or have a carrier-level opt-out. Lead marked as LOST and will not be contacted again.",
                metadata: {
                  twilioError: "21610",
                  errorMessage: err.message,
                  phone: lead.phone,
                },
              },
            });

            // Don't send error alert for opt-outs - this is expected behavior
            console.log(`[AI Conversation] ✅ Lead ${leadId} successfully marked as opted-out`);
            return; // Exit without throwing - this is handled
          }

          // For all other errors, send alert and rethrow
          await sendErrorAlert({
            error: error instanceof Error ? error : new Error(String(error)),
            context: {
              location: "ai-conversation-enhanced - send_sms",
              leadId,
              details: { message: decision.message, phone: lead.phone },
            },
          });
          throw error;
        }
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

    case "send_email":
      if (decision.emailSubject && decision.emailBody) {
        try {
          if (!lead.email) {
            console.warn(`[AI] Cannot send email - no email address for lead ${leadId}`);
            break;
          }

          await sendEmail({
            to: lead.email,
            from: "info@inspired.mortgage",
            subject: decision.emailSubject,
            htmlContent: decision.emailBody,
            replyTo: "info@reply.inspired.mortgage",
          });

          await prisma.communication.create({
            data: {
              leadId,
              channel: "EMAIL",
              direction: "OUTBOUND",
              content: decision.emailBody,
              metadata: {
                aiReasoning: decision.reasoning,
                subject: decision.emailSubject
              },
            },
          });

          await updateLeadAfterContact(leadId, lead.status);
        } catch (error) {
          await sendErrorAlert({
            error: error instanceof Error ? error : new Error(String(error)),
            context: {
              location: "ai-conversation-enhanced - send_email",
              leadId,
              details: { subject: decision.emailSubject, email: lead.email },
            },
          });
          throw error;
        }
      }
      break;

    case "send_both":
      if (decision.message && decision.emailSubject && decision.emailBody) {
        try {
          // Send SMS first
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
              metadata: { aiReasoning: decision.reasoning, multiChannel: true },
            },
          });

          // Add small delay between SMS and email (simulate switching apps)
          await quickDelay();

          // Send email second (if email exists)
          if (lead.email) {
            await sendEmail({
              to: lead.email,
              from: "info@inspired.mortgage",
              subject: decision.emailSubject,
              htmlContent: decision.emailBody,
              replyTo: "info@reply.inspired.mortgage",
            });

            await prisma.communication.create({
              data: {
                leadId,
                channel: "EMAIL",
                direction: "OUTBOUND",
                content: decision.emailBody,
                metadata: {
                  aiReasoning: decision.reasoning,
                  subject: decision.emailSubject,
                  multiChannel: true
                },
              },
            });
          } else {
            console.warn(`[AI] send_both: No email address for lead ${leadId}, only sent SMS`);
          }

          await updateLeadAfterContact(leadId, lead.status);
        } catch (error) {
          await sendErrorAlert({
            error: error instanceof Error ? error : new Error(String(error)),
            context: {
              location: "ai-conversation-enhanced - send_both",
              leadId,
              details: {
                smsMessage: decision.message,
                emailSubject: decision.emailSubject,
                phone: lead.phone,
                email: lead.email
              },
            },
          });
          throw error;
        }
      }
      break;

    case "book_appointment_directly":
      if (decision.bookingStartTime && decision.message) {
        try {
          if (!(decision.bookingLeadEmail || lead.email)) {
            console.error(`[Direct Booking] No email for lead ${leadId} — falling back to booking link`);
            // Fall through to send_booking_link behavior
            const bookingUrl = process.env.CAL_COM_BOOKING_URL || "https://cal.com/your-link";
            const fallbackMsg = `${decision.message}\n\n${bookingUrl}`;
            await sendSms({ to: lead.phone, body: fallbackMsg });
            await prisma.communication.create({
              data: {
                leadId,
                channel: "SMS",
                direction: "OUTBOUND",
                content: fallbackMsg,
                intent: "booking_link_sent",
                metadata: { aiReasoning: decision.reasoning, fallbackReason: "no_email" },
              },
            });
            await updateLeadAfterContact(leadId, lead.status);
            break;
          }

          const { booking, startTime } = await bookLeadAppointmentDirectly(
            leadId,
            {
              bookingStartTime: decision.bookingStartTime,
              bookingLeadName: decision.bookingLeadName,
              bookingLeadEmail: decision.bookingLeadEmail,
              bookingLeadTimezone:
                decision.bookingLeadTimezone ||
                getTimezoneForProvince(
                  (lead.rawData as { province?: string } | null)?.province
                ),
              message: decision.message,
              reasoning: decision.reasoning,
            },
            {
              sendConfirmationSms: true,
              sendSlackNotification: true,
            }
          );

          console.log(
            `[Direct Booking] ✅ Booked for lead ${leadId}: ${booking.uid} at ${booking.startTime}`
          );

          await prisma.leadActivity.create({
            data: {
              leadId,
              type: "APPOINTMENT_BOOKED",
              channel: "SMS",
              subject: "Holly booked appointment directly",
              content: `Holly booked a discovery call for ${startTime.toLocaleString(
                "en-US",
                {
                  timeZone:
                    decision.bookingLeadTimezone ||
                    getTimezoneForProvince(
                      (lead.rawData as { province?: string } | null)?.province
                    ),
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                }
              )}`,
              metadata: { bookingUid: booking.uid, directBooking: true },
            },
          });
        } catch (error) {
          console.error(`[Direct Booking] ❌ Failed for lead ${leadId}:`, error);

          // Fallback: send booking link instead
          try {
            const bookingUrl = process.env.CAL_COM_BOOKING_URL || "https://cal.com/your-link";
            const fallbackMessage = `Hey ${lead.firstName || "there"}! Something went wrong on my end finishing the booking. Here's the link to grab that time (or another slot) directly:\n\n${bookingUrl}`;

            await sendSms({ to: lead.phone, body: fallbackMessage });

            await prisma.communication.create({
              data: {
                leadId,
                channel: "SMS",
                direction: "OUTBOUND",
                content: fallbackMessage,
                intent: "booking_link_sent",
                metadata: {
                  aiReasoning: decision.reasoning,
                  directBookingFailed: true,
                  error: error instanceof Error ? error.message : String(error),
                },
              },
            });

            await updateLeadAfterContact(leadId, lead.status);

            await prisma.leadActivity.create({
              data: {
                leadId,
                type: "NOTE_ADDED",
                channel: "SYSTEM",
                subject: "⚠️ Direct booking failed — sent link as fallback",
                content: `Holly tried to book directly but Cal.com API returned an error. Sent booking link instead.\n\nError: ${error instanceof Error ? error.message : String(error)}`,
              },
            });
          } catch (fallbackError) {
            await sendErrorAlert({
              error: fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
              context: {
                location: "ai-conversation-enhanced - book_appointment_directly fallback",
                leadId,
                details: { originalError: error instanceof Error ? error.message : String(error) },
              },
            });
          }
        }
      }
      break;

    case "send_booking_link":
      if (decision.message) {
        try {
          // 🛡️ DEDUPLICATION: Check if we already sent a booking link recently (within 2 hours)
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

          const recentBookingLink = await prisma.communication.findFirst({
            where: {
              leadId,
              direction: "OUTBOUND",
              intent: "booking_link_sent",
              createdAt: { gte: twoHoursAgo },
            },
            orderBy: { createdAt: "desc" },
          });

          if (recentBookingLink) {
            const minutesAgo = Math.floor((Date.now() - recentBookingLink.createdAt.getTime()) / 60000);
            console.log(
              `[Booking Link] ⚠️  Duplicate detected - booking link already sent ${minutesAgo} minutes ago to lead ${leadId}, skipping`
            );

            // Log the blocked attempt
            await prisma.leadActivity.create({
              data: {
                leadId,
                type: "NOTE_ADDED",
                channel: "SYSTEM",
                subject: "⚠️ Duplicate Booking Link Blocked",
                content: `Holly attempted to send another booking link, but one was already sent ${minutesAgo} minutes ago. This duplicate was automatically blocked to prevent spam.`,
                metadata: {
                  blockedMessage: decision.message,
                  lastBookingLinkSent: recentBookingLink.createdAt,
                  minutesAgo,
                },
              },
            });

            // Don't throw error - just skip and continue
            break;
          }

          const bookingUrl = process.env.CAL_COM_BOOKING_URL || "https://cal.com/your-link";
          // Send clean link without pre-filled parameters for better aesthetics
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
        } catch (error) {
          await sendErrorAlert({
            error: error instanceof Error ? error : new Error(String(error)),
            context: {
              location: "ai-conversation-enhanced - send_booking_link",
              leadId,
              details: { message: decision.message, phone: lead.phone },
            },
          });
          throw error;
        }
      }
      break;

    case "send_application_link":
      if (decision.message) {
        try {
          const applicationUrl = process.env.MORTGAGE_APPLICATION_URL || "https://stressfree.mtg-app.com/";

          // Send clean link
          const messageWithLink = `${decision.message}\n\n${applicationUrl}`;

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
              intent: "application_link_sent",
              metadata: { aiReasoning: decision.reasoning },
            },
          });

          await updateLeadAfterContact(leadId, lead.status);
        } catch (error) {
          await sendErrorAlert({
            error: error instanceof Error ? error : new Error(String(error)),
            context: {
              location: "ai-conversation-enhanced - send_application_link",
              leadId,
              details: { message: decision.message, phone: lead.phone },
            },
          });
          throw error;
        }
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
