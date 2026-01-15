# Holly Booking Recognition - Quick Reference Guide

## The 3-Stage Booking Recognition System

### Stage 1: Holly DECIDES to Send Booking Link
**File:** `/lib/claude-decision.ts` (Lines 31-760)
**When:** Claude detects high-intent signals like "What time?" or "When can we talk?"

```
Lead Reply Detection (behavioral-intelligence.ts):
  "What time?" / "When can we talk?" / "How soon?"
  ↓
Claude Sonnet 4.5 Decision:
  action: "send_booking_link"
  message: "Perfect! Greg has openings today at 2pm and 4pm PT"
  confidence: "high"
  ↓
Guardrails Validation (safety-guardrails.ts):
  ✓ Not opted out
  ✓ Not in prohibited status
  ✓ Within SMS hours (8am-9pm)
  ✓ Not double-booking
  ✓ Not promising specific times
  ↓
Holly Executes (ai-conversation-enhanced.ts):
  1. Append Cal.com URL to message
  2. Send SMS via Twilio
  3. Log communication with intent="booking_link_sent"
  4. Start 4-hour outcome tracking
```

---

### Stage 2: Lead BOOKS Through Cal.com
**File:** `/app/api/webhooks/calcom/route.ts` (Lines 62-241)
**Trigger:** User clicks link and completes booking in Cal.com

```
Cal.com Webhook Event (triggerEvent: "BOOKING_CREATED")
  ↓
Find Lead by Email/Phone:
  email: attendeeEmail
  phone: attendeePhone (last 10 digits match)
  ↓
Check Prohibited Statuses:
  ✓ NOT in [LOST, CONVERTED, DEALS_WON]
  ✓ Not blocked - proceed
  ↓
Create Appointment Record:
  leadId: lead.id
  calComBookingUid: uid
  scheduledAt: new Date(startTime)
  status: "scheduled"
  ↓
Update Lead Status:
  Lead.status = "CALL_SCHEDULED"
  ↓
Log Activity:
  type: APPOINTMENT_BOOKED
  content: "Discovery call scheduled for [date]"
  ↓
Send Alerts:
  - Slack notification (type: "call_booked")
  - Optional Holly confirmation SMS
```

---

### Stage 3: Holly TRACKS Outcome
**File:** `/lib/conversation-outcome-tracker.ts` (Lines 21-146)
**Timeline:** 4 hours after sending booking link

```
After 4-Hour Window:
  Check: Lead.appointments.length > 0?
    
  YES → Booking Confirmed!
    ConversationOutcome.outcome = "BOOKED"
    ConversationOutcome.booked = true
    Store in LEARNED_EXAMPLES
    
  NO → Lead Didn't Book
    Check for inbound message:
      - "stop" → OPTED_OUT
      - "not interested" → ENGAGED (negative)
      - "yes" / "?" → ENGAGED (positive)
      - silence → GHOSTED
```

---

## Critical Database Fields

| Model | Field | Meaning |
|-------|-------|---------|
| **Lead** | `status` | Should be `CALL_SCHEDULED` after booking |
| **Lead** | `lastContactedAt` | When Holly last messaged |
| **Lead** | `applications` | All scheduled calls with this lead |
| **Appointment** | `calComBookingUid` | Unique Cal.com ID for this booking |
| **Appointment** | `scheduledFor` | When the call is scheduled |
| **Appointment** | `status` | "scheduled", "confirmed", "cancelled" |
| **Communication** | `intent` | "booking_link_sent" flag |
| **ConversationOutcome** | `booked` | `true` if they actually booked |

---

## The 5 Ways Booking Detection Can FAIL

### ❌ Failure 1: Orphan Booking (No Lead Found)
**Cause:** Lead not in database or email/phone mismatch
**Fix:** Check Cal.com webhook payload, verify email/phone normalization
**Alert:** Slack notification + WebhookEvent.BOOKING_CREATED_ORPHAN created

### ❌ Failure 2: Prohibited Status Block
**Cause:** Lead in LOST/CONVERTED/DEALS_WON status, booking blocked
**Fix:** Contact lead was already completed - booking attempt rejected intentionally
**Alert:** Slack notification + LeadActivity note created

### ❌ Failure 3: Double-Booking Attempt
**Cause:** Holly tries to send booking link when appointment already exists
**Fix:** Safety guardrail blocks this decision automatically
**Prevention:** `validateDecision()` checks `lead.appointments.length > 0`

### ❌ Failure 4: Time-Sensitive Rejection
**Cause:** Holly tries to send outside 8am-9pm local time
**Fix:** Message not sent, scheduled for next 8am in lead's timezone
**Prevention:** `validateDecision()` checks local hour

### ❌ Failure 5: Temporal Logic Bug (Derek Wynne)
**Cause:** Holly responds to stale "tonight" with future "tonight"
**Fix:** Check message timestamp, not current system time
**Critical Rule:** When lead says "tonight" on Oct 31, interpret relative to Oct 31, not Nov 1

---

## Quick Debugging Checklist

