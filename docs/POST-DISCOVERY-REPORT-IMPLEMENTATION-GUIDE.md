# Post-Discovery Report: Implementation Guide

## The Problem We're Solving

Our current stats show strong lead-to-call conversion (45%+), but call-to-application conversion has room to improve (Cohort 1: 27%, Cohort 2: 40%). The core issue is a trust and education gap.

**The challenge:** We believe mortgages should be actively managed, but people are conditioned to "get a mortgage, fix the rate, forget about it." What we say is foreign to them, and it creates mistrust because they just met us from the internet.

**The solution:** Show them what happened to THEM specifically. Make it personal. Make it concrete. Then show them what could happen again if no one is watching—and what active management would look like.

---

## What's Changing in the Report

### New Section: "What Happened on Your Last Term"

This is the major addition. Instead of generic stories about what COULD happen, we show them what DID happen—to them specifically. This section appears right after "What You Told Us" and before "Our Approach."

**The advisor selects ONE of four scenarios when ordering the report:**

| Scenario | Description |
|----------|-------------|
| Scenario 1 | Sub-2% Fixed → Renewal Trap: Great last term, but now facing payment shock or amortization extension that erases their progress |
| Scenario 2 | Variable → Panic Lock: Rode variable up, panicked and locked at the peak, now stuck at a high rate while rates have fallen |
| Scenario 3 | Fixed Payment Variable → Negative Amortization: Payments stayed the same while rates rose, balance didn't move or grew, now owe more than they started |
| Scenario 4 | Debt Consolidation Opportunity (OPTIONAL): Checkbox to include if they have other debts that could be restructured |

### Key Elements in Each Scenario Section

1. **Their specific story:** What happened to THEM, using their actual numbers
2. **"This wasn't your fault":** Blame the system, not them. They were failed by whoever was supposed to be watching.
3. **What active management would have looked like:** Show them the calls we WOULD have made, the adjustments that WOULD have happened
4. **"Nobody did that for you. We will.":** The commitment
5. **What we look for instead:** Rate optimization, debt restructuring, cash flow reallocation—with emphasis on ongoing relationship
6. **Verification box:** AI prompt they can use to verify our claims are real

### Removing Generic Stories from Strategy Sections

Since we're now showing them THEIR story in the new section, we no longer need the generic "A True Story" callout boxes in the strategy sections. Those were there to help people see themselves—but now we're showing them their actual situation.

The strategy sections (Fixed Rate, Variable Rate, Cash Back) remain, but become more focused on WHAT we'll do rather than stories about what COULD happen.

---

## Variables and AI Calculations

The AI needs to calculate several values based on input from the discovery call. Here's what's needed for each scenario:

### Scenario 1: Sub-2% Fixed → Renewal Trap

| Variable | Source / Calculation |
|----------|---------------------|
| `[THEIR_PREVIOUS_RATE]` | From Granola notes: "What rate did you lock in at?" |
| `[ORIGINAL_AMORTIZATION]` | From Granola notes: "What was your original amortization?" |
| `[CURRENT_AMORTIZATION]` | From Granola notes: "How many years remaining?" |
| `[OLD_PAYMENT]` | From Granola notes OR calculated from mortgage amount + previous rate + current amortization |
| `[NEW_PAYMENT]` | AI CALCULATED: Payment at current market rate (~4.5%) with same amortization. Use Canadian mortgage math (semi-annual compounding). |
| `[PAYMENT_DIFFERENCE]` | AI CALCULATED: `[NEW_PAYMENT]` - `[OLD_PAYMENT]` |
| `[FIVE_YEARS_OF_PAYMENTS]` | AI CALCULATED: `[NEW_PAYMENT]` x 60 months |

### Scenario 2: Variable → Panic Lock

| Variable | Source / Calculation |
|----------|---------------------|
| `[THEIR_ORIGINAL_RATE]` | From Granola notes: "What rate did you start at?" |
| `[THEIR_LOCK_RATE]` | From Granola notes: "When did you lock in, and at what rate?" |
| `[THEIR_LOCKED_RATE]` | Same as above (current locked rate) |
| `[ESTIMATED_EXTRA_INTEREST]` | AI CALCULATED: Estimate based on rate differential x mortgage amount x remaining term. Use ~1.5% differential as baseline if specific rates unknown. |

