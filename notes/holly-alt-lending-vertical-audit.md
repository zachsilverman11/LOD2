# Holly: Alt-Lending / Private Mortgage Vertical — Audit & Architecture Recommendation

> **Superseded — read as history, not as current state.** (Annotated 2026-09-03.)
>
> This document's central premise — that no alt-lending support exists in the
> product — predates PR #3 and is no longer true. Alt-lending is live on `main`:
> segmentation (`lib/lead-segmentation.ts`) derives `segment` / `intent` /
> `bankability` at ingest; the `alt_private` playbook, its banned-phrase block,
> the numeric guardrail and the reverse-mortgage framing all ship in
> `lib/holly/brain.ts` and `lib/holly/guardrails.ts`.
>
> The design proposed below was implemented on a different axis than it
> recommends: the shipped work keys off the `segment` field, not the `vertical`
> column this document designs around. The two draft modules it refers to,
> `lib/holly/verticals/classify.ts` and `lib/holly/verticals/alt-lending.draft.ts`,
> were deleted on 2026-09-03 — all surviving content had been ported. The
> `Lead.vertical` column still exists but is no longer populated.
>
> Kept for the reasoning and the audit findings, which are still sound.

Status: **Research + design only. No production files were modified.** See "Verification" at the end.

---

## 0. Architecture context you need before reading the audit

Before auditing, it's worth being precise about what's actually live, because the goal doc's framing (`holly-knowledge-base.ts` holds `ADVISOR_PROFILES`) is slightly out of date. Here's the real picture as of this session:

There are **two parallel prompt architectures** in `lib/holly/`, gated by the `HOLLY_PROMPT_VERSION` env var (`.env.example:35` defaults to `v1`):

| | V1 (current production default) | V2 (lean rebuild, opt-in) |
|---|---|---|
| Entry point | `decision-engine.ts:askHollyToDecide()` | `decision-engine.ts:askHollyToDecideV2()` |
| Branch point | `lib/holly/agent.ts:174` and `:669` — `process.env.HOLLY_PROMPT_VERSION === 'v2' ? askHollyToDecideV2 : askHollyToDecide` | same |
| Prompt assembly | `conversation-handler.ts` (also handles email replies directly via `handleConversation`) | `system-prompt.ts` (fixed) + `user-message.ts` (variable) |
| Knowledge source | `lib/holly/brain.ts` (`ADVISOR_TEAM_PROFILE`, `PROGRAMS`, `BOOKING_HOOKS`, `SALES_PSYCHOLOGY`, `CASH_BACK_PROGRAM`, `LEAD_JOURNEY`, `HOLLY_ROLE`) + `lib/holly/examples.ts` (`TRAINING_EXAMPLES`, `LEARNED_EXAMPLES`) | `lib/holly/brain.ts` (subset: `selectBookingHook`, `PROGRAMS`, `REPORT_PRESELL_FRAMINGS`, YouTube hook) — no `examples.ts` |
| Token cost/call | ~10,000–10,500 (per `holly-audit/token-breakdown.md`) | ~2,300–2,700 (75–77% smaller, per `holly-audit/rebuild-comparison.md`) |

**This V1→V2 rebuild *is* the meetholly.ca-driven fix referenced in your goal.** `holly-audit/` (untracked, already in your working tree) documents it in detail — `rebuild-comparison.md` and `token-breakdown.md` are essentially the audit-with-citations you asked for, but for the V1→V2 transition, not for verticals. I'm building on top of it rather than repeating it.

Two naming corrections vs. the goal doc:
- There is no `ADVISOR_PROFILES` export. The team-credentials/rate-vs-cost block is `ADVISOR_TEAM_PROFILE` in `lib/holly/brain.ts:248-275`.
- `holly-knowledge-base.ts` (root `lib/`, 719 lines) is **not** in the live path. It's imported only by `lib/claude-decision.ts`, which itself is imported by nothing in `app/` or `lib/holly` (verified by repo-wide grep). Both files are untracked in git, alongside `lib/ai-conversation.ts`, `lib/behavioral-intelligence.ts`, `lib/conversation-stage.ts`, `lib/holly-learned-examples.ts`, `lib/holly-training-examples.ts`, `lib/lead-journey-context.ts`, `lib/sales-psychology.ts` — these read as the **pre-consolidation source files** that `lib/holly/brain.ts` says it merged from (see its section header comments, e.g. `brain.ts:569` "Section 4: Sales Psychology (from sales-psychology.ts)"). They appear to be leftover originals, not a second live system. I did not touch them and did not investigate further — flagging only so they aren't confused with a third live path.

**Live call-site map** (verified by grep, not assumed):

| Trigger | Route | Resolves to |
|---|---|---|
| Inbound SMS (Twilio) | `app/api/webhooks/twilio/route.ts` → `inngest.send('lead/reply')` → `app/api/inngest/functions.ts:7,55` | `processLeadWithAutonomousAgent` from **`lib/holly/agent.ts`** |
| Proactive cron | `app/api/cron/autonomous-holly/route.ts:2` | `runHollyAgentLoop` from `lib/holly/agent.ts` |
| Admin manual trigger | `app/api/admin/process-lead/route.ts:7` | `processLeadWithAutonomousAgent` from `lib/holly/agent.ts` |
| Inbound email | `app/api/webhooks/inbound-email/route.ts:16,75` | `handleConversation` from `lib/holly/conversation-handler.ts` (V1 path only — no V2 equivalent for email) |

**On the flagged legacy-routing dependency** (`lib/ai-conversation-enhanced.ts`, `lib/autonomous-agent.ts`): I did not touch these files per your boundary, but the call-site grep above is relevant evidence for that separate investigation, so I'll report what I found without drawing conclusions. Neither file is imported by any route under `app/api/`. The Twilio SMS webhook — the path your concern was specifically about — resolves through Inngest to `lib/holly/agent.ts`, not through either flagged file. Both flagged files are referenced only by one-off scripts (`scripts/verify-autonomous-holly-system.ts`, `scripts/test-autonomous-agent.ts`, `scripts/debug-stuck-leads-query.ts`, `scripts/list-active-leads.ts`). This doesn't resolve your investigation (there may be other entry points, queued jobs, or historical data I didn't check, and "imported by a route" isn't the same as "verified non-executing") — treat it as a data point for whoever is running that investigation, not a closure of it.

---

## 1. Audit: conventional/insured-mortgage assumptions

Each item below is something that will misfire, mismatch, or actively damage trust if shown to an alt-lending/private-mortgage lead (already declined elsewhere, bruised credit, self-employed/non-trad income, equity-based lending, often time-sensitive).

### 1.1 The rate-vs-cost reframe is the primary conversion hook, everywhere

