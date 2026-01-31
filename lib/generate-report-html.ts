/**
 * HTML Template Generator for Post-Discovery Reports
 * Premium design using HTML/CSS for Puppeteer PDF generation
 */

import { REPORT_COPY, getAdvisorTitle } from "@/lib/report-copy";
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
  applicationLink: string; // The actual application URL to include in the report
  extractedData: {
    mortgageAmount?: number;
    originalAmortization?: number;
    currentAmortization?: number;
    // Scenario 1
    previousRate?: number;
    currentMarketRate?: number;
    oldPayment?: number;
    newPayment?: number;
    paymentDifference?: number;
    fiveYearsOfPayments?: number;
    // Scenario 2
    originalRate?: number;
    lockInRate?: number;
    estimatedExtraInterest?: number;
    // Scenario 3
    fixedPayment?: number;
    // Debt consolidation
    otherDebts?: Array<{ type: string; balance: number; payment: number }>;
  };
}

// Design System Colors
const colors = {
  brandPurple: "#625FFF",
  brandPurpleDark: "#4F4ACC",
  brandPurpleLight: "#E8E7FF",
  navy: "#1e3a5f",
  charcoal: "#1a1a1a",
  slate: "#374151",
  lightGray: "#f8fafc",
  cream: "#FBF3E7",
  gold: "#D4AF37",
  goldLight: "#FEF3C7",
  white: "#ffffff",
  border: "#e5e7eb",
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

  // Build variable map for template replacement
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

  // Build pages array — APPROVED PAGE ORDER
  const pages: string[] = [];

  // 1. Cover Page
  pages.push(generateCoverPage(clientName, date, consultant));

  // 2. What You Told Us
  pages.push(generateWhatYouToldUsPage(clientName, bullets, pages.length + 1, vars));

  // 3. Scenario (if selected, skip if "None"/0/null)
  if (activeScenario === 1) {
    pages.push(...generateScenario1Pages(clientName, extractedData));
  } else if (activeScenario === 2) {
    pages.push(...generateScenario2Pages(clientName, extractedData));
  } else if (activeScenario === 3) {
    pages.push(...generateScenario3Pages(clientName, extractedData));
  }

  // APP LINK #1: After scenario (or after What You Told Us if no scenario)
  pages.push(generateApplicationLinkPage(
    clientName,
    applicationLink,
    "Ready to see which strategies fit your situation? Complete your application and we'll build your personalized Lender Comparison Report—including real numbers from 30+ lenders competing for your business.",
    pages.length + 1
  ));

  // 4. Debt Consolidation (if checkbox selected)
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

  // APP LINK #2: After $5,000 Guarantee
  pages.push(generateApplicationLinkPage(
    clientName,
    applicationLink,
    "See what this looks like for your mortgage. Complete your application to unlock your Lender Comparison Report—including which lenders offer fair penalties and how the $5,000 Guarantee applies to your specific situation.",
    pages.length + 1
  ));

  // 7. Strategy: Fixed Rate Mortgage
  pages.push(...generateFixedRateStrategyPages(clientName, pages.length + 1));

  // 8. Strategy: Variable Rate Mortgage
  pages.push(...generateVariableRateStrategyPages(clientName, pages.length + 1, vars));

  // 9. Strategy: Cash Back Mortgage (if checkbox selected)
  if (includeCashBack) {
    pages.push(...generateCashBackStrategyPages(clientName, pages.length + 1, vars));
  }

  // 10. What Happens Next (CTA) — APP LINK #3
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

/**
 * Base CSS styles
 */
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: ${colors.charcoal};
      background: ${colors.white};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

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
      padding: 32px 56px 48px 56px;
    }

    /* Typography */
    h1 {
      font-size: 42px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }

    h2 {
      font-size: 28px;
      font-weight: 700;
      line-height: 1.3;
      letter-spacing: -0.01em;
      color: ${colors.charcoal};
    }

    h3 {
      font-size: 20px;
      font-weight: 600;
      line-height: 1.4;
    }

    p {
      font-size: 16px;
      line-height: 1.7;
      color: ${colors.slate};
    }

    /* ================================================
       COVER PAGE STYLES
       ================================================ */
    .cover-page {
      display: flex;
      flex-direction: column;
      height: 11in;
      position: relative;
    }

    .cover-header {
      background: ${colors.brandPurple};
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cover-header .logo-text {
      color: ${colors.white};
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
    }

    .cover-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 48px 56px 100px 56px;
    }

    .cover-tagline {
      text-align: center;
      margin-top: 40px;
      margin-bottom: 32px;
    }

    .cover-tagline h1 {
      font-size: 38px;
      font-weight: 300;
      color: ${colors.navy};
      line-height: 1.3;
      letter-spacing: -0.5px;
    }

    .cover-divider {
      width: 60px;
      height: 2px;
      background: ${colors.brandPurple};
      margin: 0 auto 32px auto;
    }

    .cover-client-info {
      text-align: center;
      margin-bottom: 40px;
    }

    .cover-client-info .prepared-for {
      font-size: 13px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }

    .cover-client-info .client-name {
      font-size: 32px;
      font-weight: 600;
      color: ${colors.charcoal};
      margin-bottom: 4px;
    }

    .cover-client-info .date {
      font-size: 14px;
      color: #9ca3af;
    }

    .cover-callout {
      background: ${colors.brandPurpleLight};
      border-radius: 12px;
      padding: 28px 32px;
      max-width: 520px;
      margin: 0 auto;
    }

    .cover-callout .callout-text {
      font-size: 16px;
      color: ${colors.charcoal};
      margin-bottom: 20px;
      line-height: 1.6;
    }

    .cover-callout .callout-list {
      list-style: none;
    }

    .cover-callout .callout-list li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 15px;
      color: ${colors.charcoal};
      line-height: 1.5;
    }

    .cover-callout .callout-list li:last-child {
      margin-bottom: 0;
    }

    .cover-callout .checkmark {
      color: ${colors.brandPurple};
      font-weight: 700;
      font-size: 16px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .cover-advisor {
      margin-top: auto;
    }

    .advisor-card {
      background: ${colors.lightGray};
      border-radius: 8px;
      padding: 18px 22px;
      display: inline-block;
    }

    .advisor-card .label {
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 6px;
    }

    .advisor-card .name {
      font-size: 17px;
      font-weight: 600;
      color: ${colors.charcoal};
      margin-bottom: 2px;
    }

    .advisor-card .contact {
      font-size: 14px;
      color: ${colors.brandPurple};
    }

    .cover-footer-note {
      position: absolute;
      bottom: 40px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 13px;
      color: #9ca3af;
      font-style: italic;
    }

    /* ================================================
       PAGE HEADER & FOOTER
       ================================================ */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 56px;
      border-bottom: 1px solid ${colors.border};
      flex-shrink: 0;
    }

    .page-header .logo {
      font-size: 12px;
      font-weight: 700;
      color: ${colors.brandPurple};
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }

    .page-header .client {
      font-size: 12px;
      color: ${colors.slate};
    }

    .page-footer {
      padding: 16px 56px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid ${colors.border};
      flex-shrink: 0;
    }

    .page-footer .website {
      font-size: 11px;
      color: ${colors.slate};
    }

    .page-footer .page-number {
      font-size: 11px;
      color: ${colors.slate};
    }

    /* ================================================
       SECTION STYLES
       ================================================ */
    .section-header {
      margin-bottom: 24px;
    }

    .section-header h2 {
      color: ${colors.charcoal};
      margin-bottom: 8px;
      font-size: 26px;
    }

    .section-header .underline {
      width: 60px;
      height: 3px;
      background: ${colors.brandPurple};
    }

    /* ================================================
       BULLET LIST
       ================================================ */
    .bullet-list {
      list-style: none;
    }

    .bullet-list li {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 14px;
      font-size: 15px;
      line-height: 1.6;
      color: ${colors.charcoal};
    }

    .bullet-list .bullet {
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      background: ${colors.brandPurple};
      border-radius: 50%;
      margin-top: 7px;
    }

    /* ================================================
       IMPACT STATEMENT
       ================================================ */
    .impact-statement {
      background: ${colors.navy};
      color: ${colors.white};
      padding: 32px 40px;
      text-align: center;
      margin: 16px -56px;
    }

    .impact-statement h2 {
      font-size: 32px;
      font-weight: 700;
      color: ${colors.white};
      line-height: 1.3;
    }

    .impact-statement p {
      color: rgba(255, 255, 255, 0.85);
      font-size: 16px;
      margin-top: 12px;
    }

    /* ================================================
       COMPARISON CARDS
       ================================================ */
    .comparison-container {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 24px 0;
    }

    .comparison-card {
      flex: 1;
      background: ${colors.lightGray};
      border-radius: 12px;
      padding: 24px;
      text-align: center;
    }

    .comparison-card.old {
      background: ${colors.lightGray};
    }

    .comparison-card.new {
      background: ${colors.brandPurpleLight};
      border: 2px solid ${colors.brandPurple};
    }

    .comparison-card .label {
      font-size: 11px;
      color: ${colors.slate};
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .comparison-card .value {
      font-size: 36px;
      font-weight: 700;
      color: ${colors.charcoal};
    }

    .comparison-card.new .value {
      color: ${colors.brandPurple};
    }

    .comparison-arrow {
      font-size: 24px;
      color: ${colors.brandPurple};
      font-weight: bold;
    }

    .difference-box {
      background: ${colors.brandPurple};
      color: ${colors.white};
      border-radius: 12px;
      padding: 16px 32px;
      text-align: center;
      display: inline-block;
      margin: 16px 0;
    }

    .difference-box .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.9;
      margin-bottom: 4px;
    }

    .difference-box .value {
      font-size: 28px;
      font-weight: 700;
    }

    /* Large cost highlight for Scenario 2 */
    .cost-highlight {
      background: ${colors.navy};
      color: ${colors.white};
      border-radius: 16px;
      padding: 28px 40px;
      text-align: center;
      margin: 16px 0;
    }

    .cost-highlight .label {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 2px;
      opacity: 0.85;
      margin-bottom: 8px;
    }

    .cost-highlight .value {
      font-size: 48px;
      font-weight: 700;
    }

    .cost-highlight .subtitle {
      font-size: 14px;
      opacity: 0.85;
      margin-top: 8px;
    }

    /* ================================================
       TIMELINE
       ================================================ */
    .timeline {
      background: ${colors.brandPurpleLight};
      border-radius: 12px;
      padding: 28px;
      margin: 24px 0;
    }

    .timeline h3 {
      color: ${colors.charcoal};
      margin-bottom: 20px;
      font-size: 18px;
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
      background: ${colors.brandPurple};
    }

    .timeline-item:not(:first-child)::before {
      content: '';
      position: absolute;
      top: 14px;
      left: 0;
      width: 50%;
      height: 2px;
      background: ${colors.brandPurple};
    }

    .timeline-year {
      display: inline-block;
      background: ${colors.brandPurple};
      color: ${colors.white};
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 10px;
      position: relative;
      z-index: 1;
    }

    .timeline-rate {
      font-size: 16px;
      font-weight: 700;
      color: ${colors.charcoal};
      margin-bottom: 6px;
    }

    .timeline-text {
      font-size: 12px;
      color: ${colors.slate};
      line-height: 1.4;
    }

    /* ================================================
       VERIFICATION BOX
       ================================================ */
    .verification-box {
      border: 1px solid ${colors.border};
      border-radius: 8px;
      overflow: hidden;
      margin: 24px 0;
    }

    .verification-header {
      background: ${colors.navy};
      color: ${colors.white};
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .verification-header .title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .verification-header .copy-hint {
      font-size: 10px;
      opacity: 0.8;
    }

    .verification-body {
      padding: 16px;
      background: ${colors.lightGray};
    }

    .verification-body .instruction {
      font-size: 13px;
      color: ${colors.slate};
      margin-bottom: 12px;
    }

    .verification-prompt {
      background: ${colors.white};
      border: 1px solid ${colors.border};
      border-radius: 6px;
      padding: 14px;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
      font-size: 12px;
      color: ${colors.charcoal};
      line-height: 1.5;
    }

    /* ================================================
       DATA TABLE
       ================================================ */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }

    .data-table th,
    .data-table td {
      padding: 14px 16px;
      text-align: left;
      border-bottom: 1px solid ${colors.border};
    }

    .data-table th {
      background: ${colors.lightGray};
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: ${colors.slate};
    }

    .data-table td {
      font-size: 14px;
      color: ${colors.charcoal};
    }

    .data-table tr:last-child td {
      border-bottom: 2px solid ${colors.charcoal};
    }

    .data-table tr.total-row td {
      font-weight: 600;
    }

    .data-table .text-right {
      text-align: right;
    }

    /* ================================================
       GUARANTEE CERTIFICATE
       ================================================ */
    .guarantee-certificate {
      border: 3px solid ${colors.gold};
      border-radius: 16px;
      background: ${colors.goldLight};
      padding: 40px;
      text-align: center;
      margin: 24px 0;
    }

    .guarantee-certificate .amount {
      font-size: 64px;
      font-weight: 700;
      color: ${colors.charcoal};
      margin-bottom: 4px;
    }

    .guarantee-certificate .title {
      font-size: 22px;
      font-weight: 600;
      color: ${colors.charcoal};
      margin-bottom: 20px;
    }

    .guarantee-certificate p {
      font-size: 15px;
      color: ${colors.slate};
      max-width: 480px;
      margin: 0 auto;
      line-height: 1.6;
    }

    /* ================================================
       STEPS
       ================================================ */
    .steps-container {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      gap: 16px;
      margin: 32px 0;
    }

    .step {
      flex: 1;
      text-align: center;
      max-width: 180px;
    }

    .step-number {
      width: 52px;
      height: 52px;
      background: ${colors.brandPurple};
      color: ${colors.white};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 700;
      margin: 0 auto 14px auto;
    }

    .step h4 {
      font-size: 15px;
      font-weight: 600;
      color: ${colors.charcoal};
      margin-bottom: 6px;
    }

    .step p {
      font-size: 13px;
      color: ${colors.slate};
      line-height: 1.5;
    }

    .step-arrow {
      display: flex;
      align-items: center;
      padding-top: 16px;
      color: ${colors.brandPurple};
      font-size: 24px;
    }

    /* ================================================
       CTA BOX
       ================================================ */
    .cta-box {
      background: ${colors.brandPurple};
      color: ${colors.white};
      border-radius: 12px;
      padding: 28px 32px;
      text-align: center;
      margin: 24px 0;
    }

    .cta-box h3 {
      color: ${colors.white};
      font-size: 22px;
      margin-bottom: 12px;
    }

    .cta-box p {
      color: rgba(255, 255, 255, 0.9);
      font-size: 15px;
    }

    /* ================================================
       PULLQUOTE
       ================================================ */
    .pullquote {
      border-left: 4px solid ${colors.brandPurple};
      padding: 16px 24px;
      margin: 24px 0;
      background: ${colors.lightGray};
      border-radius: 0 8px 8px 0;
    }

    .pullquote p {
      font-size: 17px;
      font-style: italic;
      color: ${colors.charcoal};
      line-height: 1.6;
    }

    /* ================================================
       CALLOUT BOX
       ================================================ */
    .callout-box {
      background: ${colors.brandPurpleLight};
      border-radius: 12px;
      padding: 24px;
      margin: 20px 0;
    }

    .callout-box h4 {
      font-size: 16px;
      font-weight: 600;
      color: ${colors.charcoal};
      margin-bottom: 12px;
    }

    .callout-box p {
      font-size: 14px;
      color: ${colors.slate};
      line-height: 1.6;
    }

    /* ================================================
       APPROACH PAGE
       ================================================ */
    .approach-intro {
      font-size: 17px;
      color: ${colors.charcoal};
      line-height: 1.7;
      margin-bottom: 24px;
    }

    .signature-block {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid ${colors.border};
    }

    .signature-block .name {
      font-size: 18px;
      font-weight: 600;
      color: ${colors.charcoal};
    }

    .signature-block .title {
      font-size: 14px;
      color: ${colors.slate};
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

    .avoid-break {
      page-break-inside: avoid;
    }
  `;
}

// ============================================================
// PAGE GENERATORS
// ============================================================

/**
 * Generate page header
 */
function pageHeader(clientName: string): string {
  return `
    <div class="page-header">
      <div class="logo">Inspired Mortgage</div>
      <div class="client">${clientName}</div>
    </div>
  `;
}

/**
 * Generate page footer
 */
function pageFooter(pageNumber: number): string {
  return `
    <div class="page-footer">
      <div class="website">inspired.mortgage</div>
      <div class="page-number">Page ${pageNumber}</div>
    </div>
  `;
}

/**
 * Generate Cover Page — Uses REPORT_COPY.cover for all text
 */
function generateCoverPage(
  clientName: string,
  date: string,
  consultant: { name: string; email: string; phone: string }
): string {
  const copy = REPORT_COPY.cover;
  const benefitsList = copy.benefits.map(b => `
            <li>
              <span class="checkmark">✓</span>
              <span>${b}</span>
            </li>`).join("");

  return `
    <div class="page cover-page">
      <div class="cover-header">
        <!-- TODO: Replace with actual logo image: <img src="/path/to/inspired-mortgage-logo.png" alt="Inspired Mortgage" /> -->
        <div class="logo-text">Inspired Mortgage</div>
      </div>
      <div class="cover-body">
        <div class="cover-tagline">
          <h1>${copy.tagline}</h1>
        </div>
        <div class="cover-divider"></div>
        <div class="cover-client-info">
          <div class="prepared-for">${copy.preparedForLabel}</div>
          <div class="client-name">${clientName}</div>
          <div class="date">${date}</div>
        </div>
        <div class="cover-callout">
          <p class="callout-text">
            ${copy.applicationNotice}
          </p>
          <ul class="callout-list">
            ${benefitsList}
          </ul>
        </div>
        <div class="cover-advisor">
          <div class="advisor-card">
            <div class="label">${copy.advisorLabel}</div>
            <div class="name">${consultant.name}</div>
            <div class="contact">${consultant.email}</div>
            <div class="contact">${consultant.phone}</div>
          </div>
        </div>
      </div>
      <div class="cover-footer-note">
        <p>${copy.readingTime}</p>
        <p style="font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 8px; line-height: 1.5;">${copy.readingEncouragement.split('\n\n')[0]}</p>
      </div>
      <div class="cover-closing" style="text-align: center; margin-top: 12px; font-style: italic; color: rgba(255,255,255,0.8); font-size: 14px;">
        ${copy.closingLine}
      </div>
    </div>
  `;
}

/**
 * Generate What You Told Us Page
 */
function generateWhatYouToldUsPage(
  clientName: string,
  bullets: string[],
  pageNumber: number,
  vars: Record<string, string> = {}
): string {
  const copy = REPORT_COPY.whatYouToldUs;
  const introText = replaceVariables(copy.intro, vars);
  const outroText = replaceVariables(copy.outro, vars);

  const bulletItems = bullets
    .map(
      (bullet) => `
      <li>
        <span class="bullet"></span>
        <span>${bullet}</span>
      </li>
    `
    )
    .join("");

  const introParagraphs = introText.split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="color: ${colors.slate}; margin-bottom: 16px; font-size: 16px; line-height: 1.7;">${p}</p>`
  ).join("");

  const outroParagraphs = outroText.split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p style="color: ${colors.slate}; margin-bottom: 16px; font-size: 16px; line-height: 1.7;">${p}</p>`
  ).join("");

  return `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>${copy.heading}</h2>
            <div class="underline"></div>
          </div>

          ${introParagraphs}

          <ul class="bullet-list" style="background: ${colors.cream}; padding: 24px 24px 24px 40px; border-radius: 12px; margin-bottom: 24px;">
            ${bulletItems}
          </ul>

          ${outroParagraphs}
        </div>
        ${pageFooter(pageNumber)}
      </div>
    </div>
  `;
}

/**
 * Generate Scenario 1 Pages - Sub-2% Fixed → Renewal Trap
 */
function generateScenario1Pages(
  clientName: string,
  data: ReportHTMLProps["extractedData"]
): string[] {
  const oldPayment = formatCurrency(data.oldPayment || 2045);
  const newPayment = formatCurrency(data.newPayment || 2689);
  const paymentDiff = formatCurrency(data.paymentDifference || 644);
  const fiveYearTotal = formatCurrency(data.fiveYearsOfPayments || 161340);
  const previousRate = formatPercent(data.previousRate || 0.0189);
  // Use the actual currentMarketRate if provided, otherwise check for null/undefined explicitly
  const currentRate = data.currentMarketRate != null ? formatPercent(data.currentMarketRate) : formatPercent(0.045);
  const mortgageAmount = formatCurrency(data.mortgageAmount || 485000);
  const originalAm = data.originalAmortization || 25;
  const currentAm = data.currentAmortization || 20;

  const page1 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>What Happened on Your Last Term</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4"><strong>Here's the thing: your last term was actually great.</strong></p>

          <p class="mb-4">You locked in at ${previousRate}—one of the lowest fixed rates in Canadian history. Your payments were predictable. Your principal was dropping steadily. You did everything right.</p>

          <p class="mb-4"><strong>The problem isn't what happened. The problem is what's about to happen.</strong></p>

          <p class="mb-4">You started with a ${originalAm}-year amortization. After five years of payments, you're now at ${currentAm} years remaining. You made real progress.</p>

          <p class="mb-4">But at today's rates, keeping the same amortization would push your payment from approximately ${oldPayment} to ${newPayment}—a difference of ${paymentDiff} per month.</p>

          <div class="comparison-container">
            <div class="comparison-card old">
              <div class="label">Your Old Payment</div>
              <div class="value">${oldPayment}</div>
            </div>
            <div class="comparison-arrow">→</div>
            <div class="comparison-card new">
              <div class="label">Your New Payment</div>
              <div class="value">${newPayment}</div>
            </div>
          </div>

          <div class="text-center">
            <div class="difference-box">
              <div class="label">Monthly Increase</div>
              <div class="value">+${paymentDiff}</div>
            </div>
          </div>

          <p class="mt-4">For most people, that's not manageable. So the bank offers a simple solution: add 5 years back onto your amortization. Payment problem solved.</p>

          <p class="mt-4"><strong>Except here's what that actually means:</strong></p>
        </div>
        ${pageFooter(3)}
      </div>
    </div>
  `;

  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="impact-statement" style="margin-top: 0;">
            <h2>Five years of payments.<br>Zero progress.</h2>
          </div>

          <p class="mt-6">You'll make another 60 payments—roughly ${fiveYearTotal} out of your pocket—and at the end of it, you'll still have ${currentAm} years remaining. Exactly where you are today.</p>

          <p class="mt-4">All that ground you gained with your sub-2% rate? Given back. The years of principal reduction you earned? Erased on paper.</p>

          <p class="mt-4">And the bank won't explain this. They'll send you a renewal letter with a checkbox. You'll sign it because the payment looks affordable. And you won't realize what you gave up until years later—if ever.</p>

          <div class="section-header mt-6">
            <h2>The Difference Active Management Makes</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4">Here's what would have happened if you'd had someone watching your mortgage the whole time:</p>

          <div class="timeline">
            <h3>What Active Management Looks Like</h3>
            <div class="timeline-items">
              <div class="timeline-item">
                <div class="timeline-year">Year 1</div>
                <div class="timeline-rate">2.9%</div>
                <div class="timeline-text">We call you.<br>"Bump payment slightly now."</div>
              </div>
              <div class="timeline-item">
                <div class="timeline-year">Year 2</div>
                <div class="timeline-rate">3.8%</div>
                <div class="timeline-text">We call you.<br>"Another small increase."</div>
              </div>
              <div class="timeline-item">
                <div class="timeline-year">Year 3</div>
                <div class="timeline-rate">4.2%</div>
                <div class="timeline-text">We call you.<br>"Consider locking in."</div>
              </div>
              <div class="timeline-item">
                <div class="timeline-year">Now</div>
                <div class="timeline-rate">Prepared</div>
                <div class="timeline-text">No payment shock.<br>No surprises.</div>
              </div>
            </div>
          </div>

          <p class="mt-4">By the time you reached renewal, your payments would have already adjusted gradually. No shock. No scramble. And instead of needing to extend your amortization, you'd have accelerated it—years ahead of where you are now.</p>
        </div>
        ${pageFooter(4)}
      </div>
    </div>
  `;

  const page3 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <p class="mb-4"><strong>This wasn't your fault.</strong> Nobody explained the options. Nobody showed you what was coming. Nobody called you before that renewal letter arrived.</p>

          <p class="mb-6"><strong>Nobody did that for you last time. We will this time.</strong></p>

          <div class="section-header">
            <h2>What We Look For Instead</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4">There may be ways to reduce your overall interest cost across this next term that let you hold your amortization—or at least minimize the damage:</p>

          <p class="mb-2"><strong>Rate optimization:</strong> Not just today's rate, but actively managing through the term as rates move. If we can save you 0.5% through a strategic relock in year two or three, that savings doesn't just reduce your payment—it accelerates your amortization. Every dollar that would have gone to interest now goes to principal.</p>

          <p class="mb-2"><strong>Debt restructuring:</strong> If you're carrying other debts—car loans, lines of credit, credit cards—there may be a consolidation play that reduces your total monthly outflow while keeping your mortgage amortization intact.</p>

          <p class="mb-4"><strong>Cash flow reallocation:</strong> With regular check-ins throughout your next term, we look for moments when you can increase your payments—even slightly—to claw back amortization. A small raise at work. A car loan that gets paid off. These are opportunities to move forward, but only if someone asks the question.</p>

          <div class="pullquote">
            <p>Our goal isn't just to set up your mortgage and disappear. It's to keep optimizing, keep asking, and keep you moving toward debt-free faster than you thought possible.</p>
          </div>

          <div class="verification-box">
            <div class="verification-header">
              <span class="title">Verify This Yourself</span>
              <span class="copy-hint">Copy prompt below</span>
            </div>
            <div class="verification-body">
              <p class="instruction">Ask any AI (ChatGPT, Claude, Google):</p>
              <div class="verification-prompt">I have a ${mortgageAmount} mortgage. I was paying ${previousRate} and now I'm renewing at ${currentRate}. What's the payment difference and how much will I pay over 5 years?</div>
            </div>
          </div>
        </div>
        ${pageFooter(5)}
      </div>
    </div>
  `;

  return [page1, page2, page3];
}

