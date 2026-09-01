# Legacy Path Investigation — is `lib/autonomous-agent.ts` live?

**Date:** 2026-09-01 · **Type:** read-only investigation, no files changed
**Question:** can any live traffic reach `lib/autonomous-agent.ts`, `lib/safety-guardrails.ts`,
or `lib/ai-conversation-enhanced.ts`? This must be settled before
`HOLLY_ALT_LENDING_GUARDRAILS` is ever flipped on, because partial enforcement across two
decision paths is worse than none — it looks covered when it isn't.

---

## 1. Verdict

| File | Category | One-line basis |
|---|---|---|
| `lib/autonomous-agent.ts` | **(a) not imported by anything** | zero importers repo-wide, including scripts |
| `lib/safety-guardrails.ts` | **(a) transitively orphaned** | only importers are two files inside the same dead island |
| `lib/ai-conversation-enhanced.ts` | **(a) transitively orphaned** | single importer is `autonomous-agent.ts:12` |

**A fresh-context verifier subagent independently re-derived this** without reading this report,
building the full import graph across all entry points, and reached the same verdict (a) for
`autonomous-agent.ts` — 0 of 191 enumerated entry points reach it. Its positive control
correctly identified `lib/holly/agent.ts` as reachable, so the traversal was not silently failing.

**Recommendation on the flag: the divergence concern that prompted this investigation does not
block enabling `HOLLY_ALT_LENDING_GUARDRAILS`.** There is no second live decision path to leave
unenforced. Separate, real preconditions still gate it — see §7.

---

## 2. Entry-point inventory

| Kind | Count | Source |
|---|---|---|
| `app/api/**/route.ts` | 59 | `find app -name route.ts` |
| Server actions (`'use server'`) | 2 | `app/dashboard/actions.ts`, `app/login/actions.ts` |
| Middleware | 1 | `middleware.ts:1` → imports only `@/lib/auth` |
| Inngest functions | 6 | all defined in `app/api/inngest/functions.ts`, registered `app/api/inngest/route.ts:22-33` |
| Vercel crons | 4 | `vercel.json:2-19` |
| Scripts | all of `scripts/` | one-off, run manually via `tsx` |

Crons committed in `vercel.json`: `/api/cron/autonomous-holly` (*/15), `/api/cron/automations`
(7,22,37,52), `/api/cron/cleanup` (0 2 * * *), `/api/cron/system-monitor` (*/30). No `vercel.ts`,
no `.github/workflows`, no other scheduler. **Note:** `app/api/cron/holly-health-check/route.ts`
exists but is **not** registered in `vercel.json` — it is only reachable by direct HTTP call.

**Dynamic imports** — the complete set in non-`node_modules` code is
`app/api/webhooks/finmo/submitted/route.ts:243`, `lib/generate-report-puppeteer.ts:44,45,55,113,114`,
`scripts/test-holly-stage-management.ts:92`, and `fs` calls in `scripts/verify-autonomous-holly-system.ts`.
None reference the three files. There is no `index.ts` barrel anywhere in `lib/`, no
`export * from` re-export of these modules, no string-keyed module registry, and
`tsconfig.json` maps only `@/* → ./*`.

## 3. The live decision paths — all resolve to `lib/holly/*`

- **Inbound SMS:** `app/api/webhooks/twilio/route.ts:5` sends an Inngest event →
  `app/api/inngest/functions.ts:7` imports `processLeadWithAutonomousAgent` from `@/lib/holly/agent`.
- **Cron:** `app/api/cron/autonomous-holly/route.ts:2` → `runHollyAgentLoop` from `@/lib/holly/agent`.
- **Cron:** `app/api/cron/automations/route.ts:2` → `lib/automation-engine.ts:9` → `@/lib/holly/guardrails`.
- **Inbound email:** `app/api/webhooks/inbound-email/route.ts:16` → `@/lib/holly/conversation-handler`.
- **New lead:** `app/api/webhooks/leads-on-demand/route.ts:3` → `@/lib/holly/agent`.
- **Admin:** `app/api/admin/process-lead/route.ts:7` → `@/lib/holly/agent`.

`app/api/admin/migrate-to-autonomous/route.ts` is named suggestively but imports only
`next/server` and `@/lib/db` (`:6-7`).

## 4. The dead island

`lib/autonomous-agent.ts` is a **stale fork of `lib/holly/agent.ts`**, exporting the same three
symbols at near-identical line offsets:

| Export | `lib/holly/agent.ts` | `lib/autonomous-agent.ts` |
|---|---|---|
| `processLeadWithAutonomousAgent` | :43 | :43 |
| `runHollyAgentLoop` | :553 | :535 |
| `assignLeadsToAutonomous` | :968 | :934 |

