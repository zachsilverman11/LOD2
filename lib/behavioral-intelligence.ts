/**
 * Behavioral Intelligence for SMS Sales
 *
 * Pattern recognition based on lead replies and behaviors
 * Helps Holly understand what leads REALLY mean when they say something
 */

export interface BehavioralPattern {
  signals: string[];
  meaning: string;
  recommendedAction: string;
  exampleResponse?: string;
}

export interface BehavioralIntelligence {
  replyPatterns: {
    highIntent: BehavioralPattern;
    seekingInfo: BehavioralPattern;
    objectionAlreadyWorking: BehavioralPattern;
    objectionAlreadyApproved: BehavioralPattern;
    objectionTooBusy: BehavioralPattern;
    objectionWhatRate: BehavioralPattern;
    engaged: BehavioralPattern;
    cooling: BehavioralPattern;
    corrections: BehavioralPattern;
  };
  timingSignals: {
    immediateBooking: string[];
    warmNurture: string[];
    giveSpace: string[];
  };
  engagementLevels: {
    hot: string[];
    warm: string[];
    cool: string[];
    cold: string[];
  };
}

export const BEHAVIORAL_INTELLIGENCE: BehavioralIntelligence = {
  replyPatterns: {
    highIntent: {
      signals: [
        'What time?',
        'When can we talk?',
        'How soon?',
        'What do I need?',
        'Call me',
        'Available today',
        'ASAP',
      ],
      meaning: 'Lead is ready to book NOW - strike while iron is hot',
      recommendedAction: 'Send booking link immediately with specific availability',
      exampleResponse: 'Perfect! Greg has openings today at 2pm and 4pm PT, or tomorrow morning. Here\'s his calendar: [link]. Takes 10-15 mins and he\'ll get you your rate.',
    },

    seekingInfo: {
      signals: [
        'What\'s the rate?',
        'What rates do you have?',
        'How much?',
        'What\'s the process?',
        'Do you charge?',
        'What\'s the fee?',
        'How does this work?',
      ],
      meaning: 'Lead wants info before committing - educate briefly then redirect to call for specifics',
      recommendedAction: 'Answer briefly, explain why call is needed for exact answer, keep friction low',
      exampleResponse: 'Great question! Rates depend on your credit/property type (range from 4.89-5.49% right now), but Greg can show you your EXACT rate in 10 mins. Free, no obligation. Worth a quick call?',
    },

    objectionAlreadyWorking: {
      signals: [
        'Already working with someone',
        'Have a broker',
        'My bank is helping',
        'Got someone lined up',
      ],
      meaning: 'Objection: loyalty to existing relationship. Need to create unique value without bashing competitor.',
      recommendedAction: 'Acknowledge their relationship, position as "second opinion" or "rate check"',
      exampleResponse: 'That\'s smart to work with someone you trust! Quick question: have they shown you rates from multiple lenders, or just one? Most clients use us as a second opinion to make sure they\'re getting the absolute best rate. Greg can do a 10-min rate comparison - no obligation.',
    },

    objectionAlreadyApproved: {
      signals: [
        'Already pre-approved',
        'Already got approval',
        'Have my pre-approval',
        'Just got approved',
      ],
      meaning: 'Objection: thinks they\'re done. Need to pivot to RATE comparison, not competing approval.',
      recommendedAction: 'Acknowledge approval, shift focus to rate optimization before they lock in',
      exampleResponse: 'Got it! Since you\'re already pre-approved, the main thing is making sure you lock in the BEST rate before closing. Pre-approvals can vary by 0.20%+ in rate - that\'s $85/month on a $650K mortgage. Greg can do a quick rate check against what you have (10 mins). Worth it before you\'re locked in?',
    },

    objectionTooBusy: {
      signals: [
        'Too busy',
        'Don\'t have time',
        'Crazy week',
        'Swamped right now',
        'Can\'t talk',
      ],
      meaning: 'Objection: perceives call as time-consuming. Reduce friction, offer specific short timeframe.',
      recommendedAction: 'Acknowledge busy schedule, emphasize brevity (10 mins), offer specific time',
      exampleResponse: 'Totally get it - you\'re busy! That\'s why Greg keeps these quick (10-15 mins max). He can call you during your commute or lunch break. Does tomorrow at 12:30pm work, or is evening better?',
    },

    objectionWhatRate: {
      signals: [
        'Just tell me the rate',
        'What rate can you get',
        'Give me a number',
        'What\'s your best rate',
      ],
      meaning: 'Lead wants instant quote. Explain why rate depends on their specifics, position call as fast way to get answer.',
      recommendedAction: 'Acknowledge desire for quick answer, explain why call is fastest way to get THEIR exact rate',
      exampleResponse: 'I wish I could give you an exact number right now! But mortgage rates depend on your credit score, property type, and debt ratios. The FASTEST way to get your exact rate is a 10-min call with Greg - he pulls your credit and shows you real numbers from 30+ lenders. Way faster than back-and-forth texting. Worth it?',
    },

    engaged: {
      signals: [
        'Thanks',
        'Interesting',
        'Good to know',
        'Tell me more',
        'Okay',
        'I see',
        'That makes sense',
      ],
      meaning: 'Lead is engaged and listening - don\'t rush to booking, continue building value',
      recommendedAction: 'Ask diagnostic question, share another value point, build relationship before big ask',
      exampleResponse: 'Quick question: are you actively looking right now, or planning for a few months out? Want to make sure Greg prioritizes you correctly.',
    },

    cooling: {
      signals: [
        'Maybe later',
        'I\'ll think about it',
        'Not right now',
        'Call you back',
        'Still looking around',
        'Just exploring',
      ],
      meaning: 'Lead is cooling off - don\'t push, stay top of mind with value-add touches',
      recommendedAction: 'Give space, soft touch, valuable content, check back in 48-72 hours',
      exampleResponse: 'No pressure! Most people shop around - that\'s smart. Just FYI, our Reserved Rates pool fills up on a first-come basis, so worth booking a quick spot even if you\'re still comparing. But no rush - I\'ll check in later this week.',
    },

    corrections: {
      signals: [
        'Actually it\'s',
        'No, I meant',
        'That\'s not right',
        'It\'s actually',
        'Correction:',
      ],
      meaning: 'Lead is correcting you - VERY important to acknowledge and adjust approach immediately',
      recommendedAction: 'Acknowledge correction immediately, apologize if needed, adjust your understanding',
      exampleResponse: 'Thanks for clarifying! [Acknowledge the correction and pivot strategy based on new info]',
    },
  },

  timingSignals: {
    immediateBooking: [
      'Accepted offer with subject removal deadline',
      'Closing in less than 30 days',
      'Pre-approval expires soon',
      'Rate hold expiring',
      'Offers coming in (competitive market)',
      'Need approval ASAP to make offer',
    ],

    warmNurture: [
      'Just browsing',
      'Planning for next year',
      'Renewal in 6+ months',
      'Just exploring options',
      'No specific timeline',
      'Not urgent',
    ],

    giveSpace: [
      'Said "maybe later" or "I\'ll think about it"',
      'No reply after 3+ touches',
      'Short/one-word answers',
      'Explicitly said "not interested"',
      'Mentioned already working with someone and didn\'t engage with value prop',
    ],
  },

  engagementLevels: {
    hot: [
      'Asking multiple questions',
      'Sharing specific details about their situation',
      'Mentions timeline or deadline',
      'Asks about next steps',
      'Responds quickly (within hours)',
      'Uses words like "urgent", "ASAP", "soon"',
    ],

    warm: [
      'Short but positive replies ("thanks", "interesting")',
      'Acknowledging messages',
      'Asks basic questions',
      'Responds within 24 hours',
      'Engaged but not urgent',
    ],

    cool: [
      'One-word answers ("maybe", "okay")',
      'Takes 24-48h to respond',
      'Non-committal language',
      'Doesn\'t ask follow-up questions',
      'Vague responses',
    ],

    cold: [
      'No reply after 3+ attempts',
      '"Not interested"',
      '"No thanks"',
      'No response for 72+ hours',
      'Opted out of SMS',
    ],
  },
};

