# Development Board - Feature Guide

## Overview

The Development Board is a Trello-style Kanban system for tracking features, bugs, and improvements. It includes AI-powered system monitoring where Holly automatically creates cards when she detects issues.

**URL:** https://lod2.vercel.app/dev-board

---

## Features

### 1. **Kanban Board with 3 Columns**

- **New Feature Requests & Bugs** - All new cards start here
- **Working On It** - Cards you're actively developing
- **Deployed** - Completed and live in production

### 2. **Manual Card Creation**

Anyone on your team can create cards:
- Click "+ New Card" button
- Fill in: Title, Description, Type, Priority, Your Name
- Card appears in "New Feature Requests & Bugs" column

**Card Types:**
- Feature Request
- Bug Fix
- Improvement
- Optimization

**Priority Levels:**
- Low (light blue dot)
- Medium (yellow dot)
- High (orange dot)
- Critical (red dot)

### 3. **AI System Monitoring** 🤖

Holly runs every 30 minutes and automatically creates cards when she detects:

**Error Pattern Detection:**
- Repeated SMS/email delivery failures (5+ in 24h)
- Creates bug cards with error details and affected lead IDs
- Example: "12 SMS delivery failures detected in last 24h"

**Performance Anomalies:**
- Engagement rate drops 15%+ below target
- Conversion rate issues
- Example: "Engagement rate 45% is significantly below target 60%"

**Stuck Leads:**
- 10+ leads in same stage for 7+ days
- Creates improvement cards with sample lead IDs
- Example: "25 leads stuck in CONTACTED for 7+ days"

**Engagement Drops:**
- Week-over-week engagement drops 30%+
- Creates critical cards requiring immediate attention
- Example: "Engagement dropped 35% in last 7 days"

**What Holly Includes in AI Cards:**
- **Impact:** How many leads/users affected
- **Evidence:** Links to logs, lead IDs, metrics
- **Suggested Fix:** AI-generated recommendation
- **Priority:** Automatically set based on severity

### 4. **Card Details & Comments**

Click any card to see:
- Full description
- AI analysis (for Holly-created cards)
- Comment thread
- Created by and timestamps

Add comments to discuss:
- Implementation approach
- Questions or blockers
- Testing notes
- Deployment status

### 5. **Drag & Drop**

- Move cards between columns by dragging
- Auto-saves status to database
- Sets "deployedAt" timestamp when moved to Deployed

### 6. **Slack Notifications**

Every new card triggers a Slack notification:
- Shows title, description, priority, type
- "View Dev Board" button to jump directly to the board
- Critical priority cards tagged with 🚨
- AI-detected cards clearly labeled with 🤖

---

## Using the Dev Board

### For the Team (Adding Ideas/Bugs)

1. Visit https://lod2.vercel.app/dev-board
2. Click "+ New Card"
3. Enter details:
   - **Title:** Brief summary (e.g., "Add dark mode toggle")
   - **Description:** More context (optional)
   - **Type:** Feature Request or Bug Fix
   - **Priority:** How urgent is it?
   - **Your Name:** So we know who requested it
4. Submit → Card appears in first column
5. Slack notification sent automatically

### For the Developer (You)

1. Check the board daily for new cards
2. Review AI-detected issues (🤖 badge)
3. Grab a card by dragging it to "Working On It"
4. Work on the feature/fix
5. Test thoroughly
6. Deploy to production
7. Drag card to "Deployed" column
8. System sets deployment timestamp

### Holly's Monitoring Schedule

- **Runs every 30 minutes** via cron job
- Scans for errors, performance issues, stuck leads
- Creates cards automatically (max 1 duplicate per week)
- Sends Slack alert for critical issues
- No spam - intelligent deduplication

---

## Technical Details

### Database Schema

**DevCard Table:**
```typescript
{
  id: string
  title: string
  description: string?
  type: FEATURE_REQUEST | BUG_FIX | IMPROVEMENT | OPTIMIZATION
  status: NEW | IN_PROGRESS | DEPLOYED
  priority: LOW | MEDIUM | HIGH | CRITICAL
  createdBy: string // User name or "HOLLY_AI"
  metadata: JSON // AI analysis data
  createdAt: DateTime
  updatedAt: DateTime
  deployedAt: DateTime?
  comments: DevCardComment[]
}
```

