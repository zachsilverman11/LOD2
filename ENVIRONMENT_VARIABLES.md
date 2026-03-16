# Environment Variables Documentation

This document lists all required and optional environment variables for the Holly AI system.

## ✅ Production Environment Variable Checklist

Last verified: January 2025

### Critical Variables (REQUIRED)

#### Database (Neon Postgres)
- ✅ `DATABASE_URL` - Primary database connection (pooled)
- ✅ `POSTGRES_PRISMA_URL` - Prisma client connection
- ✅ `DATABASE_URL_UNPOOLED` - Direct connection (migrations)
- ✅ `POSTGRES_URL` - Neon connection URL
- ✅ `POSTGRES_URL_NON_POOLING` - Non-pooled connection
- ✅ `POSTGRES_URL_NO_SSL` - No SSL connection
- ✅ `POSTGRES_HOST` - Database host
- ✅ `POSTGRES_USER` - Database user
- ✅ `POSTGRES_PASSWORD` - Database password
- ✅ `POSTGRES_DATABASE` - Database name
- ✅ `PGHOST` - PostgreSQL host (pooled)
- ✅ `PGHOST_UNPOOLED` - PostgreSQL host (direct)
- ✅ `PGUSER` - PostgreSQL user
- ✅ `PGPASSWORD` - PostgreSQL password
- ✅ `PGDATABASE` - PostgreSQL database name
- ✅ `NEON_PROJECT_ID` - Neon project identifier

#### Authentication & Security
- ✅ `WEBHOOK_SECRET` - Webhook signature validation
- ✅ `CRON_SECRET` - Cron job authentication
- ✅ `BASIC_AUTH_USER` - HTTP basic auth username
- ✅ `BASIC_AUTH_PASSWORD` - HTTP basic auth password
- ✅ `AUTH_USERNAME` - Dashboard auth username
- ✅ `AUTH_PASSWORD_HASH` - Dashboard auth password hash
- ✅ `AUTH_SECRET` - NextAuth secret key
- ✅ `ADMIN_USERNAME` - Admin panel username
- ✅ `ADMIN_PASSWORD` - Admin panel password
- ✅ `NEXTAUTH_URL` - NextAuth callback URL

