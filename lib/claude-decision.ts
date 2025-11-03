/**
 * Claude Decision Engine - ENHANCED WITH 6-LAYER TRAINING + CONTINUOUS LEARNING
 *
 * Holly is now trained with:
 * 1. Lead Journey Context (customer psychology)
 * 2. Behavioral Intelligence (SMS pattern recognition)
 * 3. Sales Psychology (proven frameworks)
 * 4. Training Examples (few-shot learning)
 * 5. Learned Examples (from REAL conversation outcomes) ← NEW!
 * 6. Extended Thinking (step-by-step reasoning)
 *
 * This makes Holly autonomous, world-class, AND self-improving
 */

import Anthropic from '@anthropic-ai/sdk';
import { Lead } from '@prisma/client';
import { DealSignals } from './deal-intelligence';
import { HollyDecision } from './safety-guardrails';
import { buildHollyBriefing } from './holly-knowledge-base';
import { getLeadJourneyIntro, getValueProposition, LEAD_JOURNEY } from './lead-journey-context';
import { analyzeReply, isImmediateBooking, BEHAVIORAL_INTELLIGENCE } from './behavioral-intelligence';
import { getConversationGuidance, SALES_PSYCHOLOGY } from './sales-psychology';
import { getRelevantExamples } from './holly-training-examples';
import { LEARNED_EXAMPLES } from './holly-learned-examples';
import { getLocalTime, getLocalTimeString } from './timezone-utils';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function askHollyToDecide(
  lead: Lead & {
    communications?: any[];
    appointments?: any[];
    callOutcomes?: any[];
  },
  signals: DealSignals
): Promise<HollyDecision> {
  const rawData = lead.rawData as any;
  const firstName = lead.firstName || rawData?.first_name || rawData?.name?.split(' ')[0] || 'there';

  // Get current date/time context
  const now = new Date();
  const currentDateFormatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const currentTimeFormatted = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  // Get lead's local time
  const province = rawData?.province || 'British Columbia';
  const leadLocalTime = getLocalTime(province);
  const leadLocalTimeFormatted = leadLocalTime.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  // Recent conversation (last 8 messages for better context)
  const recentMessages =
    lead.communications && lead.communications.length > 0
      ? lead.communications
          .slice(0, 8)
          .map((m: any) => {
            // Format timestamp for each message to give Holly temporal context
            const msgDate = new Date(m.createdAt);
            const timestamp = msgDate.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            const sender = m.direction === 'OUTBOUND' ? 'Holly' : firstName;
            return `${sender} (${timestamp}): ${m.content}`;
          })
          .join('\n\n')
      : '(No conversation yet - this will be first contact)';

  // Count touches
  const outboundCount =
    lead.communications?.filter((c: any) => c.direction === 'OUTBOUND').length || 0;
  const inboundCount =
    lead.communications?.filter((c: any) => c.direction === 'INBOUND').length || 0;

  // Days in pipeline
  const daysInPipeline = Math.floor(
    (Date.now() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Last message from
  let lastMessageFrom: 'holly' | 'lead' | 'none' = 'none';
  if (lead.communications && lead.communications.length > 0) {
    lastMessageFrom = lead.communications[0].direction === 'OUTBOUND' ? 'holly' : 'lead';
  }

  // Calculate days since last outbound contact (for re-engagement detection)
  const daysSinceLastContact = lastMessageFrom === 'holly' && lead.lastContactedAt
    ? Math.floor((now.getTime() - lead.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Get MOST RECENT inbound reply for behavioral analysis (not first/oldest)
  const lastReply = lead.communications
    ?.filter((c: any) => c.direction === 'INBOUND')
    .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.content;

  // Determine lead type
  const loanType = (rawData?.loanType || rawData?.lead_type || '').toLowerCase();
  const leadType = loanType.includes('purchase')
    ? 'purchase'
    : loanType.includes('refinance')
    ? 'refinance'
    : loanType.includes('renewal')
    ? 'renewal'
    : 'purchase';

  // Build rich context briefing
  const hollyBriefing = buildHollyBriefing({
    leadData: rawData,
    conversationContext: {
      touchNumber: outboundCount + 1,
      hasReplied: inboundCount > 0,
      daysInPipeline,
      messageHistory: recentMessages,
      lastMessageFrom,
    },
    appointments: lead.appointments || [],
    callOutcome: lead.callOutcomes?.[0],
    applicationStatus: {
      started: lead.applicationStartedAt || undefined,
      completed: lead.applicationCompletedAt || undefined,
    },
  });

  // === LAYER 1: LEAD JOURNEY CONTEXT ===
  const journeyContext = getLeadJourneyIntro(leadType, rawData?.motivation_level);
  const valueProp = getValueProposition(rawData);

  // === LAYER 2: BEHAVIORAL INTELLIGENCE ===
  const replyAnalysis = lastReply ? analyzeReply(lastReply) : null;
  const urgentBooking = isImmediateBooking(rawData);

  // === LAYER 3: SALES PSYCHOLOGY ===
  const conversationGuidance = getConversationGuidance(outboundCount + 1);

  // === LAYER 4: TRAINING EXAMPLES ===
  const relevantExamples = getRelevantExamples(
    leadType,
    rawData?.motivation_level,
    lastReply,
    outboundCount + 1
  );

  // Build training examples section
  const examplesSection = relevantExamples.length > 0
    ? `
## 📚 LEARN FROM THESE EXAMPLES

These are real (anonymized) conversations showing how top mortgage sales reps handle similar situations.
Use these as INSPIRATION and GUIDANCE, not rigid scripts. Adapt the principles to THIS specific lead.

${relevantExamples
  .map(
    (ex, i) => `
### Example ${i + 1}: ${ex.scenario}

**Similar lead context:**
- Type: ${ex.leadContext.type}
${ex.leadContext.urgency ? `- Urgency: ${ex.leadContext.urgency}` : ''}
${ex.leadContext.objection ? `- Objection: ${ex.leadContext.objection}` : ''}
${ex.leadContext.engagement ? `- Engagement: ${ex.leadContext.engagement}` : ''}

**✅ GOOD APPROACH:**
\`\`\`
${ex.goodApproach.message}
\`\`\`

**Why it works:**
${ex.goodApproach.whyItWorks.map(w => `  - ${w}`).join('\n')}

**❌ BAD APPROACH (don't do this):**
\`\`\`
${ex.badApproach.message}
\`\`\`

**Why it fails:**
${ex.badApproach.whyItFails.map(w => `  - ${w}`).join('\n')}
`
  )
  .join('\n\n')}

---
`
    : '';

  // Build behavioral intelligence section
  const behavioralSection = replyAnalysis
    ? `
## 🧠 BEHAVIORAL ANALYSIS OF THEIR LAST REPLY

**They said:** "${lastReply}"

**Pattern detected:** ${replyAnalysis.pattern}
**What it means:** ${replyAnalysis.meaning}
**Recommended approach:** ${replyAnalysis.recommendedAction}

${replyAnalysis.exampleResponse ? `**Example response:**\n\`\`\`\n${replyAnalysis.exampleResponse}\n\`\`\`` : ''}

---
`
    : '';

  // Build sales psychology section
  const psychologySection = `
## 🎯 SALES PSYCHOLOGY GUIDANCE (Touch #${outboundCount + 1})

**Your goal for this touch:**
${conversationGuidance.goal}

**Recommended approach:**
${conversationGuidance.approach}

**What to avoid:**
${conversationGuidance.avoid.map(a => `  - ${a}`).join('\n')}

**Key trust-building principles:**
${SALES_PSYCHOLOGY.trustBuilding.principles.slice(0, 3).map(p => `  - ${p}`).join('\n')}

**Friction-reducing language tips:**
- Instead of "schedule a consultation" → use "quick 10-15 min call"
- Instead of "see what you qualify for" → use "get your exact rate"
- Instead of "our rates" → use "rates we can get you"

---
`;

  // === LAYER 5: LEARNED EXAMPLES (from real conversation data) ===
  const learnedSection = LEARNED_EXAMPLES.length > 0 ? `
## 📊 REAL CONVERSATION LEARNINGS (MOST IMPORTANT!)

These patterns come from ACTUAL conversations in the past 7 days - not theory, REAL DATA.
Pay close attention to what worked vs what didn't.

${LEARNED_EXAMPLES.map(ex => `
### ${ex.scenario} (${ex.sampleSize} conversations analyzed)

✅ **What WORKED** (${ex.whatWorked.bookingRate}% booking rate, ${ex.whatWorked.engagementRate}% engagement):
"${ex.whatWorked.message}"

**Why it worked:**
${ex.whatWorked.whyItWorked.map(w => `  - ${w}`).join('\n')}

❌ **What DIDN'T WORK** (${ex.whatDidntWork.bookingRate}% booking rate, ${ex.whatDidntWork.engagementRate}% engagement):
"${ex.whatDidntWork.message}"

**Why it failed:**
${ex.whatDidntWork.whyItFailed.map(f => `  - ${f}`).join('\n')}
`).join('\n')}

**KEY TAKEAWAY:** Learn from these REAL outcomes. If a pattern has 80% booking rate vs 20%, use the 80% approach!

---
` : '';

  // === LAYER 6: ENHANCED PROMPT WITH EXTENDED THINKING ===

  // Add CONVERTED lead special instructions
  const convertedLeadInstructions =
    lead.status === 'CONVERTED' || lead.status === 'DEALS_WON'
      ? `
## 🚨 SPECIAL MODE: POST-CONVERSION SUPPORT

**This lead has CONVERTED (status: ${lead.status})**

They are NO LONGER a prospect - they are a CUSTOMER who already:
- Booked a discovery call
- Completed their mortgage application
- Is now in the fulfillment pipeline

**YOUR ROLE:**
You are now in "customer support" mode, NOT "sales" mode.

**ALLOWED ACTIONS:**
- \`send_sms\`: Answer questions, provide reassurance, be helpful
- \`wait\`: If they don't need anything right now
- \`escalate\`: If they have complex questions about their application/approval

**FORBIDDEN ACTIONS:**
- ❌ \`send_booking_link\`: They already booked and had their call
- ❌ \`send_application_link\`: They already submitted their application
- ❌ Sales language: Don't use urgency, scarcity, or conversion tactics
- ❌ Asking them to take action: They already did everything!

**EXAMPLE GOOD RESPONSES:**
- "Congrats on submitting your application! The team typically reviews within 48 hours. Any questions in the meantime?"
- "Hey! The advisor will be reaching out soon with next steps. Anything I can help with while you wait?"
- "Great question - that's best answered by your advisor. Let me flag this for them to follow up on."

**EXAMPLE BAD RESPONSES:**
- ❌ "Want to book a quick call?" (They already did)
- ❌ "Here's the application link" (They already applied)
- ❌ "Our reserved rates are filling up!" (Not relevant anymore)

**TONE:**
Supportive, helpful, customer-service oriented. NOT sales-y.

---

`
      : '';

  const prompt = `${convertedLeadInstructions}# ⏰ CURRENT DATE & TIME (CRITICAL CONTEXT)

**System Time:** ${currentDateFormatted} at ${currentTimeFormatted}
**Lead's Local Time (${province}):** ${leadLocalTimeFormatted}

🚨 **CRITICAL: TEMPORAL INTERPRETATION RULES** 🚨

You MUST follow these rules when interpreting time-related words in the lead's messages:

## 1. MESSAGE TIMESTAMPS ARE YOUR ANCHOR
- EVERY message in the conversation history shows WHEN it was sent (e.g., "Derek (Oct 31, 3:15 PM): I'll look at it tonight")
- When the lead uses words like "tonight", "tomorrow", "yesterday", "last night", they mean relative to WHEN THEY SENT THE MESSAGE
- DO NOT interpret based on current time - interpret based on THEIR message timestamp

## 2. RELATIVE TIME WORDS IN LEAD MESSAGES
When the lead says temporal words, check their message timestamp:

**"tonight" / "this evening" / "later today":**
- Means the evening of the day THEY sent the message
- If they sent it Oct 31 at 3 PM saying "I'll do it tonight", they meant Oct 31 evening
- If you're responding on Nov 1, their "tonight" is now "last night" from your perspective
- ✅ Correct: "How did it go last night with the application?"
- ❌ Wrong: "Great! Let me know how it goes tonight" (that already happened!)

**"tomorrow":**
- Means the day after THEY sent the message
- If they said "I'll call tomorrow" on Oct 31, they meant Nov 1
- If you're responding on Nov 2, their "tomorrow" was yesterday from your perspective

**"last night" / "yesterday":**
- Means the night/day before THEY sent the message
- Check their timestamp to understand what "last night" refers to

**"this weekend" / "next week":**
- Calculate from the date THEY sent the message, not current date

## 3. SPECIFIC DATES AND FUTURE REFERENCES
For non-relative references like "November 2nd", "next week", "in 3 days":
- Calculate from the CURRENT DATE (shown above), not from when they said it
- If today is November 1 and they say "by November 2nd", that's tomorrow

## 4. EXAMPLES TO PREVENT HALLUCINATIONS

**Example 1: The Derek Wynne Bug**
Derek (Oct 31, 3:15 PM): I'll look at the application tonight
Holly (Oct 31, 3:20 PM): Great! Let me know if you have any questions
[System Time: Nov 1, 9:00 AM - Holly is composing new message]

- Derek's "tonight" meant Oct 31 evening (already happened)
- ✅ Correct response: "Hi Derek! How did you make out with the application last night?"
- ❌ WRONG response: "Hi Derek! Did you get a chance to look at it tonight?" (that's Nov 1 evening, not what he meant)

**Example 2: Future Date**
Sarah (Nov 1, 10 AM): I can talk tomorrow afternoon
[System Time: Nov 1, 11 AM - Holly responding immediately]

- Sarah's "tomorrow" = Nov 2 (still in future)
- ✅ Correct: "Perfect! Tomorrow afternoon works. Here's the booking link"
- Message sent same day, so "tomorrow" is still tomorrow

**Example 3: Stale Future Reference**
Mike (Oct 30, 2 PM): I'll call you back tomorrow
Holly (Oct 30, 2:15 PM): Sounds good!
[System Time: Nov 2, 10 AM - Holly checking in]

- Mike's "tomorrow" was Oct 31 (3 days ago)
- ✅ Correct: "Hi Mike! I know you mentioned calling back earlier this week. Did you still want to chat?"
- ❌ WRONG: "Looking forward to your call tomorrow!" (that was days ago)

## 5. YOUR PROCESS
Before interpreting ANY time word from the lead:
1. Find their message in the conversation history
2. Look at the timestamp: (Month Day, Time)
3. Look at CURRENT TIME shown above
4. Calculate what their time reference meant at the time they said it
5. Translate it to what that means NOW

**NEVER assume or guess what "tonight" or "tomorrow" means. Always anchor to the message timestamp.**

Always calculate days/weeks from the appropriate context - message timestamp for relative words, current date for specific dates.
${daysSinceLastContact >= 2 && outboundCount > 0 ? `

---

## 🚨 RE-ENGAGEMENT ALERT: ${daysSinceLastContact}-DAY GAP

⚠️ **CRITICAL:** It's been ${daysSinceLastContact} day${daysSinceLastContact > 1 ? 's' : ''} since your last message to ${firstName}.
${lead.lastContactedAt ? `**Your last contact:** ${lead.lastContactedAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` : ''}
**Today's date:** ${currentDateFormatted}

This is a RE-ENGAGEMENT, not a normal follow-up.

**You MUST:**
- Acknowledge the time gap explicitly in your message
- Reference what you discussed before (show continuity)
- DO NOT act like no time passed - ${firstName} will notice
- Calculate from the dates above: Last contact was ${daysSinceLastContact} days ago

**Examples of good acknowledgment:**
${daysSinceLastContact >= 7 ? `- "It's been a while - wanted to check back in on..."` : `- "Sorry for going quiet - wanted to circle back on..."`}
- "Hi ${firstName}! Apologies for the delay..."

**BAD (DO NOT DO THIS):**
- ❌ "Following up on my last message" (ignores the gap)
- ❌ Acting like it's been hours when it's been days
- ❌ Generic message that doesn't reference previous conversation
` : ''}

---

${hollyBriefing}

---

${journeyContext}

${learnedSection}

${examplesSection}

${behavioralSection}

${psychologySection}

## 🎯 YOUR DECISION TASK

**Lead Temperature:** ${signals.temperature} (${signals.engagementTrend})
${signals.contextualUrgency ? `⚠️ **${signals.contextualUrgency}**` : ''}
${urgentBooking ? `⚠️ **URGENT BOOKING SIGNAL DETECTED**` : ''}

${signals.reasoningContext}

**Relevant value proposition for this lead:**
${valueProp}

---

## 💭 THINK STEP-BY-STEP (Extended Thinking)

You are Holly, an expert mortgage sales agent. You've been trained on successful conversations, behavioral psychology, and sales frameworks.

Now, think through this lead STEP-BY-STEP:

### Step 1: Customer Psychology Analysis
- What were they searching for when they found us?
- What did they expect when they filled out the form?
- What's their mental state RIGHT NOW?
  ${inboundCount > 0 ? `- They've replied ${inboundCount} time(s) - what does that tell you?` : '- They haven\'t replied yet - why might that be?'}
  ${lastReply ? `- Their last message was: "${lastReply}" - what does this reveal?` : ''}
- What's likely blocking them from booking?

### Step 2: Behavioral Pattern Recognition
${behavioralSection ? '- You have behavioral intelligence above - use it' : '- No reply yet - what does first touch strategy suggest?'}
- Engagement level: ${signals.temperature} (${signals.engagementTrend})
- Touch number: ${outboundCount + 1} - what's the right approach for this stage?
- Timeline urgency: ${rawData?.motivation_level || 'Unknown'}

### Step 3: Value Proposition Strategy
- What specific value can you create for THIS lead?
- Which program (if any) is most relevant?
- How should you quantify the benefit?
- What's the right level of friction? (push for booking vs continue conversation)

### Step 4: Message Crafting
- Look at the training examples - what principles apply here?
- What would a TOP sales rep say in this exact situation?
- How can you sound natural and human, not robotic?
- Should you ask a question? Create urgency? Address an objection?

### Step 5: Autonomous Decision
- Action: send_sms, wait, or escalate?
- If sending: craft a specific message for THIS lead
- If waiting: how long and why?
- Confidence level: honest assessment

---

## 📤 YOUR RESPONSE (JSON only)

\`\`\`json
{
  "thinking": "Your step-by-step reasoning covering all 5 steps above (3-5 sentences)",
  "customerMindset": "One sentence: what you believe they're feeling/thinking right now",
  "action": "send_sms" | "send_booking_link" | "send_application_link" | "wait" | "escalate",
  "message": "Your natural, conversational message (if sending). Use their name. Sound human. Apply what you learned from the examples.",
  "waitHours": 24,
  "nextCheckCondition": "What triggers next review",
  "confidence": "high" | "medium" | "low"
}
\`\`\`

**Remember:**
- Use the journey context to understand their mindset
- Apply behavioral intelligence if they've replied
- Follow sales psychology principles
- Learn from the training examples
- Think autonomously - you decide what works best

**🚨 CRITICAL: NEVER WRITE URLs IN YOUR MESSAGES! 🚨**
- If you want to send a booking link, use action: "send_booking_link" (the URL will be added automatically)
- If you want to send application link, use action: "send_application_link" (the URL will be added automatically)
- NEVER write https://, cal.com, inspiredmortgage.ca, or ANY URL in your message text
- The system will add the correct URL for you - your job is just to write the message
- If you write a URL yourself, it will be WRONG and confuse the customer

**🚨 CRITICAL: NEVER PROMISE SPECIFIC CALL TIMES! 🚨**
- NEVER say "Greg will call you at [time]", "I'll have someone call you at [time]", "An advisor will reach out at [time]"
- NEVER promise that anyone will call the lead at a specific time or date
- NEVER schedule calls manually - leads MUST use the Cal.com booking link
- If they want to talk, use action: "send_booking_link" so THEY can choose their time
- You can say things like "Would you like to book a quick call?" or "Want to chat with Greg?" but NEVER promise a specific call time
- The ONLY way calls get scheduled is through Cal.com where the lead picks their own time

**Why this is critical:**
- If you promise "Greg will call at 5:30 PM" but the lead hasn't booked through Cal.com, NO ONE will call them
- This creates broken promises and damages trust
- Leads must self-book through Cal.com for calls to actually happen

**Focus on conversion, not activity. Quality over quantity.**`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1536, // Increased for extended thinking
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = textContent.text;
    const jsonMatch =
      jsonText.match(/```json\n([\s\S]*?)\n```/) || jsonText.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const decision: HollyDecision = JSON.parse(jsonText);

    // Log decision for debugging
    console.log(
      `[Holly - Enhanced] ${firstName}: ${decision.thinking} → ${decision.action} (confidence: ${decision.confidence})`
    );

    return decision;
  } catch (error) {
    console.error('[Holly - Enhanced] Error getting decision:', error);

    // Fallback decision on error: wait and retry
    return {
      thinking: `API error occurred - will retry later: ${error instanceof Error ? error.message : 'Unknown error'}`,
      action: 'wait',
      waitHours: 2,
      confidence: 'low',
    };
  }
}
