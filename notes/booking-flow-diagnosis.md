# Holly direct-booking path: diagnosis

Investigated 2026-09-01 against production (Neon, read-only session:
`default_transaction_read_only=on`), Vercel runtime logs, and the deployment
history. No lead-identifying data appears in this note; counts and patterns only.

## 1. Verdict

**The failure is real, but it is not a FinanceVine failure and it is not new.**

- The prompt rule that gates `book_directly` on "this lead has an email on file
  (see lead profile in context)" was introduced in `889ca8b` on **2026-03-27**.
  The briefing did not render an email until `b0edc6b` (merged in `5297ff9`,
  deployed to production 2026-09-01 23:02 UTC). For five months Holly was told
  to check a field she was never shown.
- It misfired on **every** lead source, because every lead goes through the
  same prompt. FinanceVine only made it visible because the alt_private
  playbook forbids the booking-link fallback Holly used to hide behind.
- The **production alt_private cohort is one lead**, an internal test lead
  created 2026-08-26 via the FinanceVine webhook. There are no real FinanceVine
  leads in the database yet. Everything below about "FinanceVine" is that one
  conversation.
- `b0edc6b` closes the gap for the prompt side. This branch closes the
  execution side and fixes the one guardrail bug in the same area. Neither is
  a workaround: see §5.

## 2. The live path (there is only one)

`HOLLY_PROMPT_VERSION` is not read anywhere in tracked code. The V2 files
(`lib/holly/system-prompt.ts`, `user-message.ts`) are untracked local work.
V1 is the only path, and it is:

```
Twilio inbound SMS  →  app/api/webhooks/twilio  →  Inngest "lead/reply"
  →  lib/holly/agent.ts processLeadWithAutonomousAgent
  →  lib/holly/decision-engine.ts askHollyToDecide   (prompt + buildHollyBriefing)
  →  lib/holly/guardrails.ts validateDecision
  →  lib/holly/conversation-handler.ts executeDecision
  →  lib/direct-booking.ts bookLeadAppointmentDirectly  →  Cal.com v2
```

The 15-minute cron (`/api/cron/autonomous-holly`) enters at the same
`processLeadWithAutonomousAgent`. `handleConversation` in
`conversation-handler.ts` (the tool-calling handler) is only reached from the
Finmo / Cal.com / inbound-email webhooks and `automation-engine.ts`, not from
SMS replies. So the fix lands on V1: `decision-engine.ts` + `brain.ts`
(already merged), `guardrails.ts` and `direct-booking.ts` (this branch).

## 3. Evidence

### 3.1 The FinanceVine test conversation (2026-08-26)

Deployment serving the conversation at the moment of booking: `8665fd5`
(deployed 19:02 UTC), which already contained PR #13's booking rules and the
"email on file" gate.

| UTC | Lead said | Holly did | Note |
|---|---|---|---|
| 18:11 | "my income is tricky" | Sent the Cal.com link unasked | PR #13's rewrite did not exist yet on the deployment at 18:11 (`4607cd1`) |
| 18:42 | asked for times this week | **Nothing** | Holly chose the link again; a duplicate-link guard blocked it and no reply went out. Lead re-sent the same message 53 minutes later |
| 19:35 | (same message again) | Offered four slots | Two of the four were not in the live availability list |
| 19:36 | picked one of them | "that slot just got taken", offered real slots | Covering for the phantom slot |
| 19:37 | picked a real slot | **`book_directly` succeeded** | Cal.com attendee email == the Lead row's email |

Holly's stored reasoning for that final decision reads, verbatim apart from
the name: *"'bookingLeadEmail' is required for book_directly. The lead profile
doesn't show an email. But the instructions say to use book_directly when lead
has email on file… I should still attempt book_directly with what I have."*
She booked anyway, and it worked because `direct-booking.ts` falls back to
`lead.email` when the model omits the field. That is the gate misfiring and
being rescued by the execution layer, on the only FinanceVine booking that has
ever happened.

Two earlier Holly turns on the same lead (19:35 on Aug 26, and Aug 28) also
contain "I don't have [their] email … so I can't use book_directly" and chose
`send_sms` instead.

