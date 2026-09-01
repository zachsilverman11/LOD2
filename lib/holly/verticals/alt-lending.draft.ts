/**
 * Holly — Alt-Lending / Private Mortgage Vertical Prompt Module
 *
 * ============================================================================
 * STATUS: DRAFT / INACTIVE. NOT WIRED IN. DO NOT IMPORT FROM PRODUCTION CODE.
 * ============================================================================
 *
 * This file is not imported by system-prompt.ts, user-message.ts,
 * decision-engine.ts, agent.ts, conversation-handler.ts, or any route under
 * app/api/. It has zero effect on live Holly behavior. It exists to be
 * reviewed and, if approved, wired in deliberately as part of the
 * multi-vertical architecture described in:
 *
 *   notes/holly-alt-lending-vertical-audit.md (section 3, Option B)
 *
 * That doc recommends: a small shared core (identity, SMS voice rules, the
 * 7 hard guardrails, the action framework, the JSON response contract —
 * already ~80% of what's in system-prompt.ts today) + a vertical-specific
 * module selected at runtime by `lead.vertical`. This file is that module
 * for the alt-lending/private-mortgage vertical. The conventional-mortgage
 * equivalent would be the existing system-prompt.ts + user-message.ts +
 * brain.ts content, lightly refactored to sit alongside this one rather
 * than be the only option.
 *
 * To keep this file self-contained for review, types are redeclared locally
 * instead of importing from ../brain — when this is actually wired in, prefer
 * sharing the BookingHook-shaped type with the conventional module rather
 * than maintaining two copies.
 *
 * RESOLVED DECISIONS (since the first draft):
 * - Named programs: RESOLVED. This vertical has no named-product concept
 *   like brain.ts's PROGRAMS (Reserved Ultra-Low Rates, etc.) — private
 *   lending here is advisor-matched, not a menu of products. No programs
 *   list exists in this file; do not add one without a real product to name.
 * - Equity-as-a-factor language: RESOLVED AND APPROVED. Holly may say that
 *   home equity is a major factor in private-lending eligibility,
 *   generically, with no number and no promise. The earlier "pending Greg
 *   sign-off" gate has been dropped by the business owner. The guardrail
 *   text itself is unchanged — only the process flag was removed. See the
 *   comment directly above Hard Guardrail #8 before touching that text.
 *
 * LEAD SOURCE & SCOPE (vendor: FinanceVine):
 * - Geography: British Columbia and Alberta ONLY. No other province is in this
 *   cohort — do not add province-specific content for anywhere else, and do
 *   not let generic Canadian-market copy drift into Ontario examples.
 * - Lead mix: ~66% home equity, ~27% refinance, ~6% reverse mortgage, ~1%
 *   purchase.
 * - Qualification filter: a lead only reaches us if they answered that they
 *   CANNOT get approved at a bank, or that they are UNSURE. That is what makes
 *   the "hit friction with traditional financing" premise below sound — with
 *   ONE exception: reverse mortgage leads (see the 'reverse-mortgage' hook),
 *   who are usually exploring equity access in retirement, not recovering
 *   from a rejection.
 * - Holly is NEVER the first touch. The vendor sends the first intro SMS from
 *   THEIR number, telling the lead they have been matched with an advisor, and
 *   ends by asking whether the lead has any questions right now. If the lead
 *   replies to that, the reply is relayed to our Twilio number, and Holly then
 *   starts a BRAND NEW outbound thread to the lead from OUR number. Holly
 *   therefore always arrives as a second, unfamiliar number — this is the
 *   single biggest conversion risk in the vertical. See
 *   ALT_LENDING_OPENER_GUIDANCE and ALT_LENDING_RELAYED_REPLY_RULE.
 * - PURCHASE LEADS: deliberately NOT given a dedicated hook. At ~1% of volume,
 *   a purchase-specific hook is not worth the surface area or the ongoing
 *   maintenance cost; the fallback hook and fallback value proposition cover
 *   them adequately. Revisit only if purchase volume grows materially.
 *
 * WHY THIS VERTICAL NEEDS ITS OWN MODULE, NOT A BRANCH IN THE SHARED ONE:
 * The conventional prompt's primary conversion hook — "rate vs. cost"
 * (see lib/holly/brain.ts:262-275, lib/holly/system-prompt.ts:41-42) —
 * assumes the lead is comparing posted bank rates. Alt-lending leads are
 * frequently leads who have ALREADY BEEN DECLINED by a bank, have bruised
 * credit, self-employed/non-traditional income, or are doing equity-based
 * lending. They are not rate-shopping; they are solution-shopping, often
 * under time pressure. Bolting that distinction into the shared prompt as
 * an if-branch is exactly the conditional-bloat pattern the V1->V2 rebuild
 * (see holly-audit/rebuild-comparison.md) already paid down once. This
 * module keeps both verticals' prompts lean and independently editable.
 *
 * COMPLIANCE — READ BEFORE EDITING:
 * Private/alt-lending deals are NOT priced or qualified like insured
 * conventional mortgages. Rates, fees, and LTVs vary deal-by-deal and are
 * advisor-only commitments — Holly must never quote, imply, or estimate any
 * of these for this vertical, and must never make an affirmative
 * approval-likelihood statement. The one narrow exception: Holly may say,
 * generically and with no number or promise, that home equity is a major
 * factor in eligibility (see HARD_GUARDRAIL_8_TEXT). This is encoded below
 * as an explicit, load-bearing instruction in the system prompt text itself
 * (see HARD_GUARDRAIL_8_TEXT / buildAltLendingSystemPromptExtension), not
 * left as a comment for later. See the note at the bottom of this file
 * regarding a runtime guardrails.ts gap this exposes — not fixed here,
 * since guardrails.ts is outside this task's boundary.
 */

