/**
 * Holly Optimization Test Script
 *
 * Tests the consolidated Claude-only AI engine for Holly (replacing GPT-4o).
 * Simulates conversations by calling Claude directly with mock lead data.
 *
 * Usage: npx tsx scripts/test-holly-optimization.ts
 * Requires: ANTHROPIC_API_KEY env var
 */

import Anthropic from "@anthropic-ai/sdk";

// ─── Configuration ──────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-5-20250929";

if (!ANTHROPIC_API_KEY) {
  console.log("⚠️  ANTHROPIC_API_KEY not set — skipping AI tests");
  console.log("   Set it in your environment to run the full test suite.");
  process.exit(0);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── Mock Data ──────────────────────────────────────────────────────────────

interface MockLead {
  name: string;
  firstName: string;
  phone: string;
  email: string;
  province: string;
  city: string;
  loanType: string;
  purchasePrice?: string;
  home_value?: string;
  downPayment?: string;
  balance?: string;
  withdraw_amount?: string;
  lender?: string;
  propertyType?: string;
  motivation_level?: string;
  creditScore?: string;
  status: string;
  outboundCount: number;
  inboundCount: number;
  daysInStage: number;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  hasAppointment: boolean;
  hollyDisabled?: boolean;
}

const MOCK_AVAILABILITY = `**Monday, Jul 14:** 10:00 AM, 11:00 AM, 2:00 PM, 3:30 PM, 4:30 PM
**Tuesday, Jul 15:** 9:00 AM, 10:30 AM, 1:00 PM, 2:30 PM
**Wednesday, Jul 16:** 10:00 AM, 11:30 AM, 3:00 PM, 4:00 PM
**Thursday, Jul 17:** 9:30 AM, 11:00 AM, 1:30 PM, 3:30 PM
**Friday, Jul 18:** 10:00 AM, 2:00 PM, 3:00 PM`;

// ─── Tool Definitions (matching production) ─────────────────────────────────

const HOLLY_TOOLS: Anthropic.Tool[] = [
  {
    name: "send_sms",
    description: "Send an immediate SMS response to the lead",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "The SMS message to send" },
        reasoning: { type: "string", description: "Why you're sending this message" },
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
        hours: { type: "number", description: "Hours to wait" },
        message: { type: "string", description: "The follow-up message" },
        reasoning: { type: "string", description: "Why schedule this follow-up" },
      },
      required: ["hours", "message", "reasoning"],
    },
  },
  {
    name: "check_availability",
    description: "Check Greg's available time slots for a specific day",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        reasoning: { type: "string", description: "Why checking availability" },
      },
      required: ["date", "reasoning"],
    },
  },
  {
    name: "book_appointment_directly",
    description: "Book a specific appointment slot for the lead directly",
    input_schema: {
      type: "object" as const,
      properties: {
        startTime: { type: "string", description: "ISO 8601 UTC start time" },
        leadName: { type: "string", description: "Lead's full name" },
        leadEmail: { type: "string", description: "Lead's email" },
        leadTimezone: { type: "string", description: "Lead's IANA timezone" },
        message: { type: "string", description: "Confirmation SMS" },
        reasoning: { type: "string", description: "Why booking this slot" },
      },
      required: ["startTime", "leadName", "leadEmail", "message", "reasoning"],
    },
  },
  {
    name: "send_booking_link",
    description: "Send the Cal.com booking link as fallback",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "Message to accompany the booking link" },
        reasoning: { type: "string", description: "Why they're ready to book" },
      },
      required: ["message", "reasoning"],
    },
  },
  {
    name: "send_application_link",
    description: "Send the mortgage application link",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "Message to accompany the application link" },
        reasoning: { type: "string", description: "Why they're ready to apply" },
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
          enum: ["NEW", "CONTACTED", "ENGAGED", "QUALIFIED", "NURTURING", "CALL_SCHEDULED", "LOST"],
          description: "The new stage",
        },
        reasoning: { type: "string", description: "Why move to this stage" },
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
        reason: { type: "string", description: "Why this needs human attention" },
      },
      required: ["reason"],
    },
  },
  {
    name: "send_email",
    description: "Send a professional email with detailed information",
    input_schema: {
      type: "object" as const,
      properties: {
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body in HTML" },
        reasoning: { type: "string", description: "Why email is right" },
      },
      required: ["subject", "body", "reasoning"],
    },
  },
  {
    name: "send_both",
    description: "Send coordinated SMS + Email together",
    input_schema: {
      type: "object" as const,
      properties: {
        smsMessage: { type: "string", description: "Short SMS" },
        emailSubject: { type: "string", description: "Email subject" },
        emailBody: { type: "string", description: "Detailed email in HTML" },
        reasoning: { type: "string", description: "Why both channels" },
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
        reasoning: { type: "string", description: "Why no action is needed" },
      },
      required: ["reasoning"],
    },
  },
];

