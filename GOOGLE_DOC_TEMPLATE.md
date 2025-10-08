# LOD2 Daily Operations Google Doc Template

## 📋 Document Setup Instructions

### Step 1: Create the Document
1. Go to Google Docs
2. Create new document
3. Name it: **"LOD2 Daily Operations & Feedback"**
4. Share with: Greg, Jakub, Zach (edit access)

### Step 2: Set Up Permissions
- **Edit Access**: Greg, Jakub, Zach
- **Comment Access**: Future team members (if needed)
- **Link Sharing**: Off (keep it private)

### Step 3: Enable Suggested Edits
- Top right → Click your profile → Enable "Suggesting" mode
- This lets everyone track changes and see who updated what

---

## 📄 Copy This Template Into Your Google Doc

---

# LOD2 Daily Operations & Feedback
**Last Updated:** [Auto-updates when you edit]

---

## 🔗 Quick Links

| Resource | URL | Status |
|----------|-----|--------|
| 📊 Dashboard | https://lod2.vercel.app/dashboard | 🟢 Live |
| 📈 Analytics | https://lod2.vercel.app/dashboard/analytics | 🟢 Live |
| 📅 Cal.com | https://cal.com/team/inspired-mortgage/mortgage-discovery-call | 🟢 Live |
| 🔧 Vercel Admin | https://vercel.com/zach-silvermans-projects/lod2 | 🟢 Live |
| 📖 System Docs | [Link to SYSTEM_OVERVIEW.md] | 🟢 Live |

**Status Legend:** 🟢 Live | 🟡 Issues | 🔴 Down | 🔵 Maintenance

---

## 📅 Daily Standup Log

> **How to use:** Add a new entry each day when reviewing the system. Keep it brief (2-3 bullet points per section).

### [DATE: January 8, 2025] - Greg
**✅ What's Working:**
- Holly booked 3 calls yesterday with high-quality leads
- Response rate sitting at 35% - above target!
- Pre-filled Cal.com links are working great, no booking friction

**⚠️ Needs Attention:**
- Lead #cmgg123 asking about rates - might need manual follow-up
- Saw 2 leads in ENGAGED for 5+ days with no booking yet

**💡 Quick Wins:**
- Converted lead from Dec 28 - closed $620K purchase! 🎉

---

### [DATE: January 7, 2025] - Jakub
**✅ What's Working:**
- AI tone feels natural, leads think they're talking to a real person
- Love the Kanban color updates - much easier to scan

**⚠️ Needs Attention:**
- One lead confused about Guaranteed Approvals Certificate vs Pre-Approval
- Might need Holly to explain the difference better

**💡 Quick Wins:**
- Booked 2 calls for this week

---

### [DATE: January 6, 2025] - Zach
**✅ What's Working:**
- System stability at 100%, no downtime
- Email sending fixed (SendGrid verified)

**⚠️ Needs Attention:**
- Need to add dashboard authentication
- Consider A/B testing different opening messages

**💡 Quick Wins:**
- Deployed SMS-first optimization (95/5 split)

---

## 🚨 Issues Tracker

> **How to use:** Add new issues as they come up. Update the Status column as they're resolved. Use color coding (Google Docs → Text color).

| Date Added | Issue Description | Priority | Status | Owner | Resolution / Notes |
|------------|-------------------|----------|--------|-------|-------------------|
| Jan 8 | Lead asking about rates, Holly can't answer | 🟡 Medium | Open | Greg | Will call manually, then update Holly's script |
| Jan 7 | Email error for Greg's test lead | 🔴 Critical | ✅ Resolved | Zach | SendGrid verification complete |
| Jan 7 | Kanban colors too similar | 🟡 Medium | ✅ Resolved | Zach | Updated pipeline colors |
| Jan 6 | Phone country code issue | 🟡 Medium | ✅ Resolved | Zach | Auto-prefill with +1 |
|  |  |  |  |  |  |

**Priority Legend:**
- 🔴 Critical: System down or broken, losing leads
- 🟡 Medium: Impacting efficiency or lead experience
- 🟢 Low: Nice-to-have, no immediate impact

**Status Options:** Open | In Progress | ✅ Resolved | ❌ Won't Fix

---

## 💡 Feature Requests

> **How to use:** Add ideas as bullet points. Use 👍 emoji reactions to vote. Zach prioritizes based on votes + impact.

### High Priority (3+ votes)
- [ ] Add manual SMS send button from dashboard 👍👍👍👍
  - **Why:** Sometimes we want to send a quick manual message without AI
  - **Impact:** Saves time, more control
  - **Requester:** Greg (Jan 8)

- [ ] Lead scoring system (A/B/C priority) 👍👍👍
  - **Why:** Focus on high-intent leads first
  - **Impact:** Better time allocation
  - **Requester:** Jakub (Jan 7)

