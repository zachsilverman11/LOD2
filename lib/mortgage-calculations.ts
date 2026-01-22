/**
 * Canadian Mortgage Calculation Utilities
 *
 * Canadian mortgages use semi-annual compounding, which is different from
 * the monthly compounding used in the US. This affects the effective
 * monthly interest rate calculation.
 */

/**
 * Convert annual rate to effective monthly rate using Canadian semi-annual compounding
 */
export function getMonthlyRate(annualRate: number): number {
  // Canadian mortgages compound semi-annually
  // First convert annual rate to semi-annual rate, then to monthly
  const semiAnnualRate = annualRate / 2;
  const effectiveAnnualRate = Math.pow(1 + semiAnnualRate, 2) - 1;
  const monthlyRate = Math.pow(1 + effectiveAnnualRate, 1 / 12) - 1;
  return monthlyRate;
}

/**
 * Calculate monthly mortgage payment using Canadian semi-annual compounding
 *
 * @param principal - The mortgage principal amount
 * @param annualRate - Annual interest rate as decimal (e.g., 0.045 for 4.5%)
 * @param amortizationYears - Total amortization period in years
 * @returns Monthly payment amount
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  amortizationYears: number
): number {
  if (principal <= 0 || amortizationYears <= 0) return 0;
  if (annualRate <= 0) return principal / (amortizationYears * 12);

  const monthlyRate = getMonthlyRate(annualRate);
  const numPayments = amortizationYears * 12;

  // Standard mortgage payment formula: P * [r(1+r)^n] / [(1+r)^n - 1]
  const payment =
    principal *
    ((monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1));

  return payment;
}

/**
 * Calculate the difference in monthly payments between two rates
 */
export function calculatePaymentDifference(
  principal: number,
  oldRate: number,
  newRate: number,
  amortizationYears: number
): {
  oldPayment: number;
  newPayment: number;
  difference: number;
  monthlyDifference: number;
} {
  const oldPayment = calculateMonthlyPayment(principal, oldRate, amortizationYears);
  const newPayment = calculateMonthlyPayment(principal, newRate, amortizationYears);
  const difference = newPayment - oldPayment;

  return {
    oldPayment: Math.round(oldPayment),
    newPayment: Math.round(newPayment),
    difference: Math.round(difference),
    monthlyDifference: Math.round(difference),
  };
}

/**
 * Calculate estimated extra interest paid over a term due to rate differential
 *
 * @param principal - The mortgage principal amount
 * @param rateDifferential - The difference in rates (e.g., 0.02 for 2%)
 * @param termYears - The term length in years (typically 5)
 * @returns Estimated extra interest paid
 */
export function calculateEstimatedExtraInterest(
  principal: number,
  rateDifferential: number,
  termYears: number
): number {
  // Simplified calculation: assumes average balance over term
  // In reality, this is more complex due to amortization
  // Using a rough estimate of 85% average balance over a 5-year term
  const averageBalance = principal * 0.85;
  const extraInterest = averageBalance * rateDifferential * termYears;
  return Math.round(extraInterest);
}

/**
 * Calculate five years of payments (60 months)
 */
export function calculateFiveYearsOfPayments(monthlyPayment: number): number {
  return Math.round(monthlyPayment * 60);
}

/**
 * Format a number as Canadian currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number as a clean percentage (e.g., "4.5%" not "4.50000%")
 */
export function formatPercent(value: number): string {
  // value is expected as decimal (0.045 for 4.5%)
  const percent = value * 100;
  // Remove trailing zeros and limit to 2 decimal places
  const formatted = parseFloat(percent.toFixed(2)).toString();
  return `${formatted}%`;
}

/**
 * Parse a rate string or number to decimal format
 * Handles both "4.5" and "4.5%" and 0.045
 */
export function parseRate(rate: string | number): number {
  if (typeof rate === "number") {
    // If already in decimal form (less than 1), return as-is
    // Otherwise, convert from percentage
    return rate < 1 ? rate : rate / 100;
  }

  // Remove % sign if present and parse
  const cleaned = rate.replace("%", "").trim();
  const parsed = parseFloat(cleaned);

  // If the number is greater than 1, it's a percentage, convert to decimal
  return parsed > 1 ? parsed / 100 : parsed;
}

/**
 * Extract mortgage-related data with defaults
 */
export type ScenarioData = {
  // Common fields
  mortgageAmount: number;
  originalAmortization: number;
  currentAmortization: number;

  // Scenario 1: Sub-2% Fixed -> Renewal Trap
  previousRate?: number;
  currentMarketRate?: number;
  oldPayment?: number;
  newPayment?: number;
  paymentDifference?: number;
  fiveYearsOfPayments?: number;

  // Scenario 2: Variable -> Panic Lock
  originalRate?: number;
  lockInRate?: number;
  estimatedExtraInterest?: number;

  // Scenario 3: Fixed Payment Variable -> Negative Am
  fixedPayment?: number;

  // Debt Consolidation
  otherDebts?: Array<{
    type: string;
    balance: number;
    payment: number;
  }>;
};

/**
 * Calculate derived values for Scenario 1
 */
export function calculateScenario1Data(data: {
  mortgageAmount: number;
  currentAmortization: number;
  previousRate: number;
  currentMarketRate: number;
}): {
  oldPayment: number;
  newPayment: number;
  paymentDifference: number;
  fiveYearsOfPayments: number;
} {
  const oldPayment = calculateMonthlyPayment(
    data.mortgageAmount,
    data.previousRate,
    data.currentAmortization + 5 // Original amortization before the term
  );

  const newPayment = calculateMonthlyPayment(
    data.mortgageAmount,
    data.currentMarketRate,
    data.currentAmortization
  );

  return {
    oldPayment: Math.round(oldPayment),
    newPayment: Math.round(newPayment),
    paymentDifference: Math.round(newPayment - oldPayment),
    fiveYearsOfPayments: calculateFiveYearsOfPayments(newPayment),
  };
}

/**
 * Calculate derived values for Scenario 2
 */
export function calculateScenario2Data(data: {
  mortgageAmount: number;
  originalRate: number;
  lockInRate: number;
  termYears?: number;
}): {
  estimatedExtraInterest: number;
} {
  const termYears = data.termYears || 5;
  const rateDifferential = data.lockInRate - data.originalRate;
  // Estimate the extra interest: they locked in too high vs what they could have had
  // Assuming rates settled about 1.5% lower than where they locked
  const settleDifferential = Math.max(rateDifferential - 0.015, 0);
  const estimatedExtraInterest = calculateEstimatedExtraInterest(
    data.mortgageAmount,
    settleDifferential,
    termYears
  );

  return {
    estimatedExtraInterest,
  };
}
