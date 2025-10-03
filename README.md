# Lead Conversion System

A complete lead conversion system for Canadian mortgage businesses that automatically processes webhook leads through a Kanban pipeline to book discovery calls with advisors.

## Features

- **Webhook Lead Ingestion**: Secure endpoint to receive leads from third-party providers
- **Kanban Pipeline UI**: Drag-and-drop interface for lead progression tracking
- **Cal.com Integration**: Automated discovery call scheduling
- **Multi-Channel Communication**:
  - Email (via Resend)
  - SMS (via Twilio)
  - Voice AI Agent (via Vapi.ai with Cal.com booking capability)
- **Automation Engine**: Time-based and event-based nurture workflows
- **Canadian Compliance**: PIPEDA and CASL compliant with consent management

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Drag & Drop**: @dnd-kit
- **Integrations**:
  - Cal.com (Scheduling)
  - Resend (Email)
  - Twilio (SMS)
  - Vapi.ai (Voice AI)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- API keys for:
  - Cal.com
  - Resend (or SendGrid)
  - Twilio
  - Vapi.ai

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd lod2
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/lod2?schema=public"

# Webhook Security
WEBHOOK_SECRET="your-webhook-secret-key"

# Cal.com
CALCOM_API_KEY="your-calcom-api-key"
CALCOM_EVENT_TYPE_ID="your-event-type-id"

# Email (Resend)
RESEND_API_KEY="your-resend-api-key"
FROM_EMAIL="noreply@yourdomain.com"

# SMS (Twilio)
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"

# Voice AI (Vapi.ai)
VAPI_API_KEY="your-vapi-api-key"
VAPI_ASSISTANT_ID="your-assistant-id"

# App Config
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CRON_SECRET="your-cron-secret"
```

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Database Schema

The system uses the following core models:

- **Lead**: Main lead information with consent tracking
- **LeadActivity**: Activity timeline (emails, SMS, calls, status changes)
- **Appointment**: Cal.com appointment records
- **EmailTemplate**: Reusable email templates
- **SmsTemplate**: Reusable SMS templates
- **AutomationRule**: Workflow automation rules
- **WebhookEvent**: Audit log for all webhook events

## API Endpoints

### Webhook Endpoints

- `POST /api/webhooks/leads` - Receive new leads
- `POST /api/webhooks/calcom` - Cal.com booking events
- `POST /api/webhooks/twilio` - Incoming SMS messages
- `POST /api/webhooks/vapi` - Voice AI call events

### Lead Management

- `GET /api/leads` - List all leads
- `GET /api/leads/[id]` - Get lead details
- `PATCH /api/leads/[id]` - Update lead

### Communications

- `POST /api/communications/email` - Send email to lead
- `POST /api/communications/sms` - Send SMS to lead
- `POST /api/communications/voice` - Initiate voice AI call

### Compliance (PIPEDA/CASL)

- `GET /api/compliance/export?leadId=xxx` - Export lead data
- `DELETE /api/compliance/delete?leadId=xxx` - Delete lead data
- `POST /api/compliance/consent` - Withdraw consent

### Cron Jobs

- `GET /api/cron/automations` - Process time-based automations (run every 15 min)
- `GET /api/cron/cleanup` - Clean up old data (run daily)

## Webhook Configuration

### Lead Provider Webhook

Configure your lead provider to send webhooks to:
```
POST https://yourdomain.com/api/webhooks/leads
Header: x-webhook-signature: <HMAC-SHA256 signature>
```

Payload format:
```json
{
  "email": "lead@example.com",
  "phone": "+14165551234",
  "firstName": "John",
  "lastName": "Doe",
  "source": "facebook-ads",
  "consentEmail": true,
  "consentSms": true,
  "consentCall": true,
  "metadata": {
    "campaign": "spring-2024"
  }
}
```

### Cal.com Webhook

Configure Cal.com webhooks in your account:
```
URL: https://yourdomain.com/api/webhooks/calcom
Events: BOOKING_CREATED, BOOKING_RESCHEDULED, BOOKING_CANCELLED
```

### Twilio Webhook

Configure Twilio to send incoming SMS to:
```
https://yourdomain.com/api/webhooks/twilio
```

### Vapi.ai Webhook

Configure Vapi assistant webhooks:
```
https://yourdomain.com/api/webhooks/vapi
```

## Voice AI Setup

To set up the Voice AI assistant:

1. Create a Vapi.ai account and get your API key
2. Run the setup script to create the assistant:

```typescript
// You can create this as a one-time script
import { createVapiAssistant } from "@/lib/voice-ai";

const assistant = await createVapiAssistant();
console.log("Assistant ID:", assistant.id);
```

3. Add the Assistant ID to your `.env.local`:
```
VAPI_ASSISTANT_ID="your-assistant-id"
```

The AI assistant is configured to:
- Introduce your mortgage brokerage
- Understand caller needs (purchase, refinance, renewal)
- Collect basic information
- Book appointments directly via Cal.com during the call
- Handle objections and answer basic questions

## Automation Rules

The system includes default automation rules:

1. **Welcome Email** - Sent immediately after lead creation
2. **Follow-up SMS** - 24 hours after creation if no response
3. **Voice AI Call** - 48 hours after last contact if no response
4. **Call Reminder** - 24 hours before scheduled call

You can customize these in the database or create new ones via the `AutomationRule` model.

## Pipeline Stages

1. **New Lead** - Just received
2. **Contacted** - Initial outreach completed
3. **Qualified** - Lead is interested and qualified
4. **Call Scheduled** - Discovery call booked
5. **Call Completed** - Discovery call finished
6. **Converted** - Lead became a client
7. **Lost** - Lead didn't convert

## Canadian Compliance

### PIPEDA Compliance

- **Right to Access**: `GET /api/compliance/export?leadId=xxx`
- **Right to Delete**: `DELETE /api/compliance/delete?leadId=xxx`
- **Data Retention**: Automated cleanup based on retention policies
- **Consent Tracking**: All communications check consent before sending

### CASL Compliance

- **Express Consent**: Required before sending emails/SMS
- **Unsubscribe Mechanism**: All messages include opt-out
- **Opt-out Handling**: Automatic consent withdrawal on STOP/UNSUBSCRIBE
- **10-Day Rule**: Consent changes processed immediately

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Configure cron jobs in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/automations",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

5. Deploy!

### Database

Use a managed PostgreSQL service:
- **Vercel Postgres** (easiest)
- **Supabase**
- **Railway**
- **AWS RDS**

Ensure your database is in a Canadian region for PIPEDA compliance.

## Monitoring

Add error monitoring with Sentry:

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

## Security

- All webhooks use signature verification
- API endpoints validate input with Zod schemas
- Consent checked before all communications
- Personal data encrypted at rest (via database)
- HTTPS required for production

## License

MIT

## Support

For issues or questions, please open a GitHub issue.