### Medium Priority (1-2 votes)
- [ ] Voice AI for phone calls (Vapi integration) 👍
  - **Why:** Some leads prefer calls over SMS
  - **Impact:** Could increase conversions
  - **Requester:** Greg (Jan 6)

- [ ] Export conversation history to PDF 👍👍
  - **Why:** Attach to file for compliance
  - **Impact:** Easier record-keeping
  - **Requester:** Jakub (Jan 8)

### Backlog (0 votes - under consideration)
- [ ] Multi-language support (French for Quebec)
  - **Why:** Expand to Quebec market
  - **Impact:** New market opportunity
  - **Requester:** Zach (Jan 5)

---

## ✍️ Copy & Messaging Updates

> **How to use:** Track changes to Holly's messaging, programs, or positioning. Helps everyone stay aligned.

### Recent Updates

**[Jan 7, 2025] - Pre-fill Cal.com booking links**
- **Change:** Cal.com links now auto-populate name, email, phone with +1
- **Reason:** Reduces booking friction (Greg reported country code confusion)
- **Status:** ✅ Live in production

**[Jan 6, 2025] - SMS-first optimization**
- **Change:** Adjusted AI split from 80/10/10 to 95/5/0 (95% SMS, 5% Email when requested)
- **Reason:** Email reply loop not fully working, SMS has 98% open rate
- **Status:** ✅ Live in production

**[Jan 5, 2025] - Holly's signature**
- **Change:** Updated from "Holly from inspired mortgage" to "Holly with Inspired Mortgage"
- **Reason:** Sounds more natural in Canadian English
- **Status:** ✅ Live in production

### Proposed Updates (Needs Discussion)

**[Proposed by Greg - Jan 8] - Add urgency messaging for purchase leads**
- **Current:** "Want to grab a quick 15-min call this week?"
- **Proposed:** "Homes are moving fast right now - want to grab a quick 15-min call this week to get ahead of the competition?"
- **Discussion:** Does this feel too pushy? Or helpful urgency?
- **👍 Vote if you like this idea**

**[Proposed by Jakub - Jan 7] - Simplify Guaranteed Approvals Certificate explanation**
- **Current:** "Basically gives you the same power as a cash buyer"
- **Proposed:** "It's like a letter that says 'this buyer is 100% approved' - sellers love it"
- **Discussion:** Which is clearer?
- **👍 Vote if you like this idea**

---

## 📊 Weekly Metrics Dashboard

> **How to use:** Update every Monday morning with last week's numbers. Track trends (↑↓→).

### Week of January 6-12, 2025

| Metric | This Week | Last Week | Trend | Target |
|--------|-----------|-----------|-------|--------|
| **Leads Received** | 47 | 52 | ↓ | 50/week |
| **Leads Contacted (within 5 min)** | 47 (100%) | 52 (100%) | → | 100% |
| **Response Rate** | 35% | 28% | ↑ | 30% |
| **Booking Rate** | 18% | 15% | ↑ | 15% |
| **Calls Scheduled** | 8 | 7 | ↑ | 8/week |
| **Calls Completed** | 6 | 5 | ↑ | 6/week |
| **Conversions (Apps/Deals)** | 2 | 1 | ↑ | 2/week |
| **System Uptime** | 100% | 100% | → | 100% |

**Key Insights:**
- ✅ Response rate up 7% - Holly's tone resonating well
- ✅ Booking rate above target - Cal.com pre-fill working
- ⚠️ Slight dip in lead volume (holiday season?)
- 💡 Idea: Test different opening messages to boost response rate further

### Week of December 30 - January 5, 2025
*(Keep previous weeks for trend analysis)*

| Metric | This Week | Previous Week | Trend | Target |
|--------|-----------|---------------|-------|--------|
| **Leads Received** | 52 | 48 | ↑ | 50/week |
| **Response Rate** | 28% | 25% | ↑ | 30% |
| **Booking Rate** | 15% | 12% | ↑ | 15% |
| **Conversions** | 1 | 1 | → | 2/week |

---

## 🎯 Lead Review (Flagged for Team Input)

> **How to use:** When a lead needs team discussion, add them here with context. Review together and decide action.

### Active Reviews

**Lead: Sarah Chen (cmgg456xyz) - Flagged by Holly (Jan 8)**
- **Status:** ENGAGED (5 days, 8 messages, high engagement)
- **Issue:** Asking detailed rate questions that Holly can't answer
- **Holly's Messages:** "Greg or Jakub can walk you through the exact rates on the call"
- **Lead's Response:** "Can you just give me a ballpark? Don't want to waste time on a call if rates aren't competitive"
- **Team Input Needed:** Should we add rate ranges to Holly's knowledge? Or is this a qualifying question?
- **Decision:** [Greg to fill in after team discusses]

