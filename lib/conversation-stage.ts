/**
 * Conversation Stage Detection
 *
 * Detects the lead's current conversation stage and provides enforcement rules.
 * This prevents Holly from asking inappropriate questions (e.g., discovery questions
 * after a lead has already booked an appointment).
 */

export type ConversationStage =
  | 'COLD_OUTREACH'           // No meaningful engagement yet
  | 'ACTIVE_NURTURING'        // Lead engaged, building rapport
  | 'POST_BOOKING_PRE_CALL'   // Lead booked, awaiting discovery call
  | 'POST_CALL_PENDING_APP'   // Call done, waiting for application
  | 'CUSTOMER_SUPPORT';       // Converted, support mode only

export interface StageDetectionParams {
  lead: {
    status: string;
    applicationStartedAt?: Date | null;
    applicationCompletedAt?: Date | null;
  };
  appointments: Array<{
    scheduledFor?: Date;
    scheduledAt?: Date;
    status: string;
  }>;
  callOutcomes: Array<{
    createdAt: Date;
    outcome?: string;
  }>;
  communications: Array<{
    direction: 'INBOUND' | 'OUTBOUND';
    createdAt: Date;
  }>;
}

export interface StageRules {
  stage: ConversationStage;
  forbidden: string[];
  allowed: string[];
  contextMessage: string;
}

/**
 * Detect the lead's current conversation stage based on their journey state.
 */
export function detectConversationStage(params: StageDetectionParams): ConversationStage {
  const { lead, appointments, callOutcomes, communications } = params;
  const now = new Date();

  // Check for CONVERTED/DEALS_WON status → CUSTOMER_SUPPORT
  if (lead.status === 'CONVERTED' || lead.status === 'DEALS_WON') {
    return 'CUSTOMER_SUPPORT';
  }

  // Check for application in progress → CUSTOMER_SUPPORT
  if (lead.applicationStartedAt || lead.applicationCompletedAt) {
    return 'CUSTOMER_SUPPORT';
  }

  // Check for upcoming appointment → POST_BOOKING_PRE_CALL
  const upcomingAppointment = appointments.find(apt => {
    const scheduledTime = apt.scheduledFor || apt.scheduledAt;
    return scheduledTime && scheduledTime > now &&
           (apt.status === 'scheduled' || apt.status === 'SCHEDULED' || apt.status === 'CONFIRMED');
  });

  if (upcomingAppointment || lead.status === 'CALL_SCHEDULED') {
    return 'POST_BOOKING_PRE_CALL';
  }

  // Check for past appointment with call outcome → POST_CALL_PENDING_APP
  const pastAppointment = appointments.find(apt => {
    const scheduledTime = apt.scheduledFor || apt.scheduledAt;
    return scheduledTime && scheduledTime <= now;
  });

  if (pastAppointment || callOutcomes.length > 0 || lead.status === 'WAITING_FOR_APPLICATION') {
    return 'POST_CALL_PENDING_APP';
  }

  // Check for inbound replies → ACTIVE_NURTURING
  const hasInboundReplies = communications.some(c => c.direction === 'INBOUND');
  if (hasInboundReplies) {
    return 'ACTIVE_NURTURING';
  }

  // Default: No engagement yet → COLD_OUTREACH
  return 'COLD_OUTREACH';
}

/**
 * Get enforcement rules for a specific conversation stage.
 */
