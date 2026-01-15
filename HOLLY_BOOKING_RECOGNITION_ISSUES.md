# Holly Booking Recognition Issues & Recommended Improvements

**Date:** November 19, 2025
**Status:** Investigation Complete
**Priority:** HIGH

---

## Executive Summary

Holly has a **continuing issue where she doesn't recognize that a call has already been booked**, leading to redundant follow-ups asking "did you grab a time?" even when the customer has already scheduled (and in some cases, no-showed) their appointment.

### Real-World Example: Jade Lozinski

**Timeline:**
- **Nov 16, 10:17 PM** - Holly sent booking link
- **Nov 16, 10:19 PM** - Jade booked appointment for Nov 19, 8:00 PM ✅
- **Nov 18, 12:30 AM** - Holly asked: "did you get a chance to grab a time?" ❌
- **Nov 19, 4:15 PM** - Holly asked AGAIN: "did you get a chance to grab a time?" ❌
- **Nov 19, 8:03 PM** - Jade no-showed, advisor marked as NO_ANSWER
- **Nov 19, 8:31 PM** - Holly sent message about attempted call

**Current Status:** Lead is NURTURING (was CALL_SCHEDULED, changed back after no-show)
**Appointment Record:** Still exists in database with status "scheduled"

---

## Root Causes Identified

### 1. **Holly Doesn't Check Appointment History Before Asking About Booking**

**Location:** [lib/claude-decision.ts](lib/claude-decision.ts)

**Issue:** While appointment data IS provided to Claude in the briefing (via `buildHollyBriefing`), Holly doesn't have explicit instructions to:
- Check if an appointment already exists before asking "did you grab a time?"
- Handle the case where customer booked but then no-showed
- Understand the difference between "never booked" vs "booked and no-showed"

**Evidence:**
```typescript
// lib/holly-knowledge-base.ts:340-402
if (appointments && appointments.length > 0) {
  // Shows past and upcoming appointments
  // BUT: No explicit rule about not asking if they've already booked
}
```

### 2. **Status Changes Don't Update Holly's Understanding**