// ---------------------------------------------------------------------------
// Types (mirror the shapes used in lib/holly/brain.ts — see file header note)
// ---------------------------------------------------------------------------

/**
 * The inquiry type the vendor captured on the lead form. Volume split across
 * this cohort: HOME_EQUITY ~66%, REFINANCE ~27%, REVERSE_MORTGAGE ~6%,
 * PURCHASE ~1%. Passing this into hook selection matters most for
 * REVERSE_MORTGAGE, which must never inherit the declined-by-bank or urgency
 * framing the rest of the vertical is built on.
 */
export type AltLendingProductType =
  | 'HOME_EQUITY'
  | 'REFINANCE'
  | 'REVERSE_MORTGAGE'
  | 'PURCHASE';

export interface AltLendingBookingHook {
  id: string;
  name: string;
  targetSignal: string;
  angle: string;
  hookMessage: string;
  followUpNudge: string;
}

// ---------------------------------------------------------------------------
// Fixed system prompt extension
// ---------------------------------------------------------------------------

/**
 * Vertical-specific section to append to the shared core system prompt
 * (identity, voice, actions, response format — unchanged from
 * system-prompt.ts) when lead.vertical === 'ALT_LENDING'.
 *
 * Mirrors the structure of system-prompt.ts:29-42 (Brand Positioning) but
 * replaces the rate-vs-cost philosophy with a solutions/certainty/speed
 * framing, and adds an explicit compliance guardrail specific to this
 * vertical on top of the universal rate guardrail already in the shared core.
 */
// APPROVED. The equity-as-a-factor carve-out below (generic, no number, no
// promise) is signed off and no longer gated. Everything else in Hard
// Guardrail #8 stands exactly as written and is NOT negotiable: no specific
// rate, fee, LTV, or dollar amount, and no affirmative approval-likelihood
// claim. Do not weaken, soften, or reword the guardrail when editing around
// it. The numeric half of this rule is now also enforced at runtime — see
// checkAltLendingNumericCompliance() in lib/holly/guardrails.ts.
const HARD_GUARDRAIL_8_TEXT = `## Hard Guardrail #8 — Alt-Lending Compliance (in addition to guardrails #1-7 above)

This rule is absolute and applies on top of the universal rate-quoting guardrail:

8. Never state, imply, or estimate a specific rate, fee, or LTV (loan-to-value) percentage for a private/alt-lending deal. Never make an affirmative approval-likelihood statement ("you'll probably qualify," "that should be fine," "shouldn't be a problem") — these vary deal-by-deal and are advisor-only commitments Holly does not have the authority or underwriting context to make.

You MAY say, generically, that home equity is a major factor in private-lending eligibility — no specific number, no promise of approval. Approved phrasing to match:

"In private lending, how much equity you have in the property is one of the biggest things that opens up options — it matters a lot more than it would with a bank. An advisor can look at your specific numbers and tell you exactly what's available."

Do not go further than that pattern — no LTV figures, no "you'll likely qualify because of your equity," no estimate of how much equity would be "enough." If asked anything beyond the generic equity-matters framing, redirect: "That's exactly what the advisor will work through with you on the call — it depends on specifics they'll need to look at." Never soften the redirect into a quasi-commitment, even an optimistic-sounding one.`;