/**
 * Generate Scenario 2 Pages - Variable → Panic Lock
 */
function generateScenario2Pages(
  clientName: string,
  data: ReportHTMLProps["extractedData"]
): string[] {
  const originalRate = formatPercent(data.originalRate || 0.0145);
  const lockInRate = formatPercent(data.lockInRate || 0.0579);
  const extraInterest = formatCurrency(data.estimatedExtraInterest || 38675);
  const mortgageAmount = formatCurrency(data.mortgageAmount || 520000);

  const page1 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>What Happened on Your Last Term</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4">You started with a variable rate at ${originalRate}—a great rate at the time. Then rates started climbing. The headlines got scary. Your bank called and offered to "lock you in for protection."</p>

          <p class="mb-4">It felt responsible. It felt safe. But here's what actually happened:</p>

          <div class="cost-highlight">
            <div class="label">Estimated Extra Interest Paid</div>
            <div class="value">${extraInterest}</div>
            <div class="subtitle">Over the remaining term vs. staying variable</div>
          </div>

          <p class="mt-4">You locked in at ${lockInRate} when rates were at their peak. Since then, rates have dropped—but you're stuck paying the higher rate until your term ends.</p>

          <div class="pullquote">
            <p>The bank wasn't protecting you. They were protecting their revenue.</p>
          </div>

          <p class="mt-4">Variable rate mortgages are designed to fluctuate. That's the trade-off for historically lower rates. But when the fluctuation happened, your bank positioned a lock-in as a safety measure—when it was actually a revenue opportunity for them.</p>
        </div>
        ${pageFooter(3)}
      </div>
    </div>
  `;

  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>This Wasn't Your Fault</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4">When rates are rising and the news is alarming, locking in feels like the responsible choice. But nobody told you:</p>

          <ul class="bullet-list">
            <li>
              <span class="bullet"></span>
              <span>Variable rates historically outperform fixed rates over time</span>
            </li>
            <li>
              <span class="bullet"></span>
              <span>Banks make more money when you lock in at peak rates</span>
            </li>
            <li>
              <span class="bullet"></span>
              <span>The "protection" they offered came with a significant cost</span>
            </li>
            <li>
              <span class="bullet"></span>
              <span>There were other strategies—like trigger rate management—that could have helped</span>
            </li>
          </ul>

          <div class="section-header mt-6">
            <h2>Here's What Would Have Happened</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4">If someone had been watching your mortgage:</p>

          <p class="mb-2"><strong>When your rate crossed 3.5%:</strong> We would have called. "Rates are climbing. Let's discuss whether locking in now makes sense before it gets worse."</p>

          <p class="mb-2"><strong>When you were considering locking in at ${lockInRate}:</strong> We would have run the numbers. "Here's what locking in costs you vs. riding it out. Here's the break-even point."</p>

          <p class="mb-4"><strong>When rates started falling after you locked in:</strong> We would have called again. "Rates have dropped significantly. Let's calculate whether breaking your mortgage and relocking makes financial sense."</p>

          <p class="mt-4">Instead, you were left to react alone, under stress, with incomplete information. The pattern only breaks if someone is actually paying attention.</p>

          <p class="mt-4"><strong>Nobody did that for you last time. We will this time.</strong></p>

          <div class="verification-box">
            <div class="verification-header">
              <span class="title">Verify This Yourself</span>
              <span class="copy-hint">Copy prompt below</span>
            </div>
            <div class="verification-body">
              <p class="instruction">Ask any AI (ChatGPT, Claude, Google):</p>
              <div class="verification-prompt">I have a ${mortgageAmount} mortgage. I started at ${originalRate} variable and locked in at ${lockInRate} with 3 years remaining. If rates dropped 1.5% since then, how much extra interest am I paying?</div>
            </div>
          </div>
        </div>
        ${pageFooter(4)}
      </div>
    </div>
  `;

  return [page1, page2];
}

