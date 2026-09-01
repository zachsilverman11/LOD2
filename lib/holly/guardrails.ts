/**
 * Safety Guardrails
 * Hard boundary enforcement for Holly's autonomous decisions
 */

import { Lead } from '@/app/generated/prisma';
import { DealSignals } from '../deal-intelligence';
import { getLocalTime } from '../timezone-utils';
import { ConversationStage, getDiscoveryQuestionPatterns } from './stage';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface HollyDecision {
  thinking: string;
  customerMindset?: string;
  action: 'send_sms' | 'send_booking_link' | 'send_application_link' | 'book_directly' | 'move_stage' | 'wait' | 'escalate';
  message?: string;
  newStage?: 'CONTACTED' | 'ENGAGED' | 'NURTURING' | 'WAITING_FOR_APPLICATION' | 'LOST';
  waitHours?: number;
  nextCheckCondition?: string;
  suggestedAction?: string;
  confidence: 'high' | 'medium' | 'low';
  // Cal.com direct booking fields (used when action is 'book_directly')
  bookingStartTime?: string;
  bookingLeadName?: string;
  bookingLeadEmail?: string;
  // Internal flag: was live Cal.com availability provided to Holly? (used by guardrails)
  _availabilitySlotsProvided?: boolean;
}

interface DecisionContext {
  lead: Lead & {
    communications?: any[];
    appointments?: any[];
    hollyDisabled?: boolean;
  };
  signals: DealSignals;
  conversationStage?: ConversationStage;
  // Pass true when live Cal.com availability slots were provided to Holly
  availabilitySlotsProvided?: boolean;
  /**
   * Vertical this lead belongs to, when known. There is no `Lead.vertical`
   * column yet (see notes/holly-alt-lending-vertical-audit.md §2), so this is
   * optional and callers may also carry it on `lead.rawData.vertical`.
   * Undefined — which is every caller today — means "conventional", and the
   * alt-lending checks below do not run.
   */
  vertical?: string;
}