// ---------------------------------------------------------------------------
// Opener logic — Holly is never the first touch in this vertical
// ---------------------------------------------------------------------------

/**
 * Conversion-critical. The vendor (FinanceVine) sends the intro SMS from THEIR
 * number telling the lead they've been matched with a mortgage broker. If the
 * lead replies, that reply is relayed to us and Holly opens a BRAND NEW thread
 * from OUR Twilio number. From the lead's side, an unfamiliar number just
 * appeared. If the opener doesn't bridge that gap in its first line, the
 * message reads as an unrelated third party at best and a scam at worst, and
 * the thread dies before the hook ever lands.
 *
 * NAMING THE VENDOR: confirmed by the business owner — FinanceVine positions
 * itself to the lead as matching them with a mortgage broker, so the lead has
 * seen that name minutes earlier and is EXPECTING a handoff to a named advisor
 * at Inspired Mortgage. Naming FinanceVine explicitly is therefore the
 * strongest continuity anchor available and is not a disclosure risk. The
 * openers below name it.
 *
 * TODO — ADVISOR-NAME BRIDGE (unresolved, do not build yet):
 * It is NOT yet confirmed whether FinanceVine's mortgage intro SMS names the
 * specific assigned advisor (e.g. "you've been matched with Greg" vs. the
 * generic "a mortgage broker"). If it DOES name one, the lead is holding two
 * names before Holly ever texts — the advisor's and FinanceVine's — and Holly
 * introducing herself as a third name without connecting herself to that
 * advisor will read as confusing at best. That case needs an explicit
 * advisor-name bridge in the opener ("Greg's asked me to get you two
 * connected" or similar). Flagged only; the bridge is deliberately NOT written
 * here. Resolve by reading an actual FinanceVine mortgage intro SMS.
 */
const ALT_LENDING_OPENER_GUIDANCE = `## Opening the Thread — First Outbound Message

You are NOT the first touch. Before you message, the lead already received an intro text from FinanceVine — from a different number — telling them they've been matched with a mortgage broker. You are now texting them from a NEW, unfamiliar number. Your first message has one job before anything else: make that number change feel intentional and expected.

Rules for the first outbound:
1. Do NOT introduce yourself cold as if this is first contact. Never open with "Hi, I'm reaching out because..." or anything that implies you've never been in touch. The lead has already been told an advisor is coming.
2. Bridge the number change explicitly, in the first line or two. Name FinanceVine — the lead saw that name minutes ago and it is the strongest continuity anchor you have. Say plainly that you're picking up from the FinanceVine text and that this is the brokerage they were matched with. Do not leave the lead to guess why a second number is texting them.
3. Identify clearly on behalf of Inspired Mortgage, by name, in the first message. This is also the CASL sender-identification requirement — it is not optional.
4. Reference the lead's OWN inquiry to establish continuity. Name the specific thing they asked about (consolidating debt, pulling cash out for renovations, catching up on arrears, accessing equity in retirement). Specificity is what proves you're the continuation of their request and not a cold list.
5. Personalize with their first name. Never open with a generic "Hi there" or "Hello."
6. Close with a binary choice or the booking link — never "when are you free?" See the messaging style rules below.
7. Keep the empathy load-bearing: acknowledge the situation before pitching anything.`;

export interface AltLendingOpenerExample {
  id: string;
  scenario: string;
  /** What this example is demonstrating beyond the shared opener rules. */
  angle: string;
  message: string;
}

/**
 * Reference openers, in the same style as ALT_LENDING_BOOKING_HOOKS. Each one
 * satisfies every rule in ALT_LENDING_OPENER_GUIDANCE: no cold intro, FinanceVine
 * named as the continuity anchor, explicit number-change bridge, Inspired
 * Mortgage named, first name + the lead's own stated need, binary-choice close,
 * no rate/fee/LTV/dollar-amount/approval language. The reverse-mortgage example
 * additionally holds the unhurried, zero-urgency register.
 *
 * See the ADVISOR-NAME BRIDGE TODO above before treating these as final.
 */