### 3.2 The same pattern across all leads since the gate landed (2026-03-27)

Outbound Holly messages whose stored reasoning says some form of "no email on
file, can't book_directly":

| Followed by | Messages | Distinct leads |
|---|---|---|
| `send_sms` (did not book) | 8 | 6 |
| `book_appointment_directly` (booked anyway) | 3 | 3 |

Outbound messages that **ask the lead for their email address**: 12, on 12
leads, **all of which had an email on the Lead row** (the column is `NOT NULL`
and every ingest webhook requires it). 7 of the 12 came immediately after the
lead had just named a day or time.

What Holly did the first time a lead named a day/time (inbound matched a
weekday / "tomorrow" / `h:mm` / am-pm pattern), across all leads:

| Month | Sent link | Offered times | Asked for email | Booked directly | No reply / other |
|---|---|---|---|---|---|
| 2026-03 | 2 | 2 | 0 | 1 | 1 |
| 2026-04 | 9 | 1 | 1 | 0 | 1 |
| 2026-05 | 1 | 0 | 0 | 0 | 3 |
| 2026-08 | 0 | 1 | 0 | 1 | 0 |

Appointments created since 2026-03-27: 29, of which 2 were booked directly by
Holly. The rest came through the link.

### 3.3 What has *not* happened

- No `send_booking_link` rewrite (`🔄 Booking Link Rewritten` activity) has
  fired in production since PR #13 shipped. The availability guardrail has not
  had an opportunity to block a real booking: no lead has named a time since
  Aug 26 19:37 UTC.
- No `no_email` fallback (`execPath: …/no_email_fallback`) has ever been
  recorded. The execution layer never lacked an email.
- No `⛔ Holly Blocked by Safety Guardrails` note in the last week cites the
  booking-link or alt_private rules. Every block on the test lead is the
  4-hour follow-up cadence rule or SMS hours.

## 4. Root cause

The booking flow made the model responsible for relaying a fact the system
already holds, in two places:

1. **The prompt** asserted a precondition ("email on file") that the briefing
   did not render. The model, correctly, could not confirm it, and did what
   its instructions told it to do when the precondition fails: send SMS, ask
   for the email, or send the link. Each of those is an observed outcome in
   §3.2. `Lead.email` is `NOT NULL` in the schema and required by every ingest
   webhook, so the precondition was always true and the branch that asks for
   an email is unreachable in practice.
2. **The executor** preferred the model's `bookingLeadEmail` over the Lead
   record (`decision.bookingLeadEmail || lead.email`). While the briefing
   printed no email, that field could only be omitted (fine, fallback fires)
   or invented (Cal.com invite to a wrong address). Nothing in the data shows
   an invented address, but nothing prevented one either.

The FinanceVine-specific fear in the brief (availability guardrail closing off
the fallback and leaving Holly with no legal move) is not what happens: when
`send_booking_link` is blocked, `agent.ts` rewrites it to `send_sms` offering
real slots. The lead gets a message. The real cost is the one in §3.2: the
lead names a time and gets a link, a question, or a request for an email they
already gave, instead of a booking.

### 4.1 The failing test in this area

`tests/harper-test-fixes.test.ts › recognizes various "send link" request
patterns` failed on "can you get me the link". The pattern was
`/can (you |i )get (the |a )?link/i`, which does not allow "me". The
consequence in production: a lead who says "can you get me the link" is
treated as not having asked, `send_booking_link` is blocked by the availability
guardrail, and Holly is rewritten into offering times instead of honouring an
explicit request. That is a real (if narrow) miss, not a test artefact. The
same six-pattern list was duplicated verbatim in a second guardrail (cal.com
URL inside `send_sms`), so the two could drift.

## 5. The fix, and why it is the fix

**Already merged (`b0edc6b`, live since 2026-09-01 23:02 UTC):** the briefing
renders `**Email on file:** …` from `lead.email`, explicitly passed from
`decision-engine.ts`. The precondition the prompt asks the model to check is
now visible. This alone should end the "no email on file" reasoning; §7 says
how to confirm.