export function validateDecision(
  decision: HollyDecision,
  context: DecisionContext
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const now = new Date();

  // === HARD RULE: Holly Disabled Check ===
  // This is the MOST IMPORTANT check - if hollyDisabled is true, NOTHING should happen
  if (context.lead.hollyDisabled) {
    errors.push(
      '🛑 CRITICAL: Holly is DISABLED for this lead. This lead is managed by Finmo or has completed their journey. Holly must NOT send any messages, move stages, or take ANY automated actions.'
    );
  }

  // === HARD RULE: Opt-out check ===
  if (!context.lead.consentSms) {
    errors.push('Lead opted out of SMS - cannot send messages');
  }

  // === HARD RULE: Finmo Handoff - Do NOT contact leads after application handoff ===
  // Once a lead reaches APPLICATION_STARTED, CONVERTED, or DEALS_WON, Holly is disabled.
  // Booked leads are a special case: reactive pre-call support is allowed,
  // but Holly must not rebook, move stages, or push applications before the call.
  if (['APPLICATION_STARTED', 'CONVERTED', 'DEALS_WON'].includes(context.lead.status)) {
    errors.push(
      `Lead status is ${context.lead.status} - Holly is disabled. ${
        'Finmo system is handling communication. Holly should NEVER contact these leads.'
      }`
    );
  }

  if (
    context.lead.status === 'CALL_SCHEDULED' &&
    ['send_booking_link', 'send_application_link', 'book_directly', 'move_stage'].includes(decision.action)
  ) {
    errors.push(
      'Lead already has a scheduled call - Holly may only provide pre-call support via send_sms, wait, or escalate.'
    );
  }

  // === HARD RULE: Time-of-day check (8am-9pm local) ===
  const rawData = context.lead.rawData as any;
  const province = rawData?.province || 'British Columbia';
  const leadLocalTime = getLocalTime(province);
  const hour = leadLocalTime.getUTCHours(); // Use UTC hours since getLocalTime returns time stored in UTC

  if (hour < 8 || hour >= 21) {
    if (decision.action !== 'wait' && decision.action !== 'escalate') {
      errors.push(
        `Outside SMS hours (${hour}:${leadLocalTime
          .getUTCMinutes()
          .toString()
          .padStart(2, '0')} local time in ${province}) - can only send 8am-9pm`
      );
    }
  }

  // === HARD RULE: Context-Aware Anti-Spam ===
  // Different rules for conversations vs cold outreach
  if (context.lead.lastContactedAt) {
    const hoursSinceLastOutbound =
      (now.getTime() - context.lead.lastContactedAt.getTime()) / (1000 * 60 * 60);

    // Check if lead has replied since our last message (conversational mode)
    const repliedSinceLastContact = context.lead.communications?.some(
      (c: any) =>
        c.direction === 'INBOUND' &&
        c.createdAt.getTime() > context.lead.lastContactedAt!.getTime()
    );

    if (
      decision.action !== 'wait' &&
      decision.action !== 'escalate'
    ) {
      if (repliedSinceLastContact) {
        // CONVERSATIONAL MODE: Lead replied, allow immediate response
        // No time restriction - natural conversation flow
      } else if (hoursSinceLastOutbound < 4) {
        // BROADCAST MODE: No reply yet, enforce 4-hour anti-spam
        errors.push(
          `Too soon - last message ${hoursSinceLastOutbound.toFixed(1)}h ago, lead hasn't replied (4h minimum for follow-ups)`
        );
      }
    }
  }

  // === HARD RULE: Race Condition Prevention ===
  // Check for very recent outbound messages (within 30 seconds) to catch parallel processing
  if (context.lead.communications && context.lead.communications.length > 0) {
    const mostRecentOutbound = context.lead.communications.find(
      (c: any) => c.direction === 'OUTBOUND'
    );

    if (mostRecentOutbound) {
      const secondsSinceLastOutbound =
        (now.getTime() - new Date(mostRecentOutbound.createdAt).getTime()) / 1000;

      if (secondsSinceLastOutbound < 30 && decision.action !== 'wait' && decision.action !== 'escalate') {
        errors.push(
          `🔒 Race condition block: Message was sent ${Math.round(secondsSinceLastOutbound)}s ago. ` +
          `Wait at least 30 seconds to prevent duplicate messages.`
        );
      }
    }
  }

  // === HARD RULE: Don't double-book ===
  if (
    context.lead.appointments &&
    context.lead.appointments.length > 0 &&
    (decision.action === 'send_booking_link' || decision.action === 'book_directly')
  ) {
    errors.push('Lead already has an appointment scheduled - cannot double-book');
  }

  // === HARD RULE: Don't send booking link when live availability was provided ===
  // Holly must attempt to book directly when she has live slots — the link is last resort only
  if (decision.action === 'send_booking_link' && context.availabilitySlotsProvided) {
    errors.push(
      'CRITICAL: Holly chose send_booking_link but live calendar availability was provided. ' +
      'Offer specific times from the availability list and use book_directly when they pick one. ' +
      'Only send the link if availability is unavailable or all offered times were rejected.'
    );
  }

  // === HARD RULE: Don't ask about booking when appointment already exists ===
  if (decision.message && context.lead.appointments && context.lead.appointments.length > 0) {
    const message = decision.message.toLowerCase();

    // Phrases that ask if they booked
    const bookingQuestionPatterns = [
      /did you (get a chance to |)grab a time/i,
      /did you (get a chance to |)book/i,
      /have you (grabbed|booked) a time/i,
      /were you able to (grab|book)/i,
      /did you schedule/i,
      /have you scheduled/i,
      /did the booking link work/i,
      /trouble with the booking/i,
    ];

    const asksAboutBooking = bookingQuestionPatterns.some(pattern => pattern.test(decision.message!));

    if (asksAboutBooking) {
      errors.push(
        'CRITICAL: Message asks if lead booked, but they already have an appointment! This makes Holly look disorganized. Instead, acknowledge their existing appointment or offer to reschedule if they no-showed.'
      );
    }
  }

  // === STAGE-SPECIFIC MESSAGE VALIDATION ===
  if (decision.message && context.conversationStage === 'POST_BOOKING_PRE_CALL') {
    const discoveryPatterns = getDiscoveryQuestionPatterns();

    if (discoveryPatterns.some(p => p.test(decision.message!))) {
      errors.push(
        'POST_BOOKING violation: Cannot ask discovery questions to a lead who already booked. ' +
        'They answered these during the form/conversation. Focus on preparing them for their call.'
      );
    }

    // Also check for cold outreach language in post-booking context
    const coldOutreachPatterns = [
      /saw you filled out/i,
      /noticed you (submitted|filled|completed)/i,
      /thanks for (your interest|reaching out|the inquiry)/i,
      /wanted to (introduce myself|reach out|follow up on your inquiry)/i,
    ];

    if (coldOutreachPatterns.some(p => p.test(decision.message!))) {
      errors.push(
        'POST_BOOKING violation: Cannot use cold outreach language to a lead who already booked. ' +
        'They\'re past the inquiry stage - acknowledge their appointment instead.'
      );
    }
  }

  // === STAGE-SPECIFIC: POST_CALL_PENDING_APP ===
  if (decision.message && context.conversationStage === 'POST_CALL_PENDING_APP') {
    const discoveryPatterns = getDiscoveryQuestionPatterns();

    if (discoveryPatterns.some(p => p.test(decision.message!))) {
      errors.push(
        'POST_CALL violation: Cannot ask discovery questions to a lead who already had their call. ' +
        'Focus on next steps like sending the application link or following up on action items.'
      );
    }

    // === DOCUMENT GATHERING BAN (pre-application stages) ===
    // These patterns target document-gathering INSTRUCTIONS, not incidental keyword usage.
    // E.g. "bank statement" is blocked, but "which bank are you with?" is fine.
    const documentPatterns = [
      /pay\s*stubs?/i,                          // "pay stub" / "pay stubs"
      /\bT4s?\b/,                               // "T4" / "T4s" (case-sensitive — avoids "t4" in URLs etc.)
      /\bNOAs?\b/,                              // "NOA" / "NOAs" (case-sensitive)
      /notice of assessment/i,                   // full phrase
      /bank\s*statements?/i,                     // "bank statement(s)" as a phrase
      /income\s*verif/i,                         // "income verification" as a phrase
      /documents?\s*(gathering|checklist|you('ll| will) need|needed|required)/i, // doc-gathering instructions
      /lender\s*(will\s*)?needs?/i,              // "lender will need" / "lender needs"
      /\bwhat\s*(you('ll|.will)|we('ll|.will))\s*need\s*to\s*(provide|gather|submit|prepare)/i, // "what you'll need to provide/gather"
      /have\s*(your|the)\s*(recent\s*)?(pay\s*stubs?|T4|NOA|bank\s*statements?|tax\s*returns?)\s*(ready|handy|prepared)/i, // "have your pay stubs ready"
      /gather\s*(your|the)\s*(documents?|papers?|records?)/i, // "gather your documents"
    ];

    // Only flag if Holly is PROACTIVELY raising documents (not responding to lead's question)
    const isProactiveDocumentMention = documentPatterns.some(p => p.test(decision.message!));
    if (isProactiveDocumentMention) {
      errors.push(
        'DOCUMENT BAN: Cannot discuss documents, pay stubs, T4s, NOAs, bank statements, or lender requirements at this stage. ' +
        'Document gathering is ONLY appropriate in the CUSTOMER_SUPPORT stage (after application is submitted). ' +
        'Focus on getting them to complete the application first.'
      );
    }
  }

  // === HARD RULE: Don't send booking/application links to CONVERTED leads ===
  if (
    context.lead.status === 'CONVERTED' ||
    context.lead.status === 'DEALS_WON'
  ) {
    if (decision.action === 'send_booking_link') {
      errors.push(
        'Lead is CONVERTED - already booked and completed application. Use send_sms for customer support only.'
      );
    }
    if (decision.action === 'send_application_link') {
      errors.push(
        'Lead is CONVERTED - already completed application. Use send_sms for customer support only.'
      );
    }
  }

  // === HARD RULE: Require message for send actions ===
  if (
    (decision.action === 'send_sms' ||
      decision.action === 'send_booking_link' ||
      decision.action === 'send_application_link') &&
    !decision.message
  ) {
    errors.push('Message required for send actions');
  }

  // === HARD RULE: Message must not be empty or whitespace only ===
  if (decision.message && decision.message.trim().length === 0) {
    errors.push('Message cannot be empty or whitespace only');
  }

  // === HARD RULE: Never promise specific call times UNLESS booking directly ===
  if (decision.message && decision.action !== 'book_directly') {
    const message = decision.message.toLowerCase();

    // Allow acknowledging existing bookings (e.g., "your 2pm booking", "saw your booking")
    const isAcknowledgingBooking =
      /saw your.*booking|your.*booking|confirmed.*booking|booking.*through/i.test(message) ||
      /already.*booked|just.*booked|you.*booked/i.test(message);

    if (!isAcknowledgingBooking) {
      const forbiddenPatterns = [
        /will call you (at|around|by)/i,
        /\b(i'll|i will|we'll|we will|going to) call you (at|around|by)/i,
        /\b(greg|advisor|someone|team).*(will|going to) call you (at|around|by)/i,
        /(reach out|contact you|call you) (at|around|by) \d+/i,  // "call you at 5pm"
        /\b(i'll|i will|we'll|we will) (reach out|call|contact).*(at|around|by) \d+/i,
      ];

      const violations = forbiddenPatterns.filter(pattern => pattern.test(message));
      if (violations.length > 0) {
        errors.push(
          'CRITICAL: Message promises a specific call time without using book_directly. Use action: "book_directly" to actually book the slot, or "send_booking_link" to let them self-book.'
        );
      }
    }
  }

  // === HARD RULE: Never quote specific mortgage rates in messages ===
  if (decision.message) {
    // Match patterns like "4.5%", "4.89%", "5.49%", "0.20%", "0.30-0.50%", etc.
    const ratePatterns = [
      /\b\d+\.\d+\s*%/,                           // Any decimal% like "4.89%" or "0.20%"
      /\b\d+\.\d+\s*-\s*\d+\.\d+\s*%/,            // Rate range like "4.5-6%" or "0.30-0.50%"
      /\b(rate|rates)\s+(range|of|from|is|are)\s+\d/i, // "rates range from 4..."
      /\d+\.\d+\s*percent/i,                       // "4.5 percent"
    ];

    const rateViolation = ratePatterns.some(p => p.test(decision.message!));
    if (rateViolation) {
      errors.push(
        'CRITICAL: Message contains a specific rate percentage. Holly CANNOT quote mortgage rates. ' +
        'Remove any rate numbers (e.g. "4.5%", "0.20%") and instead say the advisor will show them their exact rate on the call.'
      );
    }
  }

  // === SOFT WARNING: Flag long messages (>320 chars = 2 SMS) ===
  if (decision.message && decision.message.length > 320) {
    warnings.push(
      `Long message (${decision.message.length} chars) - consider shortening for better SMS delivery`
    );
  }

  // === SOFT WARNING: Flag low confidence decisions ===
  if (decision.confidence === 'low' && decision.action !== 'escalate' && decision.action !== 'wait') {
    warnings.push(
      `Low confidence decision - consider escalating to human or waiting: "${decision.thinking}"`
    );
  }

  // === SOFT WARNING: Check for common repetitive phrases ===
  if (decision.message) {
    const repetitivePhrases = [
      'thanks for your text',
      'got your text',
      'thanks for reaching out',
      'hope this email finds you well',
    ];

    const message = decision.message.toLowerCase();
    const foundRepetitive = repetitivePhrases.filter((phrase) => message.includes(phrase));

    if (foundRepetitive.length > 0) {
      warnings.push(
        `Message contains potentially repetitive phrase(s): "${foundRepetitive.join('", "')}" - verify this is intentional`
      );
    }
  }

  // === SOFT WARNING: Detect if message might be too salesy ===
  if (decision.message) {
    const salesyPhrases = [
      'limited time',
      'act now',
      'don\'t miss out',
      'exclusive offer',
      'once in a lifetime',
    ];

    const message = decision.message.toLowerCase();
    const foundSalesy = salesyPhrases.filter((phrase) => message.includes(phrase));

    if (foundSalesy.length > 0) {
      warnings.push(
        `Message may be too salesy with phrase(s): "${foundSalesy.join('", "')}" - ensure this aligns with Holly's personality`
      );
    }
  }

  // === HARD RULE (ALT-LENDING ONLY, FLAGGED OFF BY DEFAULT) ===
  // Runtime half of alt-lending Hard Guardrail #8. Double-gated: the env flag
  // must be explicitly enabled AND the lead must be in the alt-lending
  // vertical. Neither is true for any conventional-cohort traffic today, so
  // this block is inert until both are deliberately turned on.
  if (
    decision.message &&
    isAltLendingNumericGuardrailEnabled() &&
    isAltLendingVertical(context)
  ) {
    errors.push(...checkAltLendingNumericCompliance(decision.message));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Alt-lending Hard Guardrail #8 — runtime enforcement (additive, default OFF)
// ---------------------------------------------------------------------------

/**
 * Feature flag, mirroring the HOLLY_PROMPT_VERSION precedent (.env.example:35):
 * a plain env var read at call time so it can be flipped without a deploy and
 * disabled instantly.
 *
 * DEFAULT: OFF. Enforcement runs only when HOLLY_ALT_LENDING_GUARDRAILS is
 * exactly 'on'. Any other value — unset, empty, 'off', 'true', typo — is off.
 */
export function isAltLendingNumericGuardrailEnabled(): boolean {
  return process.env.HOLLY_ALT_LENDING_GUARDRAILS === 'on';
}

/**
 * Second gate. Returns true only for leads explicitly marked alt-lending.
 * Conventional leads carry no vertical at all today, so this is false for
 * 100% of current production traffic even if the flag above were enabled.
 */
export function isAltLendingVertical(context: {
  vertical?: string;
  lead?: { rawData?: unknown };
}): boolean {
  const fromContext = context.vertical;
  const fromRawData = (context.lead?.rawData as { vertical?: string } | null | undefined)?.vertical;
  const vertical = (fromContext ?? fromRawData ?? '').toUpperCase();
  return vertical === 'ALT_LENDING';
}

/**
 * The numeric/promise half of alt-lending Hard Guardrail #8, which the
 * universal rate check at :324-341 does not cover (it only matches decimal
 * percentages, so "80% LTV", "$50,000", and "you'll probably qualify" all pass
 * through it today).
 *
 * DELIBERATE CARVE-OUTS — this vertical is number-silent and promise-silent,
 * NOT rate-silent. The following must pass clean, and are covered by tests:
 *  - Generic equity-as-a-factor language ("how much equity you have in the
 *    property is one of the biggest things that opens up options").
 *  - General rate phrasing ("fair rates", "lenders beyond the big banks",
 *    "competitive options").
 *  - Empathy and lender-access language of any length.
 *  - Ordinary non-financial numbers: "15 minutes", "Tomorrow 11am or 3pm",
 *    "30+ lenders", "55+". Stripping those would gut every legitimate opener,
 *    so no rule here keys on a bare digit.
 *
 * Returns an array of error strings (empty when clean), matching how every
 * other rule in this file reports. Exported so it can be unit-tested and
 * reused without going through validateDecision().
 */
export function checkAltLendingNumericCompliance(message: string): string[] {
  const errors: string[] = [];

  // "100%" is overwhelmingly emphasis in this context ("100% free", "100%
  // confident", "100% Canadian-owned"), not a financial figure. Scrub it
  // UNLESS it sits in an explicitly financial frame — an earlier whitelist of
  // approved following words was the wrong shape and false-positived on
  // ordinary copy. "100% LTV" / "100% of your home's value" still trips below.
  const scrubbed = message.replace(
    /\b100\s*%(?!\s*(?:ltv|loan[-\s]to[-\s]value|financing|of\s+(?:your|the)\s+(?:home|property|equity|value|appraised)))/gi,
    ''
  );

  // --- Any percentage figure: covers interest rates, LTVs, and percentage fees ---
  if (/\b\d{1,3}(?:\.\d+)?\s*%/.test(scrubbed) || /\b\d{1,3}(?:\.\d+)?\s*percent\b/i.test(scrubbed)) {
    errors.push(
      'ALT-LENDING GUARDRAIL #8: Message contains a specific percentage. In this vertical Holly cannot state any rate, LTV, or percentage fee — these are deal-specific and advisor-only. ' +
      'Remove the number. General phrasing ("fair rates", "lenders beyond the big banks") is allowed; figures are not.'
    );
  }

  // --- Explicit loan-to-value talk, even without a % sign ---
  if (/\b(ltv|loan[-\s]to[-\s]value)\b/i.test(scrubbed) ||
      /\bup to\s+\d[\d,.]*\s*(%|percent)?\s*of\s+(your|the|its)\s+(home|property|equity|value)/i.test(scrubbed)) {
    errors.push(
      'ALT-LENDING GUARDRAIL #8: Message discusses loan-to-value. LTV is deal-specific and advisor-only — do not state or imply how much of the property value can be borrowed against.'
    );
  }

  // --- Figures written as WORDS rather than digits ---
  // Every digit rule above is trivially evaded by spelling the number out
  // ("eighty percent of your property value", "in the high single digits",
  // "roughly half the value of your home"). The prompt bans the estimate, not
  // the notation, so the runtime check has to follow.
  const spelledFigurePatterns = [
    /\b(ten|fifteen|twenty|twenty[-\s]five|thirty|forty|fifty|sixty|seventy|eighty|ninety|(?:one\s+)?hundred)\s*(?:-|\s)?\s*(?:percent|per\s?cent)\b/i,
    /\b(high|low|mid|upper|lower)[-\s](single|double)\s+digits\b/i,
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+and\s+a\s+(half|quarter|third)\b/i,
    /\b(half|a\s+third|two[-\s]thirds|three[-\s]quarters|a\s+quarter)\s+(?:of\s+)?(?:the|your|its)\s+(value|home|house|property|equity|appraised)/i,
  ];
  if (spelledFigurePatterns.some((p) => p.test(scrubbed))) {
    errors.push(
      'ALT-LENDING GUARDRAIL #8: Message states a figure in words ("eighty percent", "high single digits", "half the value of your home"). Spelling a number out does not make it generic — the ban is on the estimate, not the notation. Remove it and let the advisor give real numbers.'
    );
  }

  // --- Specific dollar payout / borrowing / fee amounts ---
  const dollarPatterns = [
    /\$\s?(?!0(?:\.00)?(?!\d))\d/,                          // "$50,000", "$2,500" — but NOT "$0" / "$0.00"
    /\b\d[\d,]*\s*(dollars|bucks)\b/i,                     // "50,000 dollars"
    /\b\d{1,3}\s*(k|grand)\b(?!\s*(m|ft|km|bps))/i,         // "50k", "50 grand"
    /\b\d[\d,]*\s*thousand\b/i,                            // "50 thousand"
    /\b(ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|(a |one |two |three |four |five )?hundred)\s+(thousand|grand)\b/i,
  ];
  if (dollarPatterns.some((p) => p.test(scrubbed))) {
    errors.push(
      'ALT-LENDING GUARDRAIL #8: Message contains a specific dollar amount. Holly cannot state a payout, borrowing, fee, or savings figure — including reverse-mortgage payout amounts. An unkeepable number does the most harm with this audience. The advisor gives real numbers on the call.'
    );
  }

  // --- Fee figures introduced by fee/cost language ---
  // Two guards, both from real false positives: (a) "no fee", "$0", and
  // "fee-free" are the ABSENCE of a charge and are legitimate no-obligation
  // framing; (b) the number must not be a duration or clock time — "no fee for
  // the call, 15 minutes with an advisor" is an opener, not a fee quote.
  const feeIsNegated =
    /\b(no|zero|without\s+(?:any\s+)?|aren'?t\s+any|isn'?t\s+any|there'?s?\s+no)\s+(fee|fees|charge|charges|closing\s+costs?|cost|costs)\b/i.test(scrubbed) ||
    /\bfee[-\s]free\b/i.test(scrubbed) ||
    /\bdoesn'?t\s+cost\s+(you\s+)?(a\s+thing|anything)\b/i.test(scrubbed);
  const feeWithFigure =
    /\b(fee|fees|penalty|penalties|closing costs?|setup costs?|lender fees?|broker fees?)\b[^.!?]{0,30}?\b\d[\d,]*(?:\.\d+)?(?!\s*(?:min\b|mins\b|minute|hour|hr\b|hrs\b|am\b|pm\b|a\.m|p\.m|day|week|month|year|second))/i.test(scrubbed) ||
    /\b(fee|fees|rate|rates|cost|costs)\b[^.!?]{0,30}?\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+to\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(scrubbed);
  if (!feeIsNegated && feeWithFigure) {
    errors.push(
      'ALT-LENDING GUARDRAIL #8: Message attaches a number to fees or costs. Fees vary deal-by-deal and are advisor-only — state no figure.'
    );
  }

  // --- Affirmative approval-likelihood claims ---
  const approvalPatterns = [
    /\b(you'?ll|you will|you'?d|we'?ll|we will)\s+(probably|likely|most likely|definitely|certainly|almost certainly|easily)?\s*(qualify|be approved|get approved|get you approved)\b/i,
    /\b(you|we)\s+(should|will)\s+(be able to|have no (problem|trouble)|qualify|get approved)\b/i,
    /\b(that|this|it)\s+should\s+be\s+(fine|okay|ok|no problem)\b/i,
    /\bshouldn'?t\s+be\s+(a\s+problem|an\s+issue)\b/i,
    /\bno\s+(problem|trouble)\s+(getting|to get)\b/i,
    /\b(guaranteed|guarantee)\s+(approval|you'?ll|to qualify)\b/i,
    /\byou'?re\s+(a\s+)?(shoo-?in|lock|sure thing)\b/i,
    /\bi'?m\s+(sure|confident)\s+(you|we)\b[^.!?]{0,20}\b(qualify|approved)\b/i,
    /\byou'?ll\s+have\s+no\s+(problem|trouble)\b/i,
    // Non-pronoun / bare-tense forms found by adversarial review — semantically
    // identical to the phrases above, but they evaded the pronoun+modal shapes.
    /\b(we|i)\s+can\s+(definitely|certainly|absolutely|for sure|easily)\s+(get|do|make)\b/i,
    /\bapproval\s+(is|looks|seems|should be)\s+(very\s+|pretty\s+)?(likely|probable|assured|straightforward)\b/i,
    // "you qualify" as a statement of fact. Excludes the legitimate invitations
    // "see what you qualify for" / "if you qualify" / "whether you qualify".
    /(?<!\b(?:what|if|whether|see|know)\s)\byou\s+qualify\b/i,
    /\b(that|this|it)\s+(won'?t|wouldn'?t)\s+be\s+(an?\s+)?(issue|problem|concern)\b/i,
    /\b(is|are)\s+going\s+to\s+work\s+out\s+(fine|great|well)\b/i,
    /\bwork\s+out\s+(fine|great|well)\s+for\s+you\b/i,
  ];
  if (approvalPatterns.some((p) => p.test(scrubbed))) {
    errors.push(
      'ALT-LENDING GUARDRAIL #8: Message makes an affirmative approval-likelihood claim ("you\'ll probably qualify", "that should be fine"). Approval is an advisor-only judgment Holly has no underwriting context to make. ' +
      'Reframe to what the advisor will determine on the call. Generic equity-as-a-factor language is still allowed.'
    );
  }

  return errors;
}

/**
 * Additional validation: Check for repetition across recent conversation history
 */
export function detectMessageRepetition(
  newMessage: string,
  recentMessages: Array<{ role: string; content: string }>
): { isRepetitive: boolean; suggestion: string } {
  const recentOutbound = recentMessages.filter((m) => m.role === 'assistant').slice(0, 5);

  if (recentOutbound.length === 0) {
    return { isRepetitive: false, suggestion: '' };
  }

  const newLower = newMessage.toLowerCase();

  // Check for exact or near-exact matches
  for (const msg of recentOutbound) {
    const msgLower = msg.content.toLowerCase();

    // Exact match
    if (newLower === msgLower) {
      return {
        isRepetitive: true,
        suggestion: 'This exact message was already sent. Try a completely different approach.',
      };
    }

    // High similarity (Jaccard similarity of words)
    const similarity = calculateJaccardSimilarity(newLower, msgLower);
    if (similarity > 0.7) {
      return {
        isRepetitive: true,
        suggestion: `Message is ${Math.round(similarity * 100)}% similar to a recent message. Try a different angle.`,
      };
    }
  }

  // Check for repeated opening phrases
  const openings = recentOutbound.map((m) => m.content.split('\n')[0].toLowerCase().slice(0, 50));
  const newOpening = newLower.split('\n')[0].slice(0, 50);

  const repeatedOpening = openings.filter((opening) => opening === newOpening);
  if (repeatedOpening.length > 1) {
    return {
      isRepetitive: true,
      suggestion: `Opening phrase "${newOpening}..." has been used ${repeatedOpening.length + 1} times. Vary your opening.`,
    };
  }

  return { isRepetitive: false, suggestion: '' };
}

// Helper: Calculate Jaccard similarity between two strings
function calculateJaccardSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));

  const intersection = new Set([...words1].filter((word) => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}
