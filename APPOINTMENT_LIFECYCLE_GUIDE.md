# Appointment Lifecycle Automation Guide

## Overview for Greg & Jakub

Holly now handles the **entire appointment lifecycle automatically** - from booking confirmations to reschedules, cancellations, and post-call follow-ups. You only need to take action in one scenario: **no-shows**.

---

## How It Works: Complete Appointment Flow

### 1. Lead Books Appointment (via Leads on Demand or Cal.com)

**What happens automatically:**
- ✅ Appointment created in system
- ✅ Lead status → `CALL_SCHEDULED`
- ✅ Holly sends confirmation message via SMS

**Example Holly message:**
> "Hi Sarah! Your call with Greg is confirmed for Wednesday, October 10th at 2:00 PM PT. Looking forward to discussing your mortgage options! 📅"

**Your action:** Nothing! Just show up for the call.

---

### 2. Appointment Reminders (Automated)

**24 hours before call:**
- ✅ Holly sends reminder SMS

**Example:**
> "Hey Sarah! Just a friendly reminder - your mortgage discovery call is tomorrow at 2:00 PM PT. Looking forward to it! 📅"

**1 hour before call:**
- ✅ Holly sends final reminder SMS

**Example:**
> "Quick reminder - your mortgage discovery call is in 1 hour at 2:00 PM PT. See you soon! 🎯"

**Your action:** Nothing! These happen automatically.

---

### 3. Lead Reschedules Appointment

**What happens automatically:**
- ✅ Appointment time updated in system
- ✅ Reminder flags reset (so new reminders send at correct time)
- ✅ Holly sends reschedule confirmation

**Example Holly message:**
> "Perfect! Your call is now rescheduled for Friday, October 12th at 3:00 PM PT. Looking forward to it!"

**Your action:** Nothing! Cal.com webhook handles everything.

---

### 4. Lead Cancels Appointment

**What happens automatically:**
- ✅ Appointment marked as `cancelled`
- ✅ Lead status → `QUALIFIED` (back to booking mode)
- ✅ Holly sends recovery message

**Example Holly message:**
> "Saw you had to cancel - no worries! Want to find a new time that works better? I'm here to help. 📞"

**Your action:** Nothing! Holly will try to rebook them automatically.

---

### 5. Call Happens (Normal Flow - 90% of cases)

**1 hour after scheduled call time:**
- ✅ System auto-marks appointment as `completed`
- ✅ Lead status → `CALL_COMPLETED`
- ✅ **Slack notification sent to you:** "Call was scheduled for [time]. Did it happen? You have 1 hour to mark as no-show if needed."

**2 hours after scheduled call time:**
- ✅ Post-call follow-up message queued to send

**Your action:**
- **If call happened:** Do nothing! ✅ Message will send automatically.
- **If call was a no-show:** Mark as no-show in dashboard (see section 6).

---

### 6. Call Was a No-Show (Only Time You Need to Act!)

**⚠️ THIS IS THE ONLY MANUAL ACTION REQUIRED ⚠️**

**When you realize lead didn't show up:**

1. **Open dashboard** → Find the lead
2. **Click on lead card** → Lead detail modal opens
3. **Find "Appointments" section**
4. **Click "Mark as No-Show" button** (red button, appears for 24 hours after call)
5. **Confirm** in popup dialog

**What happens when you click:**
- ✅ Appointment marked as `no_show`
- ✅ Lead status → `ENGAGED` (back to nurturing)
- ✅ **Cancels** any queued post-call messages
- ✅ Holly sends no-show recovery message

**Example Holly recovery message:**
> "Hey Sarah, we missed you on yesterday's call - everything okay? Still want to chat about your mortgage? Let me know when works better! 😊"

**Timeline for action:**
- You have **1 hour** after the scheduled call time to mark as no-show
- This prevents Holly from sending "How was your call?" to someone who didn't show up
- If you don't mark it within 1 hour, post-call message sends (minor awkwardness, but no big deal)

---

## Quick Decision Tree

```
Lead books call
    ↓
Does call happen as scheduled?
    ↓
   YES → Do nothing ✅
    |
   NO (No-show) → Mark as no-show in dashboard within 1 hour ⚠️
    |
   NO (Rescheduled/Cancelled) → Do nothing, Cal.com handles it ✅
```

---

## Dashboard: How to Mark No-Shows

### Step-by-Step:

1. **Go to:** https://lod2.vercel.app/dashboard

2. **Find the lead** on Kanban board (look in `CALL_COMPLETED` column)

3. **Click lead card** to open detail modal

4. **Scroll to "Appointments" section**

5. **Look for the red button:** "Mark as No-Show"
   - Only appears if appointment was completed in last 24 hours
   - Button is red to make it obvious

6. **Click button** → Confirmation dialog appears

7. **Click "OK"** → Done!

**Visual cue:**
- Button only shows for recently completed appointments
- Appointment status will show color-coded badge:
  - 🟢 Green = scheduled
  - 🟣 Purple = completed
  - 🔴 Red = no-show
  - ⚪ Gray = cancelled

