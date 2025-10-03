# MVP Setup - Automated Lead Conversion System

**Goal**: Get leads from webhook → fully automated nurture → discovery call booked with ZERO human intervention.

## The Automated Flow

```
New Lead (Webhook)
    ↓
Immediate: Welcome Email
    ↓
24h: SMS + Status → CONTACTED
    ↓
48h: Voice AI Call (can book appointment on call!)
    ↓
72h: Reminder Email
    ↓
Cal.com Booking → Status → CALL_SCHEDULED
    ↓
24h before: Call Reminder Email
    ↓
Discovery Call Happens → CONVERTED
```

## Minimal Setup (What You Actually Need)

### 1. Database (Already Done ✅)
- Prisma Postgres is running locally
- Automation rules are seeded

### 2. Email (Essential - Free Tier)
**Resend.com** - 3,000 emails/month free

1. Sign up: https://resend.com/signup
2. Verify your email domain (or use their test domain for now)
3. Get API key from dashboard
4. Add to `.env`:
```bash
RESEND_API_KEY="re_..."
FROM_EMAIL="onboarding@resend.dev"  # Test domain
```

### 3. SMS (Essential - Pay as you go)
**Twilio** - ~$0.0079/SMS

1. Sign up: https://www.twilio.com/try-twilio
2. Get a Canadian phone number (+1)
3. Get credentials from console
4. Add to `.env`:
```bash
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+14165551234"
```

### 4. Voice AI (Essential - ~$0.10/min)
**Vapi.ai** - AI calls that can book appointments

1. Sign up: https://vapi.ai
2. Get API key
3. Create assistant (or use our script)
4. Add to `.env`:
```bash
VAPI_API_KEY="..."
VAPI_ASSISTANT_ID="..."
```

### 5. Cal.com (Essential - Free)
**Cal.com** - Scheduling

1. Sign up: https://cal.com
2. Create event type: "Discovery Call - 30min"
3. Get API key: Settings → API Keys
4. Add to `.env`:
```bash
CALCOM_API_KEY="cal_live_..."
CALCOM_EVENT_TYPE_ID="123456"
```

### 6. Webhook Secret
Generate a secret for webhook verification:
```bash
openssl rand -base64 32
```

Add to `.env`:
```bash
WEBHOOK_SECRET="your-generated-secret"
CRON_SECRET="another-secret"
```

## Environment Setup

Your `.env` should look like:
```bash
# Database (already working)
DATABASE_URL="prisma+postgres://localhost:51213/..."

# Webhooks
WEBHOOK_SECRET="your-secret"
CRON_SECRET="your-cron-secret"

# Email (Resend)
RESEND_API_KEY="re_..."
FROM_EMAIL="onboarding@resend.dev"

# SMS (Twilio)
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+14165551234"

# Voice AI (Vapi)
VAPI_API_KEY="..."
VAPI_ASSISTANT_ID="..."

# Cal.com
CALCOM_API_KEY="cal_live_..."
CALCOM_EVENT_TYPE_ID="123456"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3001"
```

## Test the Full Flow

### 1. Send a Test Lead
```bash
curl -X POST http://localhost:3001/api/webhooks/leads \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: your-secret" \
  -d '{
    "email": "test@example.com",
    "phone": "+14165551234",
    "firstName": "Test",
    "lastName": "User",
    "consentEmail": true,
    "consentSms": true,
    "consentCall": true
  }'
```

### 2. Check Dashboard
- Open http://localhost:3001/dashboard
- You should see the lead in "New Lead"
- Check the activity timeline

### 3. Manual Test Communications

**Test Email:**
```bash
curl -X POST http://localhost:3001/api/communications/email \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "your-lead-id",
    "subject": "Test Email",
    "htmlBody": "<p>Hello {{firstName}}!</p>",
    "variables": {"firstName": "Test"}
  }'
```

**Test SMS:**
```bash
curl -X POST http://localhost:3001/api/communications/sms \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "your-lead-id",
    "body": "Hi {{firstName}}, this is a test!",
    "variables": {"firstName": "Test"}
  }'
```

**Test Voice AI:**
```bash
curl -X POST http://localhost:3001/api/communications/voice \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "your-lead-id"
  }'
```

## Activate Automations

The automation rules are in the database, but they need to run on a schedule.

**For Local Testing:**
Run the automation processor manually:
```bash
curl http://localhost:3001/api/cron/automations
```

**For Production:**
Set up cron jobs (Vercel does this automatically with `vercel.json`).

## What Happens Automatically

1. **Lead comes in** → Welcome email sent immediately
2. **After 24h (no booking)** → SMS sent, status → CONTACTED
3. **After 48h (no booking)** → AI calls them, can book on the call
4. **After 72h (no booking)** → Reminder email
5. **Booking happens** → Status → CALL_SCHEDULED
6. **24h before call** → Reminder email
7. **Call happens** → Mark as CONVERTED

## Keep It Lean - What NOT to Add Yet

❌ Admin UI for automation rules (use database directly)
❌ Analytics dashboard (check database)
❌ Team management (single user for MVP)
❌ Custom fields (use metadata JSON)
❌ Lead scoring (focus on conversion)
❌ A/B testing (optimize later)

## Production Deployment (When Ready)

1. **Database**: Use Vercel Postgres (Canadian region)
2. **Deploy**: Push to GitHub → Import to Vercel
3. **Env Vars**: Add all `.env` variables in Vercel dashboard
4. **Cron Jobs**: Already configured in `vercel.json`
5. **Domain**: Point your domain to Vercel
6. **Webhooks**: Update webhook URLs to production domain

## Success Metrics

Track these manually in the database:
- Lead → CALL_SCHEDULED conversion %
- Average time to first contact
- Call scheduled → Converted %

## Cost Estimate (100 leads/month)

- Email: $0 (free tier)
- SMS: ~$0.79 (100 SMS)
- Voice AI: ~$10 (100 calls × 1 min × $0.10)
- Cal.com: $0 (free)
- Vercel: $20 (Hobby tier)
- Database: $0 (included)

**Total: ~$31/month** for 100 leads

## Next Steps

1. ✅ Get API keys (Resend, Twilio, Vapi, Cal.com)
2. ✅ Add to `.env`
3. ✅ Test each communication channel
4. ✅ Test full automation flow
5. ✅ Deploy to production
6. ✅ Connect real lead source

**That's it! Keep it simple. No extra features until this works perfectly.**
