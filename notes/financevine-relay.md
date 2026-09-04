# FinanceVine relay: attribution, the race, and malformed relays

Branch `feat/financevine-relay`. Code in `lib/financevine-relay.ts`, wired into
`app/api/webhooks/twilio/route.ts`, `app/api/inngest/functions.ts` and
`lib/holly/agent.ts`. Tests: `tests/financevine-relay.test.ts`,
`tests/financevine-relay-race.test.ts`.

## What arrives

FinanceVine sends its intro SMS from its own number (a 778, constant across all
leads) and asks whether the lead has any questions right now. Every reply the
lead sends to that number is forwarded to our Twilio number in Twilio's own
forwarding format:

```
NEW MESSAGE FROM: 6478553592 BODY: no
```

The forwarded SMS has `From` = the vendor's 778. Replying in that thread talks
to FinanceVine, not the lead. The relay path therefore never replies to `From`:
the Twilio webhook returns empty TwiML for every relay (including opt-outs,
where the direct path would send an "unsubscribed" confirmation), no Inngest
event carries the 778, and no Lead row is ever created with the 778 as phone.

## Recognition

- **Format**: body begins with `NEW MESSAGE FROM` (case-insensitive, colons
  optional, newline tolerated between the parts, `BODY` split at the first
  label so a reply that contains the word "body" still parses).
- **Sender**: `FINANCEVINE_RELAY_NUMBER` (env, optional) pins the vendor's
  number. When set, a relay-format body from any other sender is alerted and
  not acted on (spoof protection: otherwise anyone texting our number in that
  format could make Holly text a number of their choosing), and a non-relay
  body from the pinned sender is treated as a malformed relay.
- When the env is **not** set, recognition is by format only. A malformed
  relay from the 778 then falls through to the normal inbound path, matches no
  lead, and is only logged as a webhook event. Pinning the number is what makes
  the malformed-relay alert reliable. The number is not in the repo or the
  production database yet (no relay has ever been received), so it needs to be
  read off a real relay and set in Vercel.

Area-code recognition was deliberately rejected: 778 is a BC area code and
real leads text us from 778 numbers.

## Attribution

The number inside the body is normalised to E.164 (10 digits, 11 digits with a
leading 1, full E.164, punctuation all accepted; anything else is rejected
rather than guessed at). Lookup goes through `findLeadByPhone`, the same
deterministic matcher the direct path uses, so a lead's direct replies to our
number and their further relayed replies to the 778 land on the same row.

The lead's words (not the wrapper) are stored as an inbound `Communication`
with `metadata.relay = true`, `metadata.from` = the lead's number and
`metadata.relayedVia` = the sender. Holly sees the message in her history like
any other inbound; the agent adds a relay handoff briefing (open as a
continuation of the FinanceVine text from our own number, do not re-ask what
they answered, a bare "no" answers "any questions?" and is neither disinterest
nor an opt-out, never address a lead as "Unknown").

`Communication.twilioSid` is unique, so a Twilio retry of the same MessageSid
is detected first and returns without a second attribution or a second Holly
run.

## The reply-before-webhook race

The intro fires the same instant the lead webhook is delivered, and about half
of leads reply quickly, so the relay regularly beats the Lead row.

- **Relay first**: a provisional Lead is created keyed on the E.164 number:
  placeholder email `financevine-relay-<digits>@provisional.invalid` (email is
  required and unique), `firstName` "Unknown", `source` financevine, `segment`
  alt_private, `consentSms` true, `rawData.provisional = true` plus an
  `ingestTimestamp` so the agent's FinanceVine timing block applies. The first
  message is stored against it immediately. Holly is queued with a 120 s delay
  (Inngest `step.sleep`) and `nextReviewAt` set two minutes out as the cron
  fallback, so the webhook can land and replace the placeholders before she
  opens. A "new lead" Slack notification fires here because the webhook will
  take its update path and not send one.
- **Webhook lands**: its existing-lead lookup is `OR(email, phone)`, so it
  finds the provisional row by phone and updates it in place with the real
  name, email and profile. One row, no duplicate, first message kept. The race
  test drives the real, unmodified webhook handler against the provisional row
  to pin this.
- **Webhook first**: the relay finds the lead and attaches. The 30-minute
  handoff delay collapses, as it does for a direct reply: `nextReviewAt` = now
  and Holly is queued immediately.

Known gap, owned by the webhook (another session owns that file at the time of
writing, and has been asked): the update path re-asserts `consentSms: true`,
which undoes a relayed opt-out that arrived seconds earlier. Backstop in place:
the opt-out text is stored as the first inbound Communication, and the agent's
FinanceVine first-inbound guard now uses the same `isOptOutMessage` classifier
as the relay path, so the cron path stays closed even after the flag flips.
The webhook also logs that merge as a "re-submission", which is cosmetic.

## Opt-out

`isOptOutMessage` is explicit by design: stop, unsubscribe, opt out, don't
contact/text/call/message me, remove me, take me off, leave me alone, not
interested (as a stance; "not interested in refinancing, I want to buy" is a
topic correction and does not match), wrong number. "no", "nope", "no thanks",
"not right now", "nothing" answer the vendor's question and open the thread.

On opt-out: `consentSms = false`, `nextReviewAt = null`, an `SMS_RECEIVED`
activity with `metadata.optOut = true`, the inbound stored, no Inngest event,
empty TwiML. A provisional row created from an opt-out is created already
opted out.

## Malformed relays

A body that starts with the label but does not parse (no number, a number that
is not 10/11 North American digits, an empty reply), a number equal to the
sender or to our own number, or a relay-format body from an unpinned sender
when the sender is pinned: each writes a `WebhookEvent` with
`eventType = sms.relay.malformed` (or `sms.relay.unexpected_sender`),
`processed = false` and the reason in `error`, and sends a Slack error alert
carrying the MessageSid and a digit-masked shape of the body. No lead is
created, no Communication stored, no Holly run, empty TwiML.

## Not built (product decisions)

- Pinning the vendor number requires a Vercel env change.
- Whether a relayed opt-out should survive a later form re-submission by the
  same lead is the webhook's call (see gap above).
- The vendor's intro may name a specific advisor; if so the opener needs an
  advisor-name bridge. Unknown until a real intro SMS is read.