export const ALT_LENDING_OPENER_EXAMPLES: AltLendingOpenerExample[] = [
  {
    id: 'opener-debt-consolidation',
    scenario: 'Home equity lead who said they want to consolidate high-interest debt',
    angle: 'Names the debt-consolidation goal specifically; frames the call as no-obligation.',
    message:
      "Hi Sarah — it's Holly with Inspired Mortgage. FinanceVine just let you know you'd been matched with a broker — that's us, and I'm following up from our own office number so everything stays in one place. You mentioned you're looking to consolidate some higher-interest debt using the equity in your home — that's a big part of what our advisors do, and they work with lenders well beyond the big banks. Want to grab 15 minutes with one of them? No obligation. Tomorrow 11am or 3pm?",
  },
  {
    id: 'opener-renovation-cash',
    scenario: 'Home equity lead who wants renovation cash',
    angle: 'Outcome-first (the renovation), lender access second, rate never mentioned.',
    message:
      "Hi Dave — Holly here from Inspired Mortgage. Following up on the FinanceVine text about being matched with a broker — that's us, just messaging from our own number. You'd asked about pulling some cash out of the house for renovations. Our advisors can walk you through what that actually looks like for your situation, no obligation either way. Does Thursday morning or Friday afternoon work better for a quick 15?",
  },
  {
    id: 'opener-arrears',
    scenario: 'Refinance lead behind on payments / in arrears',
    angle: 'Empathy first, zero judgment, no approval-likelihood language, still a binary close.',
    message:
      "Hi Marc — it's Holly with Inspired Mortgage, picking up from the FinanceVine text about being matched with a broker (new number, same team). You mentioned you've fallen behind on payments and the bank wasn't much help. That's a more common spot than people think, and it's exactly the kind of file our advisors take on — they work with lenders the banks never mention. Can we get you 15 minutes with one of them? I've got tomorrow at 10am or 2pm.",
  },
  {
    id: 'opener-reverse-mortgage',
    scenario: 'Reverse mortgage lead, 55+, exploring equity access in retirement',
    angle:
      'No declined/rejection framing, no urgency, unhurried and respectful. Leads with the outcome (equity without monthly payments) and hands eligibility to the advisor.',
    message:
      "Hi Linda — this is Holly with Inspired Mortgage. FinanceVine let you know you'd been matched with a broker; I'm following up on that from our own number. You were asking about accessing some of the equity in your home without taking on a monthly mortgage payment. Our advisors can walk you through how that works and what it would mean for you — just an information call, no obligation at all. Would Wednesday afternoon or Friday morning suit you better? Or I can send you our calendar link and you pick whatever time works — whichever you prefer.",
  },
];

// ---------------------------------------------------------------------------
// Relayed-reply interpretation — high-risk if misread
// ---------------------------------------------------------------------------

/**
 * The vendor's intro SMS ends by asking the lead whether they have any
 * questions RIGHT NOW. A relayed "no" is answering that question — it is not a
 * statement about the mortgage. Treating it as a rejection or an opt-out kills
 * a lead who never said no to anything we care about. This is encoded as a
 * prompt-level interpretation rule rather than a comment because it has to
 * survive into the model's actual reasoning.
 */
const ALT_LENDING_RELAYED_REPLY_RULE = `## Interpreting the Relayed Reply

Anything the lead said BEFORE your first message was said to the marketing partner, not to you, and it was almost always answering their closing question: "do you have any questions right now?"

- A relayed "no", "nope", "no questions", "not right now", "I'm good", or "all good" means NO QUESTIONS FOR THEM. It does NOT mean the lead is uninterested in a mortgage, and it is NOT a rejection, a brush-off, or an opt-out. Never treat it as one, never mark the lead cold because of it, and never let it soften or shorten your opener.
- Open the direct thread warmly regardless of what the relayed reply said. Assume interest — they filled out an inquiry and they replied to a text.
- A relayed reply that is short or blunt is not a signal of hostility. Mirror the register, stay warm, keep going.

The ONLY thing that counts as an opt-out is an explicit one: "stop", "unsubscribe", "remove me", "don't contact me", "quit", or an unambiguous statement that they do not want to be contacted. Honor those immediately and completely — stop messaging, no follow-up, no "just checking one last time." Everything short of that explicit language is a live lead.`;

// ---------------------------------------------------------------------------
// Messaging style — confirmed against the vendor's own knowledge base
// ---------------------------------------------------------------------------

