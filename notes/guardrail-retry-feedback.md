# Guardrail retry feedback: informed, bounded retries

Branch: `fix/guardrail-retry-feedback` (on main a5edc34). Status: built, awaiting production verification.

## The problem

When a hard guardrail blocked Holly's message, `lib/holly/agent.ts` wrote a
`guardrailBlock` LeadActivity and rescheduled the lead for `now + 1h`. The next
run regenerated from identical inputs; the block reasons never reached the
model. For phrasing violations that was a wasted Claude call per hour. For the
alt-lending numeric guardrail (PR #23, behind `HOLLY_ALT_LENDING_GUARDRAILS`,
still off) it is a trap: the LTV, property value and balance Holly was blocked
for saying sit in her briefing, so the regeneration reproduces the figure.

## What changed

Two new modules, no schema change, no guardrail touched.

- `lib/holly/guardrail-retry.ts` (pure): derives the loop state from the
  LeadActivity rows the block path already writes, builds the retry prompt, and
  builds the Slack text.
- `lib/holly/guardrail-escalation.ts`: the DB + Slack side, shared by the agent
  and the cron nudge path.

Behaviour, per lead:

1. **Feedback on retry.** The most recent content block since the last
   communication is appended to the decision prompt as `extraContext`: the
   rejected message verbatim, the guardrail's own reason strings numbered, and
   rules for the attempt (see prompt shape below).
2. **Counting.** Consecutive *content* blocks since the last communication in
   either direction. Scheduling blocks (SMS hours, anti-spam "Too soon") are not
   strikes: the same message passes when the clock allows, and there is nothing
   for the model to learn. A block that mixes a time error with a content error
   is one strike, with only the content reasons kept.
3. **Reset.** Any Communication row, inbound or outbound, ends the streak. An
   inbound reply changes the inputs. An outbound send (Holly's own, or an
   advisor's manual SMS from the dashboard) means the chain was broken, which is
   what "a human intervened" looks like in this data model.
4. **Escalation at 3.** On the third consecutive content block the lead gets a
   `guardrailEscalation` activity, a `lead_escalated` Slack alert carrying the
   reasons and the blocked action (not the rejected message text, which may
   contain the lead's figures), and `nextReviewAt = now + 7d`.
5. **Stop.** While an escalation is newer than the last communication, a cron
   run makes no Claude call. It re-parks another 7 days and re-sends the alert
   as a reminder, so the lead is never silently orphaned and never looped. A
   reply (`sms_reply` trigger) always proceeds; the reply itself clears the
   state.

## Threshold: 3

Two is too tight for a stochastic generator: one honest miss on the retry, and
a lead that could have been handled goes to a human. Four or more means the
lead sits for 3+ hours of hourly blocked attempts, each a Claude call, before
anyone is told. Three gives the model exactly one informed retry and one final
warned retry ("this is your last try before this lead is handed to a human"),
and the whole cycle from first block to escalation is about two hours. The
constant is `GUARDRAIL_ESCALATION_THRESHOLD`; the tests read it, so changing it
is one line.

## Retry prompt shape

Placed where the post-cancellation context already goes, right before the
decision task, so it is the last thing the model reads before deciding.

```
## ⛔ YOUR PREVIOUS ATTEMPT WAS REJECTED BY SAFETY GUARDRAILS (attempt 2 of 3)

Your last decision (send_sms) was blocked by a hard guardrail and NOT sent.
Rejected message (never sent — the lead did not see it):
"<verbatim>"

Why it was rejected:
1. <guardrail error string>
2. <guardrail error string>

Rules for this attempt:
- Fix every reason above. ... After 3 consecutive blocks this lead is handed to a human and you stop.
- The figures in your briefing (property value, mortgage balance, LTV, rates,
  fees) are context for YOUR understanding only. Do not put any of them ... in
  the message — not as digits, not spelled out in words, not as a fraction or a range.
- If you cannot say something useful without the blocked content, choose "wait"
  or "escalate" instead of sending.
```

Why this shape:

- **The rejected message is included verbatim.** A concrete "not this" anchor
  outperforms an abstract rule. The model also needs to know the lead never saw
  it, or it writes a follow-up to a message that does not exist.
- **The reasons are the guardrail's own strings, de-duplicated.** They were
  written to be instructive ("Remove the number. General phrasing ... is
  allowed; figures are not."). A message that trips the decimal-rate rule, the
  alt_private phrase bans and the numeric guardrail yields one list with each
  reason once, in guardrail order.
- **The briefing-figures bullet is conditional.** It appears when any reason is
  numeric (rate percentage, GUARDRAIL #8, dollar amount, loan-to-value). It
  addresses the trap directly: the numbers are in the prompt on purpose, and the
  model must be told they are read-only. For a pure phrasing block the bullet
  is instead "the rule bans the meaning, not the wording", because the failure
  mode there is paraphrasing around a banned phrase.
- **wait / escalate is offered as the exit.** Both pass every guardrail. The
  model should be able to choose them over a third doomed send.

## The cron nudge path (`lib/automation-engine.ts`)

Included, deliberately, in a narrower form. Its `getHollyDecision` had the same
gap (block reasons went to LeadActivity only) and the same numeric trap. It now
reads the same state, feeds the same retry context, writes the same
`blockedMessage` in its block activity, and calls the same escalation at the
threshold. Blocks from either path count toward one streak because both write
the same rows.

What it does *not* do: reschedule. Its callers fire on their own day-based and
24h/48h windows, so a block there is already bounded, and adding `nextReviewAt`
writes from the automation engine would cross into the cadence work from PRs
#20-#22. The safety-net review after escalation is written by the shared
escalation helper, which is the one place both paths agree a review must exist.

## Escalation target

Shared channel via `sendSlackNotification({ type: 'lead_escalated' })`, the same
call the existing `escalate` action and the PR #22 cancellation alert use. There
is no assigned-advisor field on Lead, so the existing pattern settles it; if an
advisor-routed alert is wanted later it is a one-line change in
`escalateGuardrailLoop`.

## Human intervention, concretely

Holly resumes on this lead when any of these happen:

- the lead texts back (Twilio webhook → Communication row → `sms_reply` run)
- an advisor sends a manual SMS from the dashboard (Communication row)
- Holly is turned off on the lead (`hollyDisabled`), for a manual relationship

The Slack alert says exactly this.

## Not changed

No guardrail rule, no message rewriting, `HOLLY_ALT_LENDING_GUARDRAILS` still
off, no schema, no Vercel/env, none of classify.ts, alt-lending.draft.ts,
Lead.vertical, the stash, or `lib/autonomous-agent.ts` (which also writes
`guardrailBlock` rows; if it ever runs they count, which is correct).

## Evidence

- `tests/guardrail-retry.test.ts` (16): reason coherence, counting, resets,
  awaiting-human, prompt shape, Slack text without the message.
- `tests/guardrail-retry-agent.test.ts` (12): through
  `processLeadWithAutonomousAgent` with the real `validateDecision`
  (`HOLLY_ALT_LENDING_GUARDRAILS=on` in the test process only): reasons present
  on retry, count increments, reply resets, anti-spam is not a strike, third
  block escalates and parks, escalated lead gets no Claude call, reply
  reactivates, and every block outcome writes exactly one future review.
- Two existing agent tests gained a `leadActivity.findMany` mock entry
  (`post-cancellation-agent`, `holly-timing`); no assertions changed.
- tsc: same error set as main in every touched file (150 total, unchanged).
- Jest: 232 passed, the 3 known pre-existing failures only
  (`lead-segmentation`, `anthropic-cache`).
