/**
 * Lead Journey Context
 *
 * CRITICAL: Understanding how leads enter our system and what they expect
 * This transforms Holly from "generic chatbot" to "empathetic sales expert"
 */

export interface LeadJourneyContext {
  howTheyFoundUs: {
    searchIntent: string[];
    whatTheyWerePromised: string;
    whatTheyFilledOut: string;
    theirExpectation: string;
  };
  theGap: {
    problem: string;
    theirMindset: string;
    ourJob: string;
  };
  theValue: {
    why15MinCall: string[];
    howToFrameIt: string;
  };
  trustBuilders: string[];
}

/**
 * THE CUSTOMER JOURNEY: From Google Search → Our System
 *
 * This is what EVERY lead goes through before Holly talks to them.
 * Understanding this context is the difference between "generic bot" and "expert sales rep"
 */
export const LEAD_JOURNEY: LeadJourneyContext = {
  howTheyFoundUs: {
    searchIntent: [
      'best mortgage rates',
      'mortgage broker near me',
      'refinance calculator',
      'mortgage pre-approval',
      'lowest mortgage rate canada',
      'mortgage renewal rates',
    ],
    whatTheyWerePromised: 'Fill out a simple form to get access to the best mortgage rates available',
    whatTheyFilledOut: 'Location, property value, loan amount, purchase/refinance/renewal, timeline, credit score',
    theirExpectation: 'They expected to see rates immediately or get a quote/pre-approval',
  },

  theGap: {
    problem: 'They filled the form expecting instant rates, but landed on a booking page instead',
    theirMindset: 'Skeptical ("is this bait-and-switch?"), comparing multiple options, might feel slightly misled',
    ourJob: 'Bridge the gap by explaining WHY a 15-min discovery call IS the way to get the rate they were promised',
  },

  theValue: {
    why15MinCall: [
      'Mortgage rates depend on credit score, debt ratios, employment type, and property details we need to verify',
      'Our Reserved Rate pool is exclusive and requires qualification (not publicly posted)',
      'Advisors can compare 30+ lenders to find the absolute best rate for their specific situation',
      'Pre-approval locks in their rate for 120 days (protects them from rate increases)',
      'The call typically finds 0.10-0.30% better rates than posted online = $50-200/month savings',
    ],
    howToFrameIt: 'The 15-min call IS how they get the rate. Frame it as the next step in getting their quote, not an obstacle or sales pitch.',
  },

  trustBuilders: [
    'Use their name in first message',
    'Reference what they filled out ("I saw you\'re looking at a $850K purchase in Vancouver...")',
    'Acknowledge their search intent ("You searched for the best rate - smart move")',
    'Create urgency around THEIR timeline (subject removal, renewal date), not fake scarcity',
    'Quantify specific value ("$200-400/month savings", "0.20% rate difference = $85/month on $650K")',
    'Use low-friction language ("quick 10-15 min call" not "schedule a consultation")',
    'Position advisors as experts who work for them, not salespeople',
  ],
};

/**
 * Generate context-aware introduction for lead's first message
 */
export function getLeadJourneyIntro(leadType: string, urgencyLevel?: string): string {
  let intro = `## 🎯 CRITICAL: UNDERSTAND THE CUSTOMER JOURNEY

**How they found us:**
They searched Google for "${leadType === 'purchase' ? 'best mortgage rates' : leadType === 'refinance' ? 'refinance rates comparison' : 'mortgage renewal rates'}" and clicked on our ad promising access to exclusive rates.

**What happened:**
1. They filled out a form with their property/financial details
2. They expected to see rates immediately or get a quote
3. Instead, they landed on a booking page with our calendar
4. ${urgencyLevel === 'I have made an offer to purchase' ? '⚠️ They have an ACCEPTED OFFER with subject removal deadline approaching!' : 'They may feel skeptical or like it was a bait-and-switch'}

**Your critical job:**
Bridge the gap. They're not refusing the call because they don't want help - they're hesitant because they don't understand WHY they need it to get the rate they were promised.

**The frame:**
"The 15-min call IS how you get your rate. Our advisors compare 30+ lenders to find you the absolute best rate for your specific situation. Most clients save $200-400/month compared to their bank's offer."

**Trust builders you MUST use:**
- Reference what they searched for
- Acknowledge what they filled out
- Quantify the value (savings in dollars)
- Use low-friction language ("quick 10-15 min call" not "consultation")
- Create urgency around THEIR timeline, not fake scarcity

---
`;

  return intro;
}

/**
 * Get lead-specific value proposition based on their journey
 */
export function getValueProposition(leadData: any): string {
  const loanType = (leadData.loanType || leadData.lead_type || '').toLowerCase();
  const urgency = leadData.motivation_level;
  const loanAmount = leadData.loanAmount || leadData.purchasePrice || leadData.home_value;

  let value = '';

  // Calculate savings estimate
  const savings = loanAmount ? Math.round(parseFloat(loanAmount) * 0.002 / 12) : 200;

  if (urgency === 'I have made an offer to purchase') {
    value = `Since you have an accepted offer, getting the best rate locked in before subject removal is CRITICAL. A 0.20% difference on ${loanAmount ? `$${parseInt(loanAmount).toLocaleString()}` : 'your mortgage'} = ~$${savings}/month or $${savings * 60} over 5 years. Our advisors can lock you into our Reserved Rate pool (typically 0.10-0.30% below posted rates) in a 15-min call.`;
  } else if (loanType.includes('refinance')) {
    value = `Most people refinancing don't realize their current lender's offer is usually 0.30-0.50% higher than what mortgage brokers can access. On ${loanAmount ? `$${parseInt(loanAmount).toLocaleString()}` : 'your balance'}, that's $${savings}-${savings * 2}/month savings. The 15-min call with our advisors compares 30+ lenders to get you the absolute best rate.`;
  } else if (loanType.includes('renewal')) {
    value = `Your bank's renewal letter is typically 0.30-0.50% higher than rates brokers can get you - they're counting on you NOT shopping around. On ${loanAmount ? `$${parseInt(loanAmount).toLocaleString()}` : 'your balance'}, that's $${savings}-${savings * 2}/month you're overpaying. Our advisors can show you the difference in a quick 10-min call.`;
  } else {
    value = `Mortgage rates vary by 0.20-0.50% depending on the lender and product. On ${loanAmount ? `$${parseInt(loanAmount).toLocaleString()}` : 'a typical mortgage'}, that's $${savings}-${savings * 2}/month difference. Our advisors compare 30+ lenders in a 15-min call to get you the absolute best rate.`;
  }

  return value;
}
