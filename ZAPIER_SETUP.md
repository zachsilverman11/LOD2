# FinanceVine Zapier Setup

## Webhook URL

Point Zapier to: `https://your-domain.com/api/webhooks/financevine`

## Expected Payload Fields

The webhook accepts flexible JSON shapes (flat, nested `data`, or query-ish keys). Map these fields from FinanceVine:

### Required Fields
- `email` or `Email` - Lead's email address
- `phone` or `Phone` or `phone_number` - Lead's phone number (will be normalized to E.164)

### Optional Fields (map what you can)
- `first_name` / `firstName` / `First Name`
- `last_name` / `lastName` / `Last Name`
- `mortgage_type` / `Mortgage Type` / `loan_type`
- `primary_goal` / `Primary Goal` / `goal`
- `borrower_profile` / `Borrower Profile` - "approved at bank" / "not approved" / "unsure"
- `timeline` / `Timeline`
- `age_55_plus` / `55+` - Boolean for reverse mortgages
- `open_to_selling` / `Open to Selling`
- `property_value` / `Property Value`
- `mortgage_balance` / `Mortgage Balance`
- `equity_take_out` / `Equity Take-Out`
- `ltv_percent` / `LTV%`
- `province` / `Province`
- `zoning` / `Zoning`
- `property_conditions` / `Property Conditions`
- `trusted_form_cert` / `xxTrustedFormCertUrl` - TrustedForm certificate
- `lead_id` / `Lead_ID` / `unique_id` - FinanceVine's unique ID

All unmapped fields will be stored in `rawData` for future reference.

## Example Zapier Payload

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "(604) 555-1234",
  "mortgage_type": "refinance",
  "primary_goal": "debt consolidation",
  "borrower_profile": "not approved at bank",
  "timeline": "need funds this month",
  "property_value": "850000",
  "mortgage_balance": "500000",
  "province": "British Columbia",
  "lead_id": "FV-12345"
}
```

## Security

The webhook currently accepts any POST request. To secure it:

1. **Option A: Shared secret header**
   - Add a custom header in Zapier: `X-FinanceVine-Secret: your-secret-key`
   - Update the webhook route to validate this header

2. **Option B: Query parameter**
   - Use: `https://your-domain.com/api/webhooks/financevine?key=your-secret-key`
   - Update the webhook route to validate this parameter

## Testing

1. Use the health check endpoint: `GET https://your-domain.com/api/webhooks/financevine`
2. Test with a sample POST using curl or Postman
3. Check Slack for new lead notifications
4. Verify the lead appears in the dashboard with `source: financevine` and `segment: alt_private`

## Handoff Timing

The webhook enforces special timing for FinanceVine leads:
- **5-minute opt-out window**: Waits 5 minutes after ingest before first contact
- **30-minute handoff delay**: If the lead hasn't inbound-replied to us, waits ~30 minutes before first Inspired SMS
- **Immediate response**: If they inbound on our number sooner, responds immediately

This prevents double-pitching and respects FinanceVine's opt-out window.