### Scenario 3: Fixed Payment Variable → Negative Am

| Variable | Source / Calculation |
|----------|---------------------|
| `[THEIR_PAYMENT]` | From Granola notes: "What was your payment amount?" |
| `[THEIR_ORIGINAL_RATE]` | From Granola notes: "What rate did you start at?" |

---

## Discovery Call Question Checklist

These questions ensure Granola captures everything needed for report generation. This is a reference for what information is needed—the actual discovery call training will focus on HOW to have the conversation.

### For ALL Scenarios

- Current mortgage balance at renewal
- Current lender
- Original amortization when they started
- Current amortization remaining
- Current/most recent interest rate
- Current payment amount (monthly or bi-weekly)
- Renewal date

### Scenario 1: Sub-2% Fixed → Renewal Trap

- What rate did you lock in at in 2020/2021?
- What's your current payment?
- Have you received a renewal offer from your bank yet?
- Did they offer to extend your amortization?
- What payment can you comfortably afford?

### Scenario 2: Variable → Panic Lock

- What rate did you start at?
- When did you lock in, and at what rate?
- What triggered the decision to lock? (Rate level? Stress? Bank suggestion?)
- How long is left on your current term?

### Scenario 3: Fixed Payment Variable → Negative Am

- Were your payments adjustable or fixed when rates went up?
- Did your payment ever increase, or did it stay the same throughout?
- Were you aware your balance wasn't decreasing?
- Did your bank ever contact you about this?

### For Debt Consolidation Opportunity (Optional Section)

- Do you have any other debts? (Car loans, lines of credit, credit cards, student loans)
- If yes: What are the balances and monthly payments on each?
- What's your total monthly debt outflow across everything?
- How do you feel about your current cash flow situation?

---

## LOD Dashboard: Report Ordering Interface

When an advisor orders a report, they need to provide:

### Required Fields

1. **Client name**
2. **Advisor name** (Greg or Jakub)
3. **Scenario selection** (dropdown: Scenario 1, 2, or 3)
4. **Include debt consolidation section?** (checkbox)
5. **Granola notes** (paste or upload)
6. **Mortgage details** (amount, rate, amortization—may be in Granola notes)

### AI Processing

The AI should:

1. Parse Granola notes to extract relevant variables
2. Calculate payment differences using Canadian mortgage math (semi-annual compounding)
3. Generate the "What You Told Us" section from Granola notes
4. Generate the appropriate scenario section with calculated values
5. Include debt consolidation section only if checkbox is selected
6. Output as PDF

---

## Canadian Mortgage Calculation Reference

Canadian mortgages use **semi-annual compounding**, which is different from US mortgages.

### Monthly Payment Formula

```
Semi-annual rate = Annual rate / 2
Monthly rate = (1 + Semi-annual rate)^(1/6) - 1
Number of payments = Amortization years × 12

Monthly Payment = Principal × [Monthly rate × (1 + Monthly rate)^n] / [(1 + Monthly rate)^n - 1]
```

### Example Calculation

For a $500,000 mortgage at 4.5% over 25 years:

```
Semi-annual rate = 0.045 / 2 = 0.0225
Monthly rate = (1.0225)^(1/6) - 1 = 0.003712
Number of payments = 25 × 12 = 300

Monthly Payment = $500,000 × [0.003712 × (1.003712)^300] / [(1.003712)^300 - 1]
Monthly Payment ≈ $2,740
```

---

## Next Steps

### Immediate (Zach)

1. Review the full revised report template (separate document)
2. Update the report generator to include the new "What Happened on Your Last Term" section
3. Add scenario selection and debt consolidation checkbox to LOD interface
4. Implement Canadian mortgage payment calculations

### Coming Next (Greg + Claude)

1. Discovery call training guide—not just "ask these questions" but how to flow the conversation to get the result
2. Move away from salesy calls to advisory calls
3. Focus on engagement over selling

### Future (After Proving the Report Works)

1. Holly optimization—use the report as the hook for booking calls
2. Reduce Jakub's cold calling burden
3. Potential voice bot Holly for discovery calls
