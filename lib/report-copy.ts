// lib/report-copy.ts
// ⚠️ APPROVED COPY — DO NOT MODIFY WITHOUT GREG'S EXPLICIT APPROVAL ⚠️
// Source: /Users/clawdbot/clawd/docs/inspired-mortgage/reports/APPROVED-COPY-DO-NOT-MODIFY.md
// Any changes must be approved by Greg before implementation.

export const REPORT_COPY = {
  // ===========================================================================
  // COVER PAGE
  // ===========================================================================
  cover: {
    tagline: "SEE LENDERS COMPETE FOR YOUR BUSINESS",
    preparedForLabel: "Prepared for",
    applicationNotice: `The application isn't a commitment—it's how we get lenders to compete for your business. Here's what it unlocks:`,
    benefits: [
      "Access to 30+ lenders, not just one",
      "Real numbers customized for your goals",
      "Side-by-side comparison to your current offer",
    ],
    advisorLabel: "YOUR ADVISOR",
    readingTime: "This report takes about 10 minutes to read.",
    readingEncouragement: `We'd encourage you to take that time. The decisions ahead of you—rate type, lender, timing—will impact your finances for years. This document was built specifically for your situation, and it's designed to make sure you understand your options clearly.

Even if you choose not to work with us, you'll walk away more informed than most Canadians ever get about their mortgage.`,
    closingLine: "Markets change. So should your mortgage strategy.",
  },

  // ===========================================================================
  // WHAT YOU TOLD US
  // ===========================================================================
  whatYouToldUs: {
    heading: "What You Told Us",
    intro: `{{CLIENT_FIRST_NAME}}, thank you for sharing your story with us. Your mortgage isn't just numbers on a page—it's your home, your family's security, and years of hard work. We take that seriously.

Here's what we heard during our conversation:`,
    bulletsPlaceholder: "{{AI_GENERATED_BULLET_POINTS}}",
    outro: `We've designed the rest of this report around your specific situation. No generic advice—just a clear-eyed look at what happened on your last term, what it means for you today, and what we can do differently going forward.

Take your time with the following pages. We want you to understand not just what we recommend, but why—so you can make the best decision for your family.`,
  },

  // ===========================================================================
  // SCENARIO 1: Sub-2% Fixed → Renewal Trap
  // ===========================================================================
  scenarios: {
    scenario1: {
      label: "Scenario 1: Sub-2% Fixed → Renewal Trap",
      description: "Client locked in at sub-2% in 2020-2021, now facing payment shock",
      heading: "What Happened on Your Last Term",

      intro: `Here's the thing: your last term was actually great.

You locked in at {{THEIR_PREVIOUS_RATE}}%—one of the lowest fixed rates in Canadian history. Your payments were predictable. Your principal was dropping steadily. You did everything right.

The problem isn't what happened. The problem is what's about to happen.`,

      amortizationContext: `You started with a {{ORIGINAL_AMORTIZATION}}-year amortization. After five years of payments, you're now at {{CURRENT_AMORTIZATION}} years remaining. You made real progress.

But at today's rates, keeping the same amortization would push your payment from approximately ${"$"}{{OLD_PAYMENT}} to ${"$"}{{NEW_PAYMENT}}—a difference of ${"$"}{{PAYMENT_DIFFERENCE}} per month.`,

      bankSolution: `For most people, that's not manageable. So the bank offers a simple solution: add 5 years back onto your amortization. Payment problem solved.

Except here's what that actually means:`,

      impactHeading: "Five years of payments. Zero progress.",
      impactDetail: `You'll make another 60 payments—roughly ${"$"}{{FIVE_YEARS_OF_PAYMENTS}} out of your pocket—and at the end of it, you'll still have {{CURRENT_AMORTIZATION}} years remaining. Exactly where you are today.

All that ground you gained with your sub-2% rate? Given back. The years of principal reduction you earned? Erased on paper.

And the bank won't explain this. They'll send you a renewal letter with a checkbox. You'll sign it because the payment looks affordable. And you won't realize what you gave up until years later—if ever.`,

      transitionToSolution: `This isn't bad luck you have to accept.

Yes, rates are higher than they were. That's reality. But "extend your amortization and move on" isn't the only answer—it's just the easiest one for your bank to process.`,

      activeManagement: {
        heading: "The Difference Active Management Makes",
        intro: `Here's what would have happened if you'd had someone watching your mortgage the whole time:`,
        timeline: [
          {
            year: "Year 1 (2.9%)",
            action: `We call you. "Consider bumping your payment up as if your rate was 2.9%. You won't feel much difference now, but you'll thank yourself at renewal."`,
          },
          {
            year: "Year 2 (3.8%)",
            action: `We call you. "Another small increase."`,
          },
          {
            year: "Year 3 (4.2%)",
            action: `We call you. "Consider locking in."`,
          },
          {
            year: "Now",
            action: "Prepared. No payment shock. No surprises.",
          },
        ],
        summary: `By the time you reached renewal, your payments would have already adjusted gradually. No shock. No scramble. And instead of needing to extend your amortization, you'd have accelerated it—years ahead of where you are now, ready to absorb the higher rate environment without losing ground.

That's what active management means. Not just getting you a rate today—but making sure the next five years don't undo your progress.`,
        empathy: `This wasn't your fault. Nobody explained the options. Nobody showed you what was coming. Nobody called you before that renewal letter arrived.

Nobody did that for you last time. We will this time.`,
      },

      whatWeLookFor: {
        heading: "What We Look For Instead",
        intro: `There may be ways to reduce your overall interest cost across this next term that let you hold your amortization—or at least minimize the damage:`,
        items: [
          {
            title: "Rate optimization",
            body: `Not just today's rate, but actively managing through the term as rates move. If we can save you 0.5% through a strategic relock in year two or three, that savings doesn't just reduce your payment—it accelerates your amortization. Every dollar that would have gone to interest now goes to principal. A single well-timed relock could recover a year or more of the amortization you'd otherwise lose.`,
          },
          {
            title: "Debt restructuring",
            body: `If you're carrying other debts—car loans, lines of credit, credit cards—there may be a consolidation play that reduces your total monthly outflow while keeping your mortgage amortization intact.`,
          },
          {
            title: "Cash flow reallocation",
            body: `Sometimes the answer isn't in the mortgage itself but in how your overall debt is structured. And sometimes it's about what happens during the term, not just at the start.

With regular check-ins throughout your next term, we look for moments when you can increase your payments—even slightly—to claw back amortization. A small raise at work. A car loan that gets paid off. A bonus you weren't expecting. These are opportunities to move forward, but only if someone asks the question. If no one checks in, you'll keep making the same payment forever—even when you could afford more.

Our goal isn't just to set up your mortgage and disappear. It's to keep optimizing, keep asking, and keep you moving toward debt-free faster than you thought possible.`,
          },
        ],
        closing: `The point is: you have options beyond "extend and accept." But we can't find them without the application.`,
      },

      outcome: {
        heading: "What Could Happen With Active Management",
        body: `We find a combination of rate strategy, term selection, and possibly debt restructuring that holds your amortization at {{CURRENT_AMORTIZATION}} years—or close to it.

Every time rates move favorably, we act. Every time there's an opportunity to accelerate, we take it. Five years from now, you're at {{CURRENT_AMORTIZATION_MINUS_5}} years remaining. Then {{CURRENT_AMORTIZATION_MINUS_10}}. Then done.

The difference between these two paths is years of your life and tens of thousands of dollars.

We can't promise we'll find the perfect solution for your situation. But we can promise we'll look—which is more than your bank will ever do.`,
      },

      verificationBox: {
        heading: "Want to understand why this matters?",
        instruction: "Copy and paste this prompt into Google or any AI tool:",
        prompt: `If a Canadian homeowner had a mortgage at 1.8% for 5 years and now renews at 4.5%, what happens to their payment? If they extend their amortization to keep payments affordable, how much progress do they lose? Over a 25-year mortgage, what's the real cost of extending amortization by 5 years at renewal?`,
      },
    },

    // =========================================================================
    // SCENARIO 2: Variable → Panic Lock
    // =========================================================================
    scenario2: {
      label: "Scenario 2: Variable → Panic Lock",
      description: "Client was in variable, rode rates up, then panic-locked at peak",
      heading: "What Happened on Your Last Term",

      intro: `In 2021 or early 2022, you were in a variable rate mortgage—probably somewhere around {{THEIR_ORIGINAL_RATE}}%. It was even lower than fixed at the time. Smart move.

Then rates started climbing. And climbing. By late 2022, your rate had crossed 4%. By 2023, it was pushing toward 6%. Your payments were increasing with every Bank of Canada announcement, and the news was relentless—more hikes coming, inflation out of control, no end in sight.

At some point—probably when your rate hit {{THEIR_LOCK_RATE}}%—you called your bank and locked in. Three-year fixed. Maybe five. You needed the bleeding to stop.

That decision felt right. But here's what it cost you.`,

      costExplanation: `By the time you locked in, you'd already paid thousands in extra interest during the climb. Then you locked into a rate that was 1.5-2% higher than where rates eventually settled.

Meanwhile, rates started falling. Fixed rates dropped into the low 4s. But you were stuck at {{THEIR_LOCKED_RATE}}%. Still paying hundreds more per month than you needed to. For years.`,

      costHighlight: {
        label: "Estimated cost of this sequence",
        value: "${{ESTIMATED_EXTRA_INTEREST}}",
        subtext: "in extra interest over your term",
      },

      empathy: `This wasn't your fault.

You weren't a mortgage expert—you shouldn't have to be. But the person who was supposed to be watching your mortgage wasn't watching. No one called you at 3.5% to say "consider locking in now before it gets worse." No one reached out when rates started falling to discuss whether breaking and relocking made sense. You were left to react alone, under stress, with incomplete information.`,

      futureRisk: {
        heading: "What could happen again:",
        body: `You're about to make another multi-year commitment. If rates drop after you lock in—and no one is watching—you'll miss the window again. If you take variable and rates spike again—and no one calls you—you'll ride it up just like last time.

The pattern only breaks if someone is actually paying attention. That's what we do.`,
      },

      verificationBox: {
        heading: "Want to verify this is real?",
        instruction: "Copy and paste this prompt into Google or any AI tool:",
        prompt: `What happened to Canadian homeowners who locked into sub-2% fixed mortgage rates in 2020-2021 and are now renewing in 2025-2026? How much did typical payments increase? What choices do they face regarding payment shock vs. extending amortization?`,
      },
    },

    // =========================================================================
    // SCENARIO 3: Fixed Payment Variable → Negative Amortization
    // =========================================================================
    scenario3: {
      label: "Scenario 3: Fixed Payment Variable → Negative Amortization",
      description: "Client had variable with fixed payments, didn't realize balance was growing",
      heading: "What Happened on Your Last Term",

      intro: `In 2021 or 2022, you had a variable rate mortgage with a fixed payment—probably around ${"$"}{{THEIR_PAYMENT}} per month. Your rate was somewhere in the {{THEIR_ORIGINAL_RATE}}% range. Life was good.

Then rates exploded. From 2% to 6% in less than two years.

But here's the thing: your payment never changed. Same amount every month. Same automatic withdrawal. Nothing looked different.

So why would you think anything was wrong?`,

      explanation: {
        heading: "Here's what was actually happening.",
        body: `Your mortgage payment is split between principal (paying down what you owe) and interest (what the bank charges you to borrow). When rates rise but your payment stays the same, the interest portion grows—and the principal portion shrinks.

At a certain point, your entire payment was going to interest. Your balance wasn't moving at all.

Then it got worse. When even your full payment couldn't cover the interest, the unpaid interest got added to your balance. Your mortgage was actually growing. This is called negative amortization.

You made every payment. Never missed one. Did everything right.

And when you got to renewal, you discovered you owed more than when you started—with a longer amortization than you began with.`,
      },

      empathy: {
        heading: "This wasn't your fault.",
        body: `Your bank set this up. They chose the fixed-payment structure. And when rates climbed to the point where your mortgage was going backwards, they never called. Never warned you. Never suggested you increase your payment or lock in.

You had no way of knowing. The statements didn't scream "emergency." The payments looked normal. The damage was invisible until it was done.`,
      },

      futureRisk: {
        heading: "What could happen again:",
        body: `If you go back to the same bank—or any lender who treats mortgages as "set and forget"—you're trusting that this won't happen again. But the conditions that caused this haven't changed. Rates can still move. Banks still won't call.

The only thing that changes the outcome is having someone who's actually watching.`,
      },

      verificationBox: {
        heading: "Want to verify this story?",
        instruction: "Copy and paste this prompt into Google or any AI tool:",
        prompt: `Explain what happens to a Canadian variable rate mortgage when interest rates rise rapidly but the lender keeps the monthly payment the same. How does the principal vs interest split change? Is it possible for a borrower to make years of payments and see almost no reduction in their balance? What happened to many Canadian variable rate mortgage holders between 2022 and 2024?`,
      },
    },
  },

  // ===========================================================================
  // DEBT CONSOLIDATION (Optional Section)
  // ===========================================================================
  debtConsolidation: {
    heading: "The Opportunity You Might Not See",
    intro: `There's something we look for on every file that most banks never mention—because it doesn't help them.

When you bring us your full financial picture—not just your mortgage, but your debts, your cash flow, your goals—we sometimes find restructuring opportunities that change everything.`,

    example: {
      heading: "Here's a real example from this week:",
      setup: `A client came to us with a straightforward renewal. $215,000 mortgage at $1,200/month with 20 years remaining. Standard stuff.

But he also had:`,
      debts: [
        { type: "Car loan", balance: 75000, payment: 1555 },
        { type: "Home renovation loan", balance: 46000, payment: 450 },
      ],
      totalOutflow: "Total monthly outflow: $3,205 across three debts.",
      bankPath: `If he renewed at his bank, he'd keep making those three separate payments for years—the car loan for 5 years, the reno loan for 10, the mortgage for 20. High interest on the consumer debt. Cash flow squeezed every month.`,
    },

    solution: {
      heading: "Here's what we found:",
      body: `By consolidating everything into a single new mortgage of $336,000—and keeping his total payment at the same $3,205 he was already paying—we reduced his total time to debt-free from 20 years to 10 years.`,
      impactLine: "Same monthly cash flow. Half the time. Completely debt-free a decade sooner.",
      clientReaction: "He had no idea this was possible. His bank certainly wasn't going to tell him.",
    },

    noteOnIncreasingMortgage: {
      heading: `A note on "increasing your mortgage":`,
      body: `When we talk about debt consolidation, some people hesitate—"I don't want a bigger mortgage."

We get it. But here's the reality: your total debt doesn't change. If you owe $215,000 on your mortgage plus $121,000 in other debts, you owe $336,000. Period.

The question isn't whether you have debt. The question is how that debt is structured—and whether the structure is working for you or against you.

Consolidating doesn't add debt. It repositions it. And when done strategically, it can cut years off your path to debt-free.`,
    },

    relevance: {
      heading: "Why this matters for you:",
      body: `We don't know yet if there's a similar opportunity in your situation. That's what the application unlocks—it lets us see the full picture and look for restructuring plays that most lenders ignore.

This is one of the reasons we ask for more information than a typical rate quote requires. We're not just shopping rates. We're looking for the move that changes your trajectory.`,
    },
  },

  // ===========================================================================
  // OUR APPROACH
  // ===========================================================================
  ourApproach: {
    heading: "Our Approach",
    intro: `The Inspired Team has over 90 years combined experience in the Canadian mortgage space. We've seen every rate cycle, every market panic, every "this time is different" moment.

And here's what we've learned: the mortgage industry is designed to benefit banks, not borrowers. We built Inspired Mortgage to change that.`,

    differentiators: {
      heading: "Here's what makes us different:",
      items: [
        {
          title: "We work for you, not the banks.",
          body: "We're paid the same regardless of which lender you choose. Our only job is finding you the best deal.",
        },
        {
          title: "We watch your mortgage.",
          body: "Not just at renewal—throughout your entire term. If something changes, we call you.",
        },
        {
          title: "We explain the math.",
          body: "Every recommendation comes with numbers you can verify yourself.",
        },
        {
          title: "We make lenders compete.",
          body: "30+ lenders. One application. You see every offer.",
        },
      ],
    },

    closing: `After decades in this industry, we could have done anything. Instead, we built this.`,

    promise: {
      heading: "The Inspired Mortgage Promise",
      body: `You'll never sign a renewal letter without knowing your options. You'll never be surprised by rate changes. You'll never wonder if you got the best deal.`,
      signature: "{{ADVISOR_NAME}}\nFounder, Inspired Mortgage",
    },
  },

  // ===========================================================================
  // $5,000 PENALTY GUARANTEE
  // ===========================================================================
  guarantee: {
    heading: "$5,000 Penalty Guarantee",

    certificate: {
      amount: "$5,000",
      title: "Penalty Guarantee",
      body: "If your penalty exceeds $5,000 when refinancing with us, we cover the difference. Guaranteed.",
      subtext: "For penalties under $5,000, we split it 50/50.",
    },

    howItWorks: {
      heading: "How It Works",
      examples: [
        "Your penalty is $12,000? You pay $5,000, we cover $7,000.",
        "Your penalty is $8,000? You pay $5,000, we cover $3,000.",
        "Your penalty is $4,500? We split it 50/50—you pay $2,250, we cover $2,250.",
      ],
      explanation: `This guarantee exists because we believe in our ability to find you a better deal. If the savings from your new rate don't justify the penalty, we make up the difference.`,
    },

    askYourBank: {
      heading: "Ask Your Bank",
      prompt: `Ask your bank: "If I renew with you, will you guarantee that I will not pay any higher of a penalty than $5,000? And if the penalty is lower than $5,000, will you split it with me 50/50—for any reason I break the mortgage, including selling my house?"`,
      punchline: `If they say no, then the risk of renewing with them is way too high. You will not have an opportunity to renegotiate and get a lower rate in the future.`,
    },
  },

  // ===========================================================================
  // STRATEGY: FIXED RATE MORTGAGE
  // ===========================================================================
  fixedRate: {
    heading: "Strategy: Fixed Rate Mortgage",
    intro: `A fixed rate locks in your interest rate for the entire term—typically 5 years. Your payment stays exactly the same, no matter what happens in the market.`,

    whenItMakesSense: {
      heading: "When Fixed Makes Sense",
      items: [
        "You value predictability and want to know exactly what you'll pay each month",
        "Your budget is tight and you can't absorb payment increases",
        "You believe rates will rise significantly during your term",
        "You sleep better knowing your rate won't change",
      ],
    },

    whatWeDoDifferently: {
      heading: "What We Do Differently",
      body: `Most people just take the rate their bank offers. We make lenders compete—and the difference can be significant.

But here's the thing: getting you a competitive rate today is just the beginning. The real value happens during your term.`,
    },

    monthlyMonitoring: {
      heading: "Monthly Mortgage Monitoring",
      body: `Every month, we send you a customized report that analyzes your fixed rate relative to current market rates. You'll always know exactly where you stand.

Why this matters: Let's say you lock in today at 4.30%. Fourteen months from now, the same 5-year fixed rate is available at 3.75%. Your bank will never tell you this. They're happy to keep collecting your higher payments.

We'll notify you immediately. And because of our $5,000 Penalty Guarantee (with 50/50 split on penalties under $5,000), you can actually do something about it.`,
    },

    strategicRelock: {
      heading: "Strategic Relock: How It Works",
      body: `When rates drop significantly, we run the math:`,
      steps: [
        "What's your current penalty?",
        "What will you save with the lower rate?",
        "Does it make sense to break and relock?",
      ],
      closing: `If the savings outweigh the penalty—and with our guarantee protecting you—we execute a strategic relock. You get a brand new 5-year term at the lower rate, and you keep more money in your pocket.`,
    },

    borrowerComparison: {
      heading: "Real Example: Two Strategic Relocks in One Term",
      intro: `Let's compare two borrowers with identical $500,000 mortgages, both starting at 4.30%:`,

      borrowerA: {
        label: "BORROWER A: Renews with their bank",
        steps: [
          "Locks in at 4.30% for 5 years",
          "Rates drop to 3.75% at month 14—bank never calls",
          "Rates drop to 3.25% at month 32—bank still never calls",
          "Pays 4.30% for the entire 60 months",
          "Total interest paid over 5 years: approximately $103,500",
        ],
      },

      borrowerB: {
        label: "BORROWER B: Works with Inspired Mortgage",
        steps: [
          "Locks in at 4.30%",
          "Month 14: Rates drop to 3.75%. We call. Penalty is $4,200—we split it 50/50 ($2,100 each). Relock at 3.75% for new 5-year term.",
          "Month 32 (18 months into new term): Rates drop to 3.25%. We call again. Penalty is $3,800—we split it 50/50 ($1,900 each). Relock at 3.25%.",
          "Total penalties paid by borrower: $4,000",
          "Total interest paid: approximately $78,200",
        ],
      },

      result: {
        heading: "THE DIFFERENCE",
        body: `Borrower B saves over $21,000 in interest, minus $4,000 in penalties = net savings of $17,000+

And here's what most people miss: Borrower B also now has a rate locked at 3.25% going forward, while Borrower A is about to renew into whatever the market offers in year 6.

This is active management. This is what your bank will never do.`,
      },
    },

    askYourBank: `Before you renew with them, ask: "If rates drop significantly during my term, will you call me? Will you help me relock at the lower rate? Will you guarantee my penalty won't exceed $5,000?"

You already know the answer.`,
  },

  // ===========================================================================
  // STRATEGY: VARIABLE RATE MORTGAGE
  // ===========================================================================
  variableRate: {
    heading: "Strategy: Variable Rate Mortgage",
    intro: `Variable rates move with the market—which means risk, but also opportunity. Right now, based on our analysis, we're in a cycle that looks flat to slightly declining. That's a window.

But here's what you need to understand: a variable rate is only as good as the management behind it.`,

    whenItMakesSense: {
      heading: "When Variable Makes Sense",
      items: [
        "You can handle some payment fluctuation",
        "You believe rates will stay flat or decrease",
        "You want lower penalties if you need to break your mortgage early",
        "Historically, variable rates have outperformed fixed rates over time",
      ],
    },

    whatWeDoDifferently: {
      heading: "What We Do Differently",
      body: `We don't guess at market timing. We track the signals that matter—Bank of Canada policy, bond yields, inflation trends, employment data, and how lenders are pricing risk. We've mapped these cycles for years. When the indicators shift, we act.`,
    },

    strategy: {
      heading: "The Strategy",
      body: `Start variable, benefit from lower payments while rates drift down, and watch for the signals that tell us we're approaching the bottom of the cycle. When those signals appear, we reach out to discuss locking into a fixed rate—ideally 1–1.5% below today's rates.`,
    },

    howItPlaysOut: {
      heading: "How This Could Play Out For You",
      body: `You start variable at today's rates. Over the next 12–18 months, the Bank of Canada continues easing. Your rate drops incrementally. When we see signs the cycle is turning—inflation ticking up, bond yields rising—we reach out. You lock in at the bottom, a full 1–1.5% below today's fixed rates. That's active management in action.

On your {{MORTGAGE_AMOUNT}} mortgage, a 1.25% rate drop saves you roughly {{ANNUAL_SAVINGS}} per year—and over {{FIVE_YEAR_SAVINGS}} across a typical term. That's not a rounding error. That's a family vacation every year. Or years shaved off your amortization. Or tens of thousands in interest you never pay.`,
    },

    dangerOfGoingItAlone: {
      heading: "The Danger of Going It Alone",
      body: `In 2022 and 2023, we saw what happens when no one is watching.

Variable rates spiked. Homeowners who had chosen variable—often on good advice at the time—watched their rates climb month after month. But here's what made it worse: most banks kept their payments the same.

That sounds harmless. It wasn't.

What actually happened is that a larger and larger portion of each payment went to interest—and almost nothing went to principal. Some homeowners made payments for two full years and barely moved the needle on what they owed. They had no warning. No call from their bank. No one watching.

By the time they realized what had happened, the damage was done—tens of thousands in extra interest, years added to their mortgage, and no easy way out.

That's what unmanaged variable looks like.

Managed variable means someone is watching. Someone runs the numbers monthly. Someone calls when the math changes. Someone tells you when it's time to lock in—and when it's time to wait.

That's what we do.

And if the time comes to lock in and there's a penalty involved—even on a variable rate mortgage—you're protected by our $5,000 Mortgage Penalty Guarantee. Your out-of-pocket will never exceed $5,000 (and if the penalty is under $5,000, we split it 50/50). We cover the rest.

That's not a promise you'll find anywhere else.`,
    },
  },

  // ===========================================================================
  // STRATEGY: CASH BACK MORTGAGE (Optional)
  // ===========================================================================
  cashBack: {
    heading: "Strategy: Cash Back Mortgage",
    intro: `A cash back mortgage puts money in your hands at closing—typically 1–5% of your mortgage amount. In exchange, you accept a slightly higher rate for the term.

This isn't free money. But used strategically, it can work harder for you than the extra interest costs.`,

    whenItMakesSense: {
      heading: "When Cash Back Makes Sense",
      items: [
        "You're carrying high-interest debt (credit cards, personal loans) that's costing you more than the rate premium",
        "You're close to 20% down and cash back could help you avoid CMHC insurance entirely",
        "You're a first-time buyer with depleted savings after closing costs",
        "You have a specific, strategic use for the capital",
      ],
    },

    whatWeDoDifferently: {
      heading: "What We Do Differently",
      body: `Most people don't even know this option exists. Those who do often dismiss it as "paying more for your mortgage." But that's only true if the cash sits in a savings account doing nothing.

The real question isn't whether cash back costs more—it does. The question is whether that cash creates more value than it costs.`,
    },

    trueStory: {
      heading: "A True Story: Escaping the Credit Card Trap",
      body: `A client came to us drowning in credit card debt. Three cards. $22,000 total. Minimum payments barely covering the interest. She was stuck.

Her mortgage renewal was coming up. She could have just renewed at the best rate and kept making those credit card payments for years.

Instead, we found her a cash back mortgage. The rate was 0.6% higher than the standard—but she walked away with $18,000 at closing.

She paid off two cards completely. The third she cleared within six months using the cash flow she freed up from not making minimum payments anymore.`,
      math: {
        heading: "The math:",
        lines: [
          "Her credit card debt at 21% was costing her approximately $4,600 per year in interest—and she was making almost no progress on the principal.",
          "The cash back mortgage cost her roughly $2,400 per year more than the standard rate.",
          "Net savings in year one: over $2,200—plus she was actually paying down debt instead of drowning in it.",
        ],
      },
      outcome: `Within 18 months, she was completely debt-free except for her mortgage. Her credit score jumped. Her stress level dropped. Her cash flow transformed.

Her bank never mentioned this was possible. Why would they? They weren't watching. They weren't advising. They were just processing paperwork.`,
    },

    verificationBox: {
      heading: "Want to verify this math?",
      instruction: "Copy and paste this prompt into Google or any AI tool:",
      prompt: `Explain how cash back mortgages work in Canada. If someone has $20,000 in credit card debt at 21% interest and takes a cash back mortgage with a rate 0.6% higher than a standard mortgage to pay off that debt, are they better off or worse off? Show the math comparing the extra mortgage interest cost vs the credit card interest saved. What are other strategic uses for cash back mortgages?`,
    },

    howItCouldWork: {
      heading: "How This Could Work For You",
      body: `On your {{MORTGAGE_AMOUNT}} mortgage, you could qualify for approximately {{CASH_BACK_AMOUNT}} cash back at closing.

If you're carrying high-interest debt, that cash back could eliminate it—and the interest savings often exceed the higher mortgage rate. If you're close to 20% down, it could help you avoid CMHC insurance entirely. If you're a first-time buyer, it could give you breathing room when your accounts are drained.

The key is using it strategically. That's exactly what we'll analyze in your Lender Comparison Report—whether cash back makes sense for your situation, and if so, how much it could save you (or cost you) over the term.`,
    },
  },

  // ===========================================================================
  // WHAT HAPPENS NEXT
  // ===========================================================================
  whatHappensNext: {
    heading: "What Happens Next",
    steps: [
      {
        number: 1,
        title: "Complete Your Application",
        description: "10-15 minutes. No credit impact.",
        cta: "{{APPLICATION_LINK}}",
      },
      {
        number: 2,
        title: "Receive Your Lender Comparison Report",
        description: "Within 24-48 hours of receiving your completed application, we'll shop your mortgage to 30+ lenders and send you real rates with a side-by-side comparison.",
      },
      {
        number: 3,
        title: "Make Your Decision",
        description: "No pressure. No obligation. Just clear information to decide what's best.",
      },
    ],
    ctaBox: {
      heading: "Ready to See What's Possible?",
      buttonText: "{{APPLICATION_LINK}}",
    },
    advisorBlock: {
      label: "Your Advisor",
      name: "{{ADVISOR_NAME}}",
      email: "{{ADVISOR_EMAIL}}",
      phone: "{{ADVISOR_PHONE}}",
    },
  },
} as const;

