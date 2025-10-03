#!/bin/bash

echo "🧪 Testing Lead Conversion System Integrations"
echo "=============================================="
echo ""

# First, create a test lead
echo "📝 Step 1: Creating test lead..."
LEAD_RESPONSE=$(curl -s -X POST http://localhost:3001/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "phone": "+17787695736",
    "firstName": "Test",
    "lastName": "User",
    "status": "NEW",
    "consentEmail": true,
    "consentSms": true,
    "consentCall": true
  }')

LEAD_ID=$(echo $LEAD_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$LEAD_ID" ]; then
  echo "❌ Failed to create test lead"
  echo "Response: $LEAD_RESPONSE"
  exit 1
fi

echo "✅ Lead created with ID: $LEAD_ID"
echo ""

# Test email
echo "📧 Step 2: Testing SendGrid email..."
EMAIL_RESPONSE=$(curl -s -X POST http://localhost:3001/api/communications/email \
  -H "Content-Type: application/json" \
  -d "{
    \"leadId\": \"$LEAD_ID\",
    \"subject\": \"Test Email - Your Mortgage Journey Starts Here\",
    \"htmlBody\": \"<h2>Hi Test,</h2><p>This is a test email from your Lead Conversion System!</p><p>If you received this, SendGrid is working perfectly! ✅</p>\",
    \"variables\": {\"firstName\": \"Test\"}
  }")

echo "Response: $EMAIL_RESPONSE"
echo ""

# Test SMS
echo "💬 Step 3: Testing Twilio SMS..."
SMS_RESPONSE=$(curl -s -X POST http://localhost:3001/api/communications/sms \
  -H "Content-Type: application/json" \
  -d "{
    \"leadId\": \"$LEAD_ID\",
    \"body\": \"Hi Test! This is a test SMS from your Lead Conversion System. If you got this, Twilio works! ✅\",
    \"variables\": {\"firstName\": \"Test\"}
  }")

echo "Response: $SMS_RESPONSE"
echo ""

echo "=============================================="
echo "✅ Integration tests complete!"
echo ""
echo "Check:"
echo "1. Email inbox at test@example.com"
echo "2. Phone +17787695736 for SMS"
echo "3. Dashboard at http://localhost:3001/dashboard"
echo ""
echo "Lead ID for reference: $LEAD_ID"
