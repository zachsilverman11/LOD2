# Email Integration Plan for Inspired Mortgage

## Current State Analysis

### ✅ Already Built
- **SendGrid Integration**: Email sending via SendGrid API in `lib/email.ts`
- **Email Templates**: Welcome, Schedule Call, Call Reminder, Follow-up templates
- **Database Schema**: `Communication` table supports EMAIL channel
- **Consent Tracking**: `consentEmail` field on Lead model
- **Error Monitoring**: Slack alerts for all critical failures

### 🚧 Not Yet Integrated
- Email **not** part of AI conversation decision-making
- Email **not** part of automation engine follow-up sequences
- No multi-channel orchestration (SMS + Email together)
- No email-specific AI prompts or strategies

---

## Integration Strategy: Multi-Channel AI-Driven Communication

### Core Principle
**Treat email as a complementary channel to SMS, not a replacement.**

SMS = Fast, personal, conversational (ideal for hot leads)
Email = Detailed, professional, reference material (ideal for nurturing, booking links, documentation)

---

## Phase 1: AI Multi-Channel Decision Making (2-3 hours)

### 1.1 Update AI Decision Interface
**File**: `lib/ai-conversation-enhanced.ts`

```typescript
interface AIDecision {
  action:
    | "send_sms"
    | "send_email"              // NEW
    | "send_both"               // NEW - SMS + Email together
    | "schedule_followup"
    | "send_booking_link"
    | "escalate"
    | "do_nothing"
    | "move_stage";
  message?: string;
  emailSubject?: string;        // NEW
  emailBody?: string;           // NEW
  followupHours?: number;
  channel?: "SMS" | "EMAIL" | "BOTH"; // NEW
  newStage?: string;
  reasoning: string;
}
```

### 1.2 Add Email Tool to AI
**File**: `lib/ai-conversation-enhanced.ts` - Add new tool definition

```typescript
{
  type: "function",
  function: {
    name: "send_email",
    description: "Send a professional email to the lead with detailed information",
    parameters: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Email subject line - should be personal and compelling"
        },
        body: {
          type: "string",
          description: "Email body in HTML format - can be longer and more detailed than SMS"
        },
        reasoning: {
          type: "string",
          description: "Why email is the right channel for this message"
        }
      },
      required: ["subject", "body", "reasoning"]
    }
  }
}
```

### 1.3 Add Multi-Channel Tool
```typescript
{
  type: "function",
  function: {
    name: "send_both",
    description: "Send coordinated SMS + Email together for maximum impact",
    parameters: {
      type: "object",
      properties: {
        smsMessage: {
          type: "string",
          description: "Short, attention-grabbing SMS (under 160 chars)"
        },
        emailSubject: {
          type: "string",
          description: "Email subject line"
        },
        emailBody: {
          type: "string",
          description: "Detailed email body with full context and next steps"
        },
        reasoning: {
          type: "string",
          description: "Why both channels are needed for this situation"
        }
      },
      required: ["smsMessage", "emailSubject", "emailBody", "reasoning"]
    }
  }
}
```

### 1.4 Update AI System Prompt
**File**: `lib/ai-conversation-enhanced.ts` - Add channel strategy section

```
# 📱💬 CHANNEL STRATEGY

## When to Use SMS vs Email vs Both

**SMS ONLY** (Most common - 80% of touches):
- Quick check-ins and follow-ups
- Urgent time-sensitive messages
- Conversational back-and-forth
- Short questions
- First 3 touches (build rapport fast)

**EMAIL ONLY** (Professional documentation - 10% of touches):
- Detailed program explanations
- Document requests/delivery
- Long-form content (rate comparisons, process breakdowns)
- When lead hasn't responded to SMS in 5+ days (they may prefer email)

**BOTH SMS + EMAIL** (High-impact moments - 10% of touches):
- Initial contact (SMS: "Hey! Just sent you an email..." + Email: Full intro)
- Booking link delivery (SMS: Quick CTA + Email: Full calendar link + meeting prep)
- Important milestone updates
- Post-call follow-up with action items

## Email Writing Guidelines
- Subject: Personal, benefit-driven, under 50 chars
- Body: Use HTML formatting (headings, lists, bold)
- Include clear CTA button or link
- Sign as "Holly from Inspired Mortgage"
- Keep under 300 words (people skim)
- Always include Cal.com link if mentioning booking
```

### 1.5 Update executeDecision Function
**File**: `lib/ai-conversation-enhanced.ts`