// ===========================================================================
// VARIABLE REFERENCE
// ===========================================================================
// Dynamic placeholders used throughout:
//
// COVER / GLOBAL:
//   {{CLIENT_NAME}}            - Full client name
//   {{CLIENT_FIRST_NAME}}      - First name only
//   {{DATE}}                   - Report date
//   {{ADVISOR_NAME}}           - Advisor full name
//   {{ADVISOR_EMAIL}}          - Advisor email
//   {{ADVISOR_PHONE}}          - Advisor phone
//   {{APPLICATION_LINK}}       - Application URL
//
// SCENARIO 1 (Sub-2% Fixed → Renewal Trap):
//   {{THEIR_PREVIOUS_RATE}}    - Client's previous rate (e.g., 1.89)
//   {{ORIGINAL_AMORTIZATION}}  - Original amortization (e.g., 25)
//   {{CURRENT_AMORTIZATION}}   - Current remaining amortization (e.g., 20)
//   {{OLD_PAYMENT}}            - Previous payment amount
//   {{NEW_PAYMENT}}            - Calculated new payment at current rates
//   {{PAYMENT_DIFFERENCE}}     - NEW_PAYMENT - OLD_PAYMENT
//   {{FIVE_YEARS_OF_PAYMENTS}} - NEW_PAYMENT × 60
//   {{CURRENT_AMORTIZATION_MINUS_5}}  - CURRENT_AMORTIZATION - 5
//   {{CURRENT_AMORTIZATION_MINUS_10}} - CURRENT_AMORTIZATION - 10
//
// SCENARIO 2 (Variable → Panic Lock):
//   {{THEIR_ORIGINAL_RATE}}    - Client's original variable rate
//   {{THEIR_LOCK_RATE}}        - Rate when they panic-locked
//   {{THEIR_LOCKED_RATE}}      - Same as THEIR_LOCK_RATE (used in body)
//   {{ESTIMATED_EXTRA_INTEREST}} - Estimated extra interest paid
//
// SCENARIO 3 (Fixed Payment Variable → Negative Am):
//   {{THEIR_PAYMENT}}          - Client's fixed payment amount
//   {{THEIR_ORIGINAL_RATE}}    - Client's original variable rate
//
// VARIABLE RATE STRATEGY:
//   {{MORTGAGE_AMOUNT}}        - Client's mortgage amount (formatted)
//   {{ANNUAL_SAVINGS}}         - MORTGAGE_AMOUNT × 0.0125 (formatted)
//   {{FIVE_YEAR_SAVINGS}}      - ANNUAL_SAVINGS × 5 (formatted)
//
// CASH BACK STRATEGY:
//   {{MORTGAGE_AMOUNT}}        - Client's mortgage amount
//   {{CASH_BACK_AMOUNT}}       - MORTGAGE_AMOUNT × 0.03 (3% estimate)
