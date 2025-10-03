#!/bin/bash
curl -X POST http://localhost:3001/api/webhooks/leads \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: test123" \
  -d '{
    "email": "john.doe@example.com",
    "phone": "+14165551234",
    "firstName": "John",
    "lastName": "Doe",
    "source": "website",
    "consentEmail": true,
    "consentSms": true,
    "consentCall": true,
    "metadata": {
      "campaign": "spring-2024"
    }
  }'