/**
 * Analyze a lead's reply and return recommended approach
 */
export function analyzeReply(
  message: string
): { pattern: string; meaning: string; recommendedAction: string; exampleResponse?: string } | null {
  const lowerMessage = message.toLowerCase();

  // Check each pattern
  for (const [patternName, pattern] of Object.entries(BEHAVIORAL_INTELLIGENCE.replyPatterns)) {
    if (pattern.signals.some(signal => lowerMessage.includes(signal.toLowerCase()))) {
      return {
        pattern: patternName,
        meaning: pattern.meaning,
        recommendedAction: pattern.recommendedAction,
        exampleResponse: pattern.exampleResponse,
      };
    }
  }

  return null;
}

/**
 * Determine if lead should be contacted immediately based on urgency signals
 */
export function isImmediateBooking(leadData: any): boolean {
  const urgency = leadData.motivation_level || '';
  const timeframe = leadData.timeframe || '';

  return BEHAVIORAL_INTELLIGENCE.timingSignals.immediateBooking.some(
    signal =>
      urgency.toLowerCase().includes(signal.toLowerCase()) ||
      timeframe.toLowerCase().includes(signal.toLowerCase())
  );
}

/**
 * Get conversation strategy based on engagement level
 */
export function getConversationStrategy(
  hasReplied: boolean,
  lastReply?: string,
  responseTime?: number
): 'aggressive' | 'balanced' | 'gentle' | 'space' {
  if (!hasReplied) {
    return 'balanced'; // Haven't engaged yet
  }

  if (!lastReply) {
    return 'balanced';
  }

  // Check engagement level
  const lowerReply = lastReply.toLowerCase();

  const isHot = BEHAVIORAL_INTELLIGENCE.engagementLevels.hot.some(signal =>
    lowerReply.includes(signal.toLowerCase())
  );
  const isWarm = BEHAVIORAL_INTELLIGENCE.engagementLevels.warm.some(signal =>
    lowerReply.includes(signal.toLowerCase())
  );
  const isCool = BEHAVIORAL_INTELLIGENCE.engagementLevels.cool.some(signal =>
    lowerReply.includes(signal.toLowerCase())
  );

  if (isHot) return 'aggressive'; // Push for booking
  if (isWarm) return 'balanced'; // Continue building value
  if (isCool) return 'gentle'; // Soft touch
  return 'space'; // Give them room
}
