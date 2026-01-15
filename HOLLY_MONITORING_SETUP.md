# Holly Monitoring Setup

## Problem
Vercel's built-in cron system can sometimes stop firing scheduled tasks, causing Holly to stop nurturing leads. This happened on Nov 5, 2025 - Holly stopped at 6:16 PM and didn't run for 21+ hours.

## Solution
Use an external monitoring service to ping Holly's health check endpoint every 15 minutes. If Holly is inactive, the health check automatically triggers her.

---

## Setup with cron-job.org (FREE)

### Step 1: Create Account
1. Go to: https://cron-job.org/en/signup.php
2. Sign up for free account
3. Verify email

### Step 2: Create Cron Job
1. Click "Create cronjob"
2. Configure:
   - **Title**: "Holly Health Check"
   - **URL**: `https://lod2.vercel.app/api/cron/holly-health-check`
   - **Schedule**: Every 15 minutes
     - Pattern: `*/15 * * * *`
   - **Requests**:
     - Method: GET
     - Add Header:
       - Name: `Authorization`
       - Value: `Bearer ${CRON_SECRET}` (get from Vercel env vars)
   - **Notifications**:
     - Enable email notifications on failure
     - Your email: `info@inspired.mortgage`

3. Click "Create cronjob"

### Step 3: Test
1. Click "Run" to test immediately
2. Check "Execution history" - should show "200 OK"
3. Response should be:
   ```json
   {
     "status": "healthy",
     "message": "Holly is running normally",
     "minutesSinceActivity": <number>,
     "overdueLeads": <number>
   }
   ```

---

## Alternative: UptimeRobot (FREE)

### Setup
1. Go to: https://uptimerobot.com
2. Sign up for free
3. Add New Monitor:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: Holly Health Check
   - **URL**: `https://lod2.vercel.app/api/cron/holly-health-check`
   - **Monitoring Interval**: Every 5-15 minutes
   - **Monitor Timeout**: 30 seconds
   - **HTTP Method**: GET
   - **HTTP Headers**:
     - `Authorization: Bearer ${CRON_SECRET}`
   - **Alert Contacts**: Your email

4. Save monitor

---

## How It Works

### Normal Operation
- External service pings health check every 15 minutes
- Health check looks at Holly's recent activity
- If Holly ran recently (<2 hours), returns "healthy"
- No action needed

### When Holly Stops
- External service pings health check
- Health check detects: "Last activity >2 hours ago + overdue leads exist"
- Health check **automatically triggers Holly** by calling her cron endpoint
- Holly processes all overdue leads
- Health check returns "recovered" status

### Benefits
1. **Automatic Recovery**: No manual intervention needed
2. **Redundancy**: Works even if Vercel cron fails
3. **Monitoring**: Get email alerts if Holly is unhealthy
4. **Zero Cost**: Free tier of either service is sufficient

---

## Vercel Dashboard Check

If cron-job.org shows Holly as unhealthy consistently, check Vercel:

1. Go to: https://vercel.com/zach-silvermans-projects/lod2/settings/cron-jobs
2. Verify cron jobs are listed and enabled
3. Check execution logs for errors
4. Verify Pro plan is active: https://vercel.com/account/billing

---

## Emergency Manual Trigger

If you need to trigger Holly manually right now:

```bash
curl -X GET "https://lod2.vercel.app/api/cron/autonomous-holly" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

Or use the health check (which will auto-trigger if needed):

```bash
curl -X GET "https://lod2.vercel.app/api/cron/holly-health-check" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

---

## Monitoring Dashboard

Check Holly's status anytime at:
- Health Check: `https://lod2.vercel.app/api/cron/holly-health-check`
- LOD2 Dashboard: `https://lod2.vercel.app/dashboard`

The health check will show:
- Minutes since last SMS activity
- Number of overdue leads
- Last activity timestamp
- Current health status
