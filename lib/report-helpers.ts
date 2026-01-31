/**
 * Report template helper functions
 * Handles variable replacement and computed values for report templates
 */

import { formatCurrency, formatPercent } from "@/lib/mortgage-calculations";

export interface ReportVariables {
  // Global
  clientName?: string;
  clientFirstName?: string;
  date?: string;
  advisorName?: string;
  advisorEmail?: string;
  advisorPhone?: string;
  applicationLink?: string;

  // Mortgage data
  mortgageAmount?: number;
  currentRate?: number;
  currentLender?: string;
  propertyValue?: number;
  penaltyAmount?: number;

  // Scenario 1
  theirPreviousRate?: number;
  originalAmortization?: number;
  currentAmortization?: number;
  oldPayment?: number;
  newPayment?: number;
  paymentDifference?: number;
  fiveYearsOfPayments?: number;

  // Scenario 2
  theirOriginalRate?: number;
  theirLockRate?: number;
  theirLockedRate?: number;
  estimatedExtraInterest?: number;

  // Scenario 3
  theirPayment?: number;
}

/**
 * Builds a variable map from report data for use with replaceVariables()
 */
export function buildVariableMap(vars: ReportVariables): Record<string, string> {
  const map: Record<string, string> = {};

  // Global variables
  if (vars.clientName) map["CLIENT_NAME"] = vars.clientName;
  if (vars.clientFirstName) map["CLIENT_FIRST_NAME"] = vars.clientFirstName;
  else if (vars.clientName) map["CLIENT_FIRST_NAME"] = vars.clientName.split(" ")[0];
  if (vars.date) map["DATE"] = vars.date;
  if (vars.advisorName) map["ADVISOR_NAME"] = vars.advisorName;
  if (vars.advisorEmail) map["ADVISOR_EMAIL"] = vars.advisorEmail;
  if (vars.advisorPhone) map["ADVISOR_PHONE"] = vars.advisorPhone;
  if (vars.applicationLink) map["APPLICATION_LINK"] = vars.applicationLink;

  // Mortgage data
  if (vars.mortgageAmount != null) {
    map["MORTGAGE_AMOUNT"] = formatCurrency(vars.mortgageAmount);

    // Computed: Variable rate savings
    const annualSavings = vars.mortgageAmount * 0.0125;
    const fiveYearSavings = annualSavings * 5;
    map["ANNUAL_SAVINGS"] = formatCurrency(annualSavings);
    map["FIVE_YEAR_SAVINGS"] = formatCurrency(fiveYearSavings);

    // Computed: Cash back amount (3% estimate)
    const cashBackAmount = vars.mortgageAmount * 0.03;
    map["CASH_BACK_AMOUNT"] = formatCurrency(cashBackAmount);
  }

  if (vars.currentRate != null) map["CURRENT_RATE"] = formatPercent(vars.currentRate);
  if (vars.currentLender) map["CURRENT_LENDER"] = vars.currentLender;
  if (vars.propertyValue != null) map["PROPERTY_VALUE"] = formatCurrency(vars.propertyValue);

  // Penalty
  if (vars.penaltyAmount != null) {
    map["PENALTY_AMOUNT"] = formatCurrency(vars.penaltyAmount);
    map["PENALTY_HALF"] = formatCurrency(vars.penaltyAmount / 2);
  }

  // Scenario 1 variables
  if (vars.theirPreviousRate != null) map["THEIR_PREVIOUS_RATE"] = (vars.theirPreviousRate * 100).toFixed(2);
  if (vars.originalAmortization != null) map["ORIGINAL_AMORTIZATION"] = String(vars.originalAmortization);
  if (vars.currentAmortization != null) {
    map["CURRENT_AMORTIZATION"] = String(vars.currentAmortization);
    map["CURRENT_AMORTIZATION_MINUS_5"] = String(vars.currentAmortization - 5);
    map["CURRENT_AMORTIZATION_MINUS_10"] = String(vars.currentAmortization - 10);
    map["EXTENDED_AMORTIZATION"] = String(vars.currentAmortization + 5);
  }
  if (vars.oldPayment != null) map["OLD_PAYMENT"] = formatCurrency(vars.oldPayment).replace("$", "");
  if (vars.newPayment != null) map["NEW_PAYMENT"] = formatCurrency(vars.newPayment).replace("$", "");
  if (vars.paymentDifference != null) map["PAYMENT_DIFFERENCE"] = formatCurrency(vars.paymentDifference).replace("$", "");
  if (vars.fiveYearsOfPayments != null) map["FIVE_YEARS_OF_PAYMENTS"] = formatCurrency(vars.fiveYearsOfPayments).replace("$", "");

  // Scenario 2 variables
  if (vars.theirOriginalRate != null) map["THEIR_ORIGINAL_RATE"] = (vars.theirOriginalRate * 100).toFixed(2);
  if (vars.theirLockRate != null) map["THEIR_LOCK_RATE"] = (vars.theirLockRate * 100).toFixed(2);
  if (vars.theirLockedRate != null) map["THEIR_LOCKED_RATE"] = (vars.theirLockedRate * 100).toFixed(2);
  else if (vars.theirLockRate != null) map["THEIR_LOCKED_RATE"] = (vars.theirLockRate * 100).toFixed(2);
  if (vars.estimatedExtraInterest != null) map["ESTIMATED_EXTRA_INTEREST"] = formatCurrency(vars.estimatedExtraInterest).replace("$", "");

  // Scenario 3 variables
  if (vars.theirPayment != null) map["THEIR_PAYMENT"] = formatCurrency(vars.theirPayment).replace("$", "");
  if (vars.theirOriginalRate != null) map["THEIR_ORIGINAL_RATE"] = (vars.theirOriginalRate * 100).toFixed(2);

  return map;
}

/**
 * Replace {{VARIABLE_NAME}} placeholders in text with actual values
 */
export function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] ?? match;
  });
}

/**
 * Replace variables in text and split into paragraphs for React-PDF rendering
 * Returns array of paragraph strings (split on double newline)
 */
export function replaceAndSplit(text: string, variables: Record<string, string>): string[] {
  const replaced = replaceVariables(text, variables);
  return replaced.split(/\n\n+/).filter(p => p.trim());
}
