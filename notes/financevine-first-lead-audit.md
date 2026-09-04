# FinanceVine — first real vendor lead, end-to-end audit

**Lead:** `cmtm3hl400001jm04ki4f49rr` · **vendorLeadId** `1534741851`
**Received:** 2026-09-03 22:26:53 UTC · **Audited:** 2026-09-03 22:35 UTC
**Running deployment:** `dpl_8dfprEbPm4Y3PRBfAtYNRqeQRivX` (production, branch `main`, redeploy of `7021007`)
**Method:** read-only. All DB access via `DIRECT_URL` with `PGOPTIONS='-c default_transaction_read_only=on'`, so a write would have errored rather than succeeded. No cron route touched. No code, env, or PR changes.

No personal data appears below. Name, email, phone and address are reported by shape only. Financial figures are reported in full because their format was the open question this lead was meant to settle.

---

## 1. Payload

### Shape: a third one, not either of the two we designed for

The vendor did **not** send the capitalized/spaced schema their developer documented. Every key arrived **all-lowercase snake_case**:

| documented | actually received |
|---|---|
| `"Mortgage Balance"` | `mortgage_balance` |
| `"Equity Take Out"` | `equity_take_out` |
| `"Down Pay"` | `down_pay` |
| `"LTV"` | `ltv` |
| `"Income"` | `income` |
| `"Province"` | `province` |
| `"Zoning"` | `zoning` |
| `"Property Conditions"` | `property_conditions` |
| `"Property Address"` | `property_address` |
| — | `trustedform` *(not in the documented schema)* |

Exact key set received (23 keys, from the production log line):

```
["55","id","first_name","last_name","phone","email","mortgage_type","primary_goal",
 "borrower_profile","timeline","has_realtor","open_to_sell","property_value",
 "mortgage_balance","equity_take_out","down_pay","ltv","income","province","zoning",
 "property_conditions","property_address","trustedform"]
```

**All 22 documented fields are present** (renamed), plus `trustedform`. Nothing documented is missing. **Zero keys went unrecognised.**

The adapter does not detect or branch on shape — `pick()` in `lib/financevine-payload.ts` takes the first present value from a union of alias keys per field, and every lowercase form was already in those lists. That design choice is the only reason a schema this different needed no code change. A shape-detecting adapter would have failed on this payload.

### Field-by-field

| field | raw as received | outcome |
|---|---|---|
| `id` | 10-digit numeric string | → `vendorLeadId` ✓ |
| `first_name` / `last_name` | strings, 4 / 4 chars | present ✓ |
| `email` | string, 19 chars, valid shape | present ✓ |
| `phone` | 10 digits, no country code | → E.164, 12 chars, matches `^\+1[0-9]{10}$` ✓ |
| `mortgage_type` | `Refinance my property` | passed through ✓ |
| `primary_goal` | `Down payment for purchase` | passed through ✓ |
| `borrower_profile` | `I'm able to get approved at the bank` | passed through ✓ |
| `timeline` | `N/A` | **absent** ✓ |
| `55` | `N/A` | **absent** → `age55Plus: null` ✓ |
| `has_realtor` | `N/A` | **absent** ✓ |
| `open_to_sell` | `N/A` | **absent** ✓ |
| `property_value` | `750000` | parsed `750000`, raw kept ✓ |
| `mortgage_balance` | `1100000` | parsed `1100000`, raw kept ✓ |
| `equity_take_out` | `0` | parsed `0`, raw kept ✓ — **correctly not treated as absent** |
| `down_pay` | `N/A` | **absent** ✓ |
| `ltv` | `1.10` | parsed **`1.1`**, raw `"1.10"` kept — **see §2** |
| `income` | `N/A` | **absent** ✓ |
| `province` | `British Columbia` | → `British Columbia` (already full name) ✓ |
| `zoning` | `Urban property` | present ✓ |
| `property_conditions` | `None of the above` | **present** ✓ — near-miss, see below |
| `property_address` | `""` (empty string) | **absent** ✓ |
| `trustedform` | `https://cert.trustedform.com/11111` | captured by key name ✓ |

Two absence forms showed up that the vendor's documented schema didn't mention, and both were handled:

- **`""` (empty string)** for `property_address`, not the documented `None`/null. `ABSENT_TOKENS` includes `""`, so it read as absent.
- **`"None of the above"`** for `property_conditions`. This is the one that could have gone wrong: had `presentString` used substring matching for `"none"` instead of exact set membership on the whole trimmed string, a real answer would have been silently discarded. It didn't. (`lib/financevine-payload.ts` — `ABSENT_TOKENS` / `presentString`.)

