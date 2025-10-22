/**
 * Holly Training Examples
 *
 * Real (anonymized) successful conversations showing EXACTLY how top reps handle different scenarios
 * These examples teach Holly through demonstration, not rules
 *
 * Each example shows:
 * 1. The lead's context and situation
 * 2. What a GOOD message looks like (and why it works)
 * 3. What a BAD message looks like (and why it fails)
 */

export interface TrainingExample {
  scenario: string;
  leadContext: {
    name: string;
    type: 'purchase' | 'refinance' | 'renewal';
    urgency?: string;
    objection?: string;
    engagement?: string;
    searchedFor?: string;
    touchNumber?: number;
  };
  goodApproach: {
    message: string;
    reasoning: string;
    whyItWorks: string[];
  };
  badApproach: {
    message: string;
    whyItFails: string[];
  };
}

export const TRAINING_EXAMPLES: TrainingExample[] = [
  // ============================================
  // SCENARIO 1: URGENT PURCHASE (ACCEPTED OFFER)
  // ============================================
  {
    scenario: 'Purchase lead with accepted offer - maximum urgency',
    leadContext: {
      name: 'Sarah',
      type: 'purchase',
      urgency: 'I have made an offer to purchase',
      searchedFor: 'best mortgage rates Vancouver',
      touchNumber: 1,
    },
    goodApproach: {
      message: `Hi Sarah! Holly from Inspired Mortgage. Saw you have an accepted offer on a property in Vancouver - congrats! 🎉 With subject removal coming up, getting the best rate locked in is CRITICAL. Our Reserved Rate pool (typically 0.10-0.30% below posted rates) works on first-come basis. Quick question: when's your subject removal deadline?`,
      reasoning: 'Urgent situation requires immediate value creation and timeline question',
      whyItWorks: [
        'Identifies self and company (trust)',
        'Acknowledges accepted offer (shows she read the form)',
        'Creates urgency tied to HER deadline (subject removal)',
        'Quantifies value (0.10-0.30% below posted)',
        'Asks diagnostic question (subject removal date)',
        'Avoids pushing booking in first message',
      ],
    },
    badApproach: {
      message: `Hi! Our rates are filling up fast. Book a call to see what you qualify for!`,
      whyItFails: [
        'Doesn\'t identify self or company',
        'Ignores her accepted offer',
        'Fake urgency (filling up fast)',
        'Generic approach (could be anyone)',
        'Pushes booking without building value',
      ],
    },
  },

  // ============================================
  // SCENARIO 2: REFINANCE WITH CURRENT LENDER
  // ============================================
  {
    scenario: 'Refinance lead with TD Bank - first message (conversational approach)',
    leadContext: {
      name: 'Mike',
      type: 'refinance',
      searchedFor: 'refinance rates comparison',
      touchNumber: 1,
    },
    goodApproach: {
      message: `Hi Mike! Holly from Inspired Mortgage. Saw you're looking to refinance your Vancouver condo with TD. Quick question - what's prompting the refinance right now?`,
      reasoning: 'Conversational, uses their form data, asks diagnostic question to understand situation',
      whyItWorks: [
        'Uses specific details from form (Vancouver condo, TD Bank)',
        'Shows you read their information (builds trust)',
        'Asks open-ended diagnostic question (not info you already have)',
        'Casual and conversational (not salesy)',
        'Starts a real conversation (not a pitch)',
        'No rate comparisons or value props in first message',
      ],
    },
    badApproach: {
      message: `Hi Mike! Most people don't realize their bank's rates are 0.30-0.50% higher than what brokers can access. On your balance, that could save you $200-400/month. Want to see what you qualify for?`,
      whyItFails: [
        'Leads with rate comparison (too aggressive for first message)',
        'Makes claims without understanding their situation',
        'Calculates savings before knowing if they care',
        'Feels like a sales pitch, not a conversation',
        'Pushes value before building rapport',
      ],
    },
  },

  // ============================================
  // SCENARIO 3: OBJECTION - ALREADY PRE-APPROVED
  // ============================================
  {
    scenario: 'Lead already has pre-approval elsewhere',
    leadContext: {
      name: 'Jessica',
      type: 'purchase',
      objection: 'Already pre-approved',
      touchNumber: 2,
    },
    goodApproach: {
      message: `Got it! Since you're already pre-approved, the main thing is making sure you lock in the BEST rate before closing. Pre-approvals can vary by 0.20%+ in rate between lenders - on a $650K mortgage, that's $85/month or $30K+ over 5 years. Greg can do a quick rate check against what you have (10 mins, free). Worth it before you're locked in?`,
      reasoning: 'Acknowledge objection, pivot to rate comparison (not competing approval), quantify value',
      whyItWorks: [
        'Acknowledges her pre-approval (doesn\'t ignore objection)',
        'Pivots to rate optimization (not competing approval)',
        'Quantifies savings ($85/month, $30K over 5 years)',
        'Low-friction ask (10 min rate check, free)',
        'Creates urgency (before locked in)',
        'Asks permission (Worth it?)',
      ],
    },
    badApproach: {
      message: `That's okay! We can get you approved too. Book a call.`,
      whyItFails: [
        'Competes with existing approval (wrong angle)',
        'Doesn\'t acknowledge her objection',
        'No value creation',
        'Pushes booking without addressing concern',
      ],
    },
  },

  // ============================================
  // SCENARIO 4: OBJECTION - TOO BUSY
  // ============================================
  {
    scenario: 'Lead says they\'re too busy right now',
    leadContext: {
      name: 'David',
      type: 'renewal',
      objection: 'Too busy this week',
      touchNumber: 2,
    },
    goodApproach: {
      message: `Totally get it - you're swamped! That's exactly why Greg keeps these quick (10-12 mins, not an hour-long thing). He can call you during your commute or lunch break. Does tomorrow at 12:30pm work, or would evening (like 6pm) be easier?`,
      reasoning: 'Acknowledge busy schedule, reduce time friction, offer specific times',
      whyItWorks: [
        'Empathizes with being busy',
        'Reduces time concern (10-12 mins, specific)',
        'Offers flexible times (commute, lunch)',
        'Gives two options (increases yes probability)',
        'Makes it easy to say yes',
      ],
    },
    badApproach: {
      message: `No problem! When you have time, book here: [link]`,
      whyItFails: [
        'Puts burden on lead to take action',
        'Doesn\'t reduce time friction',
        'Generic response',
        'Easy to ignore',
      ],
    },
  },

  // ============================================
  // SCENARIO 5: SEEKING INFO - WHAT'S THE RATE?
  // ============================================
  {
    scenario: 'Lead asks "What\'s your rate?" directly',
    leadContext: {
      name: 'Amanda',
      type: 'purchase',
      objection: 'Just tell me the rate',
      touchNumber: 2,
    },
    goodApproach: {
      message: `Great question! Wish I could give you an exact number right now, but mortgage rates depend on your credit score and property details. Here's the thing: the FASTEST way to get YOUR exact rate is a 10-min call with Greg. He pulls your credit and shows you real numbers from 30+ lenders. Way faster than back-and-forth texts. Want him to call you this afternoon?`,
      reasoning: 'Acknowledge desire for instant answer, explain why call is fastest, make it easy',
      whyItWorks: [
        'Validates her question',
        'Explains WHY she needs call (credit-dependent)',
        'Positions call as FASTEST solution (not obstacle)',
        'Quantifies value (30+ lenders)',
        'Low time commitment (10 min)',
        'Specific offer (this afternoon)',
      ],
    },
    badApproach: {
      message: `Rates range from 4.89-5.49%. Book a call to see what you qualify for.`,
      whyItFails: [
        'Range is too wide to be useful',
        'Uses "qualify" language (judgmental)',
        'Doesn\'t explain why call is needed',
        'Pushy tone',
      ],
    },
  },

  // ============================================
  // SCENARIO 6: ENGAGEMENT - ASKING QUESTIONS
  // ============================================
  {
    scenario: 'Lead is engaged and asking follow-up questions',
    leadContext: {
      name: 'Tom',
      type: 'refinance',
      engagement: 'Asking questions about process',
      touchNumber: 2,
    },
    goodApproach: {
      message: `Great question! The process is actually pretty simple: (1) Greg does a quick call to understand your situation and pull your credit, (2) He shops 30+ lenders in real-time to find your best rate, (3) You get a pre-approval same day that locks your rate for 120 days. Whole thing takes about 2 weeks from start to closing. Are you looking to refinance soon, or planning for a few months out?`,
      reasoning: 'Answer question clearly, continue conversation, ask diagnostic question',
      whyItWorks: [
        'Answers his question thoroughly but concisely',
        'Breaks down process into simple steps',
        'Shows timeline (2 weeks)',
        'Asks diagnostic question to understand urgency',
        'Builds relationship before pushing booking',
      ],
    },
    badApproach: {
      message: `All your questions will be answered on the call. Book here: [link]`,
      whyItFails: [
        'Dismissive of his question',
        'Withholds information',
        'Pushy',
        'Kills engagement',
      ],
    },
  },

  // ============================================
  // SCENARIO 7: COOLING - "MAYBE LATER"
  // ============================================
  {
    scenario: 'Lead says "maybe later" or "I\'ll think about it"',
    leadContext: {
      name: 'Rachel',
      type: 'renewal',
      objection: 'I\'ll think about it',
      touchNumber: 3,
    },
    goodApproach: {
      message: `No pressure at all! Most people do shop around - that's smart. Just FYI, our Reserved Rate pool works on a first-come basis, so worth grabbing a quick spot even if you're still comparing options. But zero rush - I'll check back in a few days with any rate updates. Sound good?`,
      reasoning: 'Give space, soft value/urgency, stay top of mind, ask permission to follow up',
      whyItWorks: [
        'Respects her decision (no pressure)',
        'Validates shopping behavior',
        'Gentle FOMO (first-come basis)',
        'Offers value-add reason to follow up (rate updates)',
        'Asks permission (Sound good?)',
      ],
    },
    badApproach: {
      message: `Okay, but rates are going up! Don't miss out. Last chance to book!`,
      whyItFails: [
        'Pressure tactics',
        'Fake urgency',
        'Desperate tone',
        'Will likely get ignored or blocked',
      ],
    },
  },

  // ============================================
  // SCENARIO 8: NO REPLY - TOUCH #3
  // ============================================
  {
    scenario: 'No reply after 2 messages - trying different angle',
    leadContext: {
      name: 'Chris',
      type: 'purchase',
      engagement: 'No reply after 2 touches',
      touchNumber: 3,
    },
    goodApproach: {
      message: `Hey Chris! Just wanted to share something: saw rates dropped 0.15% this week (first time in 3 months). If you're still looking for a mortgage on that Vancouver property, now's actually a great time to lock in. Greg has a few spots open this week if you want to grab one of our Reserved Rates before the pool fills. No pressure though!`,
      reasoning: 'Different angle (market update), create real urgency, soft touch',
      whyItWorks: [
        'New angle (not repeating previous messages)',
        'Market news creates urgency (rates dropped)',
        'References his specific situation (Vancouver property)',
        'Creates scarcity (spots open this week)',
        'Ends with low-pressure (No pressure though)',
      ],
    },
    badApproach: {
      message: `Hi Chris, following up on my last message. Still interested?`,
      whyItFails: [
        'Repeats same approach',
        'Reminds him he ignored you',
        'No new value',
        'Generic and annoying',
      ],
    },
  },

  // ============================================
  // SCENARIO 9: CORRECTION - LEAD CORRECTS YOU
  // ============================================
  {
    scenario: 'Lead corrects your understanding',
    leadContext: {
      name: 'Robert',
      type: 'renewal',
      objection: 'It\'s actually a renewal, not a refinance',
      touchNumber: 2,
    },
    goodApproach: {
      message: `Thanks for clarifying, Robert! Renewals are actually perfect for us - you're penalty-free to switch, which means we can get you the best rate without any breakage fees. Most clients save $200-400/month on renewals because banks count on you NOT shopping around. Quick question: when does your current term end?`,
      reasoning: 'Acknowledge correction immediately, pivot strategy to renewal-specific value',
      whyItWorks: [
        'Thanks him for correction (shows respect)',
        'Pivots to renewal-specific value',
        'Explains why renewal is advantageous (penalty-free)',
        'Quantifies savings ($200-400/month)',
        'Asks diagnostic question (term end date)',
      ],
    },
    badApproach: {
      message: `Okay, renewal then. Want to book a call?`,
      whyItFails: [
        'Dismissive of correction',
        'Doesn\'t adjust strategy',
        'No value creation',
        'Generic response',
      ],
    },
  },

  // ============================================
  // SCENARIO 10: HIGH INTENT - READY TO BOOK
  // ============================================
  {
    scenario: 'Lead shows high intent with "When can we talk?"',
    leadContext: {
      name: 'Emma',
      type: 'purchase',
      engagement: 'When can Greg call me?',
      touchNumber: 2,
    },
    goodApproach: {
      message: `Perfect! Greg has openings today at 2pm and 4:30pm PT, or tomorrow morning at 9am and 11am. Here's his calendar - takes 2 mins to book, and the call is 10-15 mins: [link]. He'll get you your exact rate and can lock in a pre-approval same day. Which time works best?`,
      reasoning: 'Strike while hot - give specific times, send link, make it easy',
      whyItWorks: [
        'Immediate response to high intent',
        'Specific time slots (reduces decision fatigue)',
        'Explains booking time (2 mins)',
        'Explains call time (10-15 mins)',
        'Shows value (exact rate, same-day approval)',
        'Asks which time (not if they want to book)',
      ],
    },
    badApproach: {
      message: `Great! Book here: [link]`,
      whyItFails: [
        'Doesn\'t capitalize on momentum',
        'No specific times offered',
        'Minimal effort',
        'Wasted opportunity',
      ],
    },
  },
];

