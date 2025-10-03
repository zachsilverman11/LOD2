# Setup Guide

Step-by-step guide to get your Lead Conversion System up and running.

## 1. Database Setup

### Option A: Vercel Postgres (Easiest)

1. Go to your Vercel project
2. Navigate to Storage tab
3. Create a new Postgres database
4. Copy the `DATABASE_URL` to your `.env.local`

### Option B: Local PostgreSQL

1. Install PostgreSQL:
```bash
# macOS
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt-get install postgresql
sudo service postgresql start
```

2. Create database:
```bash
createdb lod2
```

3. Add to `.env.local`:
```
DATABASE_URL="postgresql://localhost:5432/lod2?schema=public"
```

### Initialize Database

```bash
npx prisma generate
npx prisma db push
```

## 2. Cal.com Setup

1. Create account at [cal.com](https://cal.com)
2. Go to Settings → API Keys → Create New API Key
3. Create an Event Type (e.g., "Discovery Call - 30 min")
4. Get the Event Type ID from the URL: `cal.com/event-types/[ID]`
5. Add to `.env.local`:
```
CALCOM_API_KEY="cal_live_..."
CALCOM_EVENT_TYPE_ID="123456"
```

6. Configure webhook in Cal.com:
   - Go to Settings → Webhooks
   - Add webhook: `https://yourdomain.com/api/webhooks/calcom`
   - Select events: BOOKING_CREATED, BOOKING_RESCHEDULED, BOOKING_CANCELLED

## 3. Email Setup (Resend)

1. Create account at [resend.com](https://resend.com)
2. Verify your domain
3. Create API key
4. Add to `.env.local`:
```
RESEND_API_KEY="re_..."
FROM_EMAIL="noreply@yourdomain.com"
```

## 4. SMS Setup (Twilio)

1. Create account at [twilio.com](https://twilio.com)
2. Buy a Canadian phone number (+1 area code)
3. Get Account SID and Auth Token from console
4. Add to `.env.local`:
```
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+14165551234"
```

5. Configure incoming SMS webhook:
   - Go to Phone Numbers → Active Numbers
   - Click your number
   - Under Messaging, set webhook URL:
     - `https://yourdomain.com/api/webhooks/twilio`
     - Method: HTTP POST

## 5. Voice AI Setup (Vapi.ai)

1. Create account at [vapi.ai](https://vapi.ai)
2. Get API key from dashboard
3. Create assistant (or use the setup script):

```typescript
// scripts/setup-vapi.ts
import { createVapiAssistant } from "./lib/voice-ai";

async function setup() {
  const assistant = await createVapiAssistant();
  console.log("Vapi Assistant created!");
  console.log("Assistant ID:", assistant.id);
  console.log("Add this to your .env.local:");
  console.log(`VAPI_ASSISTANT_ID="${assistant.id}"`);
}

setup();
```

Run it:
```bash
npx tsx scripts/setup-vapi.ts
```

4. Add to `.env.local`:
```
VAPI_API_KEY="..."
VAPI_ASSISTANT_ID="..."
```

5. Configure webhook in Vapi dashboard:
   - URL: `https://yourdomain.com/api/webhooks/vapi`
   - Events: All

## 6. Webhook Security

Generate a secure webhook secret:

```bash
openssl rand -base64 32
```

Add to `.env.local`:
```
WEBHOOK_SECRET="your-generated-secret"
CRON_SECRET="another-generated-secret"
```

Share the `WEBHOOK_SECRET` with your lead provider so they can sign webhook requests.

## 7. Lead Provider Webhook Configuration

Configure your lead provider (e.g., Facebook Leads, landing page form) to send webhooks to:

```
URL: https://yourdomain.com/api/webhooks/leads
Method: POST
Headers:
  Content-Type: application/json
  x-webhook-signature: <HMAC-SHA256 of payload using WEBHOOK_SECRET>
```

Example payload:
```json
{
  "email": "john@example.com",
  "phone": "+14165551234",
  "firstName": "John",
  "lastName": "Doe",
  "source": "facebook-ads",
  "consentEmail": true,
  "consentSms": true,
  "consentCall": true,
  "metadata": {
    "campaign": "spring-2024",
    "ad_id": "123"
  }
}
```

## 8. Test Your Setup

### Test Webhook Endpoint

```bash
curl -X POST https://yourdomain.com/api/webhooks/leads \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: <signature>" \
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

### Test Email

```bash
curl -X POST http://localhost:3000/api/communications/email \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "your-lead-id",
    "subject": "Test Email",
    "htmlBody": "<p>Hello {{firstName}}!</p>",
    "variables": {
      "firstName": "Test"
    }
  }'
```

### Test SMS

```bash
curl -X POST http://localhost:3000/api/communications/sms \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "your-lead-id",
    "body": "Hi {{firstName}}, this is a test!",
    "variables": {
      "firstName": "Test"
    }
  }'
```

## 9. Seed Default Data (Optional)

Create a script to seed automation rules:

```typescript
// scripts/seed-automations.ts
import { prisma } from "./lib/db";
import { DEFAULT_AUTOMATION_RULES } from "./lib/automation-engine";

async function seed() {
  for (const rule of DEFAULT_AUTOMATION_RULES) {
    await prisma.automationRule.create({
      data: rule,
    });
  }
  console.log("Automation rules seeded!");
}

seed();
```

## 10. Deploy to Vercel

1. Push to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

2. Import in Vercel:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repo
   - Add all environment variables
   - Deploy!

3. Verify cron jobs are running:
   - Go to Vercel dashboard → Your Project → Cron
   - You should see the two cron jobs listed

## 11. Post-Deployment

1. Update webhook URLs with your production domain
2. Test all integrations in production
3. Monitor logs for any errors
4. Set up domain email forwarding for privacy@yourdomain.com

## Troubleshooting

### Database Connection Issues

- Check `DATABASE_URL` format
- Ensure database is accessible from your app
- For local dev, make sure PostgreSQL is running

### Webhook 401 Errors

- Verify signature generation matches expected format
- Check that `WEBHOOK_SECRET` is the same on both ends
- Test with a simple payload first

### Email Not Sending

- Verify domain in Resend dashboard
- Check DNS records (SPF, DKIM, DMARC)
- Look at Resend logs for delivery status

### SMS Not Sending

- Verify phone number is verified in Twilio
- Check Twilio balance
- Ensure phone number format is correct (E.164)

### Voice AI Not Working

- Check Vapi dashboard for call logs
- Verify assistant is configured correctly
- Ensure webhook URL is accessible publicly

## Next Steps

- Customize email/SMS templates
- Add your branding to the UI
- Set up custom automation rules
- Configure analytics tracking
- Add team member access control