**This branch (`fix/booking-email-path`):**

- `lib/direct-booking.ts`: the attendee email is `lead.email` first, the
  model's `bookingLeadEmail` only when the record has none, with a warning
  when the two disagree. The Lead row is the system of record; the model is a
  relay. This removes the last place a transcription slip could reach Cal.com.
- `lib/holly/guardrails.ts`: one exported `LINK_REQUEST_PATTERNS` /
  `leadAskedForBookingLink()` shared by both guardrails, with the "can you get
  **me** the link" phrasing (and "can you send/text me the link") recognised.
  The availability guardrail itself is unchanged: it still blocks
  `send_booking_link` whenever live slots exist unless the lead's own words
  asked for a link. The alt_private bans are untouched.
- `tests/booking-email-path.test.ts`: pins that the briefing renders the
  email from the Lead row (and from rawData when that is all there is), that
  it only says "No email on file" when there truly is none, and that direct
  booking uses the record's email even when the model relays a different one.

Why not a workaround: none of this special-cases FinanceVine, adds a retry, or
loosens a guardrail. It makes the prompt's precondition observable and makes
the executor stop trusting a relayed value over the record. The prompt gate
text itself is left as is: it is now satisfiable and it documents why Cal.com
needs the email.

## 6. Verification on this branch

- `npx jest`: 146 tests, 143 pass; the 3 failures sit in 2 suites that also
  fail on a clean `origin/main` checkout and are outside this area:
  `tests/lead-segmentation.test.ts` (intent ordering, per the brief) and
  `tests/anthropic-cache.test.ts` (reads `mock.calls[1]` after a `mockClear`;
  a test bug). The brief listed two failing suites on main; there are three.
  `harper-test-fixes` now passes with the test unmodified.
- `npx tsc --noEmit`: the tree is **not** type-clean on `origin/main` (126
  error locations in tracked files, mostly `scripts/`, the dead
  `lib/autonomous-agent.ts` island, and older tests). Diffing error locations
  against a clean `origin/main` checkout, this branch introduces **zero** new
  errors; the files it touches have none.
- Vercel preview: see the PR / deployment link in the handoff.

## 7. How to confirm in production after merge

Deterministic checks, all read-only:

1. `Communication.metadata.aiReasoning` on outbound messages created after the
   deploy should stop matching `no email|doesn.t show an email|don.t have
   (their|an|the) email|email on file` in the "can't book" sense. Baseline:
   11 such messages since March, 3 of them in the last week.
2. Outbound messages asking for an email address should stop appearing
   (baseline 12 since March, all avoidable).
3. The next lead who names a time with live slots available should produce a
   `Communication` with `intent = 'booking_confirmed'` and an
   `APPOINTMENT_BOOKED` activity with `directBooking: true`, not a
   `booking_link_sent`.
4. Runtime logs: no `[Direct Booking] … differs from the Lead record` warning
   (if one appears, the model relayed a wrong email and the record won).

## 8. Seen along the way, deliberately left alone

- **Stage-move spin on the test lead.** Every 15 minutes Holly decides
  `move_stage` to `NURTURING` for a lead already in `NURTURING`; `agent.ts`
  rejects it as an invalid transition, returns without touching
  `nextReviewAt`, and the cron picks the lead up again next cycle. Ten
  consecutive cycles on Sep 1 did this, each a full Claude call. Not in scope,
  but it is burning tokens on every lead that reaches this state.
- **Post-cancellation cadence.** After the advisor cancelled the Aug 27 call,
  Holly sent 8 follow-ups in 4 days to a silent lead. The 4-hour rule blocked
  another 9 attempts. Holly's own reasoning calls this "bombarding". Separate
  problem.
- **Phantom slots.** Holly offered times not in the live list on Aug 26
  (fixed the same day by PR #15's timezone change, per the commit message; not
  re-verified here).
- `tests/lead-segmentation.test.ts` and `tests/anthropic-cache.test.ts`, as
  above.
- The `No email on file` branch in `brain.ts` is unreachable given the schema.
  Kept: it is the honest fallback if the invariant ever changes.