/**
 * Generate Scenario 3 Pages - Fixed Payment Variable → Negative Amortization
 */
function generateScenario3Pages(
  clientName: string,
  data: ReportHTMLProps["extractedData"]
): string[] {
  const mortgageAmount = formatCurrency(data.mortgageAmount || 415000);
  const fixedPayment = formatCurrency(data.fixedPayment || 1850);
  const originalAm = data.originalAmortization || 25;
  const currentAm = data.currentAmortization || 26;

  const page1 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>What Happened on Your Last Term</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4">You chose a variable rate mortgage with fixed payments of ${fixedPayment}/month. It seemed like the best of both worlds—variable rate savings with predictable payments.</p>

          <p class="mb-4">But when rates rose, something happened that your bank never warned you about:</p>

          <div class="impact-statement">
            <h2>You made every payment.<br>You now owe more than before.</h2>
          </div>

          <div class="comparison-container">
            <div class="comparison-card old">
              <div class="label">Original Amortization</div>
              <div class="value">${originalAm} years</div>
            </div>
            <div class="comparison-arrow">→</div>
            <div class="comparison-card new">
              <div class="label">Current Amortization</div>
              <div class="value">${currentAm} years</div>
            </div>
          </div>

          <p class="mt-4">This is called <strong>negative amortization</strong>. Your fixed payment no longer covered the interest, so the unpaid interest got added to your balance. You were going backwards without knowing it.</p>

          <p class="mt-4">Every month, you thought you were paying down your mortgage. Every month, your balance was actually growing. And your bank knew—they just didn't tell you.</p>
        </div>
        ${pageFooter(3)}
      </div>
    </div>
  `;

  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>This Wasn't Your Fault</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4">Your bank had a responsibility to tell you this was happening. They didn't. No phone call. No letter. No warning until you looked at your statement and saw your balance had increased.</p>

          <ul class="bullet-list">
            <li>
              <span class="bullet"></span>
              <span>You weren't told about trigger rates or trigger points</span>
            </li>
            <li>
              <span class="bullet"></span>
              <span>You weren't offered the option to increase your payment</span>
            </li>
            <li>
              <span class="bullet"></span>
              <span>You weren't warned that your amortization was extending</span>
            </li>
            <li>
              <span class="bullet"></span>
              <span>You weren't given a strategy to get back on track</span>
            </li>
          </ul>

          <div class="section-header mt-6">
            <h2>Here's What Would Have Happened</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4">If someone had been watching your mortgage:</p>

          <p class="mb-2"><strong>When rates started rising:</strong> We would have called. "Your fixed payment may not cover the interest soon. Let's increase it slightly now to stay on track."</p>

          <p class="mb-2"><strong>When you hit your trigger rate:</strong> We would have called. "Your payment no longer covers the interest. Here are your options: increase payment, lock in, or switch to adjustable payments."</p>

          <p class="mb-4"><strong>When your amortization started extending:</strong> We would have called. "Your mortgage is going backwards. Here's exactly what's happening and how to fix it."</p>

          <p class="mt-4">Your bank had all this information. They chose not to share it. We don't operate that way.</p>

          <p class="mt-4"><strong>Nobody did that for you last time. We will this time.</strong></p>

          <div class="verification-box">
            <div class="verification-header">
              <span class="title">Verify This Yourself</span>
              <span class="copy-hint">Copy prompt below</span>
            </div>
            <div class="verification-body">
              <p class="instruction">Ask any AI (ChatGPT, Claude, Google):</p>
              <div class="verification-prompt">I have a ${mortgageAmount} mortgage with fixed payments of ${fixedPayment}. If rates rose from 1.65% to 5.5%, would my payment still cover the interest? What happens if it doesn't?</div>
            </div>
          </div>
        </div>
        ${pageFooter(4)}
      </div>
    </div>
  `;

  return [page1, page2];
}