Every call site of all three resolves to the `lib/holly/agent.ts` copy — none to the legacy one.
Even `scripts/test-autonomous-agent.ts:15`, despite its filename, imports `../lib/holly/agent`.

The island is closed: `autonomous-agent.ts` (0 importers) → `claude-decision.ts` (`:9`),
`safety-guardrails.ts` (`:10`), `ai-conversation-enhanced.ts` (`:12`). `claude-decision.ts`'s only
other consumer is `safety-guardrails.ts` for a type (`claude-decision.ts:18`) — both inside the island.

**Correction to a prior claim in `notes/holly-alt-lending-vertical-audit.md:36`:** that note said
these files are "referenced only by one-off scripts (`scripts/test-autonomous-agent.ts`,
`scripts/debug-stuck-leads-query.ts`, `scripts/list-active-leads.ts`)". That is **wrong**. Those
scripts exist but none of them import these modules — the references are comments and
`console.log` strings. `scripts/verify-autonomous-holly-system.ts:235,318,342` reads the files as
*text* via `fs.readFileSync` for static doc assertions, which is not execution. The correct
statement is stronger: **nothing imports `lib/autonomous-agent.ts` at all.**

## 5. Second, independent floor: the island cannot resolve in a deployment

Even if an importer existed, the deployed build could not load this code. Vercel builds from git:

- `lib/claude-decision.ts` is **untracked** (`git ls-files --error-unmatch` → "did not match any
  file(s) known to git"; `git status` → `?? lib/claude-decision.ts`). It does not exist in a deploy.
- `lib/safety-guardrails.ts:9` imports `./conversation-stage` — `lib/conversation-stage.ts` is
  also **untracked**. So `safety-guardrails.ts` cannot resolve its own imports in a deploy.
- `claude-decision.ts` additionally imports six more untracked modules (`holly-knowledge-base`,
  `lead-journey-context`, `behavioral-intelligence`, `sales-psychology`, `holly-training-examples`,
  `holly-learned-examples`).
- `lib/ai-conversation-enhanced.ts:1` imports `openai`. **`openai` is not in `package.json`**, and
  `npm ls openai` reports `openai@6.1.0 extraneous` — not a transitive dependency, a leftover local
  install. A clean install on Vercel would not have it.

`lib/safety-guardrails.ts:6` also imports `Lead` from `@prisma/client`, but the generator outputs
to `app/generated/prisma` (`prisma/schema.prisma:3`), so that symbol does not exist — this is the
pre-existing `TS2305` error. **Weight this evidence correctly:** `next.config.ts:4` sets
`typescript.ignoreBuildErrors: true`, and a type-only import is erased at compile time, so this
would not by itself break a build or a runtime. It is evidence of *rot*, not of unreachability.
The untracked-file and missing-`openai` findings are the load-bearing ones.

## 6. Git history — parallel maintenance, then abandonment

| File | Last substantive commit |
|---|---|
| `lib/autonomous-agent.ts` | `be747e2` 2026-04-02 "exclude CALL_SCHEDULED leads from Holly cron loop" |
| `lib/safety-guardrails.ts` | `9216ce1` 2026-03-17 "block Holly from quoting rates + force direct booking" |
| `lib/ai-conversation-enhanced.ts` | `81d71f4` 2026-03-27 "shared Cal.com availability window" |
| `lib/holly/` (contrast) | `52daef5` 2026-04-13 |

The pattern that matters: `be747e2` applied the *identical* two-line fix to **both**
`lib/autonomous-agent.ts` and `lib/holly/agent.ts` in one commit, and `9216ce1` (the original rate
guardrail) landed in **both** guardrail modules. So the duplication was being maintained in
lockstep through March and early April — the author was mirroring changes into a copy they were
not sure was dead. `lib/holly/` has commits after the legacy files went quiet. This reads as
**abandonment-in-place after a migration, not active maintenance** — but note the fork was still
being fed as recently as 2026-04-02, which is why "it looks abandoned" was not sufficient
evidence on its own and the import-graph trace was necessary.

## 7. Guardrail module divergence

`diff lib/safety-guardrails.ts lib/holly/guardrails.ts` (461 vs 647 lines). Beyond the new
alt-lending block, the two are **rule-for-rule identical** — every `=== HARD RULE ===` and
`=== SOFT WARNING ===` block appears in both, in the same order, with the same regexes, including
the original decimal-only rate check (`safety-guardrails.ts:321-339`). The complete divergence is:

1. Import paths (`@prisma/client` + `./conversation-stage` vs `@/app/generated/prisma` + `./stage`).
2. `HollyDecision.customerMindset?` — present only in `holly/guardrails.ts:21`.
3. `HollyDecision._availabilitySlotsProvided?` — present only in `holly/guardrails.ts:31-32`.
4. `DecisionContext.vertical?` — added by this month's alt-lending work.
5. The alt-lending block and its three exported functions (`holly/guardrails.ts:404-587`).

So the safety gap in `safety-guardrails.ts` is exactly the alt-lending gap and nothing else. It is
not missing any conventional-cohort protection.

## 8. Runtime evidence present in-repo

- **`execPath` sentinel** — `52daef5` (2026-04-13) added `execPath` metadata to outbound SMS at
  `lib/holly/conversation-handler.ts:1885,1966,2056`, tagged `"holly-v1-handler:…"`. This is the
  only path-attribution instrumentation in the codebase. It covers **only** the v1
  conversation-handler booking-link/direct-booking branches — not `lib/holly/agent.ts`, and not the
  legacy island. Reading it requires querying the `Communication` metadata in the production
  database, which is outside this read-only investigation.
- **No instrumentation whatsoever exists in the legacy island**, so there is no positive signal
  that would show it handling a message even if it were.
- **`.next/` is NOT usable evidence.** The local build output is from 2026-03-27 and contains no
  reference to `autonomous-agent` — but it also contains none to `holly/agent` or
  `holly/guardrails`, which are unambiguously live. Absence there proves nothing. Flagging this
  explicitly because it superficially looks like corroboration and is not.

## 9. What could NOT be determined from the repo alone

1. **Whether Holly runs at all in production.** `ENABLE_AUTONOMOUS_AGENT`, `DRY_RUN_MODE`, and
   `AUTONOMOUS_LEAD_PERCENTAGE` gate the *live* `lib/holly/agent.ts:20-22,47`. **None of the three
   appear in `.env.example`** — they are documented only in prose at `ENVIRONMENT_VARIABLES.md:77-79`.
   Their real values exist only in Vercel. (The same three constants are declared in
   `lib/autonomous-agent.ts:20-22`, but that is moot given verdict (a).)
   `HOLLY_ALT_LENDING_GUARDRAILS` is likewise absent from `.env.example`.
2. **Whether the legacy path ever ran, and when it stopped.** "Not imported today" is a
   static-graph fact about the current tree; it is not "never executed." Leads in the database may
   still carry state written by it (`nextReviewAt` semantics, processing locks, `managedByAutonomous`).
3. **Whether an external system triggers something not visible here.** This does not create a door
   to the island — any external trigger still has to land on one of the enumerated entry points,
   none of which reach it.

**What would settle the residual questions:** the Vercel env var values for the three flags; a
query of `Communication.metadata->>'execPath'` over recent outbound SMS to confirm which handler
is actually sending; and Vercel function invocation logs for the cron and Inngest routes.

## 10. Verifier comparison

The independent verifier agreed on the verdict (a) for all three files and on the importer sets.
**One disagreement, not reconciled silently:** it stated the island files "are all git-tracked, so
this is committed dead code." That is true for `autonomous-agent.ts`, `safety-guardrails.ts`, and
`ai-conversation-enhanced.ts`, but **false for `lib/claude-decision.ts`, which is untracked**
(`git ls-files --error-unmatch` errors; `git status` shows `??`). This favours the verifier's own
conclusion more strongly than it realised — an untracked file is absent from the deployment
entirely. I also initially doubted its claim that `autonomous-agent.ts` reads the three env flags;
on re-check it was correct (`:20-22`) and my contradicting grep had been truncated by `head`.

## 11. Recommendation

**The specific risk that prompted this investigation — enforcement on one decision path and not
the other — does not exist.** There is one live guardrail module, `lib/holly/guardrails.ts`, on
every live path. `lib/safety-guardrails.ts` is unreachable by three independent measures: no
import chain from any entry point, untracked transitive dependencies absent from any deployment,
and no instrumentation or call site anywhere in live code.

Enabling `HOLLY_ALT_LENDING_GUARDRAILS` is **not blocked by this**. It remains blocked by the
things already recorded in `holly-alt-lending-vertical-audit.md` §8.4: the flag is undocumented in
`.env.example`, no `Lead.vertical` column exists so the second gate is false for all traffic
regardless, and the alt-lending vertical is not wired in at all. Turning the flag on today would
be a no-op, which is the correct state until the vertical actually ships.

**Do not delete the legacy island on the strength of this report.** Verdict (a) is a
static-reachability finding; §9.2 is unresolved, and dead-looking code that recently received a
production bug-fix deserves the runtime confirmation in §9 before anyone removes it.