// ─── Test Scenarios ─────────────────────────────────────────────────────────

interface TestScenario {
  name: string;
  description: string;
  lead: MockLead;
  userMessage: string;
  expectedActions: string[];
  validateFn?: (toolName: string, toolInput: Record<string, any>) => { pass: boolean; detail: string };
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: "New Lead First Contact",
    description: "Brand new refinance lead, first outreach — should introduce self and ask diagnostic question",
    lead: {
      name: "Sarah Thompson",
      firstName: "Sarah",
      phone: "+16045551234",
      email: "sarah@example.com",
      province: "British Columbia",
      city: "Vancouver",
      loanType: "refinance",
      home_value: "850000",
      balance: "500000",
      withdraw_amount: "50000",
      lender: "RBC",
      propertyType: "Condo",
      creditScore: "720",
      status: "NEW",
      outboundCount: 0,
      inboundCount: 0,
      daysInStage: 0,
      conversationHistory: [],
      hasAppointment: false,
    },
    userMessage: `This is a brand new lead who just submitted a form.\n\nCraft a warm, personalized initial SMS that:\n1. Introduces yourself\n2. References specific details from their form\n3. Asks ONE diagnostic question\n\nUse the send_sms tool.`,
    expectedActions: ["send_sms"],
    validateFn: (name, input) => {
      const msg = (input.message || "").toLowerCase();
      const hasIntro = msg.includes("holly") && msg.includes("inspired mortgage");
      const hasPersonalization = msg.includes("sarah") || msg.includes("vancouver") || msg.includes("rbc") || msg.includes("850") || msg.includes("refinanc");
      const hasQuestion = msg.includes("?");
      if (!hasIntro) return { pass: false, detail: "Missing Holly introduction" };
      if (!hasPersonalization) return { pass: false, detail: "Missing personalization (should mention Sarah, Vancouver, RBC, or property value)" };
      if (!hasQuestion) return { pass: false, detail: "Missing diagnostic question" };
      return { pass: true, detail: "Introduces self, personalizes with form data, asks diagnostic question" };
    },
  },
  {
    name: "Lead Replies with Interest",
    description: "Lead responds positively — should engage and build rapport",
    lead: {
      name: "Mike Chen",
      firstName: "Mike",
      phone: "+16045552345",
      email: "mike@example.com",
      province: "British Columbia",
      city: "Burnaby",
      loanType: "purchase",
      purchasePrice: "750000",
      downPayment: "150000",
      propertyType: "Townhouse",
      motivation_level: "I plan on making an offer soon",
      status: "CONTACTED",
      outboundCount: 1,
      inboundCount: 1,
      daysInStage: 1,
      conversationHistory: [
        { role: "assistant", content: "Hi Mike! It's Holly from Inspired Mortgage. Saw you're looking at a $750K townhouse in Burnaby with $150K down. Quick question — have you been pre-approved anywhere yet?" },
        { role: "user", content: "Sounds great, tell me more about what you can offer" },
      ],
      hasAppointment: false,
    },
    userMessage: `The lead just sent this message: "Sounds great, tell me more about what you can offer"\n\nAnalyze this message and decide what action to take.\n\nUse one of the available tools to respond.`,
    expectedActions: ["send_sms", "send_both", "move_stage"],
    validateFn: (name, input) => {
      if (name === "move_stage") {
        const isEngaged = input.stage === "ENGAGED";
        return { pass: isEngaged, detail: isEngaged ? "Correctly moves to ENGAGED" : `Moved to ${input.stage} instead of ENGAGED` };
      }
      const msg = (input.message || input.smsMessage || "").toLowerCase();
      const isConversational = msg.length > 20 && !msg.includes("stop") && !msg.includes("unsubscribe");
      return { pass: isConversational, detail: isConversational ? "Engaging, conversational response" : "Response seems off" };
    },
  },
  {
    name: "Lead Asks to Book",
    description: "Lead wants to talk to someone — should offer specific Cal.com times",
    lead: {
      name: "Jennifer Park",
      firstName: "Jennifer",
      phone: "+16045553456",
      email: "jennifer@example.com",
      province: "British Columbia",
      city: "Surrey",
      loanType: "purchase",
      purchasePrice: "600000",
      downPayment: "120000",
      propertyType: "Single Family",
      motivation_level: "I have made an offer to purchase",
      status: "ENGAGED",
      outboundCount: 3,
      inboundCount: 2,
      daysInStage: 3,
      conversationHistory: [
        { role: "assistant", content: "Hi Jennifer! It's Holly from Inspired Mortgage. Saw you made an offer on a $600K property in Surrey. When do you need financing confirmed by?" },
        { role: "user", content: "Subject removal is next Friday" },
        { role: "assistant", content: "Got it — tight timeline! Greg can get you a Guaranteed Approvals Certificate. Takes 15 mins. Interested?" },
        { role: "user", content: "Yes can I talk to someone?" },
      ],
      hasAppointment: false,
    },
    userMessage: `The lead just sent this message: "Yes can I talk to someone?"\n\nAnalyze this message and decide what action to take.\n\nUse one of the available tools to respond.`,
    expectedActions: ["send_sms", "send_booking_link", "book_appointment_directly"],
    validateFn: (name, input) => {
      const msg = (input.message || "").toLowerCase();
      if (name === "send_booking_link") {
        return { pass: true, detail: "Sends booking link — good fallback" };
      }
      if (name === "book_appointment_directly") {
        return { pass: true, detail: "Direct booking — excellent!" };
      }
      if (name === "send_sms") {
        const mentionsTimes = msg.includes("am") || msg.includes("pm") || msg.includes("today") || msg.includes("tomorrow") || msg.includes("greg");
        return { pass: mentionsTimes, detail: mentionsTimes ? "Offers specific times via SMS" : "SMS but doesn't offer booking times" };
      }
      return { pass: false, detail: `Unexpected action: ${name}` };
    },
  },
  {
    name: "Lead Picks a Time",
    description: "Lead confirms a time slot — should use book_appointment_directly",
    lead: {
      name: "Jennifer Park",
      firstName: "Jennifer",
      phone: "+16045553456",
      email: "jennifer@example.com",
      province: "British Columbia",
      city: "Surrey",
      loanType: "purchase",
      purchasePrice: "600000",
      downPayment: "120000",
      propertyType: "Single Family",
      motivation_level: "I have made an offer to purchase",
      status: "ENGAGED",
      outboundCount: 4,
      inboundCount: 3,
      daysInStage: 3,
      conversationHistory: [
        { role: "assistant", content: "Hi Jennifer! It's Holly from Inspired Mortgage." },
        { role: "user", content: "Subject removal is next Friday" },
        { role: "assistant", content: "Greg has openings at 10am, 2pm, and 3:30pm today. Which works for you?" },
        { role: "user", content: "3:30 works" },
      ],
      hasAppointment: false,
    },
    userMessage: `The lead just sent this message: "3:30 works"\n\nAnalyze this message and decide what action to take.\n\nUse one of the available tools to respond.`,
    expectedActions: ["book_appointment_directly", "send_sms", "send_booking_link"],
    validateFn: (name, input) => {
      if (name === "book_appointment_directly") {
        const hasStartTime = !!input.startTime;
        const hasName = !!input.leadName;
        const hasEmail = !!input.leadEmail;
        const hasMessage = !!input.message;
        if (!hasStartTime) return { pass: false, detail: "Missing startTime for booking" };
        if (!hasName) return { pass: false, detail: "Missing leadName for booking" };
        if (!hasEmail) return { pass: false, detail: "Missing leadEmail for booking" };
        if (!hasMessage) return { pass: false, detail: "Missing confirmation message" };
        return { pass: true, detail: "Direct booking with all required fields — perfect!" };
      }
      if (name === "send_sms") {
        const msg = (input.message || "").toLowerCase();
        const confirmsTime = msg.includes("3:30") || msg.includes("3 30") || msg.includes("booked") || msg.includes("confirmed");
        return { pass: confirmsTime, detail: confirmsTime ? "Confirms the 3:30 time via SMS" : "SMS doesn't confirm the chosen time" };
      }
      if (name === "send_booking_link") {
        return { pass: true, detail: "Fallback to booking link — acceptable" };
      }
      return { pass: false, detail: `Unexpected action: ${name}` };
    },
  },
  {
    name: "Skeptical Lead",
    description: "Lead is skeptical — should handle objection without being pushy",
    lead: {
      name: "David Williams",
      firstName: "David",
      phone: "+16045554567",
      email: "david@example.com",
      province: "Alberta",
      city: "Calgary",
      loanType: "refinance",
      home_value: "550000",
      balance: "350000",
      lender: "TD",
      propertyType: "Single Family",
      status: "CONTACTED",
      outboundCount: 2,
      inboundCount: 1,
      daysInStage: 2,
      conversationHistory: [
        { role: "assistant", content: "Hi David! It's Holly from Inspired Mortgage. Saw you're looking to refinance your $550K Calgary home with TD. What's prompting this right now?" },
        { role: "user", content: "What's the catch? Everyone promises low rates" },
      ],
      hasAppointment: false,
    },
    userMessage: `The lead just sent this message: "What's the catch? Everyone promises low rates"\n\nAnalyze this message and decide what action to take.\n\nUse one of the available tools to respond.`,
    expectedActions: ["send_sms"],
    validateFn: (name, input) => {
      const msg = (input.message || "").toLowerCase();
      const acknowledgesSkepticism = msg.includes("fair") || msg.includes("get it") || msg.includes("understand") || msg.includes("good question") || msg.includes("no catch") || msg.includes("honest") || msg.includes("totally");
      const notPushy = !msg.includes("hurry") && !msg.includes("limited time") && !msg.includes("act now");
      if (!acknowledgesSkepticism) return { pass: false, detail: "Doesn't acknowledge skepticism" };
      if (!notPushy) return { pass: false, detail: "Too pushy for a skeptical lead" };
      return { pass: true, detail: "Acknowledges skepticism, not pushy" };
    },
  },
  {
    name: "Lead Opts Out",
    description: "Lead says stop texting — should move to LOST and send polite farewell",
    lead: {
      name: "Karen White",
      firstName: "Karen",
      phone: "+16045555678",
      email: "karen@example.com",
      province: "British Columbia",
      city: "Victoria",
      loanType: "purchase",
      purchasePrice: "500000",
      downPayment: "100000",
      propertyType: "Condo",
      status: "CONTACTED",
      outboundCount: 3,
      inboundCount: 1,
      daysInStage: 5,
      conversationHistory: [
        { role: "assistant", content: "Hi Karen! It's Holly from Inspired Mortgage." },
        { role: "assistant", content: "Hey Karen, just checking in about your Victoria condo search." },
        { role: "assistant", content: "Karen, wanted to make sure you saw our reserved rates program." },
        { role: "user", content: "Stop texting me" },
      ],
      hasAppointment: false,
    },
    userMessage: `The lead just sent this message: "Stop texting me"\n\nAnalyze this message and decide what action to take.\n\nUse one of the available tools to respond.`,
    expectedActions: ["move_stage"],
    validateFn: (name, input) => {
      if (name === "move_stage") {
        const isLost = input.stage === "LOST";
        return { pass: isLost, detail: isLost ? "Correctly moves to LOST" : `Moved to ${input.stage} instead of LOST` };
      }
      if (name === "send_sms") {
        const msg = (input.message || "").toLowerCase();
        const isPolite = msg.includes("no worries") || msg.includes("no problem") || msg.includes("best of luck") || msg.includes("understand") || msg.includes("sorry");
        return { pass: isPolite, detail: isPolite ? "Polite farewell message" : "Response doesn't seem appropriate for opt-out" };
      }
      return { pass: false, detail: `Expected move_stage to LOST, got: ${name}` };
    },
  },
  {
    name: "Lead Mentions YouTube / Wants Content",
    description: "Lead shows content interest — should get YouTube hook",
    lead: {
      name: "Alex Kim",
      firstName: "Alex",
      phone: "+16045556789",
      email: "alex@example.com",
      province: "British Columbia",
      city: "Richmond",
      loanType: "purchase",
      purchasePrice: "900000",
      downPayment: "200000",
      propertyType: "Townhouse",
      motivation_level: "I plan on making an offer soon",
      status: "ENGAGED",
      outboundCount: 2,
      inboundCount: 2,
      daysInStage: 2,
      conversationHistory: [
        { role: "assistant", content: "Hi Alex! It's Holly from Inspired Mortgage. Saw you're planning to offer on a Richmond townhouse around $900K." },
        { role: "user", content: "Yeah just doing research. Do you have any content I can look at first?" },
        { role: "assistant", content: "Absolutely! Our co-founder Greg has a weekly YouTube show with real market insights." },
        { role: "user", content: "Oh cool, where can I watch?" },
      ],
      hasAppointment: false,
    },
    userMessage: `The lead just sent this message: "Oh cool, where can I watch?"\n\nAnalyze this message and decide what action to take.\n\nUse one of the available tools to respond.`,
    expectedActions: ["send_sms", "send_both"],
    validateFn: (name, input) => {
      const msg = (input.message || input.smsMessage || "").toLowerCase();
      const mentionsYouTube = msg.includes("youtube") || msg.includes("show") || msg.includes("video") || msg.includes("watch") || msg.includes("channel") || msg.includes("greg");
      return { pass: mentionsYouTube, detail: mentionsYouTube ? "References YouTube content" : "Doesn't mention YouTube/content" };
    },
  },
  {
    name: "Converted Lead Texts Back",
    description: "Already converted lead texts — should be in support mode, not sales",
    lead: {
      name: "Lisa Brown",
      firstName: "Lisa",
      phone: "+16045557890",
      email: "lisa@example.com",
      province: "Ontario",
      city: "Toronto",
      loanType: "purchase",
      purchasePrice: "700000",
      downPayment: "140000",
      propertyType: "Condo",
      status: "CONVERTED",
      outboundCount: 8,
      inboundCount: 5,
      daysInStage: 14,
      conversationHistory: [
        { role: "assistant", content: "Congrats on submitting your application, Lisa!" },
        { role: "user", content: "Thanks! Quick question — how long does the approval usually take?" },
      ],
      hasAppointment: false,
    },
    userMessage: `The lead just sent this message: "Thanks! Quick question — how long does the approval usually take?"\n\nAnalyze this message and decide what action to take.\n\nUse one of the available tools to respond.`,
    expectedActions: ["send_sms", "escalate", "do_nothing"],
    validateFn: (name, input) => {
      if (name === "send_sms") {
        const msg = (input.message || "").toLowerCase();
        const noSalesPitch = !msg.includes("book") && !msg.includes("reserved rate") && !msg.includes("calendar") && !msg.includes("discovery call");
        const isSupportive = msg.includes("48") || msg.includes("review") || msg.includes("team") || msg.includes("touch") || msg.includes("soon") || msg.includes("help");
        if (!noSalesPitch) return { pass: false, detail: "Uses sales language for a CONVERTED lead — should be support mode" };
        if (!isSupportive) return { pass: false, detail: "Not supportive enough for converted lead" };
        return { pass: true, detail: "Support mode — helpful, not salesy" };
      }
      if (name === "escalate") {
        return { pass: true, detail: "Escalates to advisor — appropriate for converted lead question" };
      }
      if (name === "do_nothing") {
        return { pass: false, detail: "Should respond to converted lead, not do nothing" };
      }
      return { pass: false, detail: `Unexpected action: ${name}` };
    },
  },
  {
    name: "Re-engagement After Gap",
    description: "7-day gap since last contact — should acknowledge the silence",
    lead: {
      name: "Tom Richards",
      firstName: "Tom",
      phone: "+16045558901",
      email: "tom@example.com",
      province: "British Columbia",
      city: "Kelowna",
      loanType: "refinance",
      home_value: "650000",
      balance: "400000",
      lender: "BMO",
      propertyType: "Single Family",
      status: "NURTURING",
      outboundCount: 5,
      inboundCount: 1,
      daysInStage: 14,
      conversationHistory: [
        { role: "assistant", content: "Hi Tom! It's Holly from Inspired Mortgage." },
        { role: "user", content: "I'll think about it" },
        { role: "assistant", content: "No rush! I'll check back in." },
      ],
      hasAppointment: false,
    },
    userMessage: `This lead needs a re-engagement message. It's been 14 days since the last contact. They said "I'll think about it" last time. Reach out with a new angle.\n\nUse the send_sms tool.`,
    expectedActions: ["send_sms"],
    validateFn: (name, input) => {
      const msg = (input.message || "").toLowerCase();
      const acknowledgesGap = msg.includes("while") || msg.includes("check") || msg.includes("circle back") || msg.includes("follow up") || msg.includes("checking in") || msg.includes("been a bit");
      const notRepetitive = !msg.includes("i'll think about it");
      if (!acknowledgesGap) return { pass: false, detail: "Doesn't acknowledge the time gap" };
      if (!notRepetitive) return { pass: false, detail: "Repeats lead's words back without adding value" };
      return { pass: true, detail: "Acknowledges gap, new angle" };
    },
  },
  {
    name: "Cold Lead (No Reply After 5 Messages)",
    description: "Lead has never replied after 5 outbound — should adapt strategy",
    lead: {
      name: "James Lee",
      firstName: "James",
      phone: "+16045559012",
      email: "james@example.com",
      province: "British Columbia",
      city: "Langley",
      loanType: "purchase",
      purchasePrice: "550000",
      downPayment: "110000",
      propertyType: "Townhouse",
      motivation_level: "Just want to know what I qualify for",
      status: "CONTACTED",
      outboundCount: 5,
      inboundCount: 0,
      daysInStage: 8,
      conversationHistory: [
        { role: "assistant", content: "Hi James! It's Holly from Inspired Mortgage." },
        { role: "assistant", content: "Hey James, quick follow-up about your Langley townhouse search." },
        { role: "assistant", content: "James, wanted to share our reserved rates program." },
        { role: "assistant", content: "James, have you found what you're looking for?" },
        { role: "assistant", content: "Just checking in — still looking at properties in Langley?" },
      ],
      hasAppointment: false,
    },
    userMessage: `This lead has not responded to 5 outbound messages over 8 days. Decide what to do next.\n\nUse one of the available tools to respond.`,
    expectedActions: ["move_stage", "send_sms", "do_nothing"],
    validateFn: (name, input) => {
      if (name === "move_stage") {
        const isNurturing = input.stage === "NURTURING";
        return { pass: isNurturing, detail: isNurturing ? "Correctly moves to NURTURING after 5 unanswered messages" : `Moved to ${input.stage} instead of NURTURING` };
      }
      if (name === "send_sms") {
        const msg = (input.message || "").toLowerCase();
        const isNewAngle = msg.length > 20;
        return { pass: isNewAngle, detail: "Tries one more message with new angle" };
      }
      if (name === "do_nothing") {
        return { pass: true, detail: "Decides to wait — reasonable after 5 unanswered" };
      }
      return { pass: false, detail: `Unexpected action: ${name}` };
    },
  },
];

