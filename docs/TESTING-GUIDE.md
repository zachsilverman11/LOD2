# Phase 2: Testing Autonomous Holly Agent

## Quick Start for Team Testing

### Setup (One-Time, 5 minutes)

1. **Add your Claude API key to `.env`:**
   ```bash
   ANTHROPIC_API_KEY="sk-ant-..."
   DRY_RUN_MODE="true"
   ENABLE_AUTONOMOUS_AGENT="true"
   ```

2. **That's it!** The agent is now ready to test but won't send real messages.

---

## How to Test with Specific Leads

### Option 1: Quick Test (Recommended)

Test with a few specific leads by email:

```bash
npx tsx scripts/test-autonomous-agent.ts "jeffkimh@telus.net" "Mikeyoneofsix@gmail.com"
```

**What happens:**
1. Script marks those leads for autonomous management
2. Runs Holly's decision-making process
3. Shows you exactly what she would do
4. Cleans up afterwards (returns leads to normal)

**Output you'll see:**
```
📋 Jeff Kim (jeffkimh@telus.net)
   Status: CALL_COMPLETED
   Temperature: warm (stable)
   ⚠️  HOT: Advisor marked ready for application after call

🧠 ASKING CLAUDE TO DECIDE...

✅ HOLLY'S DECISION:
   Action: SEND_APPLICATION_LINK
   Confidence: HIGH
   Thinking: "Lead had call and advisor marked ready for app.
              Application link was already sent but no start yet.
              Should check in with encouragement."

   📱 Would send this message:
   ┌──────────────────────────────────────────────────────────┐
   │ Hi Jeff! How's the application going? I know it can be   │
   │ a bit long - let me know if you get stuck on anything    │
   │ and I can help! 😊                                       │
   │                                                           │
   │ https://stressfree.mtg-app.com/                          │
   └──────────────────────────────────────────────────────────┘

📝 WHAT WOULD HAPPEN IN PRODUCTION:
   📤 SMS would be sent to +17789302831
   📊 Lead activity logged
   ⏰ Next review scheduled in 2h
```

### Option 2: Test All Your Leads

See what Holly would do for ALL active leads:

```bash
# First, find some lead emails
npx tsx scripts/list-active-leads.ts

# Then test with those emails
npx tsx scripts/test-autonomous-agent.ts "email1@example.com" "email2@example.com" "email3@example.com"
```

---

## Creating Test Scenarios

### Scenario 1: Test New Lead (First Contact)

Create a brand new test lead or use an existing NEW lead:

```bash
npx tsx scripts/test-autonomous-agent.ts "newlead@test.com"
```

**Expected:** Holly should introduce herself and ask a diagnostic question based on the form data.

### Scenario 2: Test Lead Who Replied (Engaged)

Use a lead who has replied positively:

```bash
npx tsx scripts/test-autonomous-agent.ts "engaged@test.com"
```

**Expected:** Holly should continue the conversation naturally, maybe ask follow-up questions or send booking link if ready.

### Scenario 3: Test Lead Who Went Cold

Use a lead who stopped replying:

```bash
npx tsx scripts/test-autonomous-agent.ts "cold@test.com"
```

**Expected:** Holly should either try a new angle or decide to wait longer.

### Scenario 4: Test Lead with Call Completed

Use someone who had a call and advisor marked READY_FOR_APP:

```bash
npx tsx scripts/test-autonomous-agent.ts "jeffkimh@telus.net"
```

**Expected:** Holly should send application link with encouragement.

---

## What to Look For

### ✅ Good Signs

- **Natural language**: Messages don't sound robotic
- **No repetition**: Doesn't say the same thing twice
- **Good timing**: Waits when appropriate, acts when needed
- **Smart decisions**: Sends booking link when ready, waits when cold
- **Confidence matches action**: High confidence for obvious actions
- **Context awareness**: References previous conversation

### ❌ Red Flags

- Repetitive phrases ("Thanks for your text" multiple times)
- Sending messages too frequently (should wait 4+ hours)
- Ignoring conversation context
- Overly salesy language
- Missing obvious signals (e.g., lead said "yes" but Holly waits)
- Low confidence on simple decisions

---

## Team Testing Protocol

### For Zach, Greg, and Jakub:

**Day 1: Individual Testing**
Each person test 2-3 leads:
```bash
# Zach tests these:
npx tsx scripts/test-autonomous-agent.ts "lead1@example.com" "lead2@example.com"

# Greg tests these:
npx tsx scripts/test-autonomous-agent.ts "lead3@example.com" "lead4@example.com"

# Jakub tests these:
npx tsx scripts/test-autonomous-agent.ts "lead5@example.com" "lead6@example.com"
```

**Review Together:**
- Compare Holly's decisions
- Look for patterns (good and bad)
- Identify any concerning behaviors
- Vote: Continue to Phase 3 or need adjustments?

**Day 2-3: Edge Case Testing**
Test specific scenarios:
- Lead who opted out → Should NOT get messages
- Lead at 10pm local time → Should wait until morning
- Lead who just got a message 2h ago → Should wait (4h minimum)
- Lead with upcoming appointment → Should confirm, not book again

---

## Viewing Test Results in Database

After running tests, check what Holly decided:

```sql
-- See all test decisions
SELECT
  l.firstName,
  l.lastName,
  la.content,
  la.createdAt
FROM LeadActivity la
JOIN Lead l ON la.leadId = l.id
WHERE la.content LIKE '[DRY RUN]%'
ORDER BY la.createdAt DESC
LIMIT 20;
```

Or use Prisma Studio:
```bash
npx prisma studio --port 5556
```
Navigate to LeadActivity → Filter by content contains "[DRY RUN]"

---

## Troubleshooting

### "No leads found with those emails"

The email is case-sensitive. Check the exact email:
```bash
npx tsx scripts/list-active-leads.ts
```

### "ANTHROPIC_API_KEY not found"

Add to your `.env` file:
```bash
ANTHROPIC_API_KEY="sk-ant-api03-..."
```

### Script hangs or errors

Check Claude API status: https://status.anthropic.com/

Make sure `.env` has:
```bash
DATABASE_URL="postgresql://..."
```

### Holly's decisions seem off

This is expected in testing! Make notes and we'll tune the system. Common issues:
- Signal thresholds might need adjustment
- Prompt might need refinement
- More context needed in specific scenarios

---

## Safety Reminders

✅ **DRY_RUN_MODE=true** means:
- Holly makes decisions
- Nothing is actually sent
- All logged for review
- 100% safe to test

✅ **Test script cleanup:**
- Automatically disables autonomous mode for test leads after running
- Your production automation continues normally
- No overlap or conflicts

✅ **Can test as many times as you want:**
- Run the script 100 times, no problem
- Each run is independent
- No side effects

---

## Next Steps After Testing

Once you're happy with the results:

1. **Document findings** - What worked? What needs tuning?
2. **Make adjustments** - Tune signal thresholds if needed
3. **Move to Phase 3** - Enable on 10% of real leads (still with monitoring)

**Phase 3 Checklist:**
- [ ] All team members tested and approved
- [ ] No critical issues found
- [ ] Holly's decisions make sense
- [ ] Ready for small-scale production test

Then we'll set:
```bash
AUTONOMOUS_LEAD_PERCENTAGE="10"
DRY_RUN_MODE="false"
```

And monitor closely for 3-4 days before scaling up.

---

## Questions?

Check the main docs:
- [docs/AUTONOMOUS-HOLLY.md](./AUTONOMOUS-HOLLY.md) - Complete system guide
- [.env.autonomous-agent.example](../.env.autonomous-agent.example) - Configuration reference

Or ask Zach!
