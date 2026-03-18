import Anthropic from "@anthropic-ai/sdk";
import {
  calculateScenario1Data,
  calculateScenario2Data,
  parseRate,
} from "@/lib/mortgage-calculations";

export type ExtractedMortgageData = {
  // Common fields
  mortgageAmount: number | null;
  originalAmortization: number | null;
  currentAmortization: number | null;

  // Scenario 1: Sub-2% Fixed -> Renewal Trap
  previousRate: number | null;
  currentMarketRate: number | null;
  oldPayment: number | null;
  newPayment: number | null;
  paymentDifference: number | null;
  fiveYearsOfPayments: number | null;

  // Scenario 2: Variable -> Panic Lock
  originalRate: number | null;
  lockInRate: number | null;
  estimatedExtraInterest: number | null;

  // Scenario 3: Fixed Payment Variable -> Negative Am
  fixedPayment: number | null;

  // Debt Consolidation
  otherDebts: Array<{
    type: string;
    balance: number;
    payment: number;
  }>;
};

type RawDataFallback = {
  balance?: string | number;
  rate?: string | number;
  amortization?: string | number;
  mortgageAmount?: string | number;
};

export async function POST(request: Request) {
  const { notes, scenario, leadRawData } = await request.json();

  if (!notes || notes.trim().length < 50) {
    return Response.json(
      { error: "Please provide more detailed notes" },
      { status: 400 }
    );
  }

  if (![1, 2, 3].includes(scenario)) {
    return Response.json(
      { error: "Scenario must be 1, 2, or 3" },
      { status: 400 }
    );
  }

  const client = new Anthropic();

  try {
    const scenarioPrompts: Record<number, string> = {
      1: `Extract the following for Scenario 1 (Sub-2% Fixed Rate that is now renewing):
- mortgageAmount: current mortgage balance
- originalAmortization: years when they first got the mortgage
- currentAmortization: years remaining now
- previousRate: their old sub-2% rate (e.g., 1.89%)
- currentMarketRate: what rate they'd renew at today (default to 4.5% if not mentioned)`,

      2: `Extract the following for Scenario 2 (Variable rate that they panic-locked):
- mortgageAmount: current mortgage balance
- originalAmortization: years when they first got the mortgage
- currentAmortization: years remaining now
- originalRate: the low variable rate they started at (e.g., 1.45%)
- lockInRate: the rate they locked into during the panic (e.g., 5.79%)`,

      3: `Extract the following for Scenario 3 (Fixed Payment Variable with negative amortization):
- mortgageAmount: current mortgage balance
- originalAmortization: years when they first got the mortgage
- currentAmortization: years remaining now
- originalRate: their starting variable rate
- fixedPayment: their fixed monthly payment amount`,
    };

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are extracting mortgage data from discovery call notes for a Canadian mortgage brokerage.

${scenarioPrompts[scenario]}

Also look for any other debts mentioned that could be consolidated:
- otherDebts: array of objects with {type, balance, payment}
  Examples: car loans, credit cards, lines of credit, renovation loans

IMPORTANT:
- Return numbers as raw numbers (no $ or , symbols)
- Return rates as decimals (e.g., 0.0189 for 1.89%, 0.045 for 4.5%)
- If a value is clearly not mentioned in the notes, use null
- If you can infer a reasonable default, use it
- For currentMarketRate in Scenario 1, default to 0.045 (4.5%) if not specified

Return ONLY a valid JSON object. No markdown, no explanation, just the JSON.`,
      messages: [{ role: "user", content: notes }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Clean the text - remove markdown code blocks if present
    const cleanedText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let extracted: Record<string, any>;
    try {
      extracted = JSON.parse(cleanedText);
    } catch {
      console.error("Failed to parse AI response for mortgage data. Raw response:", cleanedText);
      return Response.json(
        {
          error: "Failed to parse AI response",
          rawSnippet: cleanedText.slice(0, 200),
        },
        { status: 500 }
      );
    }

    // Apply fallbacks from lead rawData
    const rawData = (leadRawData || {}) as RawDataFallback;

    if (extracted.mortgageAmount === null && rawData.balance) {
      const balance =
        typeof rawData.balance === "string"
          ? parseFloat(rawData.balance.replace(/[^0-9.]/g, ""))
          : rawData.balance;
      if (!isNaN(balance)) {
        extracted.mortgageAmount = balance;
      }
    }

    if (extracted.mortgageAmount === null && rawData.mortgageAmount) {
      const amount =
        typeof rawData.mortgageAmount === "string"
          ? parseFloat(rawData.mortgageAmount.replace(/[^0-9.]/g, ""))
          : rawData.mortgageAmount;
      if (!isNaN(amount)) {
        extracted.mortgageAmount = amount;
      }
    }

    // Calculate derived values based on scenario
    if (scenario === 1 && extracted.mortgageAmount && extracted.currentAmortization) {
      const previousRate = extracted.previousRate || 0.0189; // Default 1.89%
      const currentMarketRate = extracted.currentMarketRate || 0.045; // Default 4.5%

      const scenario1Calcs = calculateScenario1Data({
        mortgageAmount: extracted.mortgageAmount,
        currentAmortization: extracted.currentAmortization,
        previousRate: parseRate(previousRate),
        currentMarketRate: parseRate(currentMarketRate),
      });

      extracted = {
        ...extracted,
        previousRate: parseRate(previousRate),
        currentMarketRate: parseRate(currentMarketRate),
        ...scenario1Calcs,
      };
    }

    if (scenario === 2 && extracted.mortgageAmount) {
      const originalRate = extracted.originalRate || 0.0145; // Default 1.45%
      const lockInRate = extracted.lockInRate || 0.0579; // Default 5.79%

      const scenario2Calcs = calculateScenario2Data({
        mortgageAmount: extracted.mortgageAmount,
        originalRate: parseRate(originalRate),
        lockInRate: parseRate(lockInRate),
      });

      extracted = {
        ...extracted,
        originalRate: parseRate(originalRate),
        lockInRate: parseRate(lockInRate),
        ...scenario2Calcs,
      };
    }

    // Ensure otherDebts is an array
    if (!Array.isArray(extracted.otherDebts)) {
      extracted.otherDebts = [];
    }

    const result: ExtractedMortgageData = {
      mortgageAmount: extracted.mortgageAmount ?? null,
      originalAmortization: extracted.originalAmortization ?? null,
      currentAmortization: extracted.currentAmortization ?? null,
      previousRate: extracted.previousRate ?? null,
      currentMarketRate: extracted.currentMarketRate ?? null,
      oldPayment: extracted.oldPayment ?? null,
      newPayment: extracted.newPayment ?? null,
      paymentDifference: extracted.paymentDifference ?? null,
      fiveYearsOfPayments: extracted.fiveYearsOfPayments ?? null,
      originalRate: extracted.originalRate ?? null,
      lockInRate: extracted.lockInRate ?? null,
      estimatedExtraInterest: extracted.estimatedExtraInterest ?? null,
      fixedPayment: extracted.fixedPayment ?? null,
      otherDebts: extracted.otherDebts,
    };

    return Response.json({ extractedData: result });
  } catch (error) {
    console.error("Error extracting mortgage data:", error);
    return Response.json(
      { error: "Failed to extract mortgage data" },
      { status: 500 }
    );
  }
}
