# Pipeline Restructure - Strategic Implementation

## New Pipeline Flow

### Primary Conversion Path:
```
NEW → CONTACTED → ENGAGED → CALL_SCHEDULED → CALL_COMPLETED →
APPLICATION_STARTED → CONVERTED
```

### Parallel Tracks:
- **NURTURING** - Long-term holding pattern (can return to ENGAGED)
- **LOST** - Dead end (no further action)

## Key Changes from Previous System

### Removed Stages:
1. **QUALIFIED** - Redundant with ENGAGED
2. **APPLICATION_COMPLETED** - Merged with CONVERTED (simpler)

### Stage Definitions:

- **NEW**: Lead just came in, no contact yet
- **CONTACTED**: Holly has reached out (waiting for reply)
- **ENGAGED**: Lead is actively responding to messages
- **CALL_SCHEDULED**: Appointment booked with advisor
- **CALL_COMPLETED**: Discovery call finished
- **APPLICATION_STARTED**: Lead started Finmo application
- **CONVERTED**: Lead submitted complete application ✅
- **NURTURING**: Long-term leads being kept warm
- **LOST**: Dead leads (unresponsive or not qualified)

## Intelligent Automation

### Auto-Move to NURTURING:
1. **14 days with no response** from CONTACTED/ENGAGED
2. **Call outcome = "long_timeline"** (6+ months out)
3. Holly continues messaging at **lower frequency** (weekly vs daily)

### Auto Re-Engage from NURTURING:
1. **Lead replies** to any message → Move to ENGAGED
2. **Lead books appointment** → Move to CALL_SCHEDULED
3. System is smart enough to "wake them up"

### Auto-Move to LOST:
1. **90 days in NURTURING** with zero engagement
2. **Manual**: Advisor can mark LOST anytime
3. Slack alert sent when this happens

## Pipedrive Integration

### Trigger:
When lead reaches **CONVERTED** status (application submitted)

### What Happens:
1. **Create Person** in Pipedrive with contact info
2. **Create Deal** with full context:
   - Title: "{Name} - {PropertyType} in {City}"
   - Value: Loan Amount (CAD)
   - Status: Open
3. **Add Note** with:
   - Loan details (type, amount, property, credit score)
   - Call outcome data (programs discussed, notes)
   - Application timeline (started/completed dates)
4. **Send Slack notification**: "💼 Pipedrive deal created"

### Setup Required:
Add these environment variables to production:
```
PIPEDRIVE_API_TOKEN=your_api_token_here
PIPEDRIVE_DOMAIN=api.pipedrive.com  # Optional, defaults to this
```

Get your API token: Pipedrive Settings → Personal Preferences → API

## How This Works in Practice

### Example Journey 1: Hot Lead
```
Day 0: NEW lead comes in from LOD
Day 0: Holly sends first message → CONTACTED
Day 0: Lead replies "Yes interested!" → ENGAGED
Day 1: Lead books call → CALL_SCHEDULED
Day 3: Call happens → CALL_COMPLETED
Day 3: Advisor captures outcome as "hot_lead"
Day 4: Lead starts application → APPLICATION_STARTED
Day 4: Holly sends 24h encouragement
Day 5: Lead completes application → CONVERTED
Day 5: Pipedrive deal auto-created ✅
```

### Example Journey 2: Slow Burner
```
Day 0: NEW lead comes in
Day 0: Holly messages → CONTACTED
Day 7: No response
Day 14: No response → Auto-moved to NURTURING
Week 3: Holly messages weekly (lower frequency)
Week 6: Lead replies "Ready now!" → Auto-moved to ENGAGED
Week 7: Lead books call → CALL_SCHEDULED
[continues to conversion]
```

### Example Journey 3: Dead Lead
```
Day 0: NEW → CONTACTED
Day 14: No response → NURTURING
Day 30: Still no response (Holly still trying)
Day 60: Still no response
Day 90: Still no response → Auto-moved to LOST
Slack alert: "Lead XYZ moved to LOST after 90 days"
```

## Benefits of This System

1. **Simpler Pipeline**: Fewer stages = clearer progression
2. **Automatic Nurturing**: No manual work to manage long-term leads
3. **Smart Re-engagement**: System knows when leads "wake up"
4. **Clean Handoff**: Converted leads auto-flow to Pipedrive
5. **Zero Data Loss**: NURTURING keeps leads warm indefinitely
6. **Intelligent Cleanup**: Auto-LOST prevents pipeline bloat

## Cron Jobs Running

These automations run every 15 minutes:
- Appointment reminders (24h and 1h before)
- Smart follow-ups (1h, 4h, 12h, daily patterns)
- Post-call confirmations
- Application nudges (24h, 48h, 72h)
- **NURTURING transitions** (NEW!)
- Stale lead alerts

## Next Steps

1. ✅ Deploy to production (DONE)
2. ⏳ Add PIPEDRIVE_API_TOKEN to Vercel env vars
3. ⏳ Test Pipedrive integration with converted lead
4. ⏳ Monitor NURTURING transitions over next 2 weeks
5. ⏳ Verify auto-re-engagement works when leads reply

## Questions?

The system is now fully autonomous:
- Leads move through stages automatically
- NURTURING happens without manual intervention
- Re-engagement is instant when leads respond
- Pipedrive deals created on conversion
- Team gets Slack alerts for key milestones