/**
 * Get relevant training examples based on lead situation
 */
export function getRelevantExamples(
  leadType: 'purchase' | 'refinance' | 'renewal',
  urgency?: string,
  lastReply?: string,
  touchNumber?: number
): TrainingExample[] {
  const examples: TrainingExample[] = [];

  // Priority 1: Match urgency
  if (urgency === 'I have made an offer to purchase') {
    const urgentExample = TRAINING_EXAMPLES.find(e => e.scenario.includes('accepted offer'));
    if (urgentExample) examples.push(urgentExample);
  }

  // Priority 2: Match objection/reply pattern
  if (lastReply) {
    const lowerReply = lastReply.toLowerCase();

    if (lowerReply.includes('already') && lowerReply.includes('approved')) {
      const example = TRAINING_EXAMPLES.find(e => e.leadContext.objection === 'Already pre-approved');
      if (example) examples.push(example);
    } else if (lowerReply.includes('busy')) {
      const example = TRAINING_EXAMPLES.find(e => e.leadContext.objection?.includes('busy'));
      if (example) examples.push(example);
    } else if (lowerReply.includes('rate')) {
      const example = TRAINING_EXAMPLES.find(e => e.leadContext.objection?.includes('rate'));
      if (example) examples.push(example);
    } else if (lowerReply.includes('maybe') || lowerReply.includes('think about')) {
      const example = TRAINING_EXAMPLES.find(e => e.leadContext.objection?.includes('think about'));
      if (example) examples.push(example);
    } else if (lowerReply.includes('when') || lowerReply.includes('call me')) {
      const example = TRAINING_EXAMPLES.find(e => e.leadContext.engagement?.includes('call me'));
      if (example) examples.push(example);
    }
  }

  // Priority 3: Match lead type
  const typeExample = TRAINING_EXAMPLES.find(e => e.leadContext.type === leadType && !examples.includes(e));
  if (typeExample) examples.push(typeExample);

  // Priority 4: Match touch number strategy
  if (touchNumber && touchNumber >= 3) {
    const touchExample = TRAINING_EXAMPLES.find(e => e.scenario.includes('No reply') || e.scenario.includes('cooling'));
    if (touchExample && !examples.includes(touchExample)) examples.push(touchExample);
  }

  // Return top 3 most relevant examples
  return examples.slice(0, 3);
}