- `lib/holly/brain.ts:262-275` — `ADVISOR_TEAM_PROFILE.corePhilosophy`: *"Most leads come in focused on the lowest rate... the goal is the lowest overall cost of homeownership."* `howHollyShouldUseThis` explicitly calls this *"the most powerful hook."*
- `lib/holly/system-prompt.ts:41-42` (V2 fixed system prompt — applies to **every** lead regardless of vertical once V2 ships): *"Core Philosophy — Rate vs. Cost... Use this to reframe the call as a strategy session."*
- `lib/holly/brain.ts:732,737` — `SALES_PSYCHOLOGY.conversationFlow.touch4PlusZeroEngagement`: explicitly *mandates* deploying "the rate vs. cost reframe" as one of three required hooks when a lead goes cold, and lists "Giving up without deploying all available hooks (cash back, report, rate vs. cost)" as a failure mode.

**Why it misfires:** the entire premise assumes the lead is comparing posted bank rates and can be won by reframing toward total cost. An alt-lending lead who's already been declined isn't rate-shopping — they're solution-shopping. Leading with "rate vs. cost" implies a rate conversation is even on the table, which it usually isn't in private lending (rates are deal-specific, often materially higher than bank rates, and leading with "cost" framing risks the lead feeling like their declined status is being glossed over rather than addressed head-on).

### 1.2 Programs are 100% conventional-mortgage products

- `lib/holly/brain.ts:195-246` (also duplicated at `lib/holly-knowledge-base.ts:123-174`, dead-code copy) — the only three `PROGRAMS`: **Reserved Ultra-Low Rates** ("pre-negotiated exclusive rates with lenders"), **No Bank Penalties Program** ("lenders/products that offer flexibility... protection against being trapped"), **Guaranteed Approvals Certificate** ("pre-approval that holds through closing... rate guaranteed for 120 days").
- These are injected into both V1 (`brain.ts:894-905` via `buildHollyBriefing`) and V2 (`user-message.ts:73-95,318-322` via `getSuggestedPrograms`/`PROGRAM_ONE_LINERS`) for **every** lead, selected only by purchase/refinance/renewal type.

**Why it misfires:** none of these exist for private/alt-lending deals. "Guaranteed approval certificate" is actively dangerous to even gesture at for a lead with credit/income issues — it implies an approval guarantee Holly cannot make and the team likely cannot extend pre-screening.

### 1.3 Booking hooks assume bank-comparison psychology

- `lib/holly/brain.ts:120-171` (duplicated `lib/holly-knowledge-base.ts:32-117`) — `BOOKING_HOOKS`: `hidden-cost`, `before-your-bank` ("Before you sign that renewal letter from the bank..."), `what-they-dont-tell-you` ("rate comparison sites won't tell you"), `spouse-needs-to-see`, `too-good-to-be-true`. `selectBookingHook()` keys off renewal/rate-shopping/partner/skeptical keyword matches in the conversation.
- None of the five hooks reference "declined," "denied," "bad credit," "self-employed," or "private lending." A declined-by-bank lead typing "the bank said no" or "got rejected" won't match any keyword set and will fall through to the **default hook (`hidden-cost`)**, which talks about "hidden costs buried in the fine print" — irrelevant to someone who already knows exactly why they were rejected.

### 1.4 `HOLLY_ROLE.handoffToAdvisor` treats the alt-lending lead profile as an edge case to escalate away from

- `lib/holly/brain.ts:286-298` (also `lib/holly-knowledge-base.ts:189-202`): `cannotDo` includes "Discuss specific rates" (fine, vertical-agnostic) but `handoffToAdvisor` lists *"Complex scenarios (self-employed, bad credit, etc)"* as something to escalate rather than engage with directly.

**Why it misfires:** for conventional leads, self-employed/bad-credit is the unusual case worth flagging for handoff. For the alt-lending vertical, it's the *default* lead profile — almost everyone in this cohort fits that description. Treating it as an escalation trigger either causes Holly to escalate constantly (defeating the purpose of an AI coordinator) or simply doesn't fire because the existing trigger language doesn't match how alt-lending leads describe their situation ("bank said no," "I'm 1099," "credit's not great").

### 1.5 `TRAINING_EXAMPLES` (V1 only) hardcode bank-comparison objection scripts, and the type system structurally excludes alt-lending

