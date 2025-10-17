# Autonomous Holly Agent

## Overview

The Autonomous Holly Agent is a smart, AI-powered system that automatically manages lead follow-ups based on deal temperature and engagement, rather than rigid time-based rules.

## How It Works

### The Old System (Rule-Based)
```
Cron job runs every hour
  → Check if 24 hours passed since CALL_COMPLETED
    → Send generic application nudge
```

### The New System (Agent-Based)
```
Agent reviews pipeline every 15 minutes
  → Analyzes each lead's health (hot/warm/cooling/cold/dead)
    → Claude decides: "Should I reach out? What should I say?"
      → Safety guardrails validate decision
        → Execute or wait
```

## Key Features

### 1. Deal Intelligence
- **Temperature detection**: Hot, warm, cooling, cold, dead
- **Engagement trend**: Improving, stable, declining
- **Sentiment analysis**: Enthusiastic, neutral, reluctant responses
- **Contextual urgency**: "Accepted offer", "Application stuck", "Call tomorrow"
- **Smart scheduling**: Hot leads reviewed every 30min, cold leads daily

### 2. Autonomous Decision-Making
Claude Sonnet 4.5 analyzes:
- Lead's current state of mind
- Conversation history
- Deal temperature and trend
- What a top sales rep would do

Decides:
- Send SMS / booking link / application link
- Wait X hours
- Escalate to human
- Confidence level (high/medium/low)

### 3. Safety Guardrails (Code-Level)
Hard boundaries enforced automatically:
- ✅ No SMS outside 8am-9pm local time
- ✅ Minimum 4 hours between messages
- ✅ No double-booking appointments
- ✅ No messages if opted out
- ✅ Repetition detection
- ✅ Message length validation

## File Structure

```
lib/
├── timezone-utils.ts           # Province → timezone mapping, SMS hours check
├── deal-intelligence.ts        # Analyze lead health signals
├── safety-guardrails.ts        # Hard boundary validation
├── claude-decision.ts          # Minimal prompt, natural reasoning
└── autonomous-agent.ts         # Main agent loop, smart scheduling
```

## Database Schema

```prisma
model Lead {
  // ... existing fields ...
  nextReviewAt        DateTime?  // When agent should review this lead
  managedByAutonomous Boolean    // True if managed by new agent
}
```

## Environment Variables

```bash
# Enable/disable agent
ENABLE_AUTONOMOUS_AGENT="false"   # Master kill switch

# Dry run mode (logging only, no real messages)
DRY_RUN_MODE="true"               # Safe testing mode

# Percentage rollout (0-100)
AUTONOMOUS_LEAD_PERCENTAGE="0"    # Gradual rollout

# Claude API
ANTHROPIC_API_KEY="sk-ant-..."    # Required for agent
```

## Safe Rollout Plan

### Week 1: Build (ZERO RISK)
- Create all files
- `ENABLE_AUTONOMOUS_AGENT=false`
- Build infrastructure with no impact

### Week 2 Days 1-3: Dry Run (LOGGING ONLY)
- `ENABLE_AUTONOMOUS_AGENT=true`
- `DRY_RUN_MODE=true`
- Agent logs decisions but doesn't send messages
- Review logs for 48 hours

### Week 2 Days 4-7: Shadow 10% (PARALLEL SYSTEMS)
- `DRY_RUN_MODE=false`
- `AUTONOMOUS_LEAD_PERCENTAGE=10`
- 10% on new agent, 90% on old automation
- No overlap due to `managedByAutonomous` flag

### Week 3: Gradual Scale (INCREASE PERCENTAGE)
- Day 1-2: 25%
- Day 3-4: 50%
- Day 5-7: 75%
- Monitor metrics at each step

### Week 4: Full Migration (COMPLETE SWITCHOVER)
- `AUTONOMOUS_LEAD_PERCENTAGE=100`
- Deprecate old automation
- Monitor for 48 hours

## Emergency Rollback

If anything goes wrong:

```bash
# Immediate rollback (5 minutes)
ENABLE_AUTONOMOUS_AGENT="false"

# Restart server
vercel redeploy  # or pm2 restart all
```

