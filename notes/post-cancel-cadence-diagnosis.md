# Post-cancellation follow-up cadence: diagnosis

Investigated 2026-09-01, following up §8 of `notes/booking-flow-diagnosis.md`.
Read-only against production; counts and patterns only, no lead data.

## 1. What happened

On 2026-08-27 an advisor cancelled a booked discovery call with the (single,
internal test) alt_private lead. Over the next four days Holly:

- sent **5** follow-up SMS to a lead who never replied again (the brief said 8:
  that figure counted the two 'no pressure' sign-offs and the Cal.com-triggered
  cancellation SMS; 5 were autonomous-cron follow-ups, 1 was the webhook's
  immediate cancellation notice);
- was **blocked 8 more times** by the 4-hour anti-spam guardrail and once by
  SMS hours, each block scheduling a retry one hour later;
- spent **10 consecutive 15-minute cron cycles** on Sep 1 deciding
  `move_stage → NURTURING` for a lead already in NURTURING (see §6).

Gaps between the unanswered sends: 4.7h, 13.8h (overnight, SMS-hours
blocked), 4.2h, 68h (Holly herself chose `wait 66h`), 6h. In other words Holly
sent whenever the 4-hour rule let her, unless she personally decided not to.

### Is it isolated?

Across all leads since 2026-03-27 (when the zero-reply backoff shipped),
counting runs of consecutive Holly outbounds with no reply in between:

| Unanswered run length | Runs | Leads |
|---|---|---|
| 1 | 161 | 48 |
| 2 | 24 | 20 |
| 3 | 32 | 32 |
| 4 | 19 | 18 |
| 5 | 5 | 5 |
| 6 | 3 | 3 |
| 7 | 5 | 5 |
| 8+ | 26 | 23 |

23 leads have received 8 or more consecutive unanswered messages. The prompt's
own rule is "move to NURTURING after 3–5 messages with no reply over 5–7
days" (`decision-engine.ts:918`, `:955`). The pattern is not specific to
cancellations; cancellation is just the state in which the prompt pushes
hardest ("recovery", "own the miss", "rebook").

Cancellations themselves are rare: 16 ever, 1 since March. The Aug 27 one is
the only advisor-attributed cancellation (attribution was added in PR #16).

## 2. Intended behaviour

Three places state the intent, and they agree:

- `lib/deal-intelligence.ts` (`68fc728`, 2026-03-27, "zero-reply cadence"):
  after an unanswered touch, widen the review gap 3d → 4d → 5d → 7d → 9d → 14d,
  "to prevent near-daily autonomous retries on silent leads".
- `lib/holly/decision-engine.ts`: "Move to NURTURING after 3–5 messages with
  no reply (5–7 days)"; NURTURING reviews every 14 days.
- `lib/holly/brain.ts` cancellation block: own the miss, offer slots, keep it
  brief. Nothing about frequency; the scheduler is supposed to own that.

So the intended shape after an advisor cancellation is: immediate apology +
rebook offer (Cal.com webhook), one follow-up, then days between touches and
a hand-off to NURTURING.

## 3. Root cause

The backoff only applied to leads who had **never** replied.

`resolveNextReviewHoursAfterOutbound()` returned the temperature-based cadence
whenever `inboundCount > 0`. Temperature for a lead who has replied at least
once is computed from `hoursSinceContact`, which is time since **Holly's**
last outbound (`lastContactedAt`), not since the lead's last reply. Every send
resets it to zero, so a once-replied lead is 'warm' forever and reviewed every
2 hours. The review finds the lead due, Holly (told the lead has "gone quiet"
and that this is a "CRITICAL" re-engagement, `decision-engine.ts:707`) chooses
to send, the 4-hour guardrail blocks it, `agent.ts` schedules a retry in 1
hour, and the loop repeats until the 4 hours have elapsed. The only thing that
ever produced a multi-day gap was Holly choosing `wait` on her own.

The guardrail is doing its job; it was never meant to be the cadence. The
cadence logic had a hole for exactly the lead who matters most: one who
engaged, then stopped.

## 4. Fix (branch `fix/post-cancel-cadence`)

- `lib/deal-intelligence.ts`: `resolveNextReviewHoursAfterOutbound` takes
  `unansweredOutboundBeforeThisSend` (outbounds since the lead's most recent
  inbound) and applies the existing 3d/4d/5d/7d/9d/14d ladder whenever that
  count is ≥ 1, regardless of whether the lead replied earlier. Replying to a
  lead's latest message keeps the conversational cadence. 'hot' leads (booked
  call, accepted offer, marked ready-for-app) remain exempt. Callers that omit
  the new field get the old behaviour. New helper `countUnansweredOutbound()`.
- `lib/holly/agent.ts`: both places that schedule the next review after a
  send (normal send, and the send_booking_link rewrite) pass the unanswered
  count.
- `tests/post-cancel-cadence.test.ts`: pins the ladder for replied-then-silent
  leads, the unchanged behaviour for never-replied and hot leads, and the
  backwards-compatible call shape. `tests/holly-timing.test.ts`: its module
  mock now includes the new helper (real implementation); no assertion
  changed.

What this produces for the Aug 27 scenario: cancellation SMS at T0 (webhook);
one follow-up ~4h later (first unanswered send, temperature cadence + 4h
guardrail); then 3 days, 4 days, 5 days… with Holly's own "move to NURTURING
after 3–5 unanswered" rule reachable well before the fifth message.

Why it is the fix: the ladder, the prompt rule and the 4-hour guardrail all
already existed and all already agreed. The scheduler simply keyed the ladder
on the wrong predicate. No new limit, no new prompt text, no guardrail change.

## 5. Verification

- `npx jest`: see PR. `holly-timing` passes unchanged in intent.
- `npx tsc --noEmit`: no new error locations versus `origin/main` in the
  touched files (tree is not type-clean on main; see the booking-flow note).
- Production check after merge: for any lead whose last inbound is older than
  their last outbound, `nextReviewAt − lastContactedAt` should be ≥ 72h
  unless the lead is 'hot'. Counting `⛔ … Too soon` guardrail notes per lead
  per day should drop to zero for silent leads.

## 6. Related, left alone

- **Invalid stage-move loop.** When Holly chooses `move_stage` to the lead's
  current stage, `agent.ts` returns without scheduling a next review, so the
  lead stays due and is re-processed every 15 minutes (10 cycles on Sep 1,
  each a Claude call). Same family (a non-send outcome that fails to
  schedule) but a different mechanism; a one-line `nextReviewAt` on the
  invalid-transition path, or telling Holly the current stage is not a valid
  target, would fix it. Not touched per instruction.
- **`/api/cron/autonomous-holly` accepts unauthenticated GETs.** Middleware
  allow-lists `/api/cron/*`, and unlike `holly-health-check` this route does
  not check `CRON_SECRET`. A production verification GET during this work ran
  a live agent cycle (it found 0 leads due; nothing was sent or written).
  Worth closing; out of scope here.