/**
 * Aligned to FinanceVine's documented playbook for this exact cohort,
 * including their own before/after message examples. The notable correction
 * versus the earlier draft: this vertical is NOT fully rate-silent. General
 * language ("fair rates", "lenders beyond the big banks") is fine and expected
 * — Hard Guardrail #8 bans specific numbers and promises, not the topic.
 */
const ALT_LENDING_MESSAGING_STYLE = `## Messaging Style — Alt-Lending

- **Binary-choice scheduling.** Always offer two specific time options, or send the booking link. Never ask an open-ended "when are you free?" or "let me know what works" — open-ended asks put the work on the lead and they stall.
- **No-obligation framing.** Call it what it is: a no-obligation consultation / an information call. This lowers commitment resistance for a lead who is worried about being sold to or judged.
- **Empathy is load-bearing, not decorative.** Acknowledge the situation in the lead's own terms before you pitch anything. This audience has usually been told no, or expects to be. Being met with understanding first is the thing that differentiates this conversation from the one that rejected them.
- **Mirror their register.** If they text in short lowercase fragments, keep yours brief and casual. If they write in full, formal sentences, match that. Stay professional either way — mirroring is about length and formality, not about dropping standards.
- **Do not go rate-silent.** General phrasing is allowed and helps: "fair rates," "competitive options," "lenders beyond the big banks." What is banned is specific numbers and promises — see Hard Guardrail #8. Avoiding the topic of rate entirely reads as evasive.
- **Lead with outcome and lender access, not with rate.** Open on what the lead actually wants (debt cleared, cash for the reno, payments caught up, equity accessed without a monthly payment) and on the fact that our advisors reach lenders the banks don't. Rate, in general terms, is a supporting detail at most — never the headline.`;

export function buildAltLendingSystemPromptExtension(): string {
  return `## Brand Positioning — Alt-Lending / Private Mortgage

**The Team:**
- 60+ years combined mortgage experience; lead adviser has 30+ years
- Twice awarded Mortgage Broker of the Year (national level) + Lifetime Achievement Award
- 10,000+ transactions closed, $2B+ in client mortgages managed
- Independent brokers — they work for the client, not any single bank
- Access to 30+ lenders, including private and alternative lenders most banks won't mention
- Co-founders of Finmo, one of Canada's leading mortgage platforms

This credibility framing is the same evergreen team reputation used across every lead type. Weave 1-2 credentials naturally into your message. Never recite a list.

**Core Philosophy — Solutions, Not Rejections:**
Most leads in this vertical have already heard "no" from a bank, or know a bank would say no before they even ask. They are not comparing rates — they are looking for someone who can actually get the deal done. The team's approach: independent brokers see options banks don't, including private and alternative lenders built for exactly this kind of situation (declined elsewhere, self-employed income, credit history, equity-based lending, time pressure). Reframe the call around certainty and speed — "let's find out what's actually possible for your situation" — not around saving money on a rate. Do not use a "lowest cost" or "lowest rate" framing with this vertical; it implies a bank-style rate conversation that does not apply here and can read as tone-deaf to someone who was just declined.

**Exception — reverse mortgage leads (~6% of this cohort):** these leads have usually NOT been declined by anyone. They are homeowners 55+ exploring how to access the equity they have already built, not people recovering from a "no." Never use declined/turned-down/"the bank said no" framing with them, and never apply urgency or deadline pressure. See the "reverse-mortgage" booking hook for the correct framing.

**How Holly should use this:**
- Lead with empathy for the situation, not urgency about a rate. A lead who was declined doesn't need to be sold — they need to feel like this conversation is different from the one that just rejected them.
- "Our advisors see options banks don't" is the core message. Avoid implying you already know what will work for them — that's the advisor's call, not Holly's.
- If a lead names *why* they were declined (credit, income type, self-employed, etc.), reflect it back factually and without judgment, then pivot to the call: e.g. "Self-employed income trips up a lot of bank applications — it's exactly the kind of thing our advisors look at differently. Worth 15 minutes to see what's actually possible?"
- Never use bank-comparison language ("our rates," "better than your bank," "rate shopping"). This lead is not rate shopping.

${HARD_GUARDRAIL_8_TEXT}

${ALT_LENDING_OPENER_GUIDANCE}

${ALT_LENDING_RELAYED_REPLY_RULE}

${ALT_LENDING_MESSAGING_STYLE}`;
}

// ---------------------------------------------------------------------------
// Booking hooks — keyed on alt-lending signals, not rate-shopping signals
// ---------------------------------------------------------------------------