/**
 * Generate Debt Consolidation Page — Uses REPORT_COPY.debtConsolidation for all text
 */
function generateDebtConsolidationPage(
  clientName: string,
  mortgageAmount: number,
  otherDebts: Array<{ type: string; balance: number; payment: number }>,
  pageNumber: number
): string {
  const copy = REPORT_COPY.debtConsolidation;
  const totalDebt =
    mortgageAmount + otherDebts.reduce((sum, d) => sum + d.balance, 0);
  const totalPayments = otherDebts.reduce((sum, d) => sum + d.payment, 0);

  const debtRows = otherDebts
    .map(
      (debt) => `
      <tr>
        <td>${debt.type}</td>
        <td class="text-right">${formatCurrency(debt.balance)}</td>
        <td class="text-right">${formatCurrency(debt.payment)}/mo</td>
      </tr>
    `
    )
    .join("");

  // Build example debts from approved copy
  const exampleDebtRows = copy.example.debts.map(d => `
      <tr><td>${d.type}</td><td class="text-right">${formatCurrency(d.balance)}</td><td class="text-right">${formatCurrency(d.payment)}/mo</td></tr>
  `).join("");

  return `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>${copy.heading}</h2>
            <div class="underline"></div>
          </div>

          ${copy.intro.split('\n\n').map(p => `<p class="mb-4">${p}</p>`).join('')}

          <h3 class="mt-6">${copy.example.heading}</h3>
          <p class="mb-4">${copy.example.setup}</p>

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

          <p class="mb-4">${copy.example.totalOutflow}</p>
          <p class="mb-4">${copy.example.bankPath}</p>

          <h3 class="mt-6">${copy.solution.heading}</h3>
          <p class="mb-4">${copy.solution.body}</p>

          <div class="cta-box">
            <p style="font-size: 18px; font-weight: 700;">${copy.solution.impactLine}</p>
          </div>

          <p class="mb-4" style="font-style: italic;">${copy.solution.clientReaction}</p>

          <h3 class="mt-6">${copy.noteOnIncreasingMortgage.heading}</h3>
          ${copy.noteOnIncreasingMortgage.body.split('\n\n').map(p => `<p class="mb-4">${p}</p>`).join('')}

          <h3 class="mt-6">${copy.relevance.heading}</h3>
          ${copy.relevance.body.split('\n\n').map(p => `<p class="mb-4">${p}</p>`).join('')}
        </div>
        ${pageFooter(pageNumber)}
      </div>
    </div>
  `;
}