export function getStageEnforcementRules(stage: ConversationStage): StageRules {
  switch (stage) {
    case 'POST_BOOKING_PRE_CALL':
      return {
        stage,
        forbidden: [
          'Asking discovery questions ("what\'s prompting your refinance?")',
          'Asking about their situation (they already told you)',
          'Sending booking links (they already booked!)',
          'Cold outreach language ("saw you filled out a form...")',
        ],
        allowed: [
          'Confirming their appointment',
          'Preparing them for the call (what to have ready)',
          'Answering questions they ask',
          'Building excitement about their upcoming call',
        ],
        contextMessage: 'If they text you, ACKNOWLEDGE their existing appointment first.',
      };

    case 'POST_CALL_PENDING_APP':
      return {
        stage,
        forbidden: [
          'Asking discovery questions (call already happened)',
          'Sending booking links (call already happened)',
          'Rehashing conversation topics from the call',
        ],
        allowed: [
          'Following up on action items from the call',
          'Sending application link if appropriate',
          'Answering questions about next steps',
          'Providing encouragement to complete application',
        ],
        contextMessage: 'Focus on moving them toward application completion.',
      };

    case 'CUSTOMER_SUPPORT':
      return {
        stage,
        forbidden: [
          'Sales language or urgency tactics',
          'Sending booking links (they already booked)',
          'Sending application links (they already applied)',
          'Discovery questions (journey is complete)',
        ],
        allowed: [
          'Answering questions about their application',
          'Providing status updates',
          'Reassuring them about the process',
          'Escalating complex questions to advisors',
        ],
        contextMessage: 'You are in support mode, NOT sales mode.',
      };

    case 'ACTIVE_NURTURING':
      return {
        stage,
        forbidden: [
          'Ignoring previous conversation context',
          'Starting over as if no conversation happened',
        ],
        allowed: [
          'Building on previous conversation',
          'Asking clarifying questions about their needs',
          'Providing value and moving toward booking',
          'Sending booking link when appropriate',
        ],
        contextMessage: 'Continue the conversation naturally, referencing what you discussed.',
      };

    case 'COLD_OUTREACH':
    default:
      return {
        stage,
        forbidden: [
          'Being too aggressive on first touch',
          'Asking too many questions at once',
        ],
        allowed: [
          'Introducing yourself and your value',
          'Asking one simple engagement question',
          'Referencing why they reached out (the form they filled)',
        ],
        contextMessage: 'First impressions matter. Be warm and helpful, not pushy.',
      };
  }
}

/**
 * Build the enforcement prompt block for inclusion in the Claude prompt.
 */
export function buildStageEnforcementPrompt(
  stage: ConversationStage,
  firstName: string,
  appointmentDetails?: { date: string; time: string }
): string {
  const rules = getStageEnforcementRules(stage);

  if (stage === 'POST_BOOKING_PRE_CALL') {
    const appointmentInfo = appointmentDetails
      ? `on ${appointmentDetails.date} at ${appointmentDetails.time}`
      : '(see appointment details in context above)';

    return `## 🚨 MODE: POST-BOOKING (APPOINTMENT SCHEDULED)

CRITICAL: ${firstName} ALREADY BOOKED an appointment ${appointmentInfo}.

FORBIDDEN (your message will be rejected):
${rules.forbidden.map(f => `❌ ${f}`).join('\n')}

ALLOWED:
${rules.allowed.map(a => `✅ ${a}`).join('\n')}

${rules.contextMessage}

---

`;
  }

  if (stage === 'POST_CALL_PENDING_APP') {
    return `## 🚨 MODE: POST-CALL (AWAITING APPLICATION)

CRITICAL: ${firstName} has ALREADY HAD their discovery call.

FORBIDDEN (your message will be rejected):
${rules.forbidden.map(f => `❌ ${f}`).join('\n')}

ALLOWED:
${rules.allowed.map(a => `✅ ${a}`).join('\n')}

${rules.contextMessage}

---

`;
  }

  if (stage === 'CUSTOMER_SUPPORT') {
    return `## 🚨 MODE: CUSTOMER SUPPORT (POST-CONVERSION)

CRITICAL: ${firstName} is now a CUSTOMER, not a prospect.

FORBIDDEN (your message will be rejected):
${rules.forbidden.map(f => `❌ ${f}`).join('\n')}

ALLOWED:
${rules.allowed.map(a => `✅ ${a}`).join('\n')}

${rules.contextMessage}

---

`;
  }

  // For ACTIVE_NURTURING and COLD_OUTREACH, return a lighter-touch prompt
  if (stage === 'ACTIVE_NURTURING') {
    return `## 📍 MODE: ACTIVE CONVERSATION

${firstName} has engaged with you before. Continue the conversation naturally.

${rules.contextMessage}

---

`;
  }

  // COLD_OUTREACH - minimal prompt, let the normal flow handle it
  return '';
}

/**
 * Get discovery question patterns for guardrail validation.
 */
export function getDiscoveryQuestionPatterns(): RegExp[] {
  return [
    /what('s| is) prompting/i,
    /what brings you/i,
    /tell me (about|more)/i,
    /when did you start looking/i,
    /how long have you been/i,
    /what's your (timeline|situation)/i,
    /why are you (looking|considering)/i,
    /what made you (decide|want|think)/i,
    /can you tell me (about|more|why)/i,
    /what are you hoping/i,
    /what's driving/i,
  ];
}