```typescript
case "send_email":
  if (decision.emailSubject && decision.emailBody) {
    try {
      await sendEmail({
        to: lead.email,
        subject: decision.emailSubject,
        html: decision.emailBody,
        replyTo: process.env.REPLY_TO_EMAIL || "holly@inspiredmortgage.ca",
      });

      await prisma.communication.create({
        data: {
          leadId,
          channel: "EMAIL",
          direction: "OUTBOUND",
          subject: decision.emailSubject,
          content: decision.emailBody,
          metadata: { aiReasoning: decision.reasoning },
        },
      });

      await prisma.lead.update({
        where: { id: leadId },
        data: { lastContactedAt: new Date() },
      });
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
  // Send SMS first (immediate attention)
  // Then email (detailed follow-up)
  // Store both in communications table
  break;
```

---

## Phase 2: Update Automation Engine (1-2 hours)

### 2.1 Multi-Channel Follow-Up Strategy
**File**: `lib/automation-engine.ts` - Update `processSmartFollowUps()`

**New Follow-Up Cadence with Email:**

```typescript
// 🔥 FIRST 48 HOURS: SMS ONLY (Strike while hot)
Day 0, Hour 0:  SMS - Holly introduction + primary offer
Day 0, Hour 1:  SMS - Quick follow-up
Day 0, Hour 4:  SMS - Different angle
Day 0, Hour 12: SMS + EMAIL - Comprehensive intro email with program details

// 📅 DAY 2-7: SMS + Strategic Email
Day 2:  SMS - Morning check-in
Day 3:  EMAIL - Detailed program breakdown (if no response)
Day 5:  SMS - Question about timeline
Day 7:  SMS + EMAIL - Week-end recap + booking link

// 📅 WEEK 2+: Email-heavy nurture
Week 2: EMAIL - Educational content (rate trends, tips)
Week 3: SMS - Quick check-in
Week 4: EMAIL - Case study / success story
Week 5: SMS - "Thinking of you" touch
Week 6: EMAIL - Offer to answer questions
Week 8: SMS + EMAIL - Final push before archive
```

### 2.2 Add Email Intelligence to AI Context
**When building lead context, include:**
- Email open rates (if using SendGrid webhooks)
- Email vs SMS response preference
- Best-performing channel for this lead

---

## Phase 3: Email Templates & Branding (1 hour)

### 3.1 Create Inspired Mortgage Email Template
**File**: `lib/email-templates.ts` (new file)

```typescript
export function getEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #625FFF 0%, #B1AFFF 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .header .tagline { color: #FBF3E7; font-style: italic; }
        .content { background: white; padding: 30px; }
        .cta-button { display: inline-block; background: #625FFF; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #55514D; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1><span class="tagline">inspired</span> <strong>mortgage.</strong></h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>Holly from Inspired Mortgage<br>
          <a href="mailto:holly@inspiredmortgage.ca">holly@inspiredmortgage.ca</a></p>
          <p style="margin-top: 20px; font-size: 11px; color: #999;">
            You received this email because you inquired about mortgage services.<br>
            <a href="{{{unsubscribe_url}}}">Unsubscribe</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
```

### 3.2 AI-Generated Email Content Types

**Initial Contact Email:**
```
Subject: Hey [Name]! Your [Loan Type] inquiry - programs available

Body:
- Personal greeting from Holly
- Acknowledge specific inquiry (purchase/refi/renewal)
- Mention 1-2 programs that match their situation
- Include loan amount/property type details from form
- CTA: Book 15-min call or reply with questions
- Include Cal.com link
```

**Nurture Email (No Response):**
```
Subject: [Name], still looking at [Property Type] in [City]?

Body:
- Acknowledge it's been X days since inquiry
- "No pressure, just checking in"
- Share quick tip relevant to their situation
- Reiterate you're here to help when ready
- Soft CTA: "Reply to this email anytime"
```

**Booking Link Email:**
```
Subject: Let's talk - here's my calendar

Body:
- "You asked about booking a call..."
- Big CTA button with Cal.com link
- What to expect on the call (bullet points)
- Who they'll speak with (Greg or Jakub)
- "No prep needed - just bring your questions"
```

---

## Phase 4: Inbound Email Handling (Optional - Future)

### 4.1 SendGrid Inbound Parse Webhook
- Configure SendGrid inbound parse for `holly@inspiredmortgage.ca`
- Create `/api/webhooks/sendgrid-inbound` endpoint
- Extract email body, match to lead by email address
- Feed into AI conversation handler (same as SMS)
- AI can decide to reply via email or SMS

### 4.2 Email Thread Tracking
- Store email thread IDs in metadata
- Keep conversation context across email threads
- Show full email/SMS timeline in lead detail modal

---

## Phase 5: Testing & Optimization (1 hour)

