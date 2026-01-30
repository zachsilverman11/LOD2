/**
 * HTML Template Generator for Post-Discovery Reports
 * Premium design using HTML/CSS for Puppeteer PDF generation
 * 
 * Design System: Wealth management firm aesthetic
 * - Navy (#1e293b) for authority/headers
 * - Brand purple (#625FFF) as sparse accent only
 * - Gold/amber (#d97706) for savings/positive outcomes
 * - Warm grays for body text
 * - Generous whitespace throughout
 */

import { REPORT_COPY } from "@/lib/report-copy";
import { replaceVariables, buildVariableMap } from "@/lib/report-helpers";

export interface ReportHTMLProps {
  clientName: string;
  date: string;
  consultant: {
    name: string;
    title?: string;
    email: string;
    phone: string;
    calLink: string;
  };
  bullets: string[];
  mortgageAmount: string;
  scenario: 0 | 1 | 2 | 3 | null;
  includeDebtConsolidation: boolean;
  includeCashBack: boolean;
  applicationLink: string;
  extractedData: {
    mortgageAmount?: number;
    originalAmortization?: number;
    currentAmortization?: number;
    previousRate?: number;
    currentMarketRate?: number;
    oldPayment?: number;
    newPayment?: number;
    paymentDifference?: number;
    fiveYearsOfPayments?: number;
    originalRate?: number;
    lockInRate?: number;
    estimatedExtraInterest?: number;
    fixedPayment?: number;
    otherDebts?: Array<{ type: string; balance: number; payment: number }>;
  };
}

// ============================================================
// DESIGN SYSTEM
// ============================================================
const colors = {
  // Primary
  navy: "#1e293b",
  navyLight: "#334155",
  navyDark: "#0f172a",

  // Accent — used sparingly
  accent: "#625FFF",
  accentLight: "#ede9fe",
  accentMuted: "#8b5cf6",

  // Gold/Amber — savings, positive outcomes
  gold: "#d97706",
  goldLight: "#fef3c7",
  goldDark: "#b45309",
  goldBorder: "#f59e0b",

  // Text
  textPrimary: "#1e293b",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  textLight: "#cbd5e1",

  // Backgrounds
  white: "#ffffff",
  bgLight: "#f8fafc",
  bgWarm: "#faf8f5",
  bgCard: "#f1f5f9",

  // Borders
  border: "#e2e8f0",
  borderLight: "#f1f5f9",

  // Functional
  success: "#059669",
  successLight: "#ecfdf5",
  successBorder: "#10b981",
};

// Helper functions
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Generate the complete HTML document
 */