**Lead: Michael Wong (cmgg789abc) - Flagged by Jakub (Jan 7)**
- **Status:** NURTURING (10 days, 3 messages, low engagement)
- **Issue:** Not responding to SMS, should we try email?
- **Holly's Last Message:** "Hey Michael! 👋 Just checking in - still thinking about that refinance?"
- **No Response:** 4 days since last message
- **Team Input Needed:** Try email? Or wait longer?
- **Decision:** ✅ Try one email (Zach to implement)

### Resolved Reviews

**Lead: Emily Chen - Resolved (Jan 6)**
- **Issue:** Asked about No Bank Penalties Program, needed more details
- **Resolution:** Holly sent detailed email, lead booked call for Jan 9
- **Status:** CALL_SCHEDULED ✅

---

## 🔄 Daily Workflow (Recommended)

### Morning Routine (5 minutes)
1. **Check Dashboard** - Scan ENGAGED column for hot leads
2. **Review Slack Alerts** - Any errors overnight?
3. **Update This Doc** - Add daily standup entry

### Mid-Day Check (2 minutes)
1. **Check Calendar** - Confirm upcoming calls
2. **Scan NEW/CONTACTED** - Any leads needing manual attention?

### End of Day (3 minutes)
1. **Update Lead Status** - Move completed calls to CALL_COMPLETED
2. **Add Notes** - Document outcomes from calls
3. **Flag Issues** - Add to Issues Tracker if anything needs fixing

### Weekly Review (30 minutes - Monday morning)
1. **Update Metrics Dashboard** - Last week's numbers
2. **Prioritize Issues** - What needs fixing this week?
3. **Vote on Features** - Review feature requests, add votes
4. **Discuss Copy Updates** - Any messaging tweaks needed?

---

## 📝 Meeting Notes Archive

> **How to use:** Keep brief notes from team meetings about LOD2.

### January 8, 2025 - Weekly LOD2 Review
**Attendees:** Greg, Jakub, Zach

**Discussed:**
- System performing well, booking rate above target
- Decided to test urgency messaging for purchase leads
- Greg to manually handle leads asking specific rate questions
- Feature request: Manual SMS send button (high priority)

**Action Items:**
- [ ] Zach: Add manual SMS button to dashboard (by Jan 15)
- [ ] Greg: Update Holly's escalation rules for rate questions (by Jan 10)
- [ ] Jakub: Track which leads convert best (purchase vs refinance) for next meeting

**Next Meeting:** January 15, 2025 - 9:00 AM

---

## 🆘 Quick Reference

### Who to Contact

**System Issues / Bugs:**
- Zach (Slack or text)
- Expected response: Same day

**Holly's Messaging / Copy:**
- Add to "Copy & Messaging Updates" section
- Discuss in weekly meeting
- Urgent changes: Slack Zach directly

**Lead Escalations:**
- Add to "Lead Review" section
- Tag team members for input
- Critical: Call/text directly

### Common Fixes

**Lead stuck in NEW:**
- Check dashboard → Click lead → See if first message was sent
- If no message: Slack Zach (system issue)
- If message sent: Manually move to CONTACTED

**Holly sent wrong info:**
- Add to "Copy & Messaging Updates" → Proposed Updates
- Document what she said vs what she should say
- Manually follow up with lead if needed

**Booking link not working:**
- Check Cal.com calendar availability
- Verify link format: https://cal.com/team/inspired-mortgage/mortgage-discovery-call
- Slack Zach if link is malformed

---

## 📈 Success Metrics (Long-Term Goals)

### Month 1 Targets (January 2025)
- [ ] 200+ leads contacted
- [ ] 30%+ response rate
- [ ] 20%+ booking rate
- [ ] 40+ calls scheduled
- [ ] 8+ conversions

### Quarter 1 Targets (Jan-Mar 2025)
- [ ] 600+ leads contacted
- [ ] 35%+ response rate
- [ ] 25%+ booking rate
- [ ] 150+ calls scheduled
- [ ] 30+ conversions

### Annual Targets (2025)
- [ ] 2,500+ leads contacted
- [ ] 40%+ response rate
- [ ] 30%+ booking rate
- [ ] 750+ calls scheduled
- [ ] 150+ conversions

---

## 💭 Random Ideas / Brainstorm

> **How to use:** Capture random thoughts, ideas, or observations. No filtering - just brain dump. Review monthly.

- What if Holly could send voice notes instead of just text? More personal? (Greg - Jan 8)
- Could we integrate with our CRM eventually? Auto-sync lead status? (Jakub - Jan 7)
- A/B test: Emoji usage vs no emojis in first message? (Zach - Jan 6)
- Dashboard mobile app? Check leads on the go? (Greg - Jan 5)
- What's the best time of day to send first contact? Morning vs afternoon vs evening? (Jakub - Jan 4)

---

**Document Owner:** Zach Silverman
**Last Major Update:** January 8, 2025
**Next Review:** January 15, 2025

---