#### AI & ML
- ✅ `ANTHROPIC_API_KEY` - Claude AI (Holly's sole AI backbone)

#### Email (SendGrid)
- ✅ `SENDGRID_API_KEY` - Email sending API key
- ✅ `FROM_EMAIL` - Sender email (info@inspired.mortgage)

#### SMS & Voice (Twilio + Vapi)
- ✅ `TWILIO_ACCOUNT_SID` - Twilio account identifier
- ✅ `TWILIO_AUTH_TOKEN` - Twilio authentication token
- ✅ `TWILIO_PHONE_NUMBER` - Twilio phone number (E.164 format)
- ✅ `VAPI_API_KEY` - Vapi voice AI API key
- ✅ `VAPI_ASSISTANT_ID` - Vapi assistant configuration
- ✅ `VAPI_PHONE_NUMBER_ID` - Vapi phone number ID

#### Scheduling (Cal.com)
- ✅ `CALCOM_API_KEY` - Cal.com API key
- ✅ `CALCOM_EVENT_TYPE_ID` - Event type for bookings
- ✅ `CAL_COM_BOOKING_URL` - Public booking URL
  - **IMPORTANT:** This is the ONLY booking URL variable used
  - Value: `https://cal.com/team/inspired-mortgage/mortgage-discovery-call`

#### CRM (Pipedrive)
- ✅ `PIPEDRIVE_API_TOKEN` - Pipedrive API authentication
- ✅ `PIPEDRIVE_COMPANY_DOMAIN` - Pipedrive company domain

#### Application Links
- ✅ `MORTGAGE_APPLICATION_URL` - Finmo application link
  - **IMPORTANT:** This is the ONLY application URL variable used
  - Value: `https://stressfree.mtg-app.com/`
  - Used in both autonomous and manual application sends

#### Notifications
- ✅ `SLACK_WEBHOOK_URL` - Slack notifications webhook

#### Autonomous Holly Configuration
- ✅ `ENABLE_AUTONOMOUS_AGENT` - Enable Holly (true/false)
- ✅ `DRY_RUN_MODE` - Dry run mode (true/false)
- ✅ `AUTONOMOUS_LEAD_PERCENTAGE` - % of leads for Holly (0-100)

#### Background Jobs (Inngest)
- ✅ `INNGEST_SIGNING_KEY` - Inngest event signature
- ✅ `INNGEST_EVENT_KEY` - Inngest event key

### Optional Variables

#### Dashboard URL
- `NEXT_PUBLIC_APP_URL` - Used for Slack notification links
  - Defaults to: `https://lod2.vercel.app`
  - Override in production if using custom domain

---

## 🔍 Variable Audit Notes

### Potentially Unused Variables

#### `OPENAI_API_KEY`
- **Status:** REMOVED (March 2026). All AI calls now use Claude via `ANTHROPIC_API_KEY`. The `openai` npm package has been removed. This key can be deleted from Vercel environment variables.

### Recently Fixed Issues

#### Booking URL Standardization (Fixed: Jan 2025)
- **Problem:** Two different variable names were used:
  - ❌ `NEXT_PUBLIC_CAL_LINK` (NOT set in Vercel, caused failures)
  - ✅ `CAL_COM_BOOKING_URL` (set in Vercel, works correctly)
- **Solution:** Standardized all code to use `CAL_COM_BOOKING_URL`
- **Files fixed:** `lib/ai-conversation-enhanced.ts:764`

#### Application URL Standardization (Fixed: Jan 2025)
- **Problem:** Two different variable names were used:
  - ❌ `APPLICATION_URL` (local .env only)
  - ❌ `NEXT_PUBLIC_APPLICATION_URL` (not set anywhere)
  - ✅ `MORTGAGE_APPLICATION_URL` (set in Vercel, correct)
- **Solution:** Standardized all code to use `MORTGAGE_APPLICATION_URL`
- **Files fixed:**
  - `lib/ai-conversation-enhanced.ts:1533`
  - `app/api/leads/[leadId]/call-outcome/route.ts:130`
  - `.env:88`

---

## 🚨 Common Issues

### 1. Missing Environment Variables
If you see errors like:
```
Error: FROM_EMAIL environment variable is required
```

**Solution:** Add the variable to Vercel:
```bash
vercel env add FROM_EMAIL production
# Enter value when prompted
```

### 2. Wrong Variable Name
If Holly sends wrong links or URLs:
- Check that code uses correct variable name
- Verify variable is set in Vercel: `vercel env ls production`
- Common culprits:
  - Booking URL: Must use `CAL_COM_BOOKING_URL`
  - Application URL: Must use `MORTGAGE_APPLICATION_URL`
  - Dashboard URL: Should use `NEXT_PUBLIC_APP_URL` with fallback

### 3. Local vs Production Mismatch
If it works locally but fails in production:
- Verify `.env` matches Vercel production settings
- Check variable names are identical (case-sensitive)
- Ensure fallback values are correct

---

## 📋 Verification Script

Run this to check all variables are set:

```bash
# Check production environment
vercel env ls production

# Check for specific variable
vercel env ls production | grep "MORTGAGE_APPLICATION_URL"

# Add missing variable
vercel env add VARIABLE_NAME production
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` to git** (already in .gitignore)
2. **Rotate secrets regularly:**
   - API keys (quarterly)
   - Webhook secrets (after any security incident)
   - Database credentials (annually or after team changes)
3. **Use Vercel's encrypted storage** (already in use)
4. **Limit access:**
   - Only team leads should have Vercel access
   - Use service accounts for CI/CD

---

## 📝 Adding New Variables

When adding a new environment variable:

1. **Add to local `.env` file**
2. **Add to Vercel production:**
   ```bash
   vercel env add VARIABLE_NAME production
   ```
3. **Add to this documentation** under appropriate section
4. **Update fallback values** in code if needed
5. **Test in production** before full rollout

---

## ✅ Production Deployment Checklist

Before deploying:

- [ ] All REQUIRED variables are set in Vercel
- [ ] Variable names match between code and Vercel
- [ ] Fallback values are safe (no "example.com" emails, etc.)
- [ ] Secrets are rotated if exposed
- [ ] This documentation is updated

---

Last updated: January 2025 by Claude Code