/**
 * Generate Application Link Page
 */
function generateApplicationLinkPage(
  clientName: string,
  applicationLink: string,
  message: string,
  pageNumber: number
): string {
  return `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content" style="display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
          <div class="cta-box" style="max-width: 520px;">
            <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin-bottom: 20px; line-height: 1.7;">${message}</p>
            <a href="${applicationLink}" style="display: inline-block; background: ${colors.white}; color: ${colors.brandPurple}; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; text-decoration: none;">Start Your Application →</a>
          </div>
        </div>
        ${pageFooter(pageNumber)}
      </div>
    </div>
  `;
}

/**
 * Generate Our Approach Page (single page, uses REPORT_COPY)
 */
function generateOurApproachPage(
  clientName: string,
  consultant: { name: string; email: string; phone: string },
  pageNumber: number,
  vars: Record<string, string> = {}
): string {
  const copy = REPORT_COPY.ourApproach;
  const introText = replaceVariables(copy.intro, vars);
  const introParagraphs = introText.split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
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
            <div class="underline"></div>
          </div>

          ${introParagraphs}

          <h3 class="mb-2">${copy.differentiators.heading}</h3>
          <ul class="bullet-list">
            ${differentiatorItems}
          </ul>

          <p class="mt-4">${copy.closing}</p>

          <div class="callout-box">
            <h4>${copy.promise.heading}</h4>
            <p>${copy.promise.body}</p>
          </div>

          <div class="signature-block">
            <div class="name">${consultant.name}</div>
            <div class="title">${getAdvisorTitle(consultant.name)}, Inspired Mortgage</div>
          </div>
        </div>
        ${pageFooter(pageNumber)}
      </div>
    </div>
  `;
}

/**
 * Generate $5,000 Penalty Guarantee Page (uses REPORT_COPY)
 */
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
            <h2>${copy.heading}</h2>
            <div class="underline"></div>
          </div>

          <div class="guarantee-certificate">
            <div class="amount">${copy.certificate.amount}</div>
            <div class="title">${copy.certificate.title}</div>
            <p>${copy.certificate.body}</p>
            <p style="font-weight: 700; margin-top: 12px;">${copy.certificate.subtext}</p>
          </div>

          <h3 class="mb-2">${copy.howItWorks.heading}</h3>
          <ul class="bullet-list mb-4">
            ${exampleItems}
          </ul>

          <p class="mb-4">${copy.howItWorks.explanation}</p>

          <div class="callout-box">
            <h4>${copy.askYourBank.heading}</h4>
            <p style="font-style: italic;">${copy.askYourBank.prompt}</p>
            <p style="font-weight: 700; margin-top: 12px;">${copy.askYourBank.punchline}</p>
          </div>
        </div>
        ${pageFooter(pageNumber)}
      </div>
    </div>
  `;
}