- `lib/holly/examples.ts:21` — `TrainingExample.leadContext.type` is typed `'purchase' | 'refinance' | 'renewal'`. There is no fourth value. Any alt-lending example would either be miscategorized or require a type change.
- `lib/holly/examples.ts:115-138` — "Already pre-approved" objection script: *"Main thing now is locking the best rate before you close... Greg or Jakub can compare in 10 mins."* This assumes the lead has a competing **bank pre-approval** to beat on rate. An alt-lending lead's analogous objection is usually the inverse — "I already got declined" — which needs a completely different response (reassurance + solution framing, not a rate-comparison pitch).
- `lib/holly/examples.ts:182-205` — "What's your rate?" objection script: *"Depends on credit and property. Greg or Jakub can pull real numbers."* Workable framing in principle, but the "good" example still leans on "Rates depend on a lot of factors" — for alt-lending, the honest answer is closer to "depends on the deal/equity/lender" than "depends on credit," since credit is often *why* they're here, and naming credit as the rate-driver risks sounding like a credit-shaming callback.
- `lib/holly/examples.ts:323` — renewal script: *"Renewals are actually perfect for us - you're penalty-free to switch... Most clients save $200-400/month."* Pure conventional-renewal economics; doesn't apply to equity-based private lending.
- TRAINING_EXAMPLES is V1-only (`decision-engine.ts:24-25` imports `getRelevantExamples`/`LEARNED_EXAMPLES` from `./examples`; V2's `user-message.ts` has no `examples` import). This narrows the blast radius for V2 but means V1 — still the production default — is saturated with this content for every lead, conventional or not.

### 1.6 `SALES_PSYCHOLOGY.valueCreation` and friction-reduction language are rate-centric by design

- `lib/holly/brain.ts:643-651` — `valueCreation.principles`: *"Always quantify savings in dollars, NEVER in rate percentages... Frame call as 'rate comparison' or 'second opinion'."*
- `lib/holly/brain.ts:603-640` — `frictionReduction.replacements` swaps "See what you qualify for" → "Get your exact rate" specifically *because* "'Qualify' implies judgment/rejection." For alt-lending leads, qualification/approval likelihood genuinely is the central question, and pretending otherwise (or routing around the word "qualify") reads as evasive to a lead who's already been through a rejection.
- `lib/holly/brain.ts:1373-1391` (`getFrictionReducedLanguage`) and `user-message.ts:56-69` (`getValuePropositionV2`) hardcode refinance/renewal/purchase value props ("early breakage penalties," "bank's renewal letter isn't the best offer") with no fourth branch.

### 1.7 Cash-back and report pre-sell hooks assume a generic insured-mortgage deliverable

- `lib/holly/brain.ts:179-193` — `CASH_BACK_PROGRAM` and `lib/holly/brain.ts:173-177` — `REPORT_PRESELL_FRAMINGS` ("rate comparisons, penalty calcs") are injected unconditionally (V1: `decision-engine.ts:649,729`; V2: `user-message.ts` Report Pre-sell block, `:548-553`). Both are vertical-neutral on their face but reference "rate comparisons" and "penalty calcs" as the deliverable contents — these don't exist in the same form for private deals (no posted-rate comparison, often no traditional penalty structure).

### 1.8 What's *not* an audit finding (already vertical-safe)

- The rate-quoting hard guardrail (`system-prompt.ts:21`, enforced at runtime by `guardrails.ts:324-339` regex) is vertical-agnostic and should remain the backbone of the alt-lending compliance rule — see §4.
- Stage detection (`stage.ts`), appointment/call-outcome awareness, and most of the runtime `guardrails.ts` checks (anti-spam, time-of-day, double-booking, opt-out) are all data-driven, not vertical-specific. No changes needed there.

---

## 2. Lead vertical/cohort tracking in the data model

Checked `prisma/schema.prisma:12-64` (`model Lead`).

**What exists:**
- `source: String?` — set to a fixed literal per ingestion webhook (e.g. `"leads_on_demand"` in `app/api/webhooks/leads-on-demand/route.ts:20,108,137,200`). Not currently used to distinguish vertical — it identifies the *channel*, not the lead type.
- `cohort: String?` + `cohortStartDate: DateTime?` — currently used as a **batch label**, not a vertical flag. `app/api/webhooks/leads-on-demand/route.ts:143` sets `cohort: cohortConfig?.currentCohortName || "COHORT_1"`. Per your goal doc, cohorts 1–4 have all been conventional/insured leads, so historically `cohort` has been 1:1 with "which batch," not "which vertical" — those happened to coincide because every prior cohort was the same vertical.
- `rawData: Json?` — the loan-type signal Holly's prompt code actually reads (`loanType`/`lead_type` ∈ `purchase|refinance|renewal`, see `brain.ts:313`, `user-message.ts:217-221`) lives inside this untyped JSON blob, not as a first-class column.
- No `vertical`, `leadType`, or similar enum/string field exists at the `Lead` model level.

**Risk if you reuse `cohort` directly as the vertical signal:** the new alt-lending cohort will likely be `cohort = "COHORT_5"` (or similar) under the existing naming convention. If vertical-selection logic keys off cohort *number* (`cohort === "COHORT_5" → alt-lending`), it silently breaks the moment you onboard a second alt-lending batch (`COHORT_6`) or a second conventional batch after that — cohort numbering and vertical identity are different axes that have just never diverged yet.

**What's needed (described only — no migration written, per your boundary):**
- A new `Lead.vertical` field — recommend a Prisma enum (`enum LeadVertical { CONVENTIONAL ALT_LENDING }`) rather than a free string, so the prompt-selection switch (§3) is exhaustive-checked by TypeScript and can't silently fall through to the wrong prompt on a typo.
- Default existing rows to `CONVENTIONAL` (all cohorts 1–4 are conventional, per your goal doc) — a backfill, not a behavior change.
- Indexed alongside `cohort` similarly to the existing `@@index([cohort])` (`schema.prisma:58`) if vertical-filtered queries (admin views, reporting) are expected — flagging as a likely need, not specifying the index here.
- This field should be set at ingestion time (whatever the spreadsheet-bridge becomes) — out of scope per your boundary, but it's the dependency: the architecture in §3 assumes `lead.vertical` exists and is populated before Holly ever sees the lead. If ingestion can't reliably set it, the rest of this design doesn't have a trigger to act on.

---

## 3. Architecture options for multi-vertical prompt support

Two real options, evaluated against the constraint you stated up front: **do not bolt alt-lending content onto the existing shared prompt as a conditional block** — that's the exact mistake the V1→V2 rebuild (`holly-audit/`) already paid down once.

### Option A: Conditional injection into the existing shared modules

Add `if (lead.vertical === 'ALT_LENDING')` branches inside `brain.ts`, `system-prompt.ts`, `user-message.ts`, `examples.ts` — e.g. a third arm in `getSuggestedPrograms()`, a fourth `BookingHook`, vertical-aware `ADVISOR_TEAM_PROFILE.corePhilosophy`.

- **Pros:** smallest diff; reuses existing call sites with no new selection logic; fastest to ship.
- **Cons:** this is precisely the anti-pattern you flagged. Every shared function (`buildHollyBriefing`, `getValuePropositionV2`, `selectBookingHook`, `buildSystemPrompt`) picks up a branch, and those branches compound with every future vertical. It reintroduces the conditional-bloat pattern the V2 rebuild explicitly removed (`rebuild-comparison.md` "Removed: Duplicate blocks... Conditional blocks kept, conditional — inject only when relevant" was already a source of V1's 10k-token bloat). It also means a bug or quality regression in alt-lending logic can leak into the conventional path through shared functions, and vice versa — the two prompt qualities are no longer independently verifiable. **Rejected** — this is what you told me not to do, and the reasoning holds up: it doesn't compose, it grows the fixed-cost section of every prompt (per `token-breakdown.md`'s own finding that fixed instructions, not conversation data, were V1's problem), and it re-couples two domains that have almost nothing in common except brand/voice.

### Option B: Vertical-specific prompt module, selected by `lead.vertical` at runtime, sharing only a small common core

Structure:
```
lib/holly/
  verticals/
    conventional.ts   # current system-prompt.ts + user-message.ts content, renamed/moved
    alt-lending.ts     # new — see draft in §4
  shared-core.ts        # brand identity, voice rules, hard guardrails, action framework, JSON response contract
  system-prompt.ts      # picks shared-core + verticals/<x>.systemPromptExtension(), keyed by lead.vertical
  user-message.ts       # picks verticals/<x>.buildUserMessage(lead, signals), keyed by lead.vertical
```

Each vertical module owns its **own** hook philosophy, programs, objection framing, and (for alt-lending) its own compliance rule — none of it touches the conventional module's code path. The shared core stays exactly what `rebuild-comparison.md` already identified as universal: identity, SMS voice rules, the 7 hard guardrails, the action framework, and the JSON response contract (`system-prompt.ts:1-76` is almost entirely shared-core material already — only the "Brand Positioning → Core Philosophy" block at `:41-42` is conventional-specific and would move into `verticals/conventional.ts`).

- **Pros:** each vertical's prompt stays as lean as V2's current ~2,300–2,700 tokens — adding alt-lending doesn't add a single token to the conventional lead's prompt, and vice versa. New verticals are additive (`verticals/heloc.ts`, `verticals/commercial.ts`, ...) without touching existing ones. Independently testable — you can run `holly-audit`-style token/quality comparisons per vertical. Matches the `HOLLY_PROMPT_VERSION` precedent you already have: a runtime-selected, fully-swappable prompt strategy, just keyed by `lead.vertical` instead of an env var.
- **Cons:** larger upfront diff — touches `decision-engine.ts`'s V2 call sites, `system-prompt.ts`, `user-message.ts`, and (if V1 stays in production during the transition) `conversation-handler.ts`/`brain.ts`/`examples.ts` too, since V1 is still the default per `.env.example`. Two verticals' worth of prompt logic to maintain instead of one, though that's the point, not a flaw. Needs the `lead.vertical` field from §2 to exist before any of this can branch correctly.

### Recommendation: **Option B**, scoped to V2 only, with V1 left untouched for conventional leads

Three reasons:
1. It's the only option that satisfies your explicit constraint. Option A isn't a real alternative given that constraint — it's included for completeness, not as a live contender.
2. Building alt-lending exclusively on **V2** (not V1) avoids doubling the work of retrofitting a vertical system into the soon-to-be-deprecated V1 architecture, and gives the new vertical the leanest possible starting point — exactly the quality bar you're trying to hit on a cohort where you have no prior conversion data to fall back on. V1 keeps serving conventional leads under `HOLLY_PROMPT_VERSION=v1` (today's default) unchanged.
3. It generalizes correctly: this is presented as 2 options but a vertical switch on `lead.vertical` is really an N-vertical-ready pattern, while a conditional-injection approach gets quadratically messier with each additional vertical (every shared function picks up another branch).

**Call sites that need to change** (full list, not just the primary one, per your requirement):
- `lib/holly/decision-engine.ts` (`askHollyToDecideV2`, ~line 1126) — needs `lead.vertical` to select which `system-prompt`/`user-message` module to call.
- `lib/holly/agent.ts:174,669` — the `HOLLY_PROMPT_VERSION === 'v2'` branch is the only place V2 is invoked; no change needed here itself, but it's the gate everything downstream depends on, so the vertical switch must live *inside* the V2 path, not beside it.
- `app/api/webhooks/inbound-email/route.ts:16,75` — currently hardcoded to V1's `handleConversation`. If alt-lending leads can reply by email, this route has no V2 (and therefore no vertical-aware) path today — flagging as a gap, not solving it here.
- `app/api/cron/autonomous-holly/route.ts:2` and `app/api/admin/process-lead/route.ts:7` — both call into `lib/holly/agent.ts`, so they inherit the fix automatically once `agent.ts`'s downstream call is vertical-aware; no direct changes expected, but worth a smoke test each since they're independent entry points.
- **The legacy-routing dependency from your goal doc** — if `lib/ai-conversation-enhanced.ts` or `lib/autonomous-agent.ts` turn out to be live on some path my call-site grep didn't cover, vertical selection would need to be wired there too. I'm flagging this as a hard dependency on that separate investigation, not attempting to resolve it here, per your instructions.
- `prisma/schema.prisma` — add `Lead.vertical` (described in §2, not migrated).
- Whatever sets `lead.vertical` at ingestion (the not-yet-finalized spreadsheet bridge) — out of scope, but everything above is inert until this exists.

---

## 4. Draft alt-lending prompt module (NEW FILE, UNWIRED)

Created at `lib/holly/verticals/alt-lending.draft.ts`. The `.draft.ts` extension and an unmistakable header are intentional — nothing imports this file, it does not compile into any route, and it should stay that way until you decide to wire it in via the Option B architecture above.

It mirrors the shape of `system-prompt.ts` + the vertical-specific parts of `user-message.ts`/`brain.ts` (hooks, programs, value prop) so that wiring it in later is close to a drop-in once `lead.vertical` exists, but it is **not imported anywhere** and changes nothing about current behavior.

Contents, in line with your requirements:
- Same brand/team credibility framing as `ADVISOR_TEAM_PROFILE.credentials` (`brain.ts:249-261`) — the team's track record is evergreen across verticals — but **without** the rate-vs-cost philosophy block, replaced with a "solutions/certainty/speed, options banks don't have" framing.
- New `ALT_LENDING_BOOKING_HOOKS`, keyed off declined/credit/self-employed/time-pressure/equity signals instead of rate-shopping/renewal signals.
- No named-products list. **Resolved** (was open question #5 below): unlike `brain.ts`'s `PROGRAMS`, this vertical has no menu of named products — private lending here is advisor-matched, not a product Holly pitches by name. The earlier placeholder programs export has been removed from the draft rather than left as dead TBD scaffolding.
- An explicit, non-negotiable compliance rule (Hard Guardrail #8) — written as an enforced instruction in the prompt text itself, not a code comment — prohibiting any specific rate, fee, or LTV figure, and any affirmative approval-likelihood statement, going further than the existing universal rate-only guardrail since private deals also commonly involve fee/LTV/approval-odds questions that the existing `guardrails.ts:324-339` regex doesn't catch (it only pattern-matches `X.X%`, not "yes you'll likely qualify" or LTV figures). **One narrow, content-confirmed-but-not-yet-Greg-approved exception**: Holly may now say, generically and with no number or promise, that home equity is a major factor in private-lending eligibility (approved phrasing pattern is in the file, attached to an explicit inline comment that this must not ship without Greg's sign-off). I've flagged the `guardrails.ts` runtime gap explicitly in the file's header comment as a follow-up if/when this ships — not implemented here, since that file is in your do-not-touch list.

---

## 5. Open questions for you before this can ship

1. **Data bridge shape and timing** — you said the spreadsheet-import bridge isn't finalized. What fields will it actually deliver per lead (declined-by info, lender that declined them, equity position, income type, urgency reason)? The draft module's value-prop logic depends on knowing what data is reliably available at ingestion vs. what Holly has to ask for conversationally.
2. **Expected lead fields and volume** — roughly how many leads/week, and is `vertical` something the bridge can set directly, or does it need to be inferred (e.g., from a "declined" flag, a separate alt-lending form, or a manual tag)? This determines whether §2's `Lead.vertical` field can be trusted at ingestion or needs a secondary classification step.
3. **Finmo implications** — does Finmo's application flow support private/alt-lending products today, or does this cohort's "application" step look different (different document set, different advisor handoff)? `stage.ts`/`user-message.ts` both gate document-discussion language on "after application submitted" — if alt-lending's document needs differ materially pre-application (e.g., proof of equity, NOA for self-employed income), that's a stage-logic question, not just a prompt-content one.
4. ~~**Cal.com implications**~~ — **RESOLVED.** Confirmed: same advisors (Greg/Jakub), same shared calendar. No `direct-booking.ts`/`calcom.ts` changes needed for this vertical.
5. ~~**Real program names**~~ — **RESOLVED.** No named programs for this vertical — private lending is advisor-matched, not a menu of products. The placeholder programs export has been removed from the draft module accordingly; there is no programs concept to fill in.
6. **Approval-likelihood language boundary** — **RESOLVED IN CONTENT, PENDING GREG SIGN-OFF.** Holly may now say, generically and with no number or promise, that home equity is a major factor in private-lending eligibility. Approved phrasing pattern: *"In private lending, how much equity you have in the property is one of the biggest things that opens up options — it matters a lot more than it would with a bank. An advisor can look at your specific numbers and tell you exactly what's available."* Everything else stays conservative: no specific rate/fee/LTV figures, no affirmative approval-likelihood statements ("you'll probably qualify," etc.). This is written into Hard Guardrail #8 in the draft module with an explicit inline comment that it must not ship without Greg's sign-off, since it affects what Holly can represent on the brokerage's behalf — do not treat the draft's presence as approval to wire it in.
7. **V1 sunset timing** — given alt-lending is being built V2-only (per §3's recommendation), is there a timeline for retiring V1 for conventional leads too, or will the two architectures coexist indefinitely? Affects whether the email-reply gap (`inbound-email/route.ts` has no V2 path) needs fixing as part of this work or can wait. **Pled as a separate, decoupled initiative** — not a blocker for shipping the alt-lending vertical itself, since §3 already scopes alt-lending to V2 only regardless of what happens to V1's timeline.

---

## 6. Verification

A fresh-context subagent independently confirmed:
- No file in Holly's live request path (`lib/holly/*.ts`, `lib/holly-knowledge-base.ts`, `prisma/schema.prisma`, any `app/api/**/route.ts`) shows working-tree modifications beyond what existed before this session (`git status`/`git diff` checked against the pre-session baseline — only the pre-existing modified files from before this task started, listed in your original git status, remain modified; nothing new was added to that list).
- `lib/holly/verticals/alt-lending.draft.ts` exists, is not imported by any other file in the repo, and does not appear in any route's dependency chain.
- Every numbered requirement in your task spec has a corresponding section above.

---

## 7. Changelog — 2026-09-01 draft update (lead-source pass)

All changes confined to `lib/holly/verticals/alt-lending.draft.ts` and this file. The
module remains **unwired and unimported** — no live path was touched.

**Context that drove this pass** (vendor: FinanceVine, BC and Alberta only):
- Lead mix: ~66% home equity, ~27% refinance, ~6% reverse mortgage, ~1% purchase.
- Leads qualify only if they answered that they *cannot* get approved at a bank, or are
  *unsure* — which confirms the "hit friction with traditional financing" premise the
  module was already built on, with reverse mortgage as the one exception.
- The vendor sends the **first** intro SMS from their own number; if the lead replies, that
  reply is relayed to our Twilio number and Holly opens a **brand new outbound thread from
  our number**. Holly is never the first touch and always appears as a second, unfamiliar
  number.

### Added

1. **Reverse-mortgage booking hook** (`reverse-mortgage`, in `ALT_LENDING_BOOKING_HOOKS`).
   *Why:* ~6% of volume, and structurally different from the rest of the vertical — 55+
   homeowners, typically house-rich and cash-poor, who have usually **not** been declined.
   Inheriting the "banks said no" framing would be actively wrong for them. The hook frames
   empathy as dignity and options in retirement, leads on accessing equity without a monthly
   mortgage payment, and carries **zero urgency language** — time pressure aimed at a 55+
   audience reads as predatory. A comment block on the hook flags that eligibility *and*
   suitability are advisor territory; Holly's only job is booking the conversation. Hard
   Guardrail #8 applies in full (no rates, fees, LTVs, payout amounts, or approval promises).
   Supported by a new `AltLendingProductType` union, a `reverseMortgage` value-prop signal
   checked before all others, and a short-circuit at the top of
   `selectAltLendingBookingHook()` — reverse leads would otherwise be captured by the
   `equity` or `time-pressure` keyword sets.

2. **Opener guidance + 3–4 worked examples** (`ALT_LENDING_OPENER_GUIDANCE`,
   `ALT_LENDING_OPENER_EXAMPLES`). *Why:* this is the highest-leverage conversion moment in
   the vertical and it was entirely missing. The rules: never introduce cold as if it's first
   contact; **explicitly bridge the number change** in the first line or two so the new number
   reads as intentional rather than as an unrelated third party; identify on behalf of
   Inspired Mortgage by name (also satisfies CASL sender identification); reference the lead's
   own inquiry for continuity; personalize with first name and their specific stated need;
   close on a binary choice or the booking link. Four examples cover debt consolidation,
   renovation cash, arrears, and reverse mortgage. A note flags that the examples reference the
   match generically rather than naming FinanceVine — confirm what brand name the lead actually
   sees on the intro SMS before naming it.

3. **Relayed-reply interpretation rule** (`ALT_LENDING_RELAYED_REPLY_RULE`). *Why:* the
   vendor's intro SMS ends by asking whether the lead has questions *right now*. A relayed
   "no" answers **that** question — it is not disinterest in a mortgage and must never be read
   as a rejection or an opt-out. Misreading it would kill live leads at the top of the funnel.
   Holly opens the direct thread warmly regardless. Genuine opt-outs are defined narrowly and
   explicitly ("stop", "unsubscribe", "remove me", "don't contact me") and are honored
   immediately and completely.

4. **Messaging style block** (`ALT_LENDING_MESSAGING_STYLE`), aligned to the vendor's own KB
   and their before/after examples: binary-choice scheduling only (never "when are you free?");
   no-obligation consultation framing; empathy before pitch; mirror the lead's register within
   professional bounds; **lead with outcome and lender access, not rate**.
   *Correction to the earlier draft:* this vertical is **not** fully rate-silent. General
   phrasing ("fair rates", "lenders beyond the big banks") is fine and expected — Guardrail #8
   bans specific numbers and promises, not the topic of rate itself. Going silent on it reads
   as evasive.

5. **Scope note in the file header**: BC and Alberta only; the lead mix; the never-first-touch
   relay mechanic; and an explicit comment recording the decision **not** to build a dedicated
   purchase hook (~1% of volume — the generic fallback hook and fallback value prop cover it;
   revisit only if purchase volume grows materially).

All four new prompt blocks are appended by `buildAltLendingSystemPromptExtension()`, and the
opener + relayed-reply rules are additionally reinforced in
`buildAltLendingDecisionTaskSection()`.

### Verified against pre-existing state

- Hard Guardrail #8 **already** carried the equity-as-a-factor carve-out and
  `ALT_LENDING_PROGRAMS` / `AltLendingProgramInfo` were **already** removed — the previously
  issued edit had been applied. No re-application was needed; both were confirmed by grep, not
  assumed.
- No Ontario or other out-of-scope provincial references were present in the module.

### Verification

- `alt-lending.draft.ts` type-checks clean in isolation under `--strict`. The repo-wide
  `tsc --noEmit` errors that remain are pre-existing Next.js route-context typing errors in
  `app/api/**`; none reference this file or `lib/holly/verticals/`.
- Zero imports of the draft file anywhere in the repo; zero references to the deleted exports.
- `git status` is unchanged from the pre-session baseline — no live Holly file was modified.

---

## 8. Changelog — 2026-09-01 second pass (vendor naming, sign-off, runtime enforcement)

Three items. Two touch only the unwired draft; the third touches a production file
additively and behind a default-off flag.

### 8.1 FinanceVine named explicitly in the openers (draft only)

`ALT_LENDING_OPENER_GUIDANCE` and all four `ALT_LENDING_OPENER_EXAMPLES` now name
FinanceVine as the continuity anchor ("FinanceVine just let you know you'd been matched with
a broker — that's us"), replacing the earlier generic "you were matched with an advisor"
phrasing. *Why:* confirmed by the business owner that FinanceVine positions itself to the lead
as matching them with a mortgage broker — the lead saw that name minutes earlier and is
expecting a handoff, so naming it is the strongest continuity signal available and carries no
disclosure risk. Every other property of the openers is preserved: number-change bridge,
Inspired Mortgage identification (CASL), first name + specific stated need, binary-choice
close, and the unhurried zero-urgency register on the reverse-mortgage example.

**Open TODO recorded in the file (deliberately not built):** it is not yet confirmed whether
FinanceVine's *mortgage* intro SMS names the specific assigned advisor (e.g. Greg or Jakub).
If it does, the lead is holding two names before Holly ever texts, and Holly arriving as a
third name needs an explicit advisor-name bridge. Flagged in the file header above
`ALT_LENDING_OPENER_GUIDANCE`; resolve by reading an actual FinanceVine mortgage intro SMS.

### 8.2 Stale sign-off flag cleared (draft only)

The "PENDING GREG SIGN-OFF" / "NOT YET CONFIRMED BY GREG" markers on the Guardrail #8 equity
carve-out are removed from all three places they appeared (the `RESOLVED DECISIONS` header
bullet, the `COMPLIANCE — READ BEFORE EDITING` block, and the comment directly above
`HARD_GUARDRAIL_8_TEXT`). The gate was dropped by the business owner.
**The guardrail text itself is unchanged** — the ban on specific rates, fees, LTVs, dollar
amounts, and approval-likelihood claims stands exactly as written. This was a process-flag
removal only, and the replacement comment says so explicitly so a future editor does not read
"approved" as licence to soften the rule.

### 8.3 Runtime enforcement of Guardrail #8's numeric half (`lib/holly/guardrails.ts`)

*Why:* only part of Guardrail #8 was enforced at runtime. The existing universal rate check
(`guardrails.ts:324-341`) matches decimal percentages only, so `80% LTV`, `$150,000`, and
"you'll probably qualify" all passed through it. The new reverse-mortgage content adds payout
amounts to that same unenforced surface, aimed at a 55+ audience where an unkeepable number
does the most harm.

**How the existing mechanism works** (matched rather than replaced): `validateDecision()` is
the single entry point, called from `lib/holly/agent.ts:179,674` and
`lib/automation-engine.ts:107`. It is a pure function with no side effects and no logging of
its own; it accumulates `errors[]` / `warnings[]` from arrays of regexes tested against
`decision.message`, each behind a context condition, and returns
`{isValid: errors.length === 0, ...}`. It **blocks, never rewrites** — the caller discards an
invalid decision. (Note: `lib/autonomous-agent.ts` imports a *different* module,
`lib/safety-guardrails.ts`, which was not touched.)

**What was added** — all additive, `git diff --stat` shows **142 insertions, 0 deletions**:
- `checkAltLendingNumericCompliance(message): string[]` — exported, pure, same
  accumulate-into-errors shape as every other rule. Covers: any percentage figure (rates,
  LTVs, percentage fees), explicit loan-to-value talk even without a `%`, specific dollar
  payout/borrowing/fee amounts (`$150,000`, `80k`, `50 thousand`, `fifty thousand`), fee
  figures introduced by fee/cost language, and affirmative approval-likelihood claims.
- `isAltLendingNumericGuardrailEnabled()` — env flag `HOLLY_ALT_LENDING_GUARDRAILS`,
  mirroring the `HOLLY_PROMPT_VERSION` precedent (`.env.example:35`). **Enforcement runs only
  when the value is exactly `'on'`.** Unset, empty, `off`, `true`, `ON` — all off.
- `isAltLendingVertical(context)` — second gate. Reads an optional `vertical` on
  `DecisionContext` or `lead.rawData.vertical`. There is no `Lead.vertical` column (see §2),
  so this is false for **100% of current production traffic even if the flag were enabled**.
- A single guarded block before `validateDecision`'s existing `return`, requiring
  `decision.message && flag enabled && alt-lending vertical`.

**Why double-gated:** the flag alone would be enough to disable it, but the vertical gate
means conventional-cohort output cannot change even if someone flips the flag on prematurely.

**Deliberate carve-outs preserved** (false positives here would strip legitimate copy, which
is a real cost — not a safe default): generic equity-as-a-factor language passes clean,
including the approved sentence verbatim; general rate phrasing ("fair rates", "lenders beyond
the big banks", "competitive options") passes; empathy and lender-access language passes; and
no rule keys on a bare digit, so "15 minutes", "Tomorrow 11am or 3pm", "30+ lenders", and
"55+" all survive. `100% free` / `100% no obligation` is scrubbed as emphasis before the
percentage sweep.

**Adversarial review pass (regexes hardened after first implementation).** A fresh-context
reviewer was asked to break the checks and found defects in both directions. All were fixed and
each is now a named regression test:

*False positives — legitimate copy wrongly blocked:*
- `"There's no fee for the call — 15 minutes with an advisor"` and `"no closing costs… 20 minute
  intro call"` tripped the fee rule, because it matched a fee word followed by *any* digit within
  30 characters — including a duration. Fixed with two guards: a negation guard (`no fee`,
  `fee-free`, `doesn't cost anything` are the *absence* of a charge, which is exactly the
  no-obligation framing the openers use) and a unit lookahead so clock times and durations do not
  count as figures.
- `"It costs you $0 to speak with an advisor"` was blocked by the dollar rule. `$0` is the
  opposite of a payout figure; now excluded explicitly.
- `"Our team is 100% Canadian-owned"` / `"I'm 100% confident…"` were blocked because the `100%`
  scrub used an approved-word whitelist. Wrong shape — inverted to a blacklist: `100%` is scrubbed
  as emphasis *unless* it sits in an explicitly financial frame, so `100% LTV` and
  `100% of your home value` are still caught.

*Misses — violations that slipped through:*
- Approval-likelihood detection keyed on pronoun+modal shapes, so `"We can definitely get this
  approved"`, `"Approval is very likely"`, `"You qualify for this"` (bare present tense),
  `"That won't be an issue"`, and `"This is going to work out fine for you"` all passed. Added,
  with a lookbehind so the legitimate invitations `"see what you qualify for"` / `"if you
  qualify"` still pass clean.
- **Every digit rule was trivially evaded by spelling the number out.** `"up to eighty percent of
  your property value"`, `"around six and a half"`, `"in the high single digits"`, `"fees in the
  two to three range"`, and `"roughly half the value of your home"` all passed. The prompt bans
  the *estimate*, not the notation, so a spelled-figure rule was added to match.

Residual limitation, stated plainly: this is a regex net over an open-ended natural-language ban.
It now covers digit-form and the common word-forms, but it cannot be exhaustive. It is a second
line of defence behind the prompt-level rule, not a replacement for it.

**Tests:** `scripts/test-alt-lending-guardrails.ts` (repo's existing `scripts/test-*.ts` +
`tsx` pattern — there is no jest/vitest here). Run with
`npx tsx scripts/test-alt-lending-guardrails.ts`. **87 assertions, all passing:** 21 violation
cases caught, 11 carve-out cases clean, all 16 message strings currently in the draft module
clean, 22 regression cases from the adversarial review above, and 16 flag/vertical gating
assertions. The test does **not** import the draft module —
it parses the message literals out of the source text — so the draft stays unimported
repo-wide while the test still catches copy drift.

### 8.4 Follow-ups not done here

- `HOLLY_ALT_LENDING_GUARDRAILS` is **not** documented in `.env.example`; that file was outside
  this pass's boundary. Add it (defaulting to unset/off) before anyone tries to enable this.
- The vertical gate reads `lead.rawData.vertical` because `Lead.vertical` does not exist. When
  the schema field lands (§2), point `isAltLendingVertical()` at it.
- `lib/safety-guardrails.ts` (used by `lib/autonomous-agent.ts`) has the same original gap and
  did **not** receive these checks — out of boundary, flagged here.

### 8.5 Verification

- Draft: isolated `tsc --strict` clean; zero imports repo-wide; guardrail text unchanged.
- `guardrails.ts`: `git diff --numstat` = **183 insertions, 0 deletions** after the hardening
  pass; `git diff -U0 | grep -c '^-[^-]'` = 0, so no pre-existing line was modified or removed. The two `tsc --noEmit`
  errors that mention guardrails (`lib/safety-guardrails.ts:6`, `scripts/test-holly-stage-management.ts:92`)
  were confirmed pre-existing by re-running the type-check with the change stashed.

---

## 9. Changelog — 2026-09-01 third pass (schema field + deterministic classifier)

Makes the alt-lending vertical gate real. Nothing wired in; no flag enabled.

### 9.1 Schema — one new field, not two

**`Lead.source` already existed** (`prisma/schema.prisma:18`, `String?`) and is already populated at
ingestion — `app/api/webhooks/leads-on-demand/route.ts:137` creates leads with
`source: "leads_on_demand"`, and other writers use `"lead_provider"`, `"vapi"`, `"cal_com"`,
`"admin_api"`. It already carries exactly the vendor-attribution semantics required, so adding a
second `source` field was neither possible nor necessary. **Only `vertical` was added.** The two
axes requirement is satisfied by `vertical` (new) + `source` (existing) + `cohort` (untouched).

`vertical String?` — nullable, **no `@default`**, **no backfill**, indexed alongside `cohort`.
Typed `String?` to match the existing `cohort` convention (`schema.prisma:34`) rather than
introducing an enum, even though the schema does use enums elsewhere — `cohort` is the closest
analogue (an orthogonal identity axis on `Lead`) and is a plain nullable string.

Schema diff is **11 insertions, 0 deletions**, confined to the `Lead` model. Note: `npx prisma
format` was run once and reformatted unrelated models (`Report`, `BookingSource`, `User`); that
was reverted and the edit reapplied by hand so the diff stays scoped.

### 9.2 Migration — generated, NOT applied

`prisma/migrations/20260901000000_add_lead_vertical/migration.sql`, hand-authored:

```sql
ALTER TABLE "Lead" ADD COLUMN "vertical" TEXT;
CREATE INDEX "Lead_vertical_idx" ON "Lead"("vertical");
```

Nullable, no DEFAULT, no UPDATE/backfill statement. `ADD COLUMN ... NULL` takes only a brief lock
in PostgreSQL and does not rewrite the table.

**Apply command (operator's call — deliberately not run):**
```
npx prisma migrate deploy
```

**Read this warning before running it.** `prisma/migrations/` contains only two migrations, both
from October 2025 (`20251003225823_init`, `20251006174758_add_communication_tables`). Neither
mentions `cohort`, `hollyDisabled`, `processingStartedAt`, or any of the other columns the current
schema has. **The migrations directory has drifted well behind the live schema** — the team has
evidently been using `prisma db push` rather than migrations. Consequences:

- If the target database's `_prisma_migrations` table does not record those two baseline
  migrations, `migrate deploy` will try to replay `init` and fail against existing tables.
- If it does record them, `migrate deploy` should apply only the new one cleanly.

Which of those is true **cannot be determined from the repo** — it needs a database connection.
The pragmatic alternative, matching how this repo has actually been maintained, is
`npx prisma db push` (schema-diff based, ignores the migration history), or running the two SQL
statements directly. **Verify against a non-production database first.** After applying, run
`npx prisma generate` so `app/generated/prisma` picks up the new field.

### 9.3 Classifier — `lib/holly/verticals/classify.ts`

Pure, deterministic, imported by nothing but its own test. Exports `classifyLead(input)` →
`{ vertical, productType, reason }`, plus `readLeadVertical()` and `SOURCE_VERTICAL_DEFAULTS`.

**Rule-based on purpose, and the module says why in a header comment:** the alt-lending numeric
guardrail is scoped on `vertical`. If a model decided `vertical`, compliance enforcement would
become probabilistic — a misclassification silently switches off the rule that stops Holly quoting
rates, fees, LTVs, and payout amounts to someone recently declined. No LLM call, no scoring, no
confidence thresholds.

Rules, in order:
1. **Reverse mortgage** → always ALT_LENDING, `productType: 'REVERSE_MORTGAGE'`, whether age is
   55+, absent, or contradictory (under 55). Even an explicit `CAN_GET_APPROVED` does not pull a
   reverse lead out. This is the structured signal that drives the draft module's
   reverse-mortgage short-circuit from data instead of keywords.
2. **`CANNOT_GET_APPROVED` or `UNSURE`** → ALT_LENDING. Covers equity take-out / refinance /
   renewal with that profile. A contradiction (cannot-approve *and* rate-shopping) is recorded in
   `reason` rather than smoothed away.
3. **`CAN_GET_APPROVED` + a known non-reverse product** → CONVENTIONAL. The only affirmative route
   out, and it requires positive evidence on *both* axes.
4. **Insufficient signals** → registered source default, else ALT_LENDING.

`reason` is populated in every branch and asserted by the tests.

**Ambiguity rule (§3 of the request), documented in a comment block that explains the asymmetry so
nobody "optimises" it later):** empty, partial, and contradictory input all return ALT_LENDING.
A wrong hook is a marketing cost; a wrong guardrail scope is a compliance incident.

**NULL vs ambiguous are deliberately not conflated.** `readLeadVertical()` reads NULL as
CONVENTIONAL — every row predating the column is known-conventional, a safe fact. The ambiguity
rule handles "we have a lead and cannot tell what it is," an unknown, which resolves to
ALT_LENDING. Reading NULL as alt-lending would drag the whole existing book into the guardrail.

**Source fallback** is a registry (`SOURCE_VERTICAL_DEFAULTS`), currently `{ financevine:
'ALT_LENDING' }` only. Per-lead rules *refine* the default — a FinanceVine lead with provable
conventional signals still classifies CONVENTIONAL (tested). **rates.ca is deliberately absent**:
no source-specific logic until its payload is known; only the shape is open.

### 9.4 Tests

`scripts/test-lead-classifier.ts` (repo's `scripts/test-*.ts` + `tsx` convention).
Run: `npx tsx scripts/test-lead-classifier.ts`. **66 assertions, all passing** — 7
reverse-mortgage cases, 6 borrower-profile cases, 4 conventional cases, 9 ambiguity cases, 8
source-fallback cases, 16 adversarial regressions (§9.4b), 7 NULL-read cases, and 9
`reason`-populated cases.

### 9.4b Adversarial review pass — a real compliance defect, found and fixed

A fresh-context reviewer was asked to break the classifier. The ambiguity rule held, but four
defects were found in normalization. All are fixed and each is now a named regression test.

**(A) The serious one — a reverse-mortgage lead could classify CONVENTIONAL.** `/equity/` was
tested before any reverse check, so `"Home Equity Conversion Mortgage"` (HECM's full legal name),
`"Equity Release"`, `"Senior Equity Release"`, and `"55+ Equity Access"` all bucketed as
HOME_EQUITY — none of them contain the word "reverse". Paired with `CAN_GET_APPROVED` (entirely
plausible: this audience usually has *not* been declined, as the module's own Rule 1 comment
says), a 72-year-old reverse-mortgage lead classified CONVENTIONAL and fell out of the
alt-lending guardrail. That is precisely the failure this module exists to prevent. Fixed with a
`REVERSE_MORTGAGE_ALIASES` set (`reverse`, `home equity conversion`, `hecm`, `equity release`,
`chip`, `retirement income mortgage`, `senior equity/lending`) tested **before** the equity branch.

**(B) `isFiftyFivePlus` recorded false facts in `reason`.** It took the first two-digit run and
ignored surrounding words, so `"under 55"` reported "confirmed 55+ age signal", and `"100+"`
matched `"10"` and read as under-55. The vertical was ALT_LENDING either way, so no compliance
leak — but `reason` exists for auditing, and an audit trail asserting something false is worse
than no note. Replaced with `parseBracketIs55Plus()`, which handles negation words and 2–3 digit
ages and returns `null` rather than guessing.

**(C) Product mis-bucketing on match order.** `"Spousal Buyout"` hit `/buy/` and became PURCHASE;
a spousal buyout is a refinance. Now matched before the purchase branch.

**(D) `CAN_GET_APPROVED` was trusted absolutely.** Nothing could pull a lead back once the vendor
asserted bank-approvability, so `"B-lender refinance"` and `"Private Second Mortgage"` classified
CONVENTIONAL — despite the product string itself being an alt-lending tell. Added a Rule 0 that
treats two situations as contradictory and resolves them restrictively: an inherently alt-lending
product string (`INHERENTLY_ALT_PRODUCT`: private, B-lender, second mortgage, MIC, bridge,
alternative lender), and a lead from a registered ALT_LENDING source claiming approvability.

**Consequence for requirement 4, stated explicitly because it changed a test.** A FinanceVine lead
reporting `CAN_GET_APPROVED` now classifies ALT_LENDING, not CONVENTIONAL. FinanceVine's own
qualification filter excludes approvable borrowers, so such a lead is contradictory data, and
requirement 3 (contradictory → restrictive) governs over requirement 4 (source default refines).
Source still does not hardcode: an *unregistered* source with clean conventional signals classifies
CONVENTIONAL, and when source and per-lead signals agree the per-lead rule supplies the reason.
Both are tested.

**Also corrected: a false claim in the module's own doc comment.** It said `productType` drives
behaviour "from DATA rather than keyword matching". Normalizing a vendor string *is* string
matching, and finding (A) is exactly what that overconfidence cost. The comment now states the
accurate distinction — it keys on the vendor's structured product field rather than the lead's
free-text conversation — and warns that the alias list is only as good as the vocabulary it knows.

**Exhaustive invariant sweep** over 105,840 input combinations (5 approval values × 27 product
strings × 6 sources × 3 rate-shopping × 7 ages × 6 brackets): **0** CONVENTIONAL results without
both an explicit `CAN_GET_APPROVED` and a recognized non-reverse product; **0** reverse-mortgage
products classified CONVENTIONAL; **0** empty `reason` strings.

### 9.5 Flagged, not built

Mid-conversation reclassification (a conventional lead later revealing a bank decline) is recorded
as a known future need in a comment block at the bottom of `classify.ts`. It must be an explicit,
logged transition writing back to `Lead.vertical` with a reason and timestamp — never silent drift,
never a per-message in-memory override — so guardrail scope stays reconstructable for compliance
and Holly's behaviour stays reproducible when debugging a bad send. Not implemented.

### 9.6 Still not done

- Classifier is **not** invoked from any route, webhook, or ingestion path.
- `HOLLY_ALT_LENDING_GUARDRAILS` untouched and still default-off; still undocumented in
  `.env.example`.
- FinanceVine ingestion endpoint and relay parser still blocked on the vendor's payload spec.
- `app/generated/prisma` has not been regenerated, so `Lead.vertical` is not yet in the generated
  types — `classify.ts` types the field alongside `Pick<Lead, 'source'>` rather than assuming it.
