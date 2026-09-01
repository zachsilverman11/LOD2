# Post-cancellation behaviour: diagnosis and rebuild

Investigated 2026-09-01. Read-only against production; patterns and timings
only, no lead data. Companion to `notes/post-cancel-cadence-diagnosis.md`
(PR #21, the scheduling-ladder half) and §8 of
`notes/booking-flow-diagnosis.md`.

## 1. Verdict

There is no single "cadence knob". The six-message run after the 2026-08-27
advisor cancellation was produced by five mechanisms that each did their job
in isolation and, combined, treated a cancellation as an outreach trigger:

| # | Mechanism | Where | Effect on the test lead |
|---|---|---|---|
| 1 | The Cal.com webhook sends the apology but never touches `nextReviewAt`, which was already in the past (set while the call was booked; the cron skips booked leads without rescheduling them). | `app/api/webhooks/calcom/route.ts` | Cron re-reviewed the lead **13 minutes** after the apology. |
| 2 | A lead who has ever replied is scheduled on the temperature cadence (2–6 h), because temperature keys on time since *Holly's* last message. | `lib/deal-intelligence.ts` (fixed in PR #21) | Every send booked the next review 2 h out. |
| 3 | The only thing between reviews and sends was the 4-hour anti-spam guardrail, and a block retried in **1 hour**. | `lib/holly/guardrails.ts`, `lib/holly/agent.ts` | 10 blocks in 5 days, each a Claude call; sends landed as soon as 4 h had passed: 4.7 h, 4.2 h, 6.0 h gaps. |
| 4 | The decision prompt applies conventional hooks universally: "You MUST reference the personalised Mortgage Strategy Report in at least one message per thread", a cash-back re-engagement hook, and a selected booking hook. Only the briefing (brain.ts) was segment-gated. | `lib/holly/decision-engine.ts` | Holly's own reasoning on Aug 27 said the report "would feel tone-deaf given the cancellation"; by message 5 (Aug 31) she complied with the mandate. |
| 5 | "Never promise a last message" existed only as prompt text (since 2026-03-27). Nothing made it unsendable. | `lib/holly/brain.ts`, `decision-engine.ts` | Message 5: "last one from me for a while". Message 6: six hours later. |

The repeated apology has the same root as #1–#3: the cron path never sees the
cancelled appointment (it loads only *active* appointments), so Holly's only
knowledge of the cancellation is her own earlier apology in the conversation
history, and each new message continues that thread. Nothing told her the
apology was already done.

The NURTURING → NURTURING spin shares a cause with the cadence problem, so it
is fixed here too: the webhook parks the lead in NURTURING, the prompt tells
Holly to "move to NURTURING when the lead goes cold after engagement", Holly
obliges, `agent.ts` rejects the transition and returns **without scheduling a
next review**, so the lead is still due 15 minutes later. Ten consecutive
Claude calls on Sep 1 with no outcome.

## 2. Evidence (production, read-only)

Single alt_private lead, FinanceVine test, `managedByAutonomous = true`, so
the autonomous cron is the only sender; the automations cron only processes
`managedByAutonomous = false` leads.

Outbound after the cancellation (times PT, gap from previous outbound):

| Msg | Time | Gap | Source | Flags |
|---|---|---|---|---|
| apology | Aug 27 1:33 PM | — | Cal.com webhook (same minute as `APPOINTMENT_CANCELLED`) | apology, rebook |
| 2 | Aug 27 6:15 PM | 4.7 h | cron | apology, "no pressure" |
| 3 | Aug 28 8:00 AM | 13.8 h | cron (SMS-hours opened) | |
| 4 | Aug 28 12:15 PM | 4.2 h | cron | |
| 5 | Aug 31 8:30 AM | 68.3 h (Holly chose `wait 66h`) | cron | **finality promise, Strategy Report, rate language** |
| 6 | Aug 31 2:30 PM | 6.0 h | cron | "no pressure" |

Guardrail blocks between those sends: Aug 27 1:46 PM (13 min after the
apology), 3:01, 4:01, 5:01, 8:16, 9:30 PM (SMS hours); Aug 28 10:02, 11:15 AM;
Aug 31 4:45, 5:45 PM. Every one is "Too soon … (4h minimum)" except the
SMS-hours one; every one re-scheduled +1 h.

The lead never replied after the cancellation. Lead status is NURTURING (set
by the webhook), so the "move to NURTURING" decisions on Sep 1 were no-ops.

Relevant code facts, verified:

- `agent.ts` loads `appointments` with `status IN (scheduled, confirmed)`; the
  cancelled appointment is invisible to the cron path, so brain.ts's
  "CANCELLATION DETECTED / recovery approach" block never renders there. It
  renders in the webhook path (conversation-handler), which is the apology.
- `askHollyToDecide` renders the report mandate whenever there is no upcoming
  appointment, with no segment check; `selectBookingHook` and the cash-back
  hook likewise.
- The invalid-transition branch in `agent.ts` returned without a
  `nextReviewAt` write.
- Only Holly V1 exists on main. `HOLLY_PROMPT_VERSION` appears in
  `.env.example` and a comment in guardrails.ts; no tracked code reads it, and
  `lib/holly/system-prompt.ts` / `user-message.ts` are untracked local files.
  The fix lands on V1 (decision-engine.ts, agent.ts, brain.ts, guardrails.ts,
  the Cal.com webhook). There is no second path that needs it.

## 3. Intended behaviour, and where each piece now lives

| Intent | Mechanism | File |
|---|---|---|
| Advisor is notified so they can own the apology | Advisor-cancel now raises a `lead_escalated` Slack alert naming who cancelled and asking them to reach out personally; lead-cancel keeps the plain notice. | `post-cancellation.ts` → `buildCancellationSlackDetails`, webhook |
| One sincere apology, then hold | Webhook sends the apology (prompt now says "this is the ONE apology, no cadence promises") and sets `nextReviewAt = now + 48h`. If the cron sees the lead anyway (e.g. a retry), `resolvePostCancellationPolicy` returns `hold` and re-parks it at apology + 48 h **before any Claude call**. | webhook, `agent.ts`, `post-cancellation.ts` |
| At most one further follow-up, ≥ 48 h later | Phase `follow_up_due` after the hold; Holly is asked once, with a context block: no second apology, one light line, no cadence promise, no off-playbook hooks for alt_private, `wait` is a valid choice. | `buildPostCancellationFollowUpContext`, `decision-engine.ts` (`extraContext`) |
| Then long-term nurture; silence is "deciding" | Phase `nurture` once apology + follow-up are unanswered: no Claude call, `nextReviewAt = last send + 14 d`, status parked in NURTURING. After that window the normal NURTURING cadence resumes (with the PR #21 ladder). | `agent.ts`, `post-cancellation.ts` |
| Never two outbounds in one day to a non-responder | Anti-spam floor is 24 h (was 4 h). Replies still reset it (conversational mode). A "Too soon" block now reschedules to `lastContactedAt + 24h + 1min`, not +1 h. | `guardrails.ts` (`MIN_HOURS_BETWEEN_UNANSWERED_OUTBOUND`), `agent.ts` |
| Never "last one" unless it is | Hard guardrail: messages matching finality phrasing ("last one/message", "won't reach out again", "I'll stop messaging", "leave you be", "closing your file") are unsendable. The prompt rule stays as the first line of defence. | `guardrails.ts` (`detectFinalityPromise`) |
| No off-playbook hooks for alt_private | The report mandate, cash-back hook, and booking-hook lines are built by segment-gated helpers; alt_private gets explicit "do not" copy and "the call is the value". Touch-4+ zero-engagement psychology has an alt_private variant without report/rate/cash-back. | `playbook-sections.ts`, `brain.ts` (`getConversationGuidance`), `decision-engine.ts` |
| Lead-initiated cancellations are different | `resolvePostCancellationPolicy` returns `none` for them; existing flow unchanged (plus the PR #21 ladder and the 24 h floor, which are universal). | `post-cancellation.ts` |
| Stage loop | `move_stage` to the current stage is treated as `wait` for the stage default (14 d for NURTURING) with a note; an invalid transition schedules +24 h. Prompt now says "never move to the stage the lead is already in". | `stage-move.ts`, `agent.ts`, `decision-engine.ts` |

Advisor attribution comes from the Cal.com `cancelledBy` email (PR #16).
New `APPOINTMENT_CANCELLED` activities carry `cancelledByAdvisor` in metadata;
older ones are recognised by the "(by advisor)" content suffix the webhook has
always written, so the existing test lead is covered.

## 4. Why this addresses the cause rather than capping symptoms

- The hold/follow-up/nurture policy is evaluated from the record (cancellation
  activity + communications since it), not from a counter Holly could reset
  or a prompt she could talk herself out of. It runs before the model is
  called, so the restrained path costs nothing.
- The 24 h floor and the 48 h hold are two different things: the floor is the
  universal ceiling on outbound frequency to a silent lead; the hold is the
  cancellation-specific pause. Removing either leaves the other intact.
- The finality guardrail makes the broken promise impossible rather than
  discouraged. The prompt rule had existed since March and was violated.
- The alt_private gate is in the prompt assembly, where the off-playbook
  instruction actually came from. The existing alt_private banned-phrase
  guardrail is untouched and still the backstop.
- Every non-send outcome in `agent.ts` (hold, nurture, same-stage, invalid
  transition, anti-spam block) now writes a `nextReviewAt`. The loop class of
  bug is closed, not just the one instance.

What is deliberately not done: no schema change (policy is derived from
existing tables), no new integration (Slack is the existing channel), no
change to `HOLLY_ALT_LENDING_GUARDRAILS`, `classify.ts`,
`alt-lending.draft.ts`, or the numeric guardrail; no existing test weakened.

## 5. What the Aug 27 sequence would look like now

1. Aug 27 1:33 PM: webhook apology + rebook offer; Slack escalation to the
   advisor; `nextReviewAt` = Aug 29 1:33 PM.
2. Cron cycles until then: nothing (lead not due; if it were, `hold` and no
   Claude call).
3. Aug 29 ≥ 1:33 PM: one follow-up, no apology, no report, no "last one" (a
   finality phrasing would be blocked and retried in an hour). Next review by
   the ladder (≥ 4 d).
4. Any later cron run while still unanswered: `nurture`, no message, quiet
   until 14 d after the follow-up, then normal NURTURING cadence.
5. Any reply at any point ends the policy; Holly responds immediately as
   today.

Two automated messages total in the first two weeks, versus six in four days.

## 6. Verification

- `tests/post-cancellation-behaviour.test.ts` (unit, 40 tests): policy
  phases including the exact hours the real messages 2–4 went out, advisor
  notification copy, 24 h floor (blocks at 5 h and 23.9 h, allows at 24.1 h
  and on reply), finality phrases blocked / near-misses allowed, alt_private
  gating of all three prompt sections and the psychology guidance, stage-move
  resolution.
- `tests/post-cancellation-agent.test.ts` (agent loop with prisma and the
  decision engine mocked, 9 tests): hold makes no Claude call and parks at
  apology + 48 h; sms_reply is never held; lead-cancel is untouched; the
  follow-up is asked once with the no-second-apology context; nurture parks
  14 d and moves ENGAGED → NURTURING; same-stage move schedules 14 d and
  sends nothing; invalid transition schedules 24 h; anti-spam block
  reschedules to the earliest legal send.
- `npx jest`: 202 passed, 3 failed; the 3 failures (`lead-segmentation` ×2,
  `anthropic-cache` byte-stable system text) fail identically on the base
  commit.
- `npx tsc --noEmit`: 136 error locations before and after, identical set
  (pre-existing; none in touched files).

Production check after merge, on the next advisor cancellation: exactly one
Holly SMS in the 48 h after `APPOINTMENT_CANCELLED`; a `lead_escalated` Slack
alert naming the advisor; `nextReviewAt − lastContactedAt ≥ 48h` on the lead;
no "Too soon" guardrail notes within 24 h of an outbound; no
`⏸️ … already in NURTURING` notes repeating more than once per 14 days.

## 7. Seen along the way, left alone

- The automations cron (`processSmartFollowUps`) still carries a 4-hour
  window for `managedByAutonomous = false` leads. No such leads are on the
  Holly path; not touched.
- The `farewell` message on a valid `move_stage` bypasses `validateDecision`
  (so the finality guardrail does not cover it). The prompt rule applies; the
  example farewells in the prompt do not promise finality. Worth routing
  through validation separately.
- `/api/cron/autonomous-holly` accepts unauthenticated GETs (noted in the
  PR #21 diagnosis). Not touched.