/**
 * OLD: Generate Our Approach Pages — REPLACED by generateOurApproachPage + generateGuaranteePage
 * Keeping for reference during migration, will be removed
 */
function _deprecated_generateOurApproachPages(
  clientName: string,
  consultant: { name: string; email: string; phone: string },
  startPageNumber: number
): string[] {
  // Page 1: Our Approach
  const approachPage = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>Our Approach</h2>
            <div class="underline"></div>
          </div>

          <p class="approach-intro">The Inspired Team has over 90 years combined experience in the Canadian mortgage space. We've seen every rate cycle, every market panic, every "this time is different" moment.</p>

          <p class="mb-4">And here's what we've learned: the mortgage industry is designed to benefit banks, not borrowers. We built Inspired Mortgage to change that.</p>

          <p class="mb-4">Here's what makes us different:</p>

          <ul class="bullet-list">
            <li>
              <span class="bullet"></span>
              <span><strong>We work for you, not the banks.</strong> We're paid the same regardless of which lender you choose. Our only job is finding you the best deal.</span>
            </li>
            <li>
              <span class="bullet"></span>
              <span><strong>We watch your mortgage.</strong> Not just at renewal—throughout your entire term. If something changes, we call you.</span>
            </li>
            <li>
              <span class="bullet"></span>
              <span><strong>We explain the math.</strong> Every recommendation comes with numbers you can verify yourself.</span>
            </li>
            <li>
              <span class="bullet"></span>
              <span><strong>We make lenders compete.</strong> 30+ lenders. One application. You see every offer.</span>
            </li>
          </ul>

          <p class="mt-4">After decades in this industry, we could have done anything. Instead, we built this.</p>

          <div class="callout-box">
            <h4>The Inspired Mortgage Promise</h4>
            <p>You'll never sign a renewal letter without knowing your options. You'll never be surprised by rate changes. You'll never wonder if you got the best deal.</p>
          </div>

          <div class="signature-block">
            <div class="name">${consultant.name}</div>
            <div class="title">${getAdvisorTitle(consultant.name)}, Inspired Mortgage</div>
          </div>
        </div>
        ${pageFooter(startPageNumber)}
      </div>
    </div>
  `;

  // Page 2: $5,000 Penalty Guarantee
  const guaranteePage = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>The $5,000 Penalty Guarantee</h2>
            <div class="underline"></div>
          </div>

          <div class="guarantee-certificate">
            <div class="amount">$5,000</div>
            <div class="title">Penalty Guarantee</div>
            <p>If your penalty exceeds $5,000 when refinancing with us, we cover the difference. Guaranteed.</p>
          </div>

          <h3 class="mb-2">How It Works</h3>
          <ul class="bullet-list mb-4">
            <li>
              <span class="bullet"></span>
              <span>Your penalty is $8,000? You pay $5,000, we cover $3,000.</span>
            </li>
            <li>
              <span class="bullet"></span>
              <span>Your penalty is $12,000? You pay $5,000, we cover $7,000.</span>
            </li>
            <li>
              <span class="bullet"></span>
              <span>Your penalty is $4,500? You pay $4,500, no coverage needed.</span>
            </li>
          </ul>

          <p class="mb-4">This guarantee exists because we believe in our ability to find you a better deal. If the savings from your new rate don't justify the penalty, we make up the difference.</p>

          <div class="callout-box">
            <h4>Ask Your Bank</h4>
            <p>Call your current lender and ask: "What would my penalty be if I broke my mortgage today?" They're required to tell you. That number helps us calculate whether refinancing makes sense—and whether the guarantee applies.</p>
          </div>
        </div>
        ${pageFooter(startPageNumber + 1)}
      </div>
    </div>
  `;

  return [approachPage, guaranteePage];
}