```
Lead said "Yes, let's book!" but system doesn't recognize booking?

[ ] 1. Check: SELECT * FROM "Appointment" WHERE "leadId" = ?
      ✓ Appointment created with calComBookingUid?
      ✓ scheduledAt within last hour?

[ ] 2. Check: SELECT status FROM "Lead" WHERE id = ?
      ✓ Status = "CALL_SCHEDULED"?
      ✓ Not LOST/CONVERTED/DEALS_WON?

[ ] 3. Check: SELECT * FROM "WebhookEvent" WHERE source = 'cal_com'
      ✓ eventType = "BOOKING_CREATED" exists?
      ✓ processed = true?
      ✓ error = null?

[ ] 4. Check: SELECT * FROM "LeadActivity" WHERE leadId = ?
      ✓ type = "APPOINTMENT_BOOKED" present?
      ✓ Recent timestamp?

[ ] 5. Check: SELECT * FROM "ConversationOutcome" WHERE leadId = ?
      ✓ booked = true?
      ✓ outcome = "BOOKED"?
      ✓ Created within last 4 hours?

[ ] 6. Check: Cal.com admin panel
      ✓ Booking exists in Cal.com?
      ✓ Webhook configured correctly?
      ✓ Event firing in Cal.com logs?
```

---

## The Claude Decision Flow (Simplified)

```
STEP 1: Context
  - Get last 8 messages
  - Calculate lead temperature (hot/warm/cool/cold)
  - Analyze last message tone

STEP 2: 6-Layer Training
  1. Lead journey context
  2. Behavioral intelligence (detect signals)
  3. Sales psychology frameworks
  4. Training examples (how others handled similar)
  5. Learned examples (what worked last 7 days)
  6. Extended thinking (step-by-step reasoning)

STEP 3: Decision Task
  - Evaluate: Is this lead ready to book?
  - Check: What's their temperature?
  - Decide: send_sms vs send_booking_link vs wait vs escalate

STEP 4: Safety Checks
  - Opted out? BLOCK
  - In prohibited status? BLOCK
  - Outside SMS hours? RESCHEDULE
  - Already has appointment? BLOCK
  - Message promises specific time? BLOCK

STEP 5: Execute
  - If "send_booking_link": Append URL, send SMS
  - Track outcome for 4 hours
  - Update lead status if needed
```

---

## High-Intent Signals (Booking Ready!)

Holly looks for these exact phrases:

```
"What time?"
"When can we talk?"
"How soon?"
"When works?"
"What do I need?"
"Call me"
"Available today"
"ASAP"
"What's the next step?"
```

When detected → Holly sends booking link immediately with `confidence: "high"`

---

## Stage Progression for Successful Booking

```
NEW
  ↓ (Holly sends first message)
CONTACTED
  ↓ (Lead replies)
ENGAGED
  ↓ (Holly detects high-intent booking signal)
CALL_SCHEDULED ← BOOKING CONFIRMED HERE
  ↓ (Call happens)
WAITING_FOR_APPLICATION
  ↓ (Lead starts mortgage application)
APPLICATION_STARTED (Finmo takes over)
  ↓ (Finmo system handles all communication)
CONVERTED
  ↓ (Application approved)
DEALS_WON
```

**Key:** Status changes to `CALL_SCHEDULED` the moment Cal.com webhook is processed

---

## Environment Variables

```bash
CAL_COM_BOOKING_URL = "https://cal.com/gregeditor"
  → This URL is automatically appended to booking link SMS

ANTHROPIC_API_KEY
  → Required for Claude Sonnet 4.5 decisions

DATABASE_URL
  → PostgreSQL connection for Lead/Appointment records

ENABLE_AUTONOMOUS_AGENT = "true"
  → Must be true for Holly to function

TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN
  → Required to send SMS messages
```

---

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/webhooks/calcom` | Cal.com booking confirmation |
| `POST /api/webhooks/twilio` | Incoming SMS from lead |
| `POST /api/inngest` | Job queue for autonomous processing |
| `GET /api/leads/[leadId]` | Get lead details |
| `POST /api/leads/[leadId]/call-outcome` | Log call results |

---

## Slack Alerts

Holly sends Slack notifications for:

```
✅ call_booked
   "Scheduled for Nov 19, 2:30pm PT"
   
🚨 lead_escalated
   "Orphan booking for unknown lead"
   "LOST lead tried to book - manual review needed"
   
⚠️ lead_rotting
   "Appointment cancelled - Holly re-engaging"
```

---

## Real-World Example: Derek's Booking Flow

```
Oct 31, 3:15 PM - Derek texts: "What time works?"
  → Holly DETECTS high-intent signal
  → Decides: send_booking_link
  → Sends: "Perfect! Greg has 2pm & 4pm today. Here's the link..."

Oct 31, 3:45 PM - Derek clicks Cal.com link
  → Opens Cal.com calendar

Oct 31, 3:50 PM - Derek selects "2pm PT" slot
  → Cal.com processes booking

Oct 31, 3:51 PM - Cal.com webhook fires
  → findLeadByPhone("Derek's phone") → ✓ Found
  → checkProhibitedStatus() → ✓ Not prohibited
  → createAppointment() → ✓ Created
  → updateLead({ status: "CALL_SCHEDULED" }) → ✓ Updated
  → sendSlackNotification() → ✓ Alert sent

Nov 1, 12:00 AM - 4-hour outcome tracking runs
  → Check: lead.appointments.length > 0?
  → YES! → ConversationOutcome.booked = true
  → Outcome recorded: "BOOKED"
  → Added to LEARNED_EXAMPLES
```

---

## Key Takeaway

Holly uses a **sophisticated three-stage system**:

1. **Claude AI decides** if lead is booking-ready (using behavioral signals)
2. **Cal.com webhook confirms** the actual booking (external system)
3. **Outcome tracking** learns from the success (improves future decisions)

Each stage has **multiple safety guardrails** to prevent errors like:
- Double-booking
- Messaging prohibited statuses
- Sending outside allowed hours
- Promising specific times manually

The system is **designed for reliability and continuous improvement**.

