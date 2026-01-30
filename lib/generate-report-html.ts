/**
 * HTML Template Generator for Post-Discovery Reports
 * Premium design using HTML/CSS for Puppeteer PDF generation
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
    pages.push(...generateScenario1Pages(clientName, extractedData, vars));
  } else if (activeScenario === 2) {
    pages.push(...generateScenario2Pages(clientName, extractedData, vars));
  } else if (activeScenario === 3) {
    pages.push(...generateScenario3Pages(clientName, extractedData, vars));
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
 * Generate Scenario 1 Pages - Sub-2% Fixed → Renewal Trap (Uses REPORT_COPY)
 */
function generateScenario1Pages(
  clientName: string,
  data: ReportHTMLProps["extractedData"],
  vars: Record<string, string> = {}
): string[] {
  const copy = REPORT_COPY.scenarios.scenario1;
  const oldPayment = formatCurrency(data.oldPayment || 2045);
  const newPayment = formatCurrency(data.newPayment || 2689);
  const paymentDiff = formatCurrency(data.paymentDifference || 644);
  const currentAm = data.currentAmortization || 20;

  const introParagraphs = replaceVariables(copy.intro, vars).split(/\n\n+/).filter(p => p.trim()).map((p, i) =>
    i === 0 ? `<p class="mb-4">${p}</p>` : `<p class="mb-4"><strong>${p}</strong></p>`
  ).join("");

  const amortParagraphs = replaceVariables(copy.amortizationContext, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

  const bankParagraphs = replaceVariables(copy.bankSolution, vars).split(/\n\n+/).filter(p => p.trim()).map((p, i) =>
    i === 1 ? `<p class="mt-4"><strong>${p}</strong></p>` : `<p class="mt-4">${p}</p>`
  ).join("");

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
          ${amortParagraphs}

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

          ${bankParagraphs}
        </div>
        ${pageFooter(3)}
      </div>
    </div>
  `;

  const impactParagraphs = replaceVariables(copy.impactDetail, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mt-4">${p}</p>`
  ).join("");

  const transitionParagraphs = replaceVariables(copy.transitionToSolution, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mt-4">${p}</p>`
  ).join("");

  const summaryParagraphs = replaceVariables(copy.activeManagement.summary, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mt-4">${p}</p>`
  ).join("");

  const empathyParagraphs = replaceVariables(copy.activeManagement.empathy, vars).split(/\n\n+/).filter(p => p.trim()).map((p, i, arr) =>
    i === arr.length - 1 ? `<p class="mt-4"><strong>${p}</strong></p>` : `<p class="mt-4">${p}</p>`
  ).join("");

  const timelineItems = copy.activeManagement.timeline.map(item => `
              <div class="timeline-item">
                <div class="timeline-year">${item.year.split(' (')[0]}</div>
                <div class="timeline-rate">${item.year.includes('(') ? item.year.match(/\(([^)]+)\)/)?.[1] || '' : ''}</div>
                <div class="timeline-text">${item.action.replace(/"/g, '&quot;').substring(0, 80)}</div>
              </div>`).join("");

  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="impact-statement" style="margin-top: 0;">
            <h2>${copy.impactHeading.replace('. ', '.<br>')}</h2>
          </div>

          ${impactParagraphs}
          ${transitionParagraphs}

          <div class="section-header mt-6">
            <h2>${copy.activeManagement.heading}</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4">${replaceVariables(copy.activeManagement.intro, vars)}</p>

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

  const whatWeLookForItems = copy.whatWeLookFor.items.map(item =>
    `<p class="mb-2"><strong>${item.title}:</strong> ${replaceVariables(item.body, vars).split(/\n\n/)[0]}</p>`
  ).join("");

  const outcomeParagraphs = replaceVariables(copy.outcome.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

  const page3 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>${copy.whatWeLookFor.heading}</h2>
            <div class="underline"></div>
          </div>

          <p class="mb-4">${replaceVariables(copy.whatWeLookFor.intro, vars)}</p>

          ${whatWeLookForItems}

          <div class="pullquote">
            <p>${replaceVariables(copy.whatWeLookFor.closing, vars)}</p>
          </div>

          <div class="section-header mt-6">
            <h2>${copy.outcome.heading}</h2>
            <div class="underline"></div>
          </div>

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
        </div>
        ${pageFooter(5)}
      </div>
    </div>
  `;

  return [page1, page2, page3];
}

/**
 * Generate Scenario 2 Pages - Variable → Panic Lock (Uses REPORT_COPY)
 */
function generateScenario2Pages(
  clientName: string,
  data: ReportHTMLProps["extractedData"],
  vars: Record<string, string> = {}
): string[] {
  const copy = REPORT_COPY.scenarios.scenario2;
  const extraInterest = formatCurrency(data.estimatedExtraInterest || 38675);

  const introParagraphs = replaceVariables(copy.intro, vars).split(/\n\n+/).filter(p => p.trim()).map((p, i, arr) =>
    i === arr.length - 1 ? `<p class="mb-4"><strong>${p}</strong></p>` : `<p class="mb-4">${p}</p>`
  ).join("");

  const costParagraphs = replaceVariables(copy.costExplanation, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mt-4">${p}</p>`
  ).join("");

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
    i === 0 ? `<p class="mb-4"><strong>${p}</strong></p>` : `<p class="mb-4">${p}</p>`
  ).join("");

  const futureParagraphs = replaceVariables(copy.futureRisk.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          ${empathyParagraphs}

          <div class="section-header mt-6">
            <h2>${copy.futureRisk.heading}</h2>
            <div class="underline"></div>
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

/**
 * Generate Scenario 3 Pages - Fixed Payment Variable → Negative Amortization (Uses REPORT_COPY)
 */
function generateScenario3Pages(
  clientName: string,
  data: ReportHTMLProps["extractedData"],
  vars: Record<string, string> = {}
): string[] {
  const copy = REPORT_COPY.scenarios.scenario3;
  const originalAm = data.originalAmortization || 25;
  const currentAm = data.currentAmortization || 26;

  const introParagraphs = replaceVariables(copy.intro, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

  const explanationParagraphs = replaceVariables(copy.explanation.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

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

          <h3 class="mt-6">${copy.explanation.heading}</h3>

          ${explanationParagraphs}

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
        </div>
        ${pageFooter(3)}
      </div>
    </div>
  `;

  const empathyParagraphs = replaceVariables(copy.empathy.body, vars).split(/\n\n+/).filter(p => p.trim()).map(p =>
    `<p class="mb-4">${p}</p>`
  ).join("");

  const futureParagraphs = replaceVariables(copy.futureRisk.body, vars).split(/\n\n+/).filter(p => p.trim()).map((p, i, arr) =>
    i === arr.length - 1 ? `<p class="mb-4"><strong>${p}</strong></p>` : `<p class="mb-4">${p}</p>`
  ).join("");

  const page2 = `
    <div class="page">
      <div class="page-inner">
        ${pageHeader(clientName)}
        <div class="page-content">
          <div class="section-header">
            <h2>${copy.empathy.heading}</h2>
            <div class="underline"></div>
          </div>

          ${empathyParagraphs}

          <div class="section-header mt-6">
            <h2>${copy.futureRisk.heading}</h2>
            <div class="underline"></div>
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
            <div class="title">${consultant.name.toLowerCase().includes("greg") ? "Founder" : "Mortgage Advisor"}, Inspired Mortgage</div>
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