/**
 * Generate Fixed Rate Strategy Pages (FULL REWRITE FROM APPROVED COPY)
 */
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
    `<p class="mb-4">${p}</p>`
  ).join("");

  const monitoringParagraphs = copy.monthlyMonitoring.body.split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

  const resultParagraphs = copy.borrowerComparison.result.body.split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

  const askYourBankParagraphs = copy.askYourBank.split(/\n\n+/).filter(p => p.trim());

  // Page 1: Intro + When + What We Do + Monthly Monitoring
  const page1 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>${copy.heading}</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4">${copy.intro}</p>

          <h3 class="mb-2">${copy.whenItMakesSense.heading}</h3>
          <ul class="bullet-list mb-6">${whenItems}</ul>

          <h3 class="mb-2">${copy.whatWeDoDifferently.heading}</h3>
          ${whatWeDoParagraphs}

          <h3 class="mb-2">${copy.monthlyMonitoring.heading}</h3>
          ${monitoringParagraphs}
        </div>
        ${pageFooter(startPageNumber)}
      </div>
    </div>
  `;

  // Page 2: Strategic Relock + Borrower Comparison
  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <h3 class="mb-2">${copy.strategicRelock.heading}</h3>
          <p class="mb-4">${copy.strategicRelock.body}</p>
          <ul class="bullet-list mb-4">${relockSteps}</ul>
          <p class="mb-4">${copy.strategicRelock.closing}</p>

          <h3 class="mb-2 mt-6">${copy.borrowerComparison.heading}</h3>
          <p class="mb-4">${copy.borrowerComparison.intro}</p>

          <div style="display: flex; gap: 16px; margin: 20px 0;">
            <div style="flex: 1; background: ${colors.lightGray}; border-radius: 12px; padding: 20px;">
              <h4 style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: ${colors.slate}; margin-bottom: 12px;">${copy.borrowerComparison.borrowerA.label}</h4>
              <ul class="bullet-list" style="margin: 0;">${borrowerASteps}</ul>
            </div>
            <div style="flex: 1; background: #ECFDF5; border: 2px solid #059669; border-radius: 12px; padding: 20px;">
              <h4 style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #059669; margin-bottom: 12px;">${copy.borrowerComparison.borrowerB.label}</h4>
              <ul class="bullet-list" style="margin: 0;">${borrowerBSteps}</ul>
            </div>
          </div>
        </div>
        ${pageFooter(startPageNumber + 1)}
      </div>
    </div>
  `;

  // Page 3: The Difference + Ask Your Bank
  const page3 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="impact-statement" style="margin-top: 0;">
            <h2>${copy.borrowerComparison.result.heading}</h2>
          </div>

          ${resultParagraphs}

          <h3 class="mb-2 mt-6">Ask Your Bank</h3>
          <div class="callout-box">
            <p style="font-style: italic;">${askYourBankParagraphs[0] || ""}</p>
            ${askYourBankParagraphs.length > 1 ? `<p style="font-weight: 700; margin-top: 12px;">${askYourBankParagraphs[1]}</p>` : ""}
          </div>
        </div>
        ${pageFooter(startPageNumber + 2)}
      </div>
    </div>
  `;

  return [page1, page2, page3];
}

/**
 * Generate Variable Rate Strategy Pages (FULL REWRITE FROM APPROVED COPY)
 */
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
    `<p class="mb-4">${p}</p>`
  ).join("");

  const howItPlaysOutParagraphs = replaceVariables(copy.howItPlaysOut.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

  const dangerParagraphs = replaceVariables(copy.dangerOfGoingItAlone.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

  // Page 1: Intro + When + What We Do + Strategy
  const page1 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>${copy.heading}</h2>
            <div class="underline"></div>
          </div>

          ${introParagraphs}

          <h3 class="mb-2">${copy.whenItMakesSense.heading}</h3>
          <ul class="bullet-list mb-6">${whenItems}</ul>

          <h3 class="mb-2">${copy.whatWeDoDifferently.heading}</h3>
          <p class="mb-4">${replaceVariables(copy.whatWeDoDifferently.body, vars)}</p>

          <h3 class="mb-2">${copy.strategy.heading}</h3>
          <p class="mb-4">${replaceVariables(copy.strategy.body, vars)}</p>
        </div>
        ${pageFooter(startPageNumber)}
      </div>
    </div>
  `;

  // Page 2: How It Plays Out + Danger of Going It Alone
  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <h3 class="mb-2">${copy.howItPlaysOut.heading}</h3>
          ${howItPlaysOutParagraphs}

          <h3 class="mb-2 mt-6">${copy.dangerOfGoingItAlone.heading}</h3>
          ${dangerParagraphs}
        </div>
        ${pageFooter(startPageNumber + 1)}
      </div>
    </div>
  `;

  return [page1, page2];
}

/**
 * Generate Cash Back Strategy Pages (NEW — FROM APPROVED COPY)
 */
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
    `<p class="mb-4">${p}</p>`
  ).join("");

  const storyParagraphs = replaceVariables(copy.trueStory.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

  const mathLines = copy.trueStory.math.lines.map(line => `
    <li><span class="bullet"></span><span>${line}</span></li>
  `).join("");

  const outcomeParagraphs = replaceVariables(copy.trueStory.outcome, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

  const howItCouldWorkParagraphs = replaceVariables(copy.howItCouldWork.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

  // Page 1: Intro + When + What We Do + True Story
  const page1 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>${copy.heading}</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4">${replaceVariables(copy.intro, vars)}</p>

          <h3 class="mb-2">${copy.whenItMakesSense.heading}</h3>
          <ul class="bullet-list mb-6">${whenItems}</ul>

          <h3 class="mb-2">${copy.whatWeDoDifferently.heading}</h3>
          ${whatWeDoParagraphs}

          <h3 class="mb-2">${copy.trueStory.heading}</h3>
          ${storyParagraphs}
        </div>
        ${pageFooter(startPageNumber)}
      </div>
    </div>
  `;

  // Page 2: Math + Outcome + Verification + How It Could Work
  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <h3 class="mb-2">${copy.trueStory.math.heading}</h3>
          <ul class="bullet-list mb-4">${mathLines}</ul>

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

          <h3 class="mb-2 mt-6">${copy.howItCouldWork.heading}</h3>
          ${howItCouldWorkParagraphs}
        </div>
        ${pageFooter(startPageNumber + 1)}
      </div>
    </div>
  `;

  return [page1, page2];
}

/**
 * Generate What Happens Next Page (uses REPORT_COPY)
 */
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
        <div class="page-content">
          <div class="section-header">
            <h2>${copy.heading}</h2>
            <div class="underline"></div>
          </div>

          <div class="steps-container">
            ${stepsHtml}
          </div>

          <div class="cta-box">
            <h3>${copy.ctaBox.heading}</h3>
            <a href="${applicationLink}" style="display: inline-block; background: ${colors.white}; color: ${colors.brandPurple}; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; text-decoration: none; margin-top: 12px;">Start Your Application →</a>
          </div>

          <div class="mt-6">
            <h3 class="mb-4">${copy.advisorBlock.label}</h3>
            <div class="advisor-card">
              <div class="label">Contact</div>
              <div class="name">${consultant.name}</div>
              <div class="contact">${consultant.email}</div>
              <div class="contact">${consultant.phone}</div>
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