Old automation takes over immediately.

## Usage

### Assign Leads to Autonomous Management

```typescript
import { assignLeadsToAutonomous } from '@/lib/autonomous-agent';

// Assign 10% of leads
await assignLeadsToAutonomous(10);
```

### Run Agent Loop (Manual)

```typescript
import { runHollyAgentLoop } from '@/lib/autonomous-agent';

// Run once
await runHollyAgentLoop();
```

### Schedule Agent Loop (Cron)

```typescript
// In your cron file or API route
import { runHollyAgentLoop } from '@/lib/autonomous-agent';

// Every 15 minutes
setInterval(runHollyAgentLoop, 15 * 60 * 1000);
```

## Monitoring

### View Dry Run Decisions

```sql
SELECT
  l.firstName,
  l.lastName,
  la.content,
  la.createdAt
FROM LeadActivity la
JOIN Lead l ON la.leadId = l.id
WHERE la.content LIKE '[DRY RUN]%'
ORDER BY la.createdAt DESC
LIMIT 100;
```

### View Escalations

```sql
SELECT
  l.firstName,
  l.lastName,
  la.content,
  la.createdAt
FROM LeadActivity la
JOIN Lead l ON la.leadId = l.id
WHERE la.content LIKE '🚨 ESCALATED BY HOLLY%'
ORDER BY la.createdAt DESC;
```

### Check Agent Logs

```bash
# View agent activity
vercel logs | grep "Holly Agent"

# Watch in real-time
vercel logs --follow | grep "Holly Agent"
```

## Cost Analysis

### Old System (GPT-4o + Rules)
- 100 leads × 24 reviews/day = 2,400 API calls/day
- ~$13/day = $390/month

### New System (Claude Sonnet 4.5 + Smart Scheduling)
- Hot (10%): 480 reviews/day
- Warm (20%): 240 reviews/day
- Cooling (30%): 120 reviews/day
- Cold (30%): 30 reviews/day
- Dead (10%): 1.4 reviews/day
- **Total: ~871 reviews/day** (63% reduction!)
- ~$4.70/day = $141/month

**Savings: $249/month (64% reduction)**

## Success Metrics

Track these during rollout:

| Metric | Target |
|--------|--------|
| Lead-to-call conversion | +10% |
| Response rate | +15% |
| Complaint rate | -50% |
| Messages per conversion | -20% |
| API calls per day | <900 |
| Avg response time (hot leads) | <1 hour |

## Key Differences from Old System

| Old System | New System |
|------------|------------|
| Rules in prompt (7K tokens) | Zero rules in prompt (2K tokens) |
| Reviews all leads every hour | Smart scheduling based on temperature |
| Generic wait times | Temperature-specific review frequencies |
| Binary decisions (act/don't act) | Flexible (wait hours, escalate, confidence) |
| Status-based follow-ups | Intelligence-based decisions |
| No sentiment analysis | Rich engagement & sentiment signals |
| Fixed timing | Adaptive timing |
| $13/day | $4.70/day (64% cheaper) |

## Troubleshooting

### Agent not running
- Check `ENABLE_AUTONOMOUS_AGENT=true`
- Verify `ANTHROPIC_API_KEY` is set
- Check server logs for errors

### No leads being reviewed
- Check if any leads have `managedByAutonomous=true`
- Run `assignLeadsToAutonomous(10)` to assign leads
- Verify `nextReviewAt` is set

### Messages not sending
- Check if `DRY_RUN_MODE=false`
- Verify safety guardrails aren't blocking (check logs)
- Confirm lead has `consentSms=true`

### Too many/few messages
- Adjust smart scheduling frequency in `deal-intelligence.ts`
- Review temperature thresholds
- Check anti-spam rules (4 hour minimum)

## Support

For issues or questions:
1. Check logs: `vercel logs | grep "Holly Agent"`
2. Review dry run decisions in database
3. Test with `DRY_RUN_MODE=true` first
4. Emergency rollback: `ENABLE_AUTONOMOUS_AGENT=false`