**DevCardComment Table:**
```typescript
{
  id: string
  cardId: string
  content: string
  authorName: string
  createdAt: DateTime
}
```

### API Routes

- `GET /api/dev-cards` - Fetch all cards
- `POST /api/dev-cards` - Create new card (sends Slack notification)
- `GET /api/dev-cards/[cardId]` - Get single card
- `PATCH /api/dev-cards/[cardId]` - Update card (status, priority, etc.)
- `DELETE /api/dev-cards/[cardId]` - Delete card
- `POST /api/dev-cards/[cardId]/comments` - Add comment

### Cron Job

- **Path:** `/api/cron/system-monitor`
- **Schedule:** Every 30 minutes (`*/30 * * * *`)
- **Function:** `runSystemMonitor()` in `lib/system-monitor.ts`

### Components

- `DevBoard` - Main Kanban board with drag & drop
- `DevBoardColumn` - Individual column wrapper
- `DevCard` - Card display component
- `DevCardModal` - Full card details + comments

---

## Examples

### Manual Card Example

**Title:** Add bulk lead import from CSV
**Type:** Feature Request
**Priority:** Medium
**Created by:** Greg
**Description:** Allow team to upload CSV files with multiple leads at once instead of manually entering them one by one.

### AI-Detected Card Example

**Title:** 12 SMS delivery failures detected in last 24h
**Type:** Bug Fix
**Priority:** High
**Created by:** HOLLY_AI
**Description:** Multiple SMS messages are failing to send. This could indicate:
- Invalid phone number formatting
- Twilio account issues
- Rate limiting
- Recipient opt-outs

**AI Analysis:**
- **Impact:** 12 leads not contacted via SMS
- **Evidence:** Sample errors: cm5x7y8z9..., cm5x8a1b2...
- **Suggested Fix:** Check Twilio logs, verify phone number formatting, review opt-out list

---

## Benefits

### For You (Developer)
✅ Never lose track of feature requests or bugs
✅ Proactive issue detection before users complain
✅ Clear priorities based on data
✅ Historical record of what was built and when
✅ Holly acts as your QA assistant

### For the Team
✅ Easy way to submit ideas without messaging you
✅ See what's in progress vs completed
✅ Comment and discuss implementation
✅ Transparency into development roadmap

### For the Business
✅ Catch problems early (stuck leads, low engagement)
✅ Data-driven development priorities
✅ Faster iteration on system improvements
✅ Better customer experience through proactive monitoring

---

## Access

- **Dashboard Link:** https://lod2.vercel.app/dev-board
- **From Lead Dashboard:** Click "Dev Board" button in top nav
- **From Analytics:** Navigate back to dashboard first

---

## Future Enhancements

Ideas for v2:
- [ ] Voting system (team upvotes most-wanted features)
- [ ] Time estimates and tracking
- [ ] Sprint planning view
- [ ] Email notifications in addition to Slack
- [ ] Archive old deployed cards (auto-archive after 90 days)
- [ ] Holly learns from deployed cards to improve suggestions
- [ ] Integration with GitHub Issues
- [ ] Card assignment (assign to specific developer)

---

## Testing the System

### Create a Test Card
1. Visit /dev-board
2. Click "+ New Card"
3. Fill in: "Test feature" / "Just testing" / Feature Request / Low / "Your Name"
4. Check Slack for notification
5. Drag to "Working On It"
6. Add a comment
7. Drag to "Deployed"

### Trigger Holly's Monitoring (Manual)
```bash
# Run the system monitor manually
DATABASE_URL='...' npx tsx -e "import { runSystemMonitor } from './lib/system-monitor'; runSystemMonitor().then(console.log)"
```

### View Sample Cards
We created 5 sample cards during development:
- 3 manual cards (CSV import, timezone fix, DB optimization)
- 2 AI cards (SMS failures, engagement rate drop)

---

**Last Updated:** October 10, 2025
**Built by:** Zach
**For:** Inspired Mortgage Development Team
