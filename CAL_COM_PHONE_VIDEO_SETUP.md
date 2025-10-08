# Cal.com Phone or Video Call Setup

## How to Offer Phone OR Video Call Options in Cal.com

Cal.com allows you to offer multiple location options to leads when they book. Here's how to set it up:

### Step 1: Access Your Event Type Settings

1. Log into https://cal.com
2. Go to **Event Types**
3. Find your "Mortgage Discovery Call" event type
4. Click **Edit** (gear icon)

### Step 2: Configure Location Options

1. Scroll to the **"Where"** or **"Location"** section
2. Click **"Add location"**
3. You should add BOTH of these options:

#### Option A: Phone Call
- Select **"Phone Call"** from the list
- This will prompt the lead to enter their phone number when booking
- The phone number will be displayed in the booking confirmation

#### Option B: Video Call
- Select your video conferencing tool:
  - **Google Meet** (recommended if using Google Calendar)
  - **Zoom**
  - **Microsoft Teams**
- Connect your account if prompted

### Step 3: Let Lead Choose

Once you have both options added:

1. Check the box **"Let invitee choose"** or **"Attendee can choose"**
2. This shows a dropdown to the lead during booking where they select their preference
3. Save the event type

### Step 4: How It Works

When a lead books a call:
1. They fill out the form (name, email, etc.)
2. They see a **"Location"** dropdown with options:
   - "Phone Call"
   - "Google Meet" (or your video platform)
3. If they choose **Phone Call**:
   - They enter their phone number
   - Advisor calls them at the scheduled time
4. If they choose **Google Meet**:
   - A video link is automatically generated
   - Link is sent to both parties
   - Lead joins via browser (no app needed)

### Step 5: Webhook Integration

Our system already handles both scenarios:
- **Phone calls**: Phone number is in `responses.location.value`
- **Video calls**: Meeting URL is in the booking metadata

The Cal.com webhook payload will include the chosen location, and our system already passes this through to the appointment record.

### Testing

1. Go to your Cal.com booking page
2. Try booking a test appointment
3. Verify you see the location dropdown
4. Test both phone and video options
5. Check that confirmation emails include the right info

### Best Practice Recommendations

**Phone Call Option:**
- Good for leads who are driving or multitasking
- More personal feel
- No tech barriers

**Video Call Option:**
- Better for screen sharing (showing mortgage options)
- Advisor can show visual aids
- Lead can share documents live

**Suggested Default:** Let the lead choose - some prefer phone, some prefer video!

---

## Current Setup

Your Cal.com event is already configured in our system:
- Event Type ID: `3298267` (mortgage-discovery-call)
- Team: Inspired Mortgage
- Duration: 15 minutes
- Advisors: Greg Williamson, Jakub Huncik (round-robin)

The webhook integration will automatically:
1. Create appointment in our system
2. Send confirmation via Holly
3. Track location preference
4. Send reminders 24h and 1h before call

---

## Need Help?

If you need assistance with Cal.com settings:
1. Check https://cal.com/docs
2. Contact Cal.com support
3. Or let me know and I can help troubleshoot!