---

## Slack Notifications (What to Expect)

You'll receive Slack notifications at key moments:

### 1. Call Booked
> "📅 **Call Booked**
> Sarah Martinez
> Scheduled for Oct 10 at 2:00 PM"

**Your action:** Review and prepare for call.

---

### 2. Post-Call Check (1 hour after call)
> "❓ **Did Call Happen?**
> Sarah Martinez
> Call was scheduled for Oct 10 at 2:00 PM. Did it happen?
> You have 1 hour to mark as no-show if needed."

**Your action:**
- If call happened → Ignore notification ✅
- If no-show → Mark in dashboard ⚠️

---

### 3. No-Show Marked (when you mark it)
> "🔄 **Lead Updated**
> Sarah Martinez
> Marked as no-show for Oct 10 at 2:00 PM. Moved back to ENGAGED."

**Your action:** None, just confirmation of your action.

---

## FAQs

### Q: What if I forget to mark a no-show within 1 hour?

**A:** Not a big deal! Holly will send the post-call message ("How was your call?"), which is slightly awkward but won't break anything. The lead will likely reply saying they didn't show up, and Holly will respond appropriately.

You can still mark as no-show later from the dashboard - the button stays visible for 24 hours.

---

### Q: What if the lead cancels but then wants to rebook?

**A:** Holly automatically handles this! When they cancel, she sends a recovery message offering to rebook. If they reply, Holly will guide them to book a new time.

---

### Q: What if I need to cancel/reschedule on behalf of the lead?

**A:** Cancel or reschedule in Cal.com directly. The webhook will trigger automatically and Holly will send the appropriate message.

---

### Q: Can I manually send a message to a lead?

**A:** Yes! You can always manually send SMS or email from the dashboard. Holly's automations won't conflict with manual messages.

---

### Q: What happens if a lead books multiple appointments?

**A:** Each appointment is tracked separately. Holly will send reminders for each one. If they no-show on one but show up for another, you can mark them individually.

---

### Q: How do I know if Holly sent a confirmation/reschedule/cancellation message?

**A:** Check the lead's SMS conversation in the dashboard. All messages are logged with timestamps. You'll see Holly's automated messages in the conversation thread.

---

## Troubleshooting

### "I don't see the no-show button"

**Possible reasons:**
1. Appointment isn't marked as `completed` yet (system marks it 1 hour after scheduled time)
2. More than 24 hours have passed since call time
3. Appointment was already marked as no-show

**Solution:** Check the appointment status in the lead detail modal. If it says "scheduled" still, wait a bit longer. If it says "no-show" already, it's been marked.

---

### "Holly sent the wrong message after a reschedule"

**Possible cause:** Cal.com webhook timing issue.

**Solution:** This is rare. If it happens, just manually send a quick follow-up clarifying the correct time.

---

### "Lead says they didn't get a reminder"

**Possible causes:**
1. Phone number incorrect in system
2. SMS delivery issue (rare)
3. They deleted/missed the text

**Solution:**
- Check their phone number in dashboard
- Check SMS conversation log to see if it was sent
- If sent but not received, may be carrier issue (very rare)

---

## Summary: What You Actually Need to Do

### Regular workflow (90-95% of calls):
1. ✅ Show up for scheduled calls
2. ✅ Do nothing - Holly handles everything

### Only manual action needed (5-10% of calls):
1. ⚠️ Mark no-shows in dashboard within 1 hour

**That's it!** The system handles:
- Confirmations ✅
- Reminders ✅
- Reschedules ✅
- Cancellations ✅
- Post-call follow-ups ✅

You only step in when someone doesn't show up.

---

## Technical Details (For Reference)

### System Architecture:
- **Cal.com webhooks:** Trigger on booking, reschedule, cancel events
- **Cron job:** Runs every 15 minutes to check for completed calls
- **Automation engine:** Handles timing and message queuing
- **Holly AI:** Generates contextual messages based on appointment status

### Key Timings:
- **Confirmation:** Immediate (within seconds of booking)
- **24h reminder:** Exactly 24 hours before call
- **1h reminder:** Exactly 1 hour before call
- **Post-call check:** 1 hour after scheduled time
- **Post-call message:** 2 hours after scheduled time (if not marked as no-show)

### Status Transitions:
```
NEW/CONTACTED → CALL_SCHEDULED (when appointment created)
CALL_SCHEDULED → QUALIFIED (when cancelled)
CALL_SCHEDULED → CALL_COMPLETED (1h after call time)
CALL_COMPLETED → ENGAGED (when marked as no-show)
```

---

## Need Help?

If you run into any issues or have questions:
1. Check this guide first
2. Check Slack notifications for system alerts
3. Review lead's conversation history in dashboard
4. Contact Zach if something seems broken

**Emergency:** If the system is sending wrong messages or not working, you can always manually message leads from the dashboard to override.

---

**Last Updated:** October 8, 2025
**System Version:** v2.0 with Appointment Lifecycle Automation
