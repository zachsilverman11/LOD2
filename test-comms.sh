#!/bin/bash

echo "🧪 Testing Communication Channels"
echo "=================================="
echo ""

# Get the first lead ID from the database
echo "📝 Getting test lead from database..."
LEAD_ID="cmgbe5k0a0000hepo26orntac"  # John Doe from earlier

echo "Using Lead ID: $LEAD_ID"
echo ""

# Test email
echo "📧 Testing SendGrid email..."
curl -X POST http://localhost:3001/api/communications/email \
  -H "Content-Type: application/json" \
  -d "{
    \"leadId\": \"$LEAD_ID\",
    \"subject\": \"Test Email - Your Mortgage Journey\",
    \"htmlBody\": \"<h2>Hi John,</h2><p>This is a test email from your Lead Conversion System!</p><p>If you received this, SendGrid is working perfectly! ✅</p>\"
  }"

echo ""
echo ""

# Test SMS  
echo "💬 Testing Twilio SMS..."
curl -X POST http://localhost:3001/api/communications/sms \
  -H "Content-Type: application/json" \
  -d "{
    \"leadId\": \"$LEAD_ID\",
    \"body\": \"Hi John! This is a test SMS from your Lead Conversion System. Twilio works! ✅\"
  }"

echo ""
echo ""
echo "✅ Tests sent! Check:"
echo "1. Email inbox for john.doe@example.com"  
echo "2. Phone +14165551234 for SMS"
echo "3. Dashboard at http://localhost:3001/dashboard"