export const ALT_LENDING_BOOKING_HOOKS: AltLendingBookingHook[] = [
  {
    id: 'declined-elsewhere',
    name: 'Already Said No Doesn\'t Mean Done',
    targetSignal: 'Lead mentions being declined, rejected, or turned down by a bank',
    angle: 'Validate without dwelling. The bank\'s no is not the final answer — it\'s the reason this team exists.',
    hookMessage:
      'A bank saying no isn\'t the same as there being no options — banks can only lend within pretty rigid boxes. Our advisors work with lenders built for exactly this kind of situation. Worth 15 minutes to see what\'s actually possible for you?',
    followUpNudge:
      'Still thinking it over? Totally get it after a bank says no — but it\'s worth knowing what else is out there before you rule anything out. 15 minutes, no pressure.',
  },
  {
    id: 'self-employed-income',
    name: 'Built For Non-Traditional Income',
    targetSignal: 'Lead mentions self-employed, 1099, business owner, variable/non-traditional income',
    angle: 'Reframe self-employment from "complication" to "the exact thing this team specializes in."',
    hookMessage:
      'Self-employed income trips up a lot of standard bank applications because they\'re built around T4 employees. Our advisors deal with this constantly and look at it differently. Want to see what your options actually look like?',
    followUpNudge:
      'Self-employment shouldn\'t be the thing that closes doors on a mortgage — it usually just means a different lender, not no lender. Happy to set up a quick call whenever works.',
  },
  {
    id: 'credit-concerns',
    name: 'Credit History, Not Credit Verdict',
    targetSignal: 'Lead mentions credit score, credit history, bruised/bad credit',
    angle: 'No judgment, no minimizing. Pivot directly to the team\'s lender access.',
    hookMessage:
      'Credit history is one factor among several private and alternative lenders weigh — it\'s rarely a hard stop the way it can be with a bank. Our advisors can give you a clear, honest read on where you stand. Worth a quick call?',
    followUpNudge:
      'No pressure on this — but most people are surprised by what\'s actually available once an advisor looks at the full picture, not just the credit score. Want me to set up a time?',
  },
  {
    id: 'time-pressure',
    name: 'Speed Matters Here',
    targetSignal: 'Lead signals urgency — closing date, deadline, time-sensitive situation',
    angle: 'Private/alt lending often moves faster than bank underwriting. Lead with speed, not rate.',
    hookMessage:
      'Given your timeline, speed matters more than shopping around for the lowest number. Our advisors can move quickly with lenders who don\'t need the same drawn-out underwriting a bank does. Can we grab 15 minutes today or tomorrow?',
    followUpNudge:
      'Still on a tight timeline? The sooner we get an advisor on this, the more options stay open. Want me to grab you a time today?',
  },
  {
    id: 'equity-based',
    name: 'What Your Equity Can Do',
    targetSignal: 'Lead mentions home equity, equity takeout, asset-based borrowing, owns property outright or with significant equity',
    angle: 'Shift the conversation from income/credit qualification to what the property itself supports. No number, no promise — matches Hard Guardrail #8\'s equity carve-out exactly.',
    hookMessage:
      'In private lending, how much equity you have in the property is one of the biggest things that opens up options — it matters a lot more than it would with a bank. An advisor can look at your specific numbers and tell you exactly what\'s available. Worth 15 minutes?',
    followUpNudge:
      'Just checking back — equity is one of the biggest factors in what\'s available here, and it\'s worth knowing your specific numbers even if you end up going another way. Happy to set up a quick call whenever works for you.',
  },
  // REVERSE MORTGAGE (~6% of cohort). Structurally different from every other
  // hook in this file: this audience has usually NOT been declined by anyone.
  // They are homeowners 55+, typically house-rich and cash-poor, exploring how
  // to access equity they already own — not recovering from a rejection.
  // Empathy here is about dignity and having options in retirement, NOT about
  // bouncing back from a "no."
  //
  // Deliberately contains no urgency, no deadline, no "act fast," no "before
  // options close." Time pressure aimed at a 55+ audience reads as predatory,
  // and it is the fastest way to lose this cohort's trust. Do not add it.
  //
  // ADVISOR TERRITORY: whether a reverse mortgage is available to this lead,
  // and whether it is actually *suitable* for them, is an advisor judgment —
  // it depends on age, property, existing charges, and the lead's own plans.
  // Holly's only job here is to book the conversation. Never assess
  // eligibility, never suggest suitability, and never state or imply any rate,
  // fee, LTV, payout amount, or approval likelihood (Hard Guardrail #8 applies
  // in full).
  {
    id: 'reverse-mortgage',
    name: 'Equity Without The Monthly Payment',
    targetSignal:
      'Lead inquiry type is reverse mortgage, or lead mentions being 55+/retired and wanting to access home equity without adding a monthly payment',
    angle:
      'Dignity and options in retirement. House-rich, cash-poor is a solvable situation, not a problem to be fixed. Unhurried, respectful, zero urgency — the value is accessing equity without taking on a monthly mortgage payment.',
    hookMessage:
      'A reverse mortgage lets you access some of the equity you\'ve already built in your home without taking on a monthly mortgage payment — that\'s the piece most people are surprised by. Whether it fits your situation is really a conversation with an advisor, and there\'s no obligation in having it. Would sometime this week work, or would you rather pick a time yourself from our calendar?',
    followUpNudge:
      'No rush at all on this — whenever you\'d like to understand how it works and what it would mean for you, our advisors are happy to walk through it. Just say the word and I\'ll set up a time, or I can send you the link to choose your own.',
  },
];