// ─── Test Runner ─────────────────────────────────────────────────────────────

function buildTestSystemPrompt(lead: MockLead): string {
  const youtubeLink = "https://www.youtube.com/@GregWilliamsonMortgage";

  return `You are Holly, the scheduling and lead nurturing specialist for Inspired Mortgage, a Canadian mortgage brokerage.

# YOUR ROLE
You are NOT a mortgage advisor. Your job is to:
1. Nurture leads with helpful information about programs
2. Build curiosity and trust
3. Book discovery calls with mortgage advisors (Greg Williamson or Jakub Huncik)

# LEAD PROFILE
Name: ${lead.name}
Phone: ${lead.phone}
Email: ${lead.email}
Location: ${lead.city}, ${lead.province}
Type: ${lead.loanType}
${lead.purchasePrice ? `Purchase Price: $${lead.purchasePrice}` : ''}
${lead.home_value ? `Property Value: $${lead.home_value}` : ''}
${lead.downPayment ? `Down Payment: $${lead.downPayment}` : ''}
${lead.balance ? `Balance: $${lead.balance}` : ''}
${lead.withdraw_amount ? `Withdrawal: $${lead.withdraw_amount}` : ''}
${lead.lender ? `Current Lender: ${lead.lender}` : ''}
Property Type: ${lead.propertyType || 'Unknown'}
${lead.motivation_level ? `Urgency: ${lead.motivation_level}` : ''}

# PIPELINE STATUS
Stage: ${lead.status}
Days in Stage: ${lead.daysInStage}
Messages Sent (You): ${lead.outboundCount}
Messages Received (Them): ${lead.inboundCount}
Has Appointment: ${lead.hasAppointment ? 'Yes' : 'No'}

${lead.status === 'CONVERTED' ? `
# 🚨 POST-CONVERSION MODE
This lead has CONVERTED. You are in SUPPORT mode, NOT sales mode.
DO NOT: Send booking links, application links, or use sales language.
DO: Be helpful, answer questions, provide reassurance.
` : ''}

# CONVERSATION HISTORY
${lead.conversationHistory.length === 0 ? '(First contact — introduce yourself!)' :
  lead.conversationHistory.map(m => `${m.role === 'assistant' ? 'Holly' : lead.firstName}: ${m.content}`).join('\n')}

# PROGRAMS
1. Reserved Ultra-Low Discounted Rates — exclusive pre-negotiated rates
2. No Bank Penalties Program — we cover early breakage penalties
3. Guaranteed Approvals Certificate — $5K guarantee to seller

# 📺 YOUTUBE SHOW
Greg Williamson has a weekly YouTube show: ${youtubeLink}
Share it ONCE per conversation as a trust builder.

# 🗓️ DIRECT BOOKING
**Greg's Live Availability (next 7 days):**
${MOCK_AVAILABILITY}

When leads want to book:
1. Offer specific times from the availability above
2. Use book_appointment_directly when they pick a time
3. Fall back to send_booking_link if needed

# STAGE MOVEMENT
- Move to ENGAGED: Lead replies positively
- Move to NURTURING: No response after 3-5 touches; "maybe later"
- Move to LOST: Explicit decline ("stop texting", "not interested")

# RULES
- Keep SMS short (1-2 sentences, under 160 chars ideal)
- Be conversational, not scripted
- Reference their specific situation
- NO emojis in SMS
- Use their first name occasionally
- First message MUST introduce yourself
- Match urgency to days in stage`;
}