### Money format: **confirmed**

Bare digit strings. **No `$`, no thousands separators, no decimals.** The masked log line from production:

```
figure formats: property_value=999999 mortgage_balance=9999999 equity_take_out=9 ltv=9.99
```

No `(UNPARSED)` markers — every figure parsed. The tolerant `$`/comma handling in `parseMoney` turned out to be unnecessary for this vendor, but harmless.

### rawData integrity

`rawData.financevineRaw` holds the payload verbatim; the canonical snake_case overlay sits alongside it; `ingestTimestamp` present. Overlay spot-checks all correct, including the negative cases — `down_payment`, `down_payment_raw` and `income_raw` are **absent** from the overlay rather than written as nulls, and `age_55_plus` was not added at all (the vendor's own `"55": "N/A"` key remains at top level, untouched).

---

## 2. LTV — the one real problem

**`ltv` arrived as `"1.10"`. We stored `1.1`, meaning 1.1%.**

The format is now known — bare decimal, two places, no `%` — but **what it denotes is still unconfirmed, and this payload cannot settle it**, because the test figures are internally inconsistent:

- `mortgage_balance` 1,100,000 **exceeds** `property_value` 750,000
- balance ÷ value = **1.4667**, which is not `1.10`

So `1.10` is not derived from the other two fields, and I can't infer the convention from it.

The risk is concrete either way:

```ts
// lib/financevine-payload.ts:162
if (!isExplicitPercent && parsed > 0 && parsed <= 1) parsed *= 100;
```

The ratio branch **only fires at or below 1.0**. Consequences:

- If the vendor means a **ratio**, `"1.10"` is a **110% LTV** and we recorded **1.1%** — off by 100×.
- The failure is specific to **LTV above 100%**, which is exactly the underwater/high-leverage case an **alt/private** book sees most. A prime book would rarely trip it.
- Handling is inconsistent across the 1.0 boundary: `"0.85"` → 85 (treated as ratio), `"1.10"` → 1.1 (treated as percentage). Same vendor, same field, opposite interpretation.
- The 0–200 plausibility guard at `lib/financevine-payload.ts:164` doesn't catch it — 1.1 is inside the range. Nothing flagged.

**No data was lost.** `ltv_percent_raw = "1.10"` is stored, so any correction is a backfill from raw, not a re-ingest. But **`ltv_percent` should not be trusted until the vendor confirms the convention**, and no downstream consumer should read it in the meantime.

---

## 3. Segmentation

| field | stored |
|---|---|
| `segment` | `alt_private` |
| `intent` | `refinance` |
| `bankability` | `bank_approved` |
| `vendorLeadId` | `1534741851` |

### segment — correct

`alt_private`, hardcoded for `source === 'financevine'` as designed.

### bankability = `bank_approved` — correct for the input, but note the polarity

Driven solely by **`borrower_profile`**, which arrived as the **positive** variant: `"I'm able to get approved at the bank"`.

- `NOT_BANKABLE_ALIASES` (`lib/lead-segmentation.ts:~170`) did **not** match — no `not able`, no `unable`, no `declined`/`denied`/`said no`.
- `BANK_APPROVED_ALIASES` (`lib/lead-segmentation.ts:179`) **did** match, on `approved\s+(?:at|by|with)\s+(?:the\s+)?bank` → "approved at the bank".

This is the negative-first design from PR #28 working exactly as intended, and it confirms something we'd only assumed: **the vendor's form carries both polarities of this question**, sharing the phrase "approved at the bank". The brochure only ever showed the negative one. Had the positive alias been written loosely as "contains `approved`", every declined borrower would have been mislabelled; had the negative check run second, this lead would have been mislabelled. Neither happened.

Worth flagging as a design tension, not a bug: a FinanceVine lead can now be `bankability = bank_approved` while `segment` is unconditionally `alt_private`. `deriveLeadSegment` returns `alt_private` on both arms of its ternary regardless of bankability. Whether a bank-approved FinanceVine lead should get the alt/private playbook is an operator call.

### intent = `refinance` — defensible, but it contradicts our own stated rule

Inputs, and which one won:

- `mortgage_type` = `"Refinance my property"` ← **this drove the result**
- `primary_goal` = `"Down payment for purchase"` ← ignored
- `"55"` = `N/A` → absent, so the reverse branch correctly did not fire

Trace through `deriveIntent`:

1. Reverse branch — no alias match, `isAge55Flag` false → skip ✓
2. Equity branch (`EQUITY_TAKEOUT_ALIASES`, `lib/lead-segmentation.ts:84` = `/equity|cash|consolidat/`) — `"down payment for purchase"` matches none → skip
3. Refinance branch (`lib/lead-segmentation.ts:146`) — `mortgage_type` contains "refinance" → **returns `refinance`**
4. Purchase branch (`lib/lead-segmentation.ts:167`, `primaryGoal.includes('purchase')`) — **would have matched, never reached**

Two problems:

1. **It violates the ordering principle we wrote down.** The comment at `lib/lead-segmentation.ts:130` states that a stated goal is more specific than a product type, and that is why equity is checked before refinance. But refinance (product) is still checked before purchase (goal), so a `primary_goal` naming a purchase loses to a `mortgage_type` naming a refinance. The principle is applied to one branch and not the others.
2. **Substantively, this lead is probably an equity take-out.** Refinancing your property to raise a down payment for another purchase is pulling cash out. `EQUITY_TAKEOUT_ALIASES` (`/equity|cash|consolidat/`) has no term for "down payment", so the equity branch can't see it.

I'm not calling this broken outright — `refinance` is a reasonable label for "Refinance my property", and the right answer depends on which playbook you want this borrower in. It needs an operator decision, and it's the kind of case that will recur.

---

## 4. Scheduling — working

| check | value |
|---|---|
| `status` | `NEW` — **create path**, not the re-submission path |
| `createdAt` | 22:26:53.088 |
| `nextReviewAt` | 22:56:53.267 → **+30m 00.179s** ✓ |
| `consentSms` / `consentEmail` / `consentCall` | `t` / `t` / `t` ✓ |
| `managedByAutonomous` | `t` ✓ |
| `hollyDisabled` | `f` ✓ |
| `cohort` | `COHORT_4` |
| `lastContactedAt` | null |

Production log confirms the handoff:

```
[Autonomous Holly] Scheduling FinanceVine lead for first contact in ~30 minutes: cmtm3hl400001jm04ki4f49rr
[Autonomous Holly] ✅ FinanceVine lead scheduled for review at 2026-09-03T22:56:53.267Z
```

`WebhookEvent` `cmtm3hl2c0000jm042x22l2v6` written at 22:26:53.027 — **before** the Lead at .088, confirming the PR #31 ordering (validate → record event → create lead). `processed = t`. No `rejected_payload` events: the vendor's payload validated on the first attempt.

**Slack `new_lead`: fired, inferred from absence.** `sendSlackNotification` is silent on success and writes `console.error` on failure (`lib/slack.ts:142`, `lib/slack.ts:154`). A query for error/warning/fatal logs across the 2-hour window returned nothing, and the request completed 200. This is negative evidence, not a directly observed success line — a "Slack sent" log line would make this provable rather than inferred.

`LeadActivity` contains exactly one row, `WEBHOOK_RECEIVED` at 22:26:53.122. No name-correction note, so `correctNames` made no change.

---

## 5. Holly — can't tell yet

**The review has not fired.** Due **22:56:53 UTC**; audit ran at **22:35 UTC**, ~22 minutes early.

Confirmed zero downstream activity:

| table | rows for this lead |
|---|---|
| `Communication` | 0 |
| `ScheduledMessage` | 0 |
| `Appointment` | 0 |
| `LeadActivity` | 1 (`WEBHOOK_RECEIVED` only) |

So none of the following can be judged yet: playbook variant, figures-are-for-understanding-only rule, banned "see if you qualify"/rate/program language, numeric guardrail, `guardrailBlock` activity, retry-feedback, or outbound number shape.

`HOLLY_ALT_LENDING_GUARDRAILS` **is set in the Production environment** (created ~1d ago). Its value is encrypted and I did not read it — pulling it writes a file, which this audit's read-only constraint forbids. Since Holly hasn't run, the value hasn't mattered yet; worth confirming it reads `on` before the review fires.

When intent settles, note that the reverse variant will **not** apply here — `"55"` was `N/A` and no reverse alias matched, so this lead takes the standard alt_private path.

---

## 6. Relay (PR #30, unmerged) — can't tell yet

Nothing to judge:

- Inbound `Communication` rows since the lead was created: **0**
- Inbound `Communication` rows since 22:00 UTC (any lead): **0**
- Rows whose content ever matched `NEW MESSAGE FROM`: **0**, across the entire table's history

PR #30 confirmed still **OPEN** on `feat/financevine-relay`; `origin/main` is still `7021007`. If a relayed reply arrives before #30 merges, it will hit the old path.

---

## 7. Verdicts

| area | verdict | evidence |
|---|---|---|
| Payload adapter — key mapping | **working** | 23/23 keys recognised despite a third, undocumented casing; production log key line |
| Phone normalization | **working** | raw 10 digits → `^\+1[0-9]{10}$`, 12 chars |
| Absence handling (`N/A`, `""`) | **working** | 6 fields absent correctly; `"None of the above"` correctly kept |
| Money parsing | **working** | format confirmed bare digits; all parsed, no `(UNPARSED)`; `"0"` stored as 0 |
| **LTV parsing** | **broken / unconfirmed** | `"1.10"` → `1.1`; ratio branch capped at 1.0 — `lib/financevine-payload.ts:162` |
| Province normalization | **working** | `British Columbia` full name preserved |
| TrustedForm capture | **working** | undocumented `trustedform` key captured by name |
| rawData verbatim + overlay | **working** | `financevineRaw` intact; absent fields omitted, not nulled |
| `vendorLeadId` persistence | **working** | `1534741851` stored |
| Segment | **working** | `alt_private` |
| Bankability | **working** | positive alias matched correctly; `lib/lead-segmentation.ts:179` |
| **Intent** | **questionable — needs a decision** | product beat goal; `lib/lead-segmentation.ts:146` vs `:167`, principle stated at `:130` |
| Scheduling / consent / flags | **working** | +30m 00.179s; all flags correct; create path |
| Slack `new_lead` | **working (inferred)** | no error logs; `lib/slack.ts:142`,`:154` are silent-on-success |
| Holly decision + outbound | **can't tell yet** | review due 22:56:53 UTC; zero communications |
| Relay | **can't tell yet** | zero inbound ever in relay format; PR #30 open |

### Most likely responsible, for the two non-green items

- **LTV:** `lib/financevine-payload.ts:162` — `parsed > 0 && parsed <= 1` is the ratio gate. Whatever the fix, it needs the vendor's answer first; the raw string is preserved so a backfill is possible either way.
- **Intent:** `lib/lead-segmentation.ts:146` (refinance, on `mortgage_type`) running ahead of `:167` (purchase, on `primary_goal`), against the principle documented at `:130`. Secondary: `EQUITY_TAKEOUT_ALIASES` at `:84` has no "down payment" term.

---

## 8. For the vendor

1. **LTV convention — blocking.** Does `"1.10"` mean **1.10%** or **110%**? This is the only field we cannot interpret, and getting it wrong is a 100× error on exactly the high-leverage leads this channel is for.
2. **Key casing changed from the spec.** Everything arrived lowercase snake_case, not the documented `"Mortgage Balance"` / `"Property Address"` form. We accept both, but please confirm which is the stable contract so we know whether the documented form is dead.
3. **`trustedform` is not in the documented schema.** We're storing it. Confirm it's intentional and stable.
4. **Absence is inconsistent.** `property_address` came as an empty string, everything else unanswered came as `"N/A"`, and the documented `None` never appeared. We treat all three as absent — confirm that's right, and whether `"N/A"` means "not asked" or "asked, not answered". They imply different things for Holly.
5. **Test payload is internally inconsistent.** `mortgage_balance` (1,100,000) exceeds `property_value` (750,000), and `ltv` (1.10) doesn't equal balance ÷ value (1.4667). Fine for a smoke test, but it's why item 1 can't be resolved from this payload — a realistic sample would settle it.
6. **`borrower_profile` has both polarities.** This lead sent the positive form. Please send the full option list for `borrower_profile`, `mortgage_type`, `primary_goal` and `timeline`, so classification can be checked against the real value set rather than inferred one lead at a time.

## 9. Follow-ups on our side

- Confirm `HOLLY_ALT_LENDING_GUARDRAILS` reads `on` before 22:56:53 UTC.
- Re-audit after the review fires: decision, message text, playbook variant, guardrail blocks, outbound number shape.
- Decide the intent question (refinance vs equity vs purchase) for the "refinance to fund a down payment" case.
- Consider a success-path log line in `sendSlackNotification`, so Slack delivery is observable rather than inferred.
- Do not consume `rawData.ltv_percent` anywhere until item 1 is answered.

---

# Follow-up — the first Holly review (added 2026-09-04)

The review §5 said couldn't be judged has now fired. Read-only against production; no cron route touched, no Holly cycle triggered.

**Fired:** 2026-09-03 23:00:06 UTC, by the scheduled `GET /api/cron/autonomous-holly` run — 33.2 min after ingest, against the 30-min handoff target.
**Result:** one SMS sent. Lead moved `NEW` → `CONTACTED`, `lastContactedAt` 23:00:06.468, `nextReviewAt` pushed to 2026-09-06 23:00:06 (3 days).

## What ran

```
[Holly Agent] Mode: LIVE
[Holly Agent] 📊 Found 1 leads due for review at 2026-09-03T23:00:06.429Z...
[Holly Agent] 🔒 Claimed lead cmtm3hl400001jm04ki4f49rr for processing
[Holly Agent] ✅ FinanceVine lead passed timing checks (33.2 min since ingest)
[Holly Agent] 🎭 Stage = COLD_OUTREACH
[Cal.com] Skipped availability pre-fetch: first outbound, no conversation yet
[Holly Cache] cache_creation=7305 cache_read=0 uncached=9241 (cache miss)
[Holly - Enhanced] → send_sms (confidence: high)
[Outcome Tracker] Will check lead outcome in 4 hours
[Holly Agent] 🔓 Released lock
[Holly Agent] ✨ Cycle complete in 11.24s - acted: 1, waited: 0, escalated: 0, skipped: 0
```

**Playbook variant:** `alt_private`, non-reverse, stage `COLD_OUTREACH`, touch #1. Correct — `"55"` was `N/A` and no reverse alias matched, so the reverse variant properly did not apply. Holly's own reasoning names it: *"Following the alt_private playbook: no rates, no programs, no qualification language."*

**Decision:** `send_sms`, confidence high. No `wait`, no `escalate`.

## The message

172 characters, personal data masked:

> Hey {firstName}! Holly from Inspired Mortgage. Saw your refinance inquiry come through from FinanceVine. Quick question before anything else — what's prompting the refi right now?

Scanned against every rule that applies:

| check | result |
|---|---|
| contains any digit | **no** |
| contains `%` | **no** |
| contains `$` | **no** |
| `qualify` / `rate` / `program` / `approv` | **no** |
| contains `778` | **no** |

The figures-are-for-understanding-only rule held, trivially — no figure appears at all. The banned "see if you qualify" / rate / program language is absent.

## Guardrails, retries, delivery

- **No `guardrailBlock` activity.** `LeadActivity` for this lead contains exactly one row, `WEBHOOK_RECEIVED`. The guardrail passed the message first time.
- **No retry.** No retry-feedback activity, and the cycle logged a single decision.
- **Outbound went to the lead's own number.** `sendSms({ to: lead.phone })` at `lib/ai-conversation-enhanced.ts:1644`. The lead's phone is `+1647…`, 12 chars, valid E.164, **not a 778**. Nothing was sent to the vendor's number.
- **`twilioSid` is null on the row, and that is normal, not a failed send.** `twilioSid` is only ever written by the *inbound* webhook (`app/api/webhooks/twilio/route.ts:127`); the outbound path never stores it. `sendSms` throws on a non-OK Twilio response (`lib/sms.ts`), no error was logged, the cycle reported `acted: 1`, and `lastContactedAt` was set — so the send succeeded.

## Two observations worth acting on separately

**1. Holly was told the figures were unknown, but we had them.** Her reasoning states: *"I don't know the specific blocker yet … because property value and balance are unknown."* The payload carried `property_value` 750000 and `mortgage_balance` 1100000, and the adapter stored both parsed and raw. The prompt builder is not reading the FinanceVine financials out of `rawData`. Not a defect in the adapter — the data is on the record — but the alt_private playbook is reasoning without figures it could have had. Out of scope here (playbooks are off-limits in this change); worth its own ticket.

**2. The message framed the lead as a refinance, which the intent fix changes.** "Saw your refinance inquiry … what's prompting the refi" follows directly from `intent = refinance`. With the down-payment equity alias now added (`lib/lead-segmentation.ts`, `isDownPaymentTakeout`), this same payload classifies as `equity`, and touch #1 would be framed around raising a down payment from existing equity instead. That is the intended behaviour change, and this lead is the reason for it. **The stored `intent` on the existing row is not rewritten by the code fix** — only newly ingested leads reclassify. If this lead's framing matters, it needs a separate decision; it is not part of the LTV backfill.

## Verdict update

| area | previous | now |
|---|---|---|
| Holly decision + outbound | can't tell yet | **working** — `send_sms`, alt_private touch #1, clean message, no guardrail block, no retry, delivered to the lead's own number |
| Relay | can't tell yet | **still can't tell** — no inbound has arrived; PR #30 remains open |

No stop condition found: nothing went to a 778, and no figure reached a message.