export function generateReportHTML(props: ReportHTMLProps): string {
  const {
    clientName,
    date,
    consultant,
    bullets,
    scenario,
    includeDebtConsolidation,
    includeCashBack,
    applicationLink,
    extractedData,
  } = props;

  const vars = buildVariableMap({
    clientName,
    clientFirstName: clientName.split(" ")[0],
    date,
    advisorName: consultant.name,
    advisorEmail: consultant.email,
    advisorPhone: consultant.phone,
    applicationLink,
    mortgageAmount: extractedData.mortgageAmount ?? undefined,
    theirPreviousRate: extractedData.previousRate ?? undefined,
    originalAmortization: extractedData.originalAmortization ?? undefined,
    currentAmortization: extractedData.currentAmortization ?? undefined,
    oldPayment: extractedData.oldPayment ?? undefined,
    newPayment: extractedData.newPayment ?? undefined,
    paymentDifference: extractedData.paymentDifference ?? undefined,
    fiveYearsOfPayments: extractedData.fiveYearsOfPayments ?? undefined,
    theirOriginalRate: extractedData.originalRate ?? undefined,
    theirLockRate: extractedData.lockInRate ?? undefined,
    estimatedExtraInterest: extractedData.estimatedExtraInterest ?? undefined,
    theirPayment: extractedData.fixedPayment ?? undefined,
  });

  const activeScenario: 1 | 2 | 3 | null = (scenario === 1 || scenario === 2 || scenario === 3) ? scenario : null;

  // Build pages — APPROVED PAGE ORDER
  const pages: string[] = [];

  // 1. Cover Page
  pages.push(generateCoverPage(clientName, date, consultant));

  // 2. What You Told Us
  pages.push(generateWhatYouToldUsPage(clientName, bullets, pages.length + 1, vars));

  // 3. Scenario pages
  if (activeScenario === 1) {
    pages.push(...generateScenario1Pages(clientName, extractedData, vars));
  } else if (activeScenario === 2) {
    pages.push(...generateScenario2Pages(clientName, extractedData, vars));
  } else if (activeScenario === 3) {
    pages.push(...generateScenario3Pages(clientName, extractedData, vars));
  }

  // APP LINK #1: After scenario
  pages.push(generateApplicationLinkPage(
    clientName,
    applicationLink,
    REPORT_COPY.ctaPages.afterScenario.message,
    pages.length + 1,
    "afterScenario"
  ));

  // 4. Debt Consolidation
  if (includeDebtConsolidation && extractedData.otherDebts?.length) {
    pages.push(
      generateDebtConsolidationPage(
        clientName,
        extractedData.mortgageAmount || 0,
        extractedData.otherDebts,
        pages.length + 1
      )
    );
  }

  // 5. Our Approach
  pages.push(generateOurApproachPage(clientName, consultant, pages.length + 1, vars));

  // 6. $5,000 Penalty Guarantee
  pages.push(generateGuaranteePage(clientName, pages.length + 1));

  // APP LINK #2: After Guarantee
  pages.push(generateApplicationLinkPage(
    clientName,
    applicationLink,
    REPORT_COPY.ctaPages.afterGuarantee.message,
    pages.length + 1,
    "afterGuarantee"
  ));

  // 7. Strategy: Fixed Rate
  pages.push(...generateFixedRateStrategyPages(clientName, pages.length + 1));

  // 8. Strategy: Variable Rate
  pages.push(...generateVariableRateStrategyPages(clientName, pages.length + 1, vars));

  // 9. Strategy: Cash Back (optional)
  if (includeCashBack) {
    pages.push(...generateCashBackStrategyPages(clientName, pages.length + 1, vars));
  }

  // 10. What Happens Next — APP LINK #3
  pages.push(
    generateWhatHappensNextPage(clientName, consultant, applicationLink, pages.length + 1)
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Post-Discovery Report - ${clientName}</title>
  <style>
    ${getBaseStyles()}
  </style>
</head>
<body>
  ${pages.join("\n")}
</body>
</html>`;
}

// ============================================================
// BASE CSS
// ============================================================
function getBaseStyles(): string {
  return `
    @page {
      size: letter;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Georgia', 'Times New Roman', 'Palatino', serif;
      font-size: 15px;
      line-height: 1.7;
      color: ${colors.textPrimary};
      background: ${colors.white};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ================================================
       PAGE FOUNDATION
       ================================================ */
    .page {
      width: 8.5in;
      min-height: 11in;
      height: 11in;
      padding: 0;
      position: relative;
      page-break-after: always;
      background: ${colors.white};
      overflow: hidden;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .page-inner {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .page-content {
      flex: 1;
      padding: 36px 64px 40px 64px;
    }

    /* ================================================
       TYPOGRAPHY
       ================================================ */
    h1 {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 40px;
      font-weight: 300;
      line-height: 1.2;
      letter-spacing: -0.02em;
      color: ${colors.navy};
    }

    h2 {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.3;
      letter-spacing: -0.01em;
      color: ${colors.navy};
    }

    h3 {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 20px;
      font-weight: 600;
      line-height: 1.4;
      color: ${colors.navy};
    }

    h4 {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      font-weight: 600;
      line-height: 1.4;
      color: ${colors.navy};
    }

    p {
      font-size: 15px;
      line-height: 1.75;
      color: ${colors.textSecondary};
    }

    /* ================================================
       COVER PAGE
       ================================================ */
    .cover-page {
      display: flex;
      flex-direction: column;
      height: 11in;
      position: relative;
      overflow: hidden;
    }

    .cover-top {
      background: linear-gradient(135deg, ${colors.navyDark} 0%, ${colors.navy} 60%, ${colors.navyLight} 100%);
      height: 320px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      flex-shrink: 0;
    }

    .cover-top::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, ${colors.accent}, ${colors.gold});
    }

    .cover-logo {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: ${colors.white};
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 24px;
      opacity: 0.9;
    }

    .cover-tagline {
      color: ${colors.white};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 32px;
      font-weight: 300;
      letter-spacing: 1px;
      text-align: center;
      line-height: 1.3;
      max-width: 500px;
      padding: 0 40px;
    }

    .cover-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 64px 40px 64px;
    }

    .cover-label {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      color: ${colors.textMuted};
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 16px;
    }

    .cover-client-name {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 36px;
      font-weight: 300;
      color: ${colors.navy};
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }

    .cover-date {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      color: ${colors.textMuted};
      margin-bottom: 48px;
    }

    .cover-divider {
      width: 48px;
      height: 1px;
      background: ${colors.border};
      margin-bottom: 48px;
    }

    .cover-advisor-card {
      background: ${colors.bgLight};
      border: 1px solid ${colors.border};
      border-radius: 8px;
      padding: 20px 28px;
      text-align: center;
      min-width: 280px;
    }

    .cover-advisor-label {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 10px;
      color: ${colors.textMuted};
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }

    .cover-advisor-name {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 17px;
      font-weight: 600;
      color: ${colors.navy};
      margin-bottom: 4px;
    }

    .cover-advisor-detail {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      color: ${colors.textSecondary};
      line-height: 1.5;
    }

    /* ================================================
       PAGE HEADER & FOOTER
       ================================================ */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 64px;
      border-bottom: 1px solid ${colors.border};
      flex-shrink: 0;
    }

    .page-header .logo {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      font-weight: 600;
      color: ${colors.navy};
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .page-header .client {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      color: ${colors.textMuted};
    }

    .page-footer {
      padding: 14px 64px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid ${colors.border};
      flex-shrink: 0;
    }

    .page-footer .website {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 10px;
      color: ${colors.textMuted};
      letter-spacing: 0.5px;
    }

    .page-footer .page-number {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 10px;
      color: ${colors.textMuted};
    }

    /* ================================================
       SECTION HEADER
       ================================================ */
    .section-header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 3px solid ${colors.navy};
      display: flex;
      align-items: baseline;
      gap: 12px;
    }

    .section-header h2 {
      color: ${colors.navy};
      font-size: 26px;
      margin: 0;
    }

    .section-icon {
      font-size: 22px;
      flex-shrink: 0;
    }

    /* ================================================
       BULLET LIST
       ================================================ */
    .bullet-list {
      list-style: none;
      padding: 0;
    }

    .bullet-list li {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 12px;
      font-size: 14px;
      line-height: 1.65;
      color: ${colors.textPrimary};
    }

    .bullet-list .bullet {
      flex-shrink: 0;
      width: 6px;
      height: 6px;
      background: ${colors.accent};
      border-radius: 50%;
      margin-top: 8px;
    }

    /* ================================================
       METRIC CARDS — Dashboard Style
       ================================================ */
    .metrics-row {
      display: flex;
      gap: 16px;
      margin: 24px 0;
    }

    .metric-card {
      flex: 1;
      border-radius: 10px;
      padding: 24px;
      text-align: center;
    }

    .metric-card.neutral {
      background: ${colors.bgCard};
      border: 1px solid ${colors.border};
    }

    .metric-card.highlight {
      background: ${colors.accentLight};
      border: 2px solid ${colors.accent};
    }

    .metric-card.gold {
      background: ${colors.goldLight};
      border: 2px solid ${colors.goldBorder};
    }

    .metric-label {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: ${colors.textMuted};
      margin-bottom: 8px;
    }

    .metric-value {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 36px;
      font-weight: 700;
      color: ${colors.navy};
      line-height: 1.1;
    }

    .metric-value.accent {
      color: ${colors.accent};
    }

    .metric-value.gold {
      color: ${colors.gold};
    }

    .metric-value.negative {
      color: #dc2626;
    }

    .metric-subtitle {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      color: ${colors.textMuted};
      margin-top: 4px;
    }

    .comparison-arrow {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      color: ${colors.textMuted};
      padding: 0 4px;
      flex-shrink: 0;
    }

    /* ================================================
       IMPACT BANNER — Full Width Navy
       ================================================ */
    .impact-banner {
      background: ${colors.navy};
      color: ${colors.white};
      padding: 28px 48px;
      text-align: center;
      margin: 24px -64px;
    }

    .impact-banner h2 {
      font-size: 26px;
      font-weight: 700;
      color: ${colors.white};
      line-height: 1.3;
    }

    .impact-banner p {
      color: rgba(255, 255, 255, 0.75);
      font-size: 14px;
      margin-top: 8px;
    }

    /* ================================================
       PULLQUOTE — Key Insight Callout
       ================================================ */
    .pullquote {
      border-left: 4px solid ${colors.accent};
      padding: 20px 28px;
      margin: 28px 0;
      background: ${colors.bgLight};
      border-radius: 0 8px 8px 0;
    }

    .pullquote p {
      font-size: 16px;
      font-style: italic;
      color: ${colors.textPrimary};
      line-height: 1.65;
    }

    .pullquote .attribution {
      font-size: 12px;
      font-style: normal;
      color: ${colors.textMuted};
      margin-top: 8px;
    }

    /* ================================================
       CALLOUT BOX
       ================================================ */
    .callout-box {
      background: ${colors.bgLight};
      border: 1px solid ${colors.border};
      border-radius: 10px;
      padding: 24px 28px;
      margin: 24px 0;
    }

    .callout-box h4 {
      font-size: 15px;
      font-weight: 600;
      color: ${colors.navy};
      margin-bottom: 10px;
    }

    .callout-box p {
      font-size: 14px;
      color: ${colors.textSecondary};
      line-height: 1.65;
    }

    .callout-box.warm {
      background: ${colors.bgWarm};
      border-color: #e8ddd0;
    }

    .callout-box.accent {
      background: ${colors.accentLight};
      border-color: #c4b5fd;
    }

    /* ================================================
       TIMELINE
       ================================================ */
    .timeline {
      background: ${colors.bgLight};
      border: 1px solid ${colors.border};
      border-radius: 10px;
      padding: 28px;
      margin: 24px 0;
    }

    .timeline h3 {
      color: ${colors.navy};
      margin-bottom: 20px;
      font-size: 17px;
    }

    .timeline-items {
      display: flex;
      justify-content: space-between;
    }

    .timeline-item {
      flex: 1;
      text-align: center;
      position: relative;
      padding: 0 8px;
    }

    .timeline-item:not(:last-child)::after {
      content: '';
      position: absolute;
      top: 14px;
      right: 0;
      width: 50%;
      height: 2px;
      background: ${colors.accent};
    }

    .timeline-item:not(:first-child)::before {
      content: '';
      position: absolute;
      top: 14px;
      left: 0;
      width: 50%;
      height: 2px;
      background: ${colors.accent};
    }

    .timeline-year {
      display: inline-block;
      background: ${colors.navy};
      color: ${colors.white};
      padding: 4px 12px;
      border-radius: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 10px;
      position: relative;
      z-index: 1;
    }

    .timeline-rate {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: ${colors.navy};
      margin-bottom: 6px;
    }

    .timeline-text {
      font-size: 11px;
      color: ${colors.textSecondary};
      line-height: 1.4;
    }

    /* ================================================
       VERIFICATION BOX
       ================================================ */
    .verification-box {
      border: 1px solid ${colors.border};
      border-radius: 10px;
      overflow: hidden;
      margin: 24px 0;
    }

    .verification-header {
      background: ${colors.navy};
      color: ${colors.white};
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .verification-header .title {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .verification-header .copy-hint {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 10px;
      opacity: 0.7;
    }

    .verification-body {
      padding: 20px;
      background: ${colors.bgLight};
    }

    .verification-body .instruction {
      font-size: 13px;
      color: ${colors.textSecondary};
      margin-bottom: 12px;
    }

    .verification-prompt {
      background: ${colors.white};
      border: 1px solid ${colors.border};
      border-radius: 6px;
      padding: 16px;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
      font-size: 12px;
      color: ${colors.textPrimary};
      line-height: 1.6;
    }

    /* ================================================
       DATA TABLE — Modern
       ================================================ */
    .data-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 20px 0;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid ${colors.border};
    }

    .data-table th,
    .data-table td {
      padding: 14px 18px;
      text-align: left;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    .data-table th {
      background: ${colors.navy};
      color: ${colors.white};
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    .data-table td {
      font-size: 14px;
      color: ${colors.textPrimary};
      border-bottom: 1px solid ${colors.borderLight};
    }

    .data-table tbody tr:nth-child(even) {
      background: ${colors.bgLight};
    }

    .data-table tbody tr:last-child td {
      border-bottom: none;
      font-weight: 700;
      background: ${colors.bgCard};
    }

    .data-table .text-right {
      text-align: right;
    }

    /* ================================================
       GUARANTEE CERTIFICATE
       ================================================ */
    .guarantee-certificate {
      border: 2px solid ${colors.navy};
      border-radius: 12px;
      background: linear-gradient(135deg, ${colors.bgLight} 0%, ${colors.white} 100%);
      padding: 40px;
      text-align: center;
      margin: 28px 0;
      position: relative;
    }

    .guarantee-certificate::before {
      content: '';
      position: absolute;
      top: 8px;
      left: 8px;
      right: 8px;
      bottom: 8px;
      border: 1px solid ${colors.border};
      border-radius: 8px;
      pointer-events: none;
    }

    .guarantee-shield {
      font-size: 48px;
      margin-bottom: 12px;
    }

    .guarantee-certificate .amount {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 56px;
      font-weight: 700;
      color: ${colors.navy};
      margin-bottom: 4px;
    }

    .guarantee-certificate .g-title {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 20px;
      font-weight: 600;
      color: ${colors.navy};
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .guarantee-certificate p {
      font-size: 14px;
      color: ${colors.textSecondary};
      max-width: 440px;
      margin: 0 auto;
      line-height: 1.65;
    }

    /* ================================================
       STEPS
       ================================================ */
    .steps-container {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      gap: 12px;
      margin: 32px 0;
    }

    .step {
      flex: 1;
      text-align: center;
      max-width: 170px;
    }

    .step-number {
      width: 48px;
      height: 48px;
      background: ${colors.navy};
      color: ${colors.white};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 20px;
      font-weight: 700;
      margin: 0 auto 14px auto;
    }

    .step h4 {
      font-size: 14px;
      font-weight: 600;
      color: ${colors.navy};
      margin-bottom: 6px;
    }

    .step p {
      font-size: 12px;
      color: ${colors.textSecondary};
      line-height: 1.5;
    }

    .step-arrow {
      display: flex;
      align-items: center;
      padding-top: 12px;
      color: ${colors.textMuted};
      font-size: 20px;
    }

    /* ================================================
       CTA BOX
       ================================================ */
    .cta-box {
      background: ${colors.navy};
      color: ${colors.white};
      border-radius: 12px;
      padding: 32px 36px;
      text-align: center;
      margin: 28px 0;
    }

    .cta-box h3 {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: ${colors.white};
      font-size: 22px;
      margin-bottom: 12px;
    }

    .cta-box p {
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
    }

    .cta-button {
      display: inline-block;
      background: ${colors.white};
      color: ${colors.navy};
      padding: 14px 36px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-weight: 700;
      font-size: 16px;
      text-decoration: none;
      margin-top: 16px;
    }

    /* ================================================
       COST HIGHLIGHT — Scenario 2
       ================================================ */
    .cost-highlight {
      background: linear-gradient(135deg, ${colors.navyDark} 0%, ${colors.navy} 100%);
      color: ${colors.white};
      border-radius: 12px;
      padding: 32px 40px;
      text-align: center;
      margin: 24px 0;
    }

    .cost-highlight .label {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      opacity: 0.7;
      margin-bottom: 8px;
    }

    .cost-highlight .value {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 48px;
      font-weight: 700;
    }

    .cost-highlight .subtitle {
      font-size: 13px;
      opacity: 0.7;
      margin-top: 8px;
    }

    /* ================================================
       SIGNATURE BLOCK
       ================================================ */
    .signature-block {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid ${colors.border};
    }

    .signature-block .name {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 17px;
      font-weight: 600;
      color: ${colors.navy};
    }

    .signature-block .title {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      color: ${colors.textMuted};
    }

    /* ================================================
       ADVISOR CARD — Inline
       ================================================ */
    .advisor-card-inline {
      background: ${colors.bgLight};
      border: 1px solid ${colors.border};
      border-radius: 8px;
      padding: 18px 24px;
      display: inline-block;
    }

    .advisor-card-inline .label {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 10px;
      color: ${colors.textMuted};
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 6px;
    }

    .advisor-card-inline .name {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      font-weight: 600;
      color: ${colors.navy};
      margin-bottom: 2px;
    }

    .advisor-card-inline .contact {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      color: ${colors.textSecondary};
    }

    /* ================================================
       UTILITY CLASSES
       ================================================ */
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .mt-2 { margin-top: 8px; }
    .mt-4 { margin-top: 16px; }
    .mt-6 { margin-top: 24px; }
    .mb-2 { margin-bottom: 8px; }
    .mb-4 { margin-bottom: 16px; }
    .mb-6 { margin-bottom: 24px; }
    .font-bold { font-weight: 700; }
    .avoid-break { page-break-inside: avoid; }
  `;
}

// ============================================================
// PAGE GENERATORS
// ============================================================

function pageHeader(clientName: string): string {
  return `
    <div class="page-header">
      <div class="logo">Inspired Mortgage</div>
      <div class="client">${clientName}</div>
    </div>
  `;
}

function pageFooter(pageNumber: number): string {
  return `
    <div class="page-footer">
      <div class="website">inspired.mortgage</div>
      <div class="page-number">Page ${pageNumber}</div>
    </div>
  `;
}

// ============================================================
// COVER PAGE — Premium, Minimal
// ============================================================
function generateCoverPage(
  clientName: string,
  date: string,
  consultant: { name: string; email: string; phone: string }
): string {
  const copy = REPORT_COPY.cover;

  return `
    <div class="page cover-page">
      <div class="cover-top">
        <div class="cover-logo">Inspired Mortgage</div>
        <div class="cover-tagline">${copy.tagline}</div>
      </div>
      <div class="cover-body">
        <div class="cover-label">${copy.preparedForLabel}</div>
        <div class="cover-client-name">${clientName}</div>
        <div class="cover-date">${date}</div>
        <div class="cover-divider"></div>
        <div class="cover-advisor-card">
          <div class="cover-advisor-label">${copy.advisorLabel}</div>
          <div class="cover-advisor-name">${consultant.name}</div>
          <div class="cover-advisor-detail">${consultant.email}</div>
          ${consultant.phone ? `<div class="cover-advisor-detail">${consultant.phone}</div>` : ""}
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// WHAT YOU TOLD US — Reading encouragement moved here from cover
// ============================================================
function generateWhatYouToldUsPage(
  clientName: string,
  bullets: string[],
  pageNumber: number,
  vars: Record<string, string> = {}
): string {
  const copy = REPORT_COPY.whatYouToldUs;
  const coverCopy = REPORT_COPY.cover;
  const introText = replaceVariables(copy.intro, vars);
  const outroText = replaceVariables(copy.outro, vars);

  const bulletItems = bullets
    .map(
      (bullet) => `
      <li>
        <span class="bullet"></span>
        <span>${bullet}</span>
      </li>`
    )
    .join("");

  const introParagraphs = introText.split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const outroParagraphs = outroText.split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  // Reading encouragement moved from cover page
  const readingEncParagraphs = coverCopy.readingEncouragement.split('\n\n').filter(p => p.trim()).map(p =>
    `<p style="font-size: 13px; color: ${colors.textSecondary}; line-height: 1.6; margin-bottom: 6px;">${p}</p>`
  ).join('');

  return `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div style="background: ${colors.bgWarm}; border-left: 4px solid ${colors.gold}; border-radius: 0 8px 8px 0; padding: 16px 24px; margin-bottom: 28px;">
            <p style="font-size: 13px; color: ${colors.textSecondary}; margin-bottom: 6px; font-style: italic;">${coverCopy.readingTime}</p>
            ${readingEncParagraphs}
            <p style="font-size: 13px; color: ${colors.navy}; font-weight: 600; margin-top: 8px; font-style: italic;">${coverCopy.closingLine}</p>
          </div>

          <div class="section-header">
            
            <h2>${copy.heading}</h2>
          </div>

          ${introParagraphs}

          <ul class="bullet-list" style="background: ${colors.bgLight}; border: 1px solid ${colors.border}; padding: 20px 24px 8px 24px; border-radius: 10px; margin: 20px 0;">
            ${bulletItems}
          </ul>

          ${outroParagraphs}
        </div>
        ${pageFooter(pageNumber)}
      </div>
    </div>
  `;
}

// ============================================================
// SCENARIO 1 — Sub-2% Fixed → Renewal Trap
// ============================================================
function generateScenario1Pages(
  clientName: string,
  data: ReportHTMLProps["extractedData"],
  vars: Record<string, string> = {}
): string[] {
  const copy = REPORT_COPY.scenarios.scenario1;
  const oldPayment = formatCurrency(data.oldPayment || 2045);
  const newPayment = formatCurrency(data.newPayment || 2689);
  const paymentDiff = formatCurrency(data.paymentDifference || 644);

  const introParagraphs = replaceVariables(copy.intro, vars).split(/\n\n+/).filter(p => p.trim()).map((p, i) =>
    i === 0 ? `<p style="margin-bottom: 14px;">${p}</p>` : `<p style="margin-bottom: 14px;"><strong>${p}</strong></p>`
  ).join("");

  const amortParagraphs = replaceVariables(copy.amortizationContext, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const bankParagraphs = replaceVariables(copy.bankSolution, vars).split(/\n\n+/).filter(p => p.trim()).map((p, i) =>
    i === 1 ? `<p style="margin-top: 14px;"><strong>${p}</strong></p>` : `<p style="margin-top: 14px;">${p}</p>`
  ).join("");

  // PAGE 1: The Problem
  const page1 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            
            <h2>${copy.heading}</h2>
          </div>

          ${introParagraphs}
          ${amortParagraphs}

          <div class="metrics-row">
            <div class="metric-card neutral">
              <div class="metric-label">Your Old Payment</div>
              <div class="metric-value">${oldPayment}</div>
              <div class="metric-subtitle">per month</div>
            </div>
            <div class="comparison-arrow">→</div>
            <div class="metric-card highlight">
              <div class="metric-label">Your New Payment</div>
              <div class="metric-value accent">${newPayment}</div>
              <div class="metric-subtitle">per month</div>
            </div>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <div style="display: inline-block; background: linear-gradient(135deg, ${colors.navyDark}, ${colors.navy}); color: ${colors.white}; border-radius: 10px; padding: 18px 40px; text-align: center;">
              <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.7; margin-bottom: 4px;">Monthly Increase</div>
              <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 32px; font-weight: 700;">+${paymentDiff}</div>
            </div>
          </div>

          ${bankParagraphs}
        </div>
        ${pageFooter(3)}
      </div>
    </div>
  `;

  // PAGE 2: Impact + Active Management
  const impactParagraphs = replaceVariables(copy.impactDetail, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-top: 14px;">${p}</p>`
  ).join("");

  const transitionParagraphs = replaceVariables(copy.transitionToSolution, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-top: 14px;">${p}</p>`
  ).join("");

  const summaryParagraphs = replaceVariables(copy.activeManagement.summary, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-top: 14px;">${p}</p>`
  ).join("");

  const empathyParagraphs = replaceVariables(copy.activeManagement.empathy, vars).split(/\n\n+/).filter(p => p.trim()).map((p, i, arr) =>
    i === arr.length - 1 ? `<p style="margin-top: 14px;"><strong>${p}</strong></p>` : `<p style="margin-top: 14px;">${p}</p>`
  ).join("");

  const timelineItems = copy.activeManagement.timeline.map(item => `
    <div class="timeline-item">
      <div class="timeline-year">${item.year.split(' (')[0]}</div>
      <div class="timeline-rate">${item.year.includes('(') ? item.year.match(/\(([^)]+)\)/)?.[1] || '' : ''}</div>
      <div class="timeline-text">${item.action.replace(/"/g, '&quot;')}</div>
    </div>`).join("");

  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="impact-banner" style="margin-top: 0;">
            <h2>${copy.impactHeading.replace('. ', '.<br>')}</h2>
          </div>

          ${impactParagraphs}
          ${transitionParagraphs}

          <div class="section-header mt-6">
            <h2>${copy.activeManagement.heading}</h2>
          </div>

          <p style="margin-bottom: 14px;">${replaceVariables(copy.activeManagement.intro, vars)}</p>

          <div class="timeline">
            <h3>What Active Management Looks Like</h3>
            <div class="timeline-items">
              ${timelineItems}
            </div>
          </div>

          ${summaryParagraphs}
          ${empathyParagraphs}
        </div>
        ${pageFooter(4)}
      </div>
    </div>
  `;

  // PAGE 3: What We Look For + Outcome + Verification
  const whatWeLookForItems = copy.whatWeLookFor.items.map(item =>
    `<p style="margin-bottom: 10px;"><strong>${item.title}:</strong> ${replaceVariables(item.body, vars).split(/\n\n/)[0]}</p>`
  ).join("");

  const outcomeParagraphs = replaceVariables(copy.outcome.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const page3 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>${copy.whatWeLookFor.heading}</h2>
          </div>

          <p style="margin-bottom: 14px;">${replaceVariables(copy.whatWeLookFor.intro, vars)}</p>

          ${whatWeLookForItems}

          <div class="pullquote">
            <p>${replaceVariables(copy.whatWeLookFor.closing, vars)}</p>
          </div>

          <div class="section-header mt-6">
            <h2>${copy.outcome.heading}</h2>
          </div>

          ${outcomeParagraphs}

          <div class="verification-box">
            <div class="verification-header">
              <span class="title">${copy.verificationBox.heading}</span>
              <span class="copy-hint">Copy prompt below</span>
            </div>
            <div class="verification-body">
              <p class="instruction">${copy.verificationBox.instruction}</p>
              <div class="verification-prompt">${replaceVariables(copy.verificationBox.prompt, vars)}</div>
            </div>
          </div>
        </div>
        ${pageFooter(5)}
      </div>
    </div>
  `;

  return [page1, page2, page3];
}

// ============================================================
// SCENARIO 2 — Variable → Panic Lock
// ============================================================
function generateScenario2Pages(
  clientName: string,
  data: ReportHTMLProps["extractedData"],
  vars: Record<string, string> = {}
): string[] {
  const copy = REPORT_COPY.scenarios.scenario2;
  const extraInterest = formatCurrency(data.estimatedExtraInterest || 38675);

  const introParagraphs = replaceVariables(copy.intro, vars).split(/\n\n+/).filter(p => p.trim()).map((p, i, arr) =>
    i === arr.length - 1 ? `<p style="margin-bottom: 14px;"><strong>${p}</strong></p>` : `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const costParagraphs = replaceVariables(copy.costExplanation, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-top: 14px;">${p}</p>`
  ).join("");

  const page1 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            
            <h2>${copy.heading}</h2>
          </div>

          ${introParagraphs}

          <div class="cost-highlight">
            <div class="label">${copy.costHighlight.label}</div>
            <div class="value">${extraInterest}</div>
            <div class="subtitle">${copy.costHighlight.subtext}</div>
          </div>

          ${costParagraphs}
        </div>
        ${pageFooter(3)}
      </div>
    </div>
  `;

  const empathyParagraphs = replaceVariables(copy.empathy, vars).split(/\n\n+/).filter(p => p.trim()).map((p, i) =>
    i === 0 ? `<p style="margin-bottom: 14px;"><strong>${p}</strong></p>` : `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const futureParagraphs = replaceVariables(copy.futureRisk.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          ${empathyParagraphs}

          <div class="section-header mt-6">
            <h2>${copy.futureRisk.heading}</h2>
          </div>

          ${futureParagraphs}

          <div class="verification-box">
            <div class="verification-header">
              <span class="title">${copy.verificationBox.heading}</span>
              <span class="copy-hint">Copy prompt below</span>
            </div>
            <div class="verification-body">
              <p class="instruction">${copy.verificationBox.instruction}</p>
              <div class="verification-prompt">${copy.verificationBox.prompt}</div>
            </div>
          </div>
        </div>
        ${pageFooter(4)}
      </div>
    </div>
  `;

  return [page1, page2];
}

// ============================================================
// SCENARIO 3 — Fixed Payment Variable → Negative Amortization
// ============================================================
function generateScenario3Pages(
  clientName: string,
  data: ReportHTMLProps["extractedData"],
  vars: Record<string, string> = {}
): string[] {
  const copy = REPORT_COPY.scenarios.scenario3;
  const originalAm = data.originalAmortization || 25;
  const currentAm = data.currentAmortization || 26;

  const introParagraphs = replaceVariables(copy.intro, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const explanationParagraphs = replaceVariables(copy.explanation.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const page1 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            
            <h2>${copy.heading}</h2>
          </div>

          ${introParagraphs}

          <h3 class="mt-6">${copy.explanation.heading}</h3>

          ${explanationParagraphs}

          <div class="impact-banner">
            <h2>You made every payment.<br>You now owe more than before.</h2>
          </div>

          <div class="metrics-row">
            <div class="metric-card neutral">
              <div class="metric-label">Original Amortization</div>
              <div class="metric-value">${originalAm}</div>
              <div class="metric-subtitle">years</div>
            </div>
            <div class="comparison-arrow">→</div>
            <div class="metric-card gold">
              <div class="metric-label">Current Amortization</div>
              <div class="metric-value negative">${currentAm}</div>
              <div class="metric-subtitle">years — going backwards</div>
            </div>
          </div>
        </div>
        ${pageFooter(3)}
      </div>
    </div>
  `;

  const empathyParagraphs = replaceVariables(copy.empathy.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const futureParagraphs = replaceVariables(copy.futureRisk.body, vars).split(/\n\n+/).filter(p => p.trim()).map((p, i, arr) =>
    i === arr.length - 1 ? `<p style="margin-bottom: 14px;"><strong>${p}</strong></p>` : `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>${copy.empathy.heading}</h2>
          </div>

          ${empathyParagraphs}

          <div class="section-header mt-6">
            <h2>${copy.futureRisk.heading}</h2>
          </div>

          ${futureParagraphs}

          <div class="verification-box">
            <div class="verification-header">
              <span class="title">${copy.verificationBox.heading}</span>
              <span class="copy-hint">Copy prompt below</span>
            </div>
            <div class="verification-body">
              <p class="instruction">${copy.verificationBox.instruction}</p>
              <div class="verification-prompt">${copy.verificationBox.prompt}</div>
            </div>
          </div>
        </div>
        ${pageFooter(4)}
      </div>
    </div>
  `;

  return [page1, page2];
}

// ============================================================
// DEBT CONSOLIDATION
// ============================================================
function generateDebtConsolidationPage(
  clientName: string,
  mortgageAmount: number,
  otherDebts: Array<{ type: string; balance: number; payment: number }>,
  pageNumber: number
): string {
  const copy = REPORT_COPY.debtConsolidation;
  const totalPayments = otherDebts.reduce((sum, d) => sum + d.payment, 0);

  const exampleDebtRows = copy.example.debts.map((d, i) => `
    <tr${i % 2 === 1 ? ` style="background: ${colors.bgLight};"` : ''}>
      <td>${d.type}</td>
      <td class="text-right">${formatCurrency(d.balance)}</td>
      <td class="text-right">${formatCurrency(d.payment)}/mo</td>
    </tr>
  `).join("");

  return `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            
            <h2>${copy.heading}</h2>
          </div>

          ${copy.intro.split('\n\n').map(p => `<p style="margin-bottom: 14px;">${p}</p>`).join('')}

          <h3 class="mt-6" style="margin-bottom: 10px;">${copy.example.heading}</h3>
          <p style="margin-bottom: 14px;">${copy.example.setup}</p>

          <table class="data-table">
            <thead>
              <tr>
                <th>Debt</th>
                <th class="text-right">Balance</th>
                <th class="text-right">Payment</th>
              </tr>
            </thead>
            <tbody>
              ${exampleDebtRows}
            </tbody>
          </table>

          <p style="margin-bottom: 10px;">${copy.example.totalOutflow}</p>
          <p style="margin-bottom: 14px;">${copy.example.bankPath}</p>

          <h3 class="mt-6" style="margin-bottom: 10px;">${copy.solution.heading}</h3>
          <p style="margin-bottom: 14px;">${copy.solution.body}</p>

          <div style="background: ${colors.goldLight}; border: 2px solid ${colors.goldBorder}; border-radius: 10px; padding: 20px 28px; text-align: center; margin: 20px 0;">
            <p style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 18px; font-weight: 700; color: ${colors.gold};">${copy.solution.impactLine}</p>
          </div>

          <p style="margin-bottom: 14px; font-style: italic;">${copy.solution.clientReaction}</p>

          <h3 class="mt-6" style="margin-bottom: 10px;">${copy.noteOnIncreasingMortgage.heading}</h3>
          ${copy.noteOnIncreasingMortgage.body.split('\n\n').map(p => `<p style="margin-bottom: 10px;">${p}</p>`).join('')}

          <h3 class="mt-6" style="margin-bottom: 10px;">${copy.relevance.heading}</h3>
          ${copy.relevance.body.split('\n\n').map(p => `<p style="margin-bottom: 10px;">${p}</p>`).join('')}
        </div>
        ${pageFooter(pageNumber)}
      </div>
    </div>
  `;
}

// ============================================================
// APPLICATION LINK / CTA PAGE
// ============================================================
function generateApplicationLinkPage(
  clientName: string,
  applicationLink: string,
  message: string,
  pageNumber: number,
  variant: "afterScenario" | "afterGuarantee" = "afterScenario"
): string {
  const ctaCopy = REPORT_COPY.ctaPages[variant];

  const benefitsList = ctaCopy.benefits.map(b => `
    <li style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 14px; color: ${colors.textPrimary}; line-height: 1.6;">
      <span style="color: ${colors.success}; font-weight: 700; font-size: 16px; flex-shrink: 0; margin-top: 1px;">✓</span>
      <span>${b}</span>
    </li>
  `).join("");

  const guaranteeCopy = REPORT_COPY.ctaPages.afterGuarantee;
  const testimonialHtml = variant === "afterGuarantee" ? `
    <div style="background: ${colors.bgWarm}; border-left: 4px solid ${colors.gold}; border-radius: 0 8px 8px 0; padding: 20px 24px; margin: 24px 0; text-align: left;">
      <p style="font-size: 15px; font-style: italic; color: ${colors.textPrimary}; line-height: 1.65; margin-bottom: 8px;">${guaranteeCopy.testimonial.quote}</p>
      <p style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; color: ${colors.textMuted}; font-weight: 600;">${guaranteeCopy.testimonial.attribution}</p>
    </div>
  ` : "";

  return `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            
            <h2>${ctaCopy.heading}</h2>
          </div>

          <p style="font-size: 15px; color: ${colors.textSecondary}; line-height: 1.75; margin-bottom: 28px;">${ctaCopy.message}</p>

          <h3 style="font-size: 17px; font-weight: 600; color: ${colors.navy}; margin-bottom: 16px;">${ctaCopy.subheading}</h3>

          <ul style="list-style: none; padding: 0; margin-bottom: 28px;">
            ${benefitsList}
          </ul>

          <div class="cta-box">
            <h3>Ready to See What's Possible?</h3>
            <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin-bottom: 8px;">10-15 minutes · No credit impact · No obligation</p>
            <a href="${applicationLink}" class="cta-button">Start Your Application →</a>
          </div>

          ${testimonialHtml}

          <div class="callout-box" style="margin-top: 20px;">
            <h4>${ctaCopy.reassurance.heading}</h4>
            <p>${ctaCopy.reassurance.body}</p>
          </div>

          ${variant === "afterScenario" ? `
          <div class="callout-box warm" style="margin-top: 16px;">
            <h4>${(ctaCopy as typeof REPORT_COPY.ctaPages.afterScenario).urgency.heading}</h4>
            <p>${(ctaCopy as typeof REPORT_COPY.ctaPages.afterScenario).urgency.body}</p>
          </div>
          ` : ""}
        </div>
        ${pageFooter(pageNumber)}
      </div>
    </div>
  `;
}

// ============================================================
// OUR APPROACH
// ============================================================
function generateOurApproachPage(
  clientName: string,
  consultant: { name: string; email: string; phone: string },
  pageNumber: number,
  vars: Record<string, string> = {}
): string {
  const copy = REPORT_COPY.ourApproach;
  const introText = replaceVariables(copy.intro, vars);
  const introParagraphs = introText.split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const differentiatorItems = copy.differentiators.items.map(item => `
    <li>
      <span class="bullet"></span>
      <span><strong>${item.title}</strong> ${item.body}</span>
    </li>
  `).join("");

  return `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            
            <h2>${copy.heading}</h2>
          </div>

          ${introParagraphs}

          <h3 style="margin-bottom: 10px;">${copy.differentiators.heading}</h3>
          <ul class="bullet-list">
            ${differentiatorItems}
          </ul>

          <p style="margin-top: 16px; margin-bottom: 24px;">${copy.closing}</p>

          <div class="callout-box accent" style="border: 2px solid ${colors.accent}; margin-bottom: 24px;">
            <h4>${copy.promise.heading}</h4>
            <p>${copy.promise.body}</p>
          </div>

          <div class="signature-block">
            <div class="name">${consultant.name}</div>
            <div class="title">${consultant.name.toLowerCase().includes("greg") ? "Founder" : "Mortgage Advisor"}, Inspired Mortgage</div>
          </div>
        </div>
        ${pageFooter(pageNumber)}
      </div>
    </div>
  `;
}

// ============================================================
// $5,000 PENALTY GUARANTEE — Premium Certificate
// ============================================================
function generateGuaranteePage(
  clientName: string,
  pageNumber: number
): string {
  const copy = REPORT_COPY.guarantee;

  const exampleItems = copy.howItWorks.examples.map(example => `
    <li>
      <span class="bullet"></span>
      <span>${example}</span>
    </li>
  `).join("");

  return `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>Our Promise to You</h2>
          </div>

          <div class="guarantee-certificate">
            <div class="guarantee-shield">✦</div>
            <div class="amount">${copy.certificate.amount}</div>
            <div class="g-title">${copy.certificate.title}</div>
            <p>${copy.certificate.body}</p>
            <p style="font-weight: 700; margin-top: 12px; color: ${colors.navy};">${copy.certificate.subtext}</p>
          </div>

          <h3 style="margin-bottom: 10px;">${copy.howItWorks.heading}</h3>
          <ul class="bullet-list" style="margin-bottom: 20px;">
            ${exampleItems}
          </ul>

          <p style="margin-bottom: 20px;">${copy.howItWorks.explanation}</p>

          <div style="background: ${colors.navy}; border-radius: 10px; padding: 24px 28px; margin-top: 16px;">
            <h4 style="color: ${colors.white}; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 15px; margin-bottom: 10px;">${copy.askYourBank.heading}</h4>
            <p style="font-style: italic; color: rgba(255,255,255,0.85); font-size: 14px; line-height: 1.6;">${copy.askYourBank.prompt}</p>
            <p style="font-weight: 700; margin-top: 12px; color: ${colors.goldBorder}; font-size: 14px;">${copy.askYourBank.punchline}</p>
          </div>
        </div>
        ${pageFooter(pageNumber)}
      </div>
    </div>
  `;
}

// ============================================================
// FIXED RATE STRATEGY
// ============================================================
function generateFixedRateStrategyPages(
  clientName: string,
  startPageNumber: number
): string[] {
  const copy = REPORT_COPY.fixedRate;

  const whenItems = copy.whenItMakesSense.items.map(item => `
    <li><span class="bullet"></span><span>${item}</span></li>
  `).join("");

  const relockSteps = copy.strategicRelock.steps.map(step => `
    <li><span class="bullet"></span><span>${step}</span></li>
  `).join("");

  const borrowerASteps = copy.borrowerComparison.borrowerA.steps.map(step => `
    <li><span class="bullet"></span><span>${step}</span></li>
  `).join("");

  const borrowerBSteps = copy.borrowerComparison.borrowerB.steps.map(step => `
    <li><span class="bullet"></span><span>${step}</span></li>
  `).join("");

  const whatWeDoParagraphs = copy.whatWeDoDifferently.body.split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const monitoringParagraphs = copy.monthlyMonitoring.body.split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const resultParagraphs = copy.borrowerComparison.result.body.split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const askYourBankParagraphs = copy.askYourBank.split(/\n\n+/).filter(p => p.trim());

  // Page 1
  const page1 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            
            <h2>${copy.heading}</h2>
          </div>

          <p style="margin-bottom: 14px;">${copy.intro}</p>

          <h3 style="margin-bottom: 10px;">${copy.whenItMakesSense.heading}</h3>
          <ul class="bullet-list mb-6">${whenItems}</ul>

          <h3 style="margin-bottom: 10px;">${copy.whatWeDoDifferently.heading}</h3>
          ${whatWeDoParagraphs}

          <h3 style="margin-bottom: 10px;">${copy.monthlyMonitoring.heading}</h3>
          ${monitoringParagraphs}
        </div>
        ${pageFooter(startPageNumber)}
      </div>
    </div>
  `;

  // Page 2
  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <h3 style="margin-bottom: 10px;">${copy.strategicRelock.heading}</h3>
          <p style="margin-bottom: 14px;">${copy.strategicRelock.body}</p>
          <ul class="bullet-list" style="margin-bottom: 14px;">${relockSteps}</ul>
          <p style="margin-bottom: 14px;">${copy.strategicRelock.closing}</p>

          <h3 style="margin-top: 24px; margin-bottom: 10px;">${copy.borrowerComparison.heading}</h3>
          <p style="margin-bottom: 14px;">${copy.borrowerComparison.intro}</p>

          <div style="display: flex; gap: 16px; margin: 20px 0; align-items: flex-start;">
            <div style="flex: 1; background: ${colors.bgCard}; border: 1px solid ${colors.border}; border-radius: 10px; padding: 20px;">
              <h4 style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${colors.textMuted}; margin-bottom: 12px;">${copy.borrowerComparison.borrowerA.label}</h4>
              <ul class="bullet-list" style="margin: 0;">${borrowerASteps}</ul>
            </div>
            <div style="flex: 1; background: ${colors.successLight}; border: 2px solid ${colors.success}; border-radius: 10px; padding: 20px;">
              <h4 style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${colors.success}; margin-bottom: 12px;">${copy.borrowerComparison.borrowerB.label}</h4>
              <ul class="bullet-list" style="margin: 0;">${borrowerBSteps}</ul>
            </div>
          </div>
        </div>
        ${pageFooter(startPageNumber + 1)}
      </div>
    </div>
  `;

  // Page 3
  const page3 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content" style="display: flex; flex-direction: column; justify-content: center;">
          <div class="impact-banner" style="margin-top: 0;">
            <h2>${copy.borrowerComparison.result.heading}</h2>
          </div>

          ${resultParagraphs}

          <h3 style="margin-top: 32px; margin-bottom: 14px;">Ask Your Bank</h3>
          <div style="background: ${colors.navy}; border-radius: 10px; padding: 28px 32px;">
            <p style="font-style: italic; color: rgba(255,255,255,0.85); font-size: 15px; line-height: 1.7;">${askYourBankParagraphs[0] || ""}</p>
            ${askYourBankParagraphs.length > 1 ? `<p style="font-weight: 700; margin-top: 14px; color: ${colors.goldBorder}; font-size: 15px;">${askYourBankParagraphs[1]}</p>` : ""}
          </div>
        </div>
        ${pageFooter(startPageNumber + 2)}
      </div>
    </div>
  `;

  return [page1, page2, page3];
}

// ============================================================
// VARIABLE RATE STRATEGY
// ============================================================
function generateVariableRateStrategyPages(
  clientName: string,
  startPageNumber: number,
  vars: Record<string, string> = {}
): string[] {
  const copy = REPORT_COPY.variableRate;

  const whenItems = copy.whenItMakesSense.items.map(item => `
    <li><span class="bullet"></span><span>${item}</span></li>
  `).join("");

  const introParagraphs = replaceVariables(copy.intro, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const howItPlaysOutParagraphs = replaceVariables(copy.howItPlaysOut.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const dangerParagraphs = replaceVariables(copy.dangerOfGoingItAlone.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  // Page 1
  const page1 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            
            <h2>${copy.heading}</h2>
          </div>

          ${introParagraphs}

          <h3 style="margin-bottom: 10px;">${copy.whenItMakesSense.heading}</h3>
          <ul class="bullet-list mb-6">${whenItems}</ul>

          <h3 style="margin-bottom: 10px;">${copy.whatWeDoDifferently.heading}</h3>
          <p style="margin-bottom: 14px;">${replaceVariables(copy.whatWeDoDifferently.body, vars)}</p>

          <h3 style="margin-bottom: 10px;">${copy.strategy.heading}</h3>
          <p style="margin-bottom: 14px;">${replaceVariables(copy.strategy.body, vars)}</p>
        </div>
        ${pageFooter(startPageNumber)}
      </div>
    </div>
  `;

  // Page 2
  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <h3 style="margin-bottom: 10px;">${copy.howItPlaysOut.heading}</h3>
          ${howItPlaysOutParagraphs}

          <h3 style="margin-top: 24px; margin-bottom: 10px;">${copy.dangerOfGoingItAlone.heading}</h3>
          ${dangerParagraphs}
        </div>
        ${pageFooter(startPageNumber + 1)}
      </div>
    </div>
  `;

  return [page1, page2];
}

// ============================================================
// CASH BACK STRATEGY
// ============================================================
function generateCashBackStrategyPages(
  clientName: string,
  startPageNumber: number,
  vars: Record<string, string> = {}
): string[] {
  const copy = REPORT_COPY.cashBack;

  const whenItems = copy.whenItMakesSense.items.map(item => `
    <li><span class="bullet"></span><span>${item}</span></li>
  `).join("");

  const whatWeDoParagraphs = replaceVariables(copy.whatWeDoDifferently.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const storyParagraphs = replaceVariables(copy.trueStory.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const mathLines = copy.trueStory.math.lines.map(line => `
    <li><span class="bullet"></span><span>${line}</span></li>
  `).join("");

  const outcomeParagraphs = replaceVariables(copy.trueStory.outcome, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  const howItCouldWorkParagraphs = replaceVariables(copy.howItCouldWork.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="margin-bottom: 14px;">${p}</p>`
  ).join("");

  // Page 1
  const page1 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            
            <h2>${copy.heading}</h2>
          </div>

          <p style="margin-bottom: 14px;">${replaceVariables(copy.intro, vars)}</p>

          <h3 style="margin-bottom: 10px;">${copy.whenItMakesSense.heading}</h3>
          <ul class="bullet-list mb-6">${whenItems}</ul>

          <h3 style="margin-bottom: 10px;">${copy.whatWeDoDifferently.heading}</h3>
          ${whatWeDoParagraphs}

          <h3 style="margin-bottom: 10px;">${copy.trueStory.heading}</h3>
          ${storyParagraphs}
        </div>
        ${pageFooter(startPageNumber)}
      </div>
    </div>
  `;

  // Page 2
  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <h3 style="margin-bottom: 10px;">${copy.trueStory.math.heading}</h3>
          <ul class="bullet-list" style="margin-bottom: 16px;">${mathLines}</ul>

          ${outcomeParagraphs}

          <div class="verification-box">
            <div class="verification-header">
              <span class="title">${copy.verificationBox.heading}</span>
              <span class="copy-hint">Copy prompt below</span>
            </div>
            <div class="verification-body">
              <p class="instruction">${copy.verificationBox.instruction}</p>
              <div class="verification-prompt">${copy.verificationBox.prompt}</div>
            </div>
          </div>

          <h3 style="margin-top: 24px; margin-bottom: 10px;">${copy.howItCouldWork.heading}</h3>
          ${howItCouldWorkParagraphs}
        </div>
        ${pageFooter(startPageNumber + 1)}
      </div>
    </div>
  `;

  return [page1, page2];
}

// ============================================================
// WHAT HAPPENS NEXT — Final CTA Page
// ============================================================
function generateWhatHappensNextPage(
  clientName: string,
  consultant: { name: string; email: string; phone: string; calLink: string },
  applicationLink: string,
  pageNumber: number
): string {
  const copy = REPORT_COPY.whatHappensNext;

  const stepsHtml = copy.steps.map((step, i) => `
    <div class="step">
      <div class="step-number">${step.number}</div>
      <h4>${step.title}</h4>
      <p>${step.description}</p>
    </div>
    ${i < copy.steps.length - 1 ? '<div class="step-arrow">→</div>' : ""}
  `).join("");

  return `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content" style="display: flex; flex-direction: column; justify-content: center;">
          <div class="section-header">
            
            <h2>${copy.heading}</h2>
          </div>

          <div class="steps-container">
            ${stepsHtml}
          </div>

          <div class="cta-box" style="margin-top: 32px;">
            <h3>${copy.ctaBox.heading}</h3>
            <a href="${applicationLink}" class="cta-button">Start Your Application →</a>
          </div>

          <div style="margin-top: 32px;">
            <h3 style="margin-bottom: 14px;">${copy.advisorBlock.label}</h3>
            <div class="advisor-card-inline">
              <div class="label">Contact</div>
              <div class="name">${consultant.name}</div>
              <div class="contact">${consultant.email}</div>
              ${consultant.phone ? `<div class="contact">${consultant.phone}</div>` : ""}
            </div>
          </div>
        </div>
        ${pageFooter(pageNumber)}
      </div>
    </div>
  `;
}

// Export helpers
export { formatCurrency, formatPercent, colors };