interface TestResult {
  name: string;
  pass: boolean;
  action: string;
  reasoning: string;
  message?: string;
  detail: string;
  durationMs: number;
}

async function runTest(scenario: TestScenario): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const systemPrompt = buildTestSystemPrompt(scenario.lead);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: scenario.userMessage }],
      tools: HOLLY_TOOLS,
      tool_choice: { type: "any" },
    });

    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (!toolUseBlock) {
      return {
        name: scenario.name,
        pass: false,
        action: "NONE",
        reasoning: "Claude did not use a tool",
        detail: "No tool_use block in response",
        durationMs: Date.now() - startTime,
      };
    }

    const toolInput = toolUseBlock.input as Record<string, any>;
    const action = toolUseBlock.name;
    const reasoning = toolInput.reasoning || toolInput.reason || "";
    const message = toolInput.message || toolInput.smsMessage || "";

    // Check if action is in expected list
    const actionAllowed = scenario.expectedActions.includes(action);

    // Run custom validation
    let validationResult = { pass: actionAllowed, detail: actionAllowed ? `Action "${action}" is expected` : `Action "${action}" not in expected: ${scenario.expectedActions.join(", ")}` };
    if (scenario.validateFn) {
      validationResult = scenario.validateFn(action, toolInput);
    }

    return {
      name: scenario.name,
      pass: validationResult.pass,
      action,
      reasoning,
      message: message || undefined,
      detail: validationResult.detail,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      name: scenario.name,
      pass: false,
      action: "ERROR",
      reasoning: error instanceof Error ? error.message : String(error),
      detail: "API call failed",
      durationMs: Date.now() - startTime,
    };
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     Holly Optimization Test Suite — Claude Consolidation    ║");
  console.log("║     Model: claude-sonnet-4-5-20250929                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const scenario of TEST_SCENARIOS) {
    process.stdout.write(`⏳ ${scenario.name}...`);
    const result = await runTest(scenario);
    results.push(result);

    if (result.pass) {
      passed++;
      console.log(` ✅ PASS (${result.durationMs}ms)`);
    } else {
      failed++;
      console.log(` ❌ FAIL (${result.durationMs}ms)`);
    }

    console.log(`   Action: ${result.action}`);
    if (result.message) {
      console.log(`   Message: "${result.message.substring(0, 120)}${result.message.length > 120 ? '...' : ''}"`);
    }
    console.log(`   Reasoning: ${result.reasoning.substring(0, 150)}${result.reasoning.length > 150 ? '...' : ''}`);
    console.log(`   Detail: ${result.detail}`);
    console.log("");

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Results: ${passed}/${results.length} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════════");

  if (failed > 0) {
    console.log("\n❌ Failed tests:");
    for (const r of results.filter(r => !r.pass)) {
      console.log(`   - ${r.name}: ${r.detail}`);
    }
  }

  console.log(`\n${failed === 0 ? '🎉 All tests passed!' : `⚠️  ${failed} test(s) need attention`}`);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