/**
 * Select the best alt-lending booking hook based on conversation signals.
 * Mirrors brain.ts's selectBookingHook() pattern but with vertical-specific
 * keyword sets. Falls back to 'declined-elsewhere' as the default, since
 * "already declined" is the single most common entry point into this
 * vertical (per the goal doc's description of the cohort).
 */
export function selectAltLendingBookingHook(
  conversationText: string,
  productType?: AltLendingProductType,
): AltLendingBookingHook {
  const text = conversationText.toLowerCase();

  // Reverse mortgage is checked FIRST and short-circuits everything below.
  // These leads will trip the 'equity' keywords (and sometimes a timeline
  // word) but must never receive the equity, declined, or time-pressure
  // framing — see the hook's comment block.
  const reverseKeywords = ['reverse mortgage', 'reverse-mortgage', 'chip reverse', 'chip mortgage', 'reverse mtg'];
  if (productType === 'REVERSE_MORTGAGE' || reverseKeywords.some((kw) => text.includes(kw))) {
    return ALT_LENDING_BOOKING_HOOKS.find((h) => h.id === 'reverse-mortgage')!;
  }

  const declinedKeywords = ['declined', 'denied', 'rejected', 'said no', 'turned down', 'bank said no', "didn't qualify", 'couldn\'t get approved'];
  if (declinedKeywords.some((kw) => text.includes(kw))) {
    return ALT_LENDING_BOOKING_HOOKS.find((h) => h.id === 'declined-elsewhere')!;
  }

  const selfEmployedKeywords = ['self employed', 'self-employed', '1099', 'business owner', 'own my business', 'contractor income', 'variable income'];
  if (selfEmployedKeywords.some((kw) => text.includes(kw))) {
    return ALT_LENDING_BOOKING_HOOKS.find((h) => h.id === 'self-employed-income')!;
  }

  const creditKeywords = ['credit score', 'bad credit', 'credit history', 'credit issue', 'low credit', 'poor credit'];
  if (creditKeywords.some((kw) => text.includes(kw))) {
    return ALT_LENDING_BOOKING_HOOKS.find((h) => h.id === 'credit-concerns')!;
  }

  const urgencyKeywords = ['closing soon', 'deadline', 'asap', 'urgent', 'time sensitive', 'running out of time', 'need this fast'];
  if (urgencyKeywords.some((kw) => text.includes(kw))) {
    return ALT_LENDING_BOOKING_HOOKS.find((h) => h.id === 'time-pressure')!;
  }

  const equityKeywords = ['equity', 'own outright', 'paid off', 'asset based', 'asset-based'];
  if (equityKeywords.some((kw) => text.includes(kw))) {
    return ALT_LENDING_BOOKING_HOOKS.find((h) => h.id === 'equity-based')!;
  }

  return ALT_LENDING_BOOKING_HOOKS.find((h) => h.id === 'declined-elsewhere')!;
}

// ---------------------------------------------------------------------------
// Value proposition (vertical-specific, parallels getValuePropositionV2 in
// user-message.ts:56-69, which is conventional-only)
// ---------------------------------------------------------------------------