### 5.1 Test Scenarios
1. **New Lead**: Should get SMS + Email within first 24 hours
2. **Email-Only Responder**: If they reply to email but not SMS, switch to email-heavy
3. **SMS-Only Responder**: If they reply to SMS but not email, stick to SMS
4. **No Response**: Escalate to email after 5 SMS with no reply
5. **Booking Link**: Always send both SMS (quick) + Email (full details)

### 5.2 A/B Testing Ideas
- SMS-only vs SMS+Email for initial contact
- Short emails vs detailed emails
- Email subject line variations
- Send time optimization (9am vs 2pm vs 7pm)

---

## Environment Variables Needed

```bash
# Already configured
SENDGRID_API_KEY=xxx
FROM_EMAIL=holly@inspiredmortgage.ca
REPLY_TO_EMAIL=holly@inspiredmortgage.ca

# New (optional)
SENDGRID_WEBHOOK_SECRET=xxx  # For open/click tracking
EMAIL_FOOTER_UNSUBSCRIBE_URL=https://lod2.vercel.app/unsubscribe
```

---

## Success Metrics to Track (Add to Analytics)

### Email-Specific Metrics
- **Email Delivery Rate**: % of emails successfully delivered
- **Email Open Rate**: % of delivered emails opened (if tracking)
- **Email Click Rate**: % of emails with link clicks
- **Email Response Rate**: % of emails that got replies
- **Channel Preference**: SMS responders vs Email responders
- **Multi-Channel Effectiveness**: Conversion rate of SMS-only vs Email-only vs Both

### Add to Analytics Dashboard
```typescript
// New endpoint: /api/analytics/channel-performance
{
  smsMetrics: {
    sent: 150,
    delivered: 148,
    replied: 42,
    responseRate: 28.4%
  },
  emailMetrics: {
    sent: 75,
    delivered: 73,
    opened: 45,
    clicked: 12,
    replied: 8,
    openRate: 61.6%,
    clickRate: 16.4%,
    responseRate: 11.0%
  },
  multiChannel: {
    bothSent: 25,
    replied: 12,
    responseRate: 48.0%  // Higher than either alone!
  }
}
```

---

## Implementation Order (Recommended)

### Week 1: Core Integration
1. ✅ Add email tools to AI (`send_email`, `send_both`)
2. ✅ Update AI prompt with channel strategy
3. ✅ Implement `executeDecision` email cases
4. ✅ Test with sandbox leads

### Week 2: Automation Integration
5. ✅ Update automation engine with multi-channel cadence
6. ✅ Add email to follow-up sequences (Day 1, Day 3, Day 7, etc.)
7. ✅ Test full automation flow

### Week 3: Polish & Analytics
8. ✅ Create branded email template
9. ✅ Add email metrics to analytics dashboard
10. ✅ Monitor performance, optimize based on data

### Future Enhancements
- Inbound email handling via SendGrid parse
- Email open/click tracking
- A/B testing framework
- Dynamic content personalization

---

## Key Design Decisions

### Why Not Email-Heavy from Start?
**SMS is faster for conversion in first 48 hours.**
- Lead inquiries are hot - they want immediate response
- SMS open rate: 98% within 3 minutes
- Email open rate: 20-30% within 24 hours
- First to respond wins the deal

**Email becomes powerful for:**
- Leads who don't respond to SMS (channel preference)
- Detailed explanations (programs, rates, process)
- Professional documentation and bookings
- Long-term nurture (weeks 2-8)

### Multi-Channel Orchestration Strategy
- **SMS leads, Email reinforces**
- Never duplicate exact message on both channels
- SMS: "Hey! Just sent you an email with details about..."
- Email: Full breakdown of what was teased in SMS
- Creates curiosity loop = higher engagement

### Respecting Consent
- Only send email if `consentEmail === true`
- Include unsubscribe link in every email footer
- Track opt-outs in both channels separately
- AI should check consent before choosing channel

---

## Estimated Implementation Time

**Phase 1 (AI Multi-Channel)**: 2-3 hours
**Phase 2 (Automation Engine)**: 1-2 hours
**Phase 3 (Email Templates)**: 1 hour
**Phase 4 (Inbound Email)**: 3-4 hours (optional, later)
**Phase 5 (Testing)**: 1 hour

**Total**: ~6-8 hours for core integration

---

## Ready to Start?

Recommended starting point:
1. Update `AIDecision` interface in `lib/ai-conversation-enhanced.ts`
2. Add `send_email` and `send_both` tools to AI
3. Update system prompt with channel strategy
4. Implement `executeDecision` cases for email
5. Test with 1-2 sandbox leads before deploying

Let me know when you want to proceed! 🚀