**Location:** [app/api/leads/[leadId]/call-outcome/route.ts:310-318](app/api/leads/[leadId]/call-outcome/route.ts#L310-L318)

**Issue:** When a customer no-shows, the lead status changes from `CALL_SCHEDULED` → `NURTURING`, but Holly doesn't understand the context:

```typescript
case "NO_ANSWER":
  // Move to NURTURING - voicemail left, Holly will continue nurturing
  newStatus = "NURTURING";
  actionTaken = "Moved to NURTURING. Holly will continue nurturing schedule.";

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "NURTURING" },
  });
  break;
```

**Result:** Holly treats this as "just another lead in nurturing" rather than "customer booked and no-showed"

### 3. **Double Booking Link Sends**

**Issue:** Jade received TWO booking links within 1 minute:
- Nov 16, 10:16 PM - First booking link
- Nov 16, 10:17 PM - Second booking link

**Likely Cause:** Race condition or safety guardrail not properly preventing duplicate sends

### 4. **No Explicit Context for "Already Booked" Scenario**

**Location:** [lib/claude-decision.ts](lib/claude-decision.ts)

**Issue:** The prompt doesn't have explicit training examples or rules for:
- "Customer booked but hasn't replied to follow-ups" (don't ask if they booked)
- "Customer booked and no-showed" (acknowledge the missed appointment, not ask about booking)
- "Customer has upcoming appointment" (confirm/prepare, don't re-book)

---

## Impact Assessment

### User Experience Issues:
1. **Looks unprofessional** - Holly appears to not know what's happening
2. **Reduces trust** - Customer thinks "doesn't she know I already booked?"
3. **Potentially annoying** - Redundant messages about something already done
4. **Confusing after no-show** - Should acknowledge missed appointment, not ask about booking

### System Issues:
1. **Wasted messages** - SMS costs for redundant follow-ups
2. **Misleading analytics** - Follow-up messages counted as engagement attempts
3. **Status confusion** - Lead status doesn't reflect full appointment history

---

## Recommended Improvements

### Priority 1: Add Appointment Awareness Rules (CRITICAL)

**File:** [lib/claude-decision.ts](lib/claude-decision.ts) or [lib/safety-guardrails.ts](lib/safety-guardrails.ts)

Add explicit logic BEFORE Claude makes a decision:

```typescript
// Check if lead has any appointments (past or upcoming)
const hasUpcomingAppointment = lead.appointments?.some(a =>
  (a.scheduledFor || a.scheduledAt) > new Date() && a.status === 'scheduled'
);

const hasPastAppointment = lead.appointments?.some(a =>
  (a.scheduledFor || a.scheduledAt) < new Date()
);

const hasNoShowAppointment = lead.appointments?.some(a =>
  a.status === 'scheduled' && (a.scheduledFor || a.scheduledAt) < new Date()
);
```

Add to Holly's briefing:

```markdown
## 🚨 APPOINTMENT AWARENESS RULES

${hasUpcomingAppointment ? `
⏰ THIS LEAD HAS AN UPCOMING APPOINTMENT
- DO NOT ask "did you grab a time?" - they already booked!
- DO NOT send another booking link
- FOCUS on confirming the appointment and preparing them
- Example: "Looking forward to your call with Greg on [date]! Make sure you have your property details ready."
` : ''}

${hasPastAppointment && !hasUpcomingAppointment ? `
📅 THIS LEAD HAD AN APPOINTMENT IN THE PAST
${hasNoShowAppointment ? `
⚠️ THEY NO-SHOWED (appointment time passed but no call outcome recorded)
- DO NOT ask "did you grab a time?" - they already booked once!
- ACKNOWLEDGE the missed appointment tactfully
- OFFER to reschedule: "Hey [name]! Looks like we missed each other on [date]. Want to grab another time?"
- Be understanding, not judgmental
` : `
✅ APPOINTMENT ALREADY COMPLETED
- Check callOutcome for details
- Follow up based on what happened in the call
- DO NOT ask them to book again unless advisor specifically requested
`}
` : ''}

${!hasUpcomingAppointment && !hasPastAppointment ? `
📞 NO APPOINTMENTS YET
- You can offer booking link when appropriate
- Look for high-intent signals
- Don't be too pushy
` : ''}
```

### Priority 2: Improve No-Show Handling

**File:** [app/api/leads/[leadId]/call-outcome/route.ts:310-318](app/api/leads/[leadId]/call-outcome/route.ts#L310-L318)

**Current:**
```typescript
case "NO_ANSWER":
  newStatus = "NURTURING";
  actionTaken = "Moved to NURTURING. Holly will continue nurturing schedule.";
```

**Improved:**
```typescript
case "NO_ANSWER":
  // Move to NURTURING but add context for Holly
  newStatus = "NURTURING";
  actionTaken = "Moved to NURTURING. Holly will acknowledge missed call and offer rescheduling.";

  // Add metadata to rawData so Holly knows this is a no-show scenario
  const currentRawData = (lead.rawData as any) || {};
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: "NURTURING",
      rawData: {
        ...currentRawData,
        lastNoShow: {
          appointmentId,
          scheduledFor: appointment?.scheduledFor,
          timestamp: new Date().toISOString(),
          advisorName,
        },
      },
    },
  });

  // Optional: Trigger Holly to send rescheduling message immediately
  try {
    const rescheduleContext = `This lead no-showed their appointment with ${advisorName} on ${appointment?.scheduledFor}.

Your job is to:
1. Tactfully acknowledge the missed appointment (don't be judgmental)
2. Offer to reschedule
3. Make it easy with the booking link

Example: "Hey ${lead.firstName}! Looks like we missed each other on [date]. Life gets busy! Want to grab another time with Greg? [link]"

Be understanding and casual, not formal or guilt-trippy.`;

    const decision = await handleConversation(leadId, undefined, rescheduleContext);
    await executeDecision(leadId, decision);
  } catch (error) {
    console.error('[No-Show] Error sending rescheduling message:', error);
  }
  break;
```

### Priority 3: Prevent Double Booking Link Sends

**File:** [lib/ai-conversation-enhanced.ts](lib/ai-conversation-enhanced.ts) or [lib/safety-guardrails.ts](lib/safety-guardrails.ts)

Add deduplication check in `validateDecision()`:

```typescript
// Check if we sent a booking link recently (within 2 hours)
if (decision.action === 'send_booking_link') {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const recentBookingLink = await prisma.communication.findFirst({
    where: {
      leadId,
      direction: 'OUTBOUND',
      intent: 'booking_link_sent',
      createdAt: { gte: twoHoursAgo },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recentBookingLink) {
    const minutesAgo = Math.floor((Date.now() - recentBookingLink.createdAt.getTime()) / 60000);
    return {
      valid: false,
      reason: `Booking link already sent ${minutesAgo} minutes ago`,
      shouldRetry: false,
    };
  }
}
```

### Priority 4: Add Training Examples for Appointment Scenarios

**File:** [lib/holly-training-examples.ts](lib/holly-training-examples.ts)

Add specific examples:

```typescript
{
  scenario: "Lead booked but hasn't replied to follow-ups",
  leadContext: {
    type: "renewal",
    engagement: "booked_appointment",
    hasUpcomingAppointment: true,
  },
  goodApproach: {
    message: "Hey Sarah! Looking forward to your call with Greg on Wednesday at 2pm. Quick tip - have your current mortgage statement handy so we can pull the best numbers for you!",
    whyItWorks: [
      "Confirms the existing appointment",
      "Provides helpful preparation tips",
      "Shows we're organized and know what's happening",
      "Doesn't ask redundant questions",
    ],
  },
  badApproach: {
    message: "Hey Sarah! Did you get a chance to grab a time with Greg? Let me know!",
    whyItFails: [
      "She already booked - makes us look disorganized",
      "Redundant question damages credibility",
      "Wastes customer's time",
    ],
  },
},
{
  scenario: "Lead no-showed their appointment",
  leadContext: {
    type: "purchase",
    engagement: "no_show",
    hasPastAppointment: true,
    noShow: true,
  },
  goodApproach: {
    message: "Hey Mike! Looks like we missed each other on Tuesday. No worries - life gets busy! Want to grab another time this week? I'll send you the link: [cal.com]",
    whyItWorks: [
      "Acknowledges what happened without being judgmental",
      "Shows understanding ('life gets busy')",
      "Makes it easy to reschedule",
      "Casual and friendly tone",
    ],
  },
  badApproach: {
    message: "Hey Mike! Did you get a chance to book a time with Greg?",
    whyItFails: [
      "He already booked and no-showed - shows we're not paying attention",
      "Doesn't acknowledge the missed appointment",
      "Feels robotic and disconnected",
    ],
  },
},
```

### Priority 5: Update Safety Guardrails

**File:** [lib/safety-guardrails.ts](lib/safety-guardrails.ts)

Add new validation rule:

```typescript
// Rule 6: Don't ask about booking if appointment exists
if (decision.message.toLowerCase().includes('grab a time') ||
    decision.message.toLowerCase().includes('book a time') ||
    decision.message.toLowerCase().includes('did you book')) {

  const hasAnyAppointment = lead.appointments && lead.appointments.length > 0;

  if (hasAnyAppointment) {
    return {
      valid: false,
      reason: "Lead already has/had an appointment - don't ask if they booked",
      shouldRetry: true, // Let Claude try again with different message
      suggestion: "Acknowledge their existing appointment or offer to reschedule if they no-showed",
    };
  }
}
```

---

## Implementation Priority

### Phase 1 - Immediate Fixes (This Week)
1. ✅ Add appointment awareness rules to Holly's prompt
2. ✅ Add safety guardrail to prevent asking about booking when appointment exists
3. ✅ Add deduplication check for booking link sends

### Phase 2 - Enhanced No-Show Handling (Next Week)
4. ⏳ Improve NO_ANSWER case to add context and trigger rescheduling message
5. ⏳ Add training examples for appointment scenarios

### Phase 3 - Long-Term Improvements (Future)
6. ⏳ Track appointment outcomes more granularly (no-show vs cancelled vs completed)
7. ⏳ Add analytics dashboard for appointment conversion and no-show rates
8. ⏳ Consider SMS reminder system 24h before appointments

---

## Testing Plan

### Test Case 1: Lead with Upcoming Appointment
- **Setup:** Create appointment for tomorrow
- **Expected:** Holly confirms appointment, doesn't ask if they booked
- **Actual:** TBD

### Test Case 2: Lead with Past No-Show
- **Setup:** Create past appointment, no call outcome
- **Expected:** Holly acknowledges missed appointment, offers to reschedule
- **Actual:** TBD

### Test Case 3: Rapid Booking Link Sends
- **Setup:** Trigger booking link send twice in quick succession
- **Expected:** Second send blocked with deduplication message
- **Actual:** TBD

### Test Case 4: Lead Books After Follow-Up
- **Setup:** Send booking link, customer books, send another message
- **Expected:** Follow-up message doesn't ask if they booked
- **Actual:** TBD

---

## Files to Modify

1. **[lib/claude-decision.ts](lib/claude-decision.ts)** - Add appointment awareness rules to prompt
2. **[lib/holly-knowledge-base.ts](lib/holly-knowledge-base.ts)** - Enhance appointment briefing section
3. **[lib/safety-guardrails.ts](lib/safety-guardrails.ts)** - Add validation rules
4. **[app/api/leads/[leadId]/call-outcome/route.ts](app/api/leads/[leadId]/call-outcome/route.ts)** - Improve NO_ANSWER handling
5. **[lib/holly-training-examples.ts](lib/holly-training-examples.ts)** - Add appointment scenario examples
6. **[lib/ai-conversation-enhanced.ts](lib/ai-conversation-enhanced.ts)** - Add deduplication checks

---

## Success Metrics

### Before Improvements (Current State - Jade Lozinski Example):
- ❌ 2 redundant "did you book?" messages sent after booking
- ❌ 0% appointment awareness in follow-ups
- ❌ No acknowledgment of no-show

### After Improvements (Target):
- ✅ 0 redundant "did you book?" messages after booking
- ✅ 100% appointment awareness in follow-ups
- ✅ Proper no-show acknowledgment and rescheduling offers
- ✅ <1% duplicate booking link sends
- ✅ Higher trust and professionalism scores in customer perception

---

## Related Documentation

- [HOLLY_BOOKING_RECOGNITION_ANALYSIS.md](HOLLY_BOOKING_RECOGNITION_ANALYSIS.md) - Complete technical analysis
- [BOOKING_INVESTIGATION_SUMMARY.md](BOOKING_INVESTIGATION_SUMMARY.md) - 3-stage booking system overview
- [HOLLY_BOOKING_QUICK_REFERENCE.md](HOLLY_BOOKING_QUICK_REFERENCE.md) - Developer quick reference

---

## Questions for Discussion

1. **No-Show Behavior:** Should Holly automatically send rescheduling message after no-show, or wait for next automation cycle?
2. **Appointment Status:** Should we add "no_show" status to Appointment model, or just rely on call outcomes?
3. **Time Window:** How long after booking link send should we prevent duplicate sends? (Currently proposing 2 hours)
4. **Analytics:** What metrics should we track to measure improvement in booking recognition?

---

**Next Steps:** Review recommendations with team, prioritize Phase 1 improvements, begin implementation.