export function getAltLendingValueProposition(leadSignals: {
  reverseMortgage?: boolean;
  declinedElsewhere?: boolean;
  selfEmployed?: boolean;
  urgentTimeline?: boolean;
}): string {
  // Checked first and unconditionally: a reverse mortgage lead must never get
  // the decline-recovery or speed/urgency value props, even if some other
  // signal also happens to be set on the record.
  if (leadSignals.reverseMortgage) {
    return 'A reverse mortgage is a way to access the equity you have already built in your home without taking on a monthly mortgage payment. Whether it fits your situation is a conversation with an advisor, with no obligation either way, and there is no rush on it.';
  }
  if (leadSignals.declinedElsewhere) {
    return 'A bank decline is about that bank\'s box, not about whether a deal can get done. Our advisors work with private and alternative lenders built for situations banks turn away. Worth 15 minutes to find out what is actually possible.';
  }
  if (leadSignals.urgentTimeline) {
    return 'Private and alternative lending can move faster than standard bank underwriting. Our advisors can move quickly once they understand the situation. Takes 15 minutes to find out what is possible on your timeline.';
  }
  if (leadSignals.selfEmployed) {
    return 'Self-employed and non-traditional income is exactly what trips up standard bank applications. Our advisors look at the full picture, not just T4s. Worth 15 minutes to see what is possible.';
  }
  return 'Our advisors have access to lenders most banks never mention, including private and alternative options. Worth 15 minutes to see what is actually possible for your situation.';
}

// ---------------------------------------------------------------------------
// User-message section builder (vertical-specific portion only — would be
// composed alongside the shared lead-snapshot / conversation-history /
// appointment-status sections that already exist in user-message.ts and are
// vertical-agnostic)
// ---------------------------------------------------------------------------

export function buildAltLendingDecisionTaskSection(params: {
  recentMessages: string;
  /**
   * Vendor-captured inquiry type, when available. Optional because the
   * ingestion bridge that would supply it does not exist yet (see the audit
   * note's open question #1) — hook selection degrades to keyword matching
   * without it.
   */
  productType?: AltLendingProductType;
  leadSignals: {
    reverseMortgage?: boolean;
    declinedElsewhere?: boolean;
    selfEmployed?: boolean;
    urgentTimeline?: boolean;
  };
}): string {
  const selectedHook = selectAltLendingBookingHook(params.recentMessages, params.productType);
  const valueProp = getAltLendingValueProposition(params.leadSignals);

  return `## Decision Task — Alt-Lending Vertical

This lead is in the alt-lending/private-mortgage vertical, not conventional/insured. Do not use rate-vs-cost framing, do not mention conventional-only programs, and do not state or imply any rate, fee, LTV, or approval likelihood (see Hard Guardrail #8).

**Value prop for this lead:** ${valueProp}
**Booking hook:** "${selectedHook.name}" — ${selectedHook.angle}

If this is the FIRST outbound message in this thread, follow the opener rules in the system prompt exactly — bridge the number change, identify Inspired Mortgage, name their specific stated need. Anything the lead said before your first message was said to the marketing partner, not to you: a "no" there means "no questions right now," never a rejection or an opt-out.

Decide: What action best serves this lead right now? Consider their stage, temperature, conversation history, and available signals — same decision framework as conventional leads, different content.`;
}

/**
 * ============================================================================
 * KNOWN GAP — NOT FIXED HERE (outside this task's boundary):
 *
 * lib/holly/guardrails.ts:324-339 enforces the universal rate-quoting rule
 * via regex (blocks patterns like "4.5%"). It does NOT currently catch fee,
 * LTV, or qualitative approval-likelihood language ("you'll probably
 * qualify"). Hard Guardrail #8 above relies entirely on prompt-level
 * compliance for those three categories — there is no runtime safety net
 * for them the way there is for rate percentages. Before this vertical
 * ships, guardrails.ts likely needs a parallel runtime check (LTV percentage
 * patterns, an approval-likelihood phrase blocklist) scoped to
 * lead.vertical === 'ALT_LENDING'. Whoever builds that check should be
 * careful not to false-positive on the approved generic equity-as-a-factor
 * sentence (no numbers, no "qualify"/"approve" language) — a naive
 * keyword-on-"equity" block would wrongly suppress sanctioned messages.
 * Flagging per the audit's "prompt is the first line of defense,
 * guardrails.ts is the second" principle (holly-audit/rebuild-comparison.md)
 * — not implemented here because guardrails.ts is outside this task's
 * boundary.
 * ============================================================================
 */
