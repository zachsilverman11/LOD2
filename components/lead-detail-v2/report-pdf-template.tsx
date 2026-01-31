"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
  Svg,
  Rect,
  Line,
  Circle,
  Path,
} from "@react-pdf/renderer";
import { formatCurrency, formatPercent } from "@/lib/mortgage-calculations";
import { REPORT_COPY, getAdvisorTitle } from "@/lib/report-copy";
import { replaceVariables, buildVariableMap, replaceAndSplit } from "@/lib/report-helpers";

// Consultant/Advisor details
export type ConsultantInfo = {
  name: string;
  email: string;
  phone?: string;
  calLink?: string;
};

// Extracted mortgage data for scenarios
export type ExtractedData = {
  mortgageAmount?: number | null;
  originalAmortization?: number | null;
  currentAmortization?: number | null;
  previousRate?: number | null;
  currentMarketRate?: number | null;
  oldPayment?: number | null;
  newPayment?: number | null;
  paymentDifference?: number | null;
  fiveYearsOfPayments?: number | null;
  originalRate?: number | null;
  lockInRate?: number | null;
  estimatedExtraInterest?: number | null;
  fixedPayment?: number | null;
  otherDebts?: Array<{
    type: string;
    balance: number;
    payment: number;
  }>;
};

// Props for the PDF template
export type ReportPDFProps = {
  clientName: string;
  date: string;
  consultant: ConsultantInfo;
  bullets: string[];
  mortgageAmount: string;
  scenario: 0 | 1 | 2 | 3 | null;
  includeDebtConsolidation: boolean;
  includeCashBack: boolean;
  applicationLink: string;
  extractedData: ExtractedData;
};

// Premium Design Colors - Wealth Management Quality
const colors = {
  // Primary brand
  primary: "#625FFF",
  primaryDark: "#4F4CD9",

  // Navy for premium feel
  navy: "#1e3a5f",
  navyLight: "#2d4a6f",

  // Text hierarchy
  darkText: "#1a1a1a",
  bodyText: "#374151",
  lightGray: "#6B7280",
  mutedText: "#9CA3AF",

  // Backgrounds
  cream: "#FBF3E7",
  lightBg: "#F9FAFB",
  warmWhite: "#FEFDFB",

  // Accents
  gold: "#D4A853",
  goldLight: "#FEF3C7",
  success: "#059669",
  danger: "#DC2626",

  // Utilities
  white: "#FFFFFF",
  border: "#E5E0D8",
  borderLight: "#F3F4F6",
};

// Premium Styles
const styles = StyleSheet.create({
  // ============================================================================
  // BASE PAGE WITH HEADER/FOOTER
  // ============================================================================
  page: {
    paddingTop: 70,
    paddingBottom: 50,
    paddingHorizontal: 50,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: colors.darkText,
    lineHeight: 1.6,
    position: "relative",
  },
  pageHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 50,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  pageHeaderLogo: {
    fontSize: 10,
    color: colors.lightGray,
    letterSpacing: 1,
  },
  pageFooter: {
    position: "absolute",
    bottom: 20,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageFooterText: {
    fontSize: 8,
    color: colors.mutedText,
  },
  pageNumber: {
    fontSize: 9,
    color: colors.lightGray,
    fontFamily: "Helvetica-Bold",
  },

  // ============================================================================
  // COVER PAGE - PREMIUM DESIGN
  // ============================================================================
  coverPage: {
    padding: 0,
    fontFamily: "Helvetica",
    position: "relative",
  },
  coverHeaderBand: {
    backgroundColor: colors.navy,
    height: 120,
    paddingHorizontal: 50,
    paddingTop: 35,
  },
  coverLogo: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  coverLogoInspired: {
    fontSize: 28,
    fontFamily: "Helvetica-Oblique",
    color: colors.white,
    letterSpacing: 1,
  },
  coverLogoMortgage: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: colors.white,
    letterSpacing: 1,
  },
  coverTagline: {
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 3,
    marginTop: 8,
    textTransform: "uppercase",
  },
  coverMain: {
    paddingHorizontal: 50,
    paddingTop: 60,
    flex: 1,
  },
  coverPreparedLabel: {
    fontSize: 11,
    color: colors.lightGray,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  coverClientName: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    marginBottom: 8,
  },
  coverDate: {
    fontSize: 12,
    color: colors.lightGray,
    marginBottom: 40,
  },
  coverInviteBox: {
    backgroundColor: colors.warmWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 24,
    marginBottom: 30,
  },
  coverInviteTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    marginBottom: 12,
  },
  coverInviteText: {
    fontSize: 10,
    color: colors.bodyText,
    lineHeight: 1.6,
    marginBottom: 12,
  },
  coverInviteBullet: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 8,
  },
  coverInviteBulletIcon: {
    width: 16,
    marginRight: 8,
  },
  coverInviteBulletText: {
    flex: 1,
    fontSize: 10,
    color: colors.bodyText,
    lineHeight: 1.5,
  },
  coverNote: {
    fontSize: 9,
    color: colors.lightGray,
    lineHeight: 1.5,
    fontFamily: "Helvetica-Oblique",
    paddingHorizontal: 4,
  },
  coverFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.lightBg,
    paddingHorizontal: 50,
    paddingVertical: 25,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  coverAdvisorLabel: {
    fontSize: 9,
    color: colors.lightGray,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  coverAdvisorName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
  },
  coverAdvisorTitle: {
    fontSize: 10,
    color: colors.bodyText,
    marginBottom: 6,
  },
  coverWebsite: {
    fontSize: 10,
    color: colors.primary,
  },

  // ============================================================================
  // SECTION HEADERS
  // ============================================================================
  sectionHeader: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    marginBottom: 6,
  },
  sectionHeaderUnderline: {
    width: 60,
    height: 3,
    backgroundColor: colors.primary,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    marginTop: 24,
    marginBottom: 10,
  },

  // ============================================================================
  // TYPOGRAPHY
  // ============================================================================
  paragraph: {
    fontSize: 11,
    color: colors.bodyText,
    lineHeight: 1.65,
    marginBottom: 12,
  },
  paragraphBold: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.darkText,
    lineHeight: 1.65,
    marginBottom: 12,
  },

  // ============================================================================
  // BULLETS
  // ============================================================================
  bulletContainer: {
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  bulletIcon: {
    width: 18,
    marginRight: 10,
    paddingTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    color: colors.bodyText,
    lineHeight: 1.55,
  },

  // ============================================================================
  // IMPACT STATEMENT - THE EMOTIONAL MOMENT
  // ============================================================================
  impactBox: {
    backgroundColor: colors.navy,
    borderRadius: 8,
    padding: 30,
    marginVertical: 25,
    alignItems: "center",
  },
  impactText: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: colors.white,
    textAlign: "center",
  },
  impactSubtext: {
    fontSize: 11,
    color: colors.gold,
    marginTop: 8,
    textAlign: "center",
  },

  // ============================================================================
  // PAYMENT COMPARISON VISUAL
  // ============================================================================
  comparisonContainer: {
    marginVertical: 20,
  },
  comparisonLabel: {
    fontSize: 10,
    color: colors.lightGray,
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 12,
  },
  comparisonRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "stretch",
    gap: 20,
  },
  comparisonBox: {
    width: "40%",
    borderWidth: 2,
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
  },
  comparisonBoxOld: {
    borderColor: colors.border,
    backgroundColor: colors.lightBg,
  },
  comparisonBoxNew: {
    borderColor: colors.danger,
    backgroundColor: "#FEF2F2",
  },
  comparisonRate: {
    fontSize: 10,
    color: colors.lightGray,
    marginBottom: 4,
  },
  comparisonAmount: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
  },
  comparisonAmountOld: {
    color: colors.bodyText,
  },
  comparisonAmountNew: {
    color: colors.danger,
  },
  comparisonPer: {
    fontSize: 10,
    color: colors.lightGray,
  },
  comparisonArrow: {
    justifyContent: "center",
    alignItems: "center",
  },
  comparisonDifference: {
    marginTop: 15,
    alignItems: "center",
  },
  comparisonDiffLabel: {
    fontSize: 9,
    color: colors.lightGray,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  comparisonDiffValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.danger,
  },

  // ============================================================================
  // PATH COMPARISON (Amortization)
  // ============================================================================
  pathContainer: {
    marginVertical: 20,
  },
  pathBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  pathBoxBank: {
    borderColor: colors.border,
    backgroundColor: colors.lightBg,
  },
  pathBoxUs: {
    borderColor: colors.success,
    backgroundColor: "#ECFDF5",
  },
  pathHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  pathLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  pathLabelBank: {
    color: colors.lightGray,
  },
  pathLabelUs: {
    color: colors.success,
  },
  pathStep: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 8,
  },
  pathStepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
    marginTop: 4,
  },
  pathStepText: {
    fontSize: 10,
    color: colors.bodyText,
  },
  pathResult: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  pathResultText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },

  // ============================================================================
  // VERIFICATION BOX - CODE BLOCK STYLE
  // ============================================================================
  verificationBox: {
    backgroundColor: colors.lightBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginVertical: 20,
    overflow: "hidden",
  },
  verificationHeader: {
    backgroundColor: colors.navy,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  verificationHeaderText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.white,
  },
  verificationCopyHint: {
    fontSize: 8,
    color: colors.gold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  verificationBody: {
    padding: 16,
  },
  verificationInstruction: {
    fontSize: 10,
    color: colors.bodyText,
    marginBottom: 10,
  },
  verificationPrompt: {
    fontFamily: "Courier",
    fontSize: 9,
    color: colors.darkText,
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
    lineHeight: 1.6,
  },

  // ============================================================================
  // DATA HIGHLIGHT / COST BOX
  // ============================================================================
  costHighlight: {
    backgroundColor: colors.cream,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: 8,
    padding: 24,
    marginVertical: 20,
    alignItems: "center",
  },
  costLabel: {
    fontSize: 10,
    color: colors.lightGray,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  costValue: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: colors.danger,
  },
  costSubtext: {
    fontSize: 10,
    color: colors.bodyText,
    marginTop: 4,
  },

  // ============================================================================
  // DEBT CONSOLIDATION TABLE
  // ============================================================================
  debtTable: {
    marginVertical: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  debtTableHeader: {
    flexDirection: "row",
    backgroundColor: colors.navy,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  debtTableHeaderCell: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.white,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  debtTableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  debtTableRowAlt: {
    backgroundColor: colors.lightBg,
  },
  debtTableTotal: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.cream,
  },
  debtTableCell: {
    fontSize: 10,
    color: colors.bodyText,
  },
  debtTableCellBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.darkText,
  },
  debtTableCellPrimary: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },

  // ============================================================================
  // ACTIVE MANAGEMENT STORY
  // ============================================================================
  storyBox: {
    backgroundColor: colors.warmWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 20,
    marginVertical: 15,
  },
  storyMoment: {
    marginBottom: 16,
  },
  storyYear: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 4,
  },
  storyAction: {
    fontSize: 10,
    color: colors.bodyText,
    lineHeight: 1.55,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
  },
  storyCallout: {
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
  },

  // ============================================================================
  // GUARANTEE PAGE - CERTIFICATE STYLE
  // ============================================================================
  guaranteeCertificate: {
    borderWidth: 3,
    borderColor: colors.gold,
    borderRadius: 12,
    padding: 30,
    marginVertical: 20,
    backgroundColor: colors.warmWhite,
    alignItems: "center",
  },
  guaranteeSeal: {
    marginBottom: 15,
  },
  guaranteeAmount: {
    fontSize: 48,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    marginBottom: 8,
  },
  guaranteeTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: colors.darkText,
    marginBottom: 12,
    textAlign: "center",
  },
  guaranteeText: {
    fontSize: 11,
    color: colors.bodyText,
    textAlign: "center",
    lineHeight: 1.6,
    maxWidth: 400,
  },

  // ============================================================================
  // WHAT HAPPENS NEXT - VISUAL STEPS
  // ============================================================================
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 30,
  },
  stepBox: {
    width: "30%",
    alignItems: "center",
  },
  stepCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  stepCircleNumber: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: colors.white,
  },
  stepConnector: {
    position: "absolute",
    top: 25,
    width: "20%",
    height: 2,
    backgroundColor: colors.primary,
  },
  stepConnectorLeft: {
    left: "35%",
  },
  stepConnectorRight: {
    right: "35%",
  },
  stepTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
    textAlign: "center",
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 9,
    color: colors.bodyText,
    textAlign: "center",
    lineHeight: 1.4,
  },

  // ============================================================================
  // CALLOUT BOXES
  // ============================================================================
  calloutBox: {
    backgroundColor: colors.warmWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 20,
    marginVertical: 15,
  },
  calloutHighlight: {
    backgroundColor: colors.lightBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    marginVertical: 15,
  },

  // ============================================================================
  // CTA BOX
  // ============================================================================
  ctaBox: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 24,
    marginTop: 20,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 12,
    color: colors.white,
    marginBottom: 6,
  },
  ctaLink: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.white,
  },

  // ============================================================================
  // CONTACT BOX
  // ============================================================================
  contactBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 20,
    marginTop: 20,
  },
  contactLabel: {
    fontSize: 9,
    color: colors.lightGray,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  contactName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.navy,
  },
  contactTitle: {
    fontSize: 10,
    color: colors.bodyText,
    marginBottom: 8,
  },
  contactDetail: {
    fontSize: 10,
    color: colors.bodyText,
    marginBottom: 2,
  },
  contactLink: {
    fontSize: 10,
    color: colors.primary,
    marginTop: 6,
  },

  // ============================================================================
  // ADVISOR SIGNATURE BOX
  // ============================================================================
  advisorBox: {
    backgroundColor: colors.lightBg,
    borderRadius: 8,
    padding: 20,
    marginTop: 20,
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function displayRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "N/A";
  return formatPercent(rate);
}

function displayCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "N/A";
  return formatCurrency(amount);
}

// ============================================================================
// PAGE HEADER COMPONENT
// ============================================================================
function PageHeader() {
  return (
    <View style={styles.pageHeader} fixed>
      <Text style={styles.pageHeaderLogo}>INSPIRED MORTGAGE</Text>
      <Text style={styles.pageHeaderLogo}>Post-Discovery Report</Text>
    </View>
  );
}

// ============================================================================
// PAGE FOOTER COMPONENT
// ============================================================================
function PageFooter({ pageNum }: { pageNum: number }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text style={styles.pageFooterText}>inspired.mortgage</Text>
      <Text style={styles.pageNumber}>{pageNum}</Text>
    </View>
  );
}

// ============================================================================
// CHECKMARK ICON
// ============================================================================
function CheckIcon({ color = colors.success }: { color?: string }) {
  return (
    <Svg width="14" height="14" viewBox="0 0 14 14">
      <Circle cx="7" cy="7" r="7" fill={color} />
      <Path d="M4 7 L6 9 L10 5" stroke="white" strokeWidth="1.5" fill="none" />
    </Svg>
  );
}

// ============================================================================
// ARROW ICON
// ============================================================================
function ArrowIcon() {
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24">
      <Path d="M8 4 L16 12 L8 20" stroke={colors.danger} strokeWidth="2" fill="none" />
    </Svg>
  );
}

// ============================================================================
// SEAL/BADGE ICON
// ============================================================================
function SealIcon() {
  return (
    <Svg width="60" height="60" viewBox="0 0 60 60">
      <Circle cx="30" cy="30" r="28" fill="none" stroke={colors.gold} strokeWidth="2" />
      <Circle cx="30" cy="30" r="22" fill={colors.gold} opacity="0.2" />
      <Path d="M20 30 L27 37 L42 22" stroke={colors.gold} strokeWidth="3" fill="none" />
    </Svg>
  );
}

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================
function SectionHeader({ children }: { children: string }) {
  return (
    <View>
      <Text style={styles.sectionHeader}>{children}</Text>
      <View style={styles.sectionHeaderUnderline} />
    </View>
  );
}

// ============================================================================
// COVER PAGE
// ============================================================================
function CoverPage({
  clientName,
  date,
  consultant,
}: {
  clientName: string;
  date: string;
  consultant: ConsultantInfo;
}) {
  const copy = REPORT_COPY.cover;
  return (
    <Page size="LETTER" style={styles.coverPage}>
      {/* Navy header band */}
      <View style={styles.coverHeaderBand}>
        <View style={styles.coverLogo}>
          <Text style={styles.coverLogoInspired}>inspired </Text>
          <Text style={styles.coverLogoMortgage}>mortgage.</Text>
        </View>
        <Text style={styles.coverTagline}>{copy.tagline}</Text>
      </View>

      {/* Main content */}
      <View style={styles.coverMain}>
        <Text style={styles.coverPreparedLabel}>{copy.preparedForLabel}</Text>
        <Text style={styles.coverClientName}>{clientName}</Text>
        <Text style={styles.coverDate}>{date}</Text>

        {/* Invitation box */}
        <View style={styles.coverInviteBox}>
          <Text style={styles.coverInviteText}>
            {copy.applicationNotice}
          </Text>
          {copy.benefits.map((benefit, i) => (
            <View key={i} style={styles.coverInviteBullet}>
              <View style={styles.coverInviteBulletIcon}>
                <CheckIcon color={colors.primary} />
              </View>
              <Text style={styles.coverInviteBulletText}>{benefit}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.coverNote}>
          {copy.readingTime}
        </Text>
        <Text style={[styles.coverNote, { marginTop: 8 }]}>
          {copy.readingEncouragement}
        </Text>
        <Text style={[styles.coverNote, { marginTop: 12, fontFamily: "Helvetica-Bold" }]}>
          {copy.closingLine}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.coverFooter}>
        <Text style={styles.coverAdvisorLabel}>{copy.advisorLabel}</Text>
        <Text style={styles.coverAdvisorName}>{consultant.name}</Text>
        <Text style={styles.coverAdvisorTitle}>{getAdvisorTitle(consultant.name)}, Inspired Mortgage</Text>
        {consultant.email && <Text style={styles.coverWebsite}>{consultant.email}</Text>}
        {consultant.phone && <Text style={styles.coverWebsite}>{consultant.phone}</Text>}
      </View>
    </Page>
  );
}

// ============================================================================
// WHAT YOU TOLD US PAGE
// ============================================================================
function WhatYouToldUsPages({ bullets, clientName, vars }: { bullets: string[]; clientName: string; vars: Record<string, string> }) {
  const copy = REPORT_COPY.whatYouToldUs;
  const introParagraphs = replaceAndSplit(copy.intro, vars);
  const outroParagraphs = replaceAndSplit(copy.outro, vars);

  return (
    <Page size="LETTER" style={styles.page}>
      <PageHeader />
      <SectionHeader>{copy.heading}</SectionHeader>

      {introParagraphs.map((p, i) => (
        <Text key={`intro-${i}`} style={styles.paragraph}>{p}</Text>
      ))}

      <View style={styles.bulletContainer}>
        {bullets.map((bullet, index) => (
          <View key={index} style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon color={colors.primary} />
            </View>
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>

      {outroParagraphs.map((p, i) => (
        <Text key={`outro-${i}`} style={[styles.paragraph, i === 0 ? { marginTop: 20 } : {}]}>{p}</Text>
      ))}

      <PageFooter pageNum={2} />
    </Page>
  );
}

// ============================================================================
// SCENARIO 1: SUB-2% FIXED -> RENEWAL TRAP (Uses REPORT_COPY)
// ============================================================================
function Scenario1Pages({ data, vars }: { data: ExtractedData; vars: Record<string, string> }) {
  const copy = REPORT_COPY.scenarios.scenario1;
  return (
    <>
      <Page size="LETTER" style={styles.page}>
        <PageHeader />
        <SectionHeader>{copy.heading}</SectionHeader>

        {replaceAndSplit(copy.intro, vars).map((p, i) => (
          <Text key={`s1i-${i}`} style={i === 0 ? styles.paragraph : styles.paragraphBold}>{p}</Text>
        ))}

        {replaceAndSplit(copy.amortizationContext, vars).map((p, i) => (
          <Text key={`s1a-${i}`} style={styles.paragraph}>{p}</Text>
        ))}

        {/* Payment Comparison Visual */}
        <View style={styles.comparisonContainer}>
          <Text style={styles.comparisonLabel}>Your Payment Change</Text>
          <View style={styles.comparisonRow}>
            <View style={[styles.comparisonBox, styles.comparisonBoxOld]}>
              <Text style={styles.comparisonRate}>at {displayRate(data.previousRate)}</Text>
              <Text style={[styles.comparisonAmount, styles.comparisonAmountOld]}>
                {displayCurrency(data.oldPayment)}
              </Text>
              <Text style={styles.comparisonPer}>per month</Text>
            </View>
            <View style={styles.comparisonArrow}>
              <ArrowIcon />
            </View>
            <View style={[styles.comparisonBox, styles.comparisonBoxNew]}>
              <Text style={styles.comparisonRate}>at {displayRate(data.currentMarketRate)}</Text>
              <Text style={[styles.comparisonAmount, styles.comparisonAmountNew]}>
                {displayCurrency(data.newPayment)}
              </Text>
              <Text style={styles.comparisonPer}>per month</Text>
            </View>
          </View>
          <View style={styles.comparisonDifference}>
            <Text style={styles.comparisonDiffLabel}>Monthly Increase</Text>
            <Text style={styles.comparisonDiffValue}>+{displayCurrency(data.paymentDifference)}</Text>
          </View>
        </View>

        {replaceAndSplit(copy.bankSolution, vars).map((p, i) => (
          <Text key={`s1b-${i}`} style={i === 1 ? styles.paragraphBold : styles.paragraph}>{p}</Text>
        ))}

        {/* Impact Statement */}
        <View style={styles.impactBox}>
          {copy.impactHeading.split('. ').filter(s => s.trim()).map((line, i) => (
            <Text key={`impact-${i}`} style={styles.impactText}>{line.endsWith('.') ? line : `${line}.`}</Text>
          ))}
          <Text style={styles.impactSubtext}>
            {displayCurrency(data.fiveYearsOfPayments)} out of your pocket — still {data.currentAmortization || 20} years remaining
          </Text>
        </View>

        <PageFooter pageNum={3} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <PageHeader />

        {replaceAndSplit(copy.impactDetail, vars).map((p, i) => (
          <Text key={`s1d-${i}`} style={styles.paragraph}>{p}</Text>
        ))}

        {replaceAndSplit(copy.transitionToSolution, vars).map((p, i) => (
          <Text key={`s1t-${i}`} style={styles.paragraph}>{p}</Text>
        ))}

        <Text style={styles.sectionTitle}>{copy.activeManagement.heading}</Text>

        {replaceAndSplit(copy.activeManagement.intro, vars).map((p, i) => (
          <Text key={`s1ami-${i}`} style={styles.paragraph}>{p}</Text>
        ))}

        <View style={styles.storyBox}>
          {copy.activeManagement.timeline.map((item, i) => (
            <View key={`tl-${i}`} style={i < copy.activeManagement.timeline.length - 1 ? styles.storyMoment : [styles.storyMoment, { marginBottom: 0 }]}>
              <Text style={styles.storyYear}>{item.year}</Text>
              <Text style={styles.storyAction}>{item.action}</Text>
            </View>
          ))}
        </View>

        {replaceAndSplit(copy.activeManagement.summary, vars).map((p, i) => (
          <Text key={`s1sum-${i}`} style={styles.paragraph}>{p}</Text>
        ))}

        {replaceAndSplit(copy.activeManagement.empathy, vars).map((p, i, arr) => (
          <Text key={`s1emp-${i}`} style={i === arr.length - 1 ? styles.paragraphBold : styles.paragraph}>{p}</Text>
        ))}

        <PageFooter pageNum={4} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <PageHeader />

        <Text style={styles.sectionTitle}>{copy.whatWeLookFor.heading}</Text>

        {replaceAndSplit(copy.whatWeLookFor.intro, vars).map((p, i) => (
          <Text key={`s1wli-${i}`} style={styles.paragraph}>{p}</Text>
        ))}

        <View style={styles.bulletContainer}>
          {copy.whatWeLookFor.items.map((item, i) => (
            <View key={`s1item-${i}`} style={styles.bulletRow}>
              <View style={styles.bulletIcon}>
                <CheckIcon />
              </View>
              <Text style={styles.bulletText}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{item.title}:</Text> {replaceVariables(item.body, vars)}
              </Text>
            </View>
          ))}
        </View>

        <Text style={[styles.paragraph, { fontFamily: "Helvetica-Oblique", marginTop: 15 }]}>
          {replaceVariables(copy.whatWeLookFor.closing, vars)}
        </Text>

        {/* What Could Happen With Active Management */}
        <Text style={styles.sectionTitle}>{copy.outcome.heading}</Text>
        {replaceAndSplit(copy.outcome.body, vars).map((p, i) => (
          <Text key={`s1out-${i}`} style={styles.paragraph}>{p}</Text>
        ))}

        {/* Verification Box */}
        <View style={styles.verificationBox}>
          <View style={styles.verificationHeader}>
            <Text style={styles.verificationHeaderText}>{copy.verificationBox.heading}</Text>
            <Text style={styles.verificationCopyHint}>COPY & PASTE</Text>
          </View>
          <View style={styles.verificationBody}>
            <Text style={styles.verificationInstruction}>
              {copy.verificationBox.instruction}
            </Text>
            <Text style={styles.verificationPrompt}>
              {copy.verificationBox.prompt}
            </Text>
          </View>
        </View>

        <PageFooter pageNum={5} />
      </Page>
    </>
  );
}

// ============================================================================
// SCENARIO 2: VARIABLE -> PANIC LOCK (Uses REPORT_COPY)
// ============================================================================
function Scenario2Pages({ data, vars }: { data: ExtractedData; vars: Record<string, string> }) {
  const copy = REPORT_COPY.scenarios.scenario2;
  return (
    <>
      <Page size="LETTER" style={styles.page}>
        <PageHeader />
        <SectionHeader>{copy.heading}</SectionHeader>

        {replaceAndSplit(copy.intro, vars).map((p, i, arr) => (
          <Text key={`s2i-${i}`} style={i === arr.length - 1 ? styles.paragraphBold : styles.paragraph}>{p}</Text>
        ))}

        {/* Cost Highlight */}
        <View style={styles.costHighlight}>
          <Text style={styles.costLabel}>{copy.costHighlight.label}</Text>
          <Text style={styles.costValue}>{displayCurrency(data.estimatedExtraInterest)}</Text>
          <Text style={styles.costSubtext}>{copy.costHighlight.subtext}</Text>
        </View>

        {replaceAndSplit(copy.costExplanation, vars).map((p, i) => (
          <Text key={`s2c-${i}`} style={styles.paragraph}>{p}</Text>
        ))}

        <PageFooter pageNum={3} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <PageHeader />

        {replaceAndSplit(copy.empathy, vars).map((p, i) => (
          <Text key={`s2e-${i}`} style={i === 0 ? styles.paragraphBold : styles.paragraph}>{p}</Text>
        ))}

        <Text style={styles.sectionTitle}>{copy.futureRisk.heading}</Text>

        {replaceAndSplit(copy.futureRisk.body, vars).map((p, i) => (
          <Text key={`s2f-${i}`} style={styles.paragraph}>{p}</Text>
        ))}

        {/* Verification Box */}
        <View style={styles.verificationBox}>
          <View style={styles.verificationHeader}>
            <Text style={styles.verificationHeaderText}>{copy.verificationBox.heading}</Text>
            <Text style={styles.verificationCopyHint}>COPY & PASTE</Text>
          </View>
          <View style={styles.verificationBody}>
            <Text style={styles.verificationInstruction}>
              {copy.verificationBox.instruction}
            </Text>
            <Text style={styles.verificationPrompt}>
              {copy.verificationBox.prompt}
            </Text>
          </View>
        </View>

        <PageFooter pageNum={4} />
      </Page>
    </>
  );
}

// ============================================================================
// SCENARIO 3: FIXED PAYMENT VARIABLE -> NEGATIVE AMORTIZATION (Uses REPORT_COPY)
// ============================================================================
function Scenario3Pages({ data, vars }: { data: ExtractedData; vars: Record<string, string> }) {
  const copy = REPORT_COPY.scenarios.scenario3;
  return (
    <>
      <Page size="LETTER" style={styles.page}>
        <PageHeader />
        <SectionHeader>{copy.heading}</SectionHeader>

        {replaceAndSplit(copy.intro, vars).map((p, i) => (
          <Text key={`s3i-${i}`} style={styles.paragraph}>{p}</Text>
        ))}

        <Text style={styles.sectionTitle}>{copy.explanation.heading}</Text>

        {replaceAndSplit(copy.explanation.body, vars).map((p, i) => (
          <Text key={`s3x-${i}`} style={styles.paragraph}>{p}</Text>
        ))}

        {/* Impact Box */}
        <View style={styles.impactBox}>
          <Text style={styles.impactText}>You made every payment.</Text>
          <Text style={styles.impactText}>You now owe more than before.</Text>
          <Text style={styles.impactSubtext}>
            Amortization extended from {data.originalAmortization || 25} to {data.currentAmortization || 26} years
          </Text>
        </View>

        <PageFooter pageNum={3} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <PageHeader />

        <Text style={styles.sectionTitle}>{copy.empathy.heading}</Text>

        {replaceAndSplit(copy.empathy.body, vars).map((p, i) => (
          <Text key={`s3e-${i}`} style={styles.paragraph}>{p}</Text>
        ))}

        <Text style={styles.sectionTitle}>{copy.futureRisk.heading}</Text>

        {replaceAndSplit(copy.futureRisk.body, vars).map((p, i, arr) => (
          <Text key={`s3f-${i}`} style={i === arr.length - 1 ? styles.paragraphBold : styles.paragraph}>{p}</Text>
        ))}

        {/* Verification Box */}
        <View style={styles.verificationBox}>
          <View style={styles.verificationHeader}>
            <Text style={styles.verificationHeaderText}>{copy.verificationBox.heading}</Text>
            <Text style={styles.verificationCopyHint}>COPY & PASTE</Text>
          </View>
          <View style={styles.verificationBody}>
            <Text style={styles.verificationInstruction}>
              {copy.verificationBox.instruction}
            </Text>
            <Text style={styles.verificationPrompt}>
              {copy.verificationBox.prompt}
            </Text>
          </View>
        </View>

        <PageFooter pageNum={4} />
      </Page>
    </>
  );
}

// ============================================================================
// DEBT CONSOLIDATION PAGE (Uses REPORT_COPY)
// ============================================================================
function DebtConsolidationPage() {
  const copy = REPORT_COPY.debtConsolidation;
  return (
    <Page size="LETTER" style={styles.page}>
      <PageHeader />
      <SectionHeader>{copy.heading}</SectionHeader>

      {copy.intro.split(/\n\n+/).filter(p => p.trim()).map((p, i) => (
        <Text key={`dci-${i}`} style={styles.paragraph}>{p}</Text>
      ))}

      <Text style={styles.sectionTitle}>{copy.example.heading}</Text>

      {copy.example.setup.split(/\n\n+/).filter(p => p.trim()).map((p, i) => (
        <Text key={`dcs-${i}`} style={styles.paragraph}>{p}</Text>
      ))}

      {/* Debt Table — Example from approved copy */}
      <View style={styles.debtTable}>
        <View style={styles.debtTableHeader}>
          <Text style={[styles.debtTableHeaderCell, { width: "45%" }]}>DEBT</Text>
          <Text style={[styles.debtTableHeaderCell, { width: "27.5%", textAlign: "right" }]}>BALANCE</Text>
          <Text style={[styles.debtTableHeaderCell, { width: "27.5%", textAlign: "right" }]}>PAYMENT</Text>
        </View>
        <View style={styles.debtTableRow}>
          <Text style={[styles.debtTableCell, { width: "45%" }]}>Mortgage</Text>
          <Text style={[styles.debtTableCell, { width: "27.5%", textAlign: "right" }]}>$215,000</Text>
          <Text style={[styles.debtTableCell, { width: "27.5%", textAlign: "right" }]}>$1,200/mo</Text>
        </View>
        {copy.example.debts.map((debt, i) => (
          <View key={`debt-${i}`} style={[styles.debtTableRow, i % 2 === 0 ? styles.debtTableRowAlt : {}]}>
            <Text style={[styles.debtTableCell, { width: "45%" }]}>{debt.type}</Text>
            <Text style={[styles.debtTableCell, { width: "27.5%", textAlign: "right" }]}>${debt.balance.toLocaleString()}</Text>
            <Text style={[styles.debtTableCell, { width: "27.5%", textAlign: "right" }]}>${debt.payment.toLocaleString()}/mo</Text>
          </View>
        ))}
        <View style={styles.debtTableTotal}>
          <Text style={[styles.debtTableCellBold, { width: "45%" }]}>TOTAL</Text>
          <Text style={[styles.debtTableCellBold, { width: "27.5%", textAlign: "right" }]}>$336,000</Text>
          <Text style={[styles.debtTableCellPrimary, { width: "27.5%", textAlign: "right" }]}>$3,205/mo</Text>
        </View>
      </View>

      <Text style={styles.paragraph}>{copy.example.totalOutflow}</Text>
      <Text style={styles.paragraph}>{copy.example.bankPath}</Text>

      <Text style={styles.sectionTitle}>{copy.solution.heading}</Text>
      <Text style={styles.paragraph}>{copy.solution.body}</Text>

      <View style={styles.impactBox}>
        {copy.solution.impactLine.split('. ').filter(s => s.trim()).map((line, i) => (
          <Text key={`dcimp-${i}`} style={styles.impactText}>{line.endsWith('.') ? line : `${line}.`}</Text>
        ))}
      </View>

      <Text style={[styles.paragraph, { fontFamily: "Helvetica-Oblique" }]}>{copy.solution.clientReaction}</Text>

      <Text style={styles.sectionTitle}>{copy.noteOnIncreasingMortgage.heading}</Text>
      {copy.noteOnIncreasingMortgage.body.split(/\n\n+/).filter(p => p.trim()).map((p, i) => (
        <Text key={`dcn-${i}`} style={styles.paragraph}>{p}</Text>
      ))}

      <PageFooter pageNum={6} />
    </Page>
  );
}

// ============================================================================
// OUR APPROACH (Uses approved copy from REPORT_COPY)
// ============================================================================
function OurApproachPage({ consultant, vars }: { consultant: ConsultantInfo; vars: Record<string, string> }) {
  const copy = REPORT_COPY.ourApproach;
  return (
    <Page size="LETTER" style={styles.page}>
      <PageHeader />
      <SectionHeader>{copy.heading}</SectionHeader>

      {replaceAndSplit(copy.intro, vars).map((p, i) => (
        <Text key={i} style={styles.paragraph}>{p}</Text>
      ))}

      <Text style={styles.sectionTitle}>{copy.differentiators.heading}</Text>

      <View style={styles.bulletContainer}>
        {copy.differentiators.items.map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{item.title}</Text> {item.body}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.paragraph}>{copy.closing}</Text>

      <View style={styles.calloutBox}>
        <Text style={[styles.paragraph, { fontFamily: "Helvetica-Bold", marginBottom: 8 }]}>
          {copy.promise.heading}
        </Text>
        <Text style={styles.paragraph}>{copy.promise.body}</Text>
      </View>

      <View style={styles.advisorBox}>
        <Text style={styles.contactName}>{consultant.name}</Text>
        <Text style={styles.contactTitle}>
          {getAdvisorTitle(consultant.name)}, Inspired Mortgage
        </Text>
      </View>

      <PageFooter pageNum={0} />
    </Page>
  );
}

// ============================================================================
// APPLICATION LINK BLOCK
// ============================================================================
function ApplicationLinkBlock({ applicationLink, message }: { applicationLink: string; message?: string }) {
  const defaultMessage = "Ready to see which strategies fit your situation? Complete your application and we'll build your personalized Lender Comparison Report.";
  return (
    <View style={{ marginVertical: 20 }}>
      <View style={styles.ctaBox}>
        <Text style={styles.ctaText}>{message || defaultMessage}</Text>
        <Link src={applicationLink}>
          <Text style={styles.ctaLink}>Start Your Application →</Text>
        </Link>
      </View>
    </View>
  );
}

// ============================================================================
// FULL CTA PAGE (After Scenario)
// ============================================================================
function CtaPageAfterScenario({ applicationLink }: { applicationLink: string }) {
  const copy = REPORT_COPY.ctaPages.afterScenario;
  return (
    <Page size="LETTER" style={styles.page}>
      <PageHeader />
      <SectionHeader>{copy.heading}</SectionHeader>

      <Text style={styles.paragraph}>{copy.message}</Text>

      <Text style={styles.sectionTitle}>{copy.subheading}</Text>
      <View style={styles.bulletContainer}>
        {copy.benefits.map((benefit, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon color={colors.primary} />
            </View>
            <Text style={styles.bulletText}>{benefit}</Text>
          </View>
        ))}
      </View>

      <View style={styles.ctaBox}>
        <Text style={[styles.ctaText, { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 }]}>
          Ready to See What&apos;s Possible?
        </Text>
        <Text style={[styles.ctaText, { fontSize: 10, marginBottom: 8 }]}>
          10-15 minutes · No credit impact · No obligation
        </Text>
        <Link src={applicationLink}>
          <Text style={styles.ctaLink}>Start Your Application →</Text>
        </Link>
      </View>

      <View style={[styles.calloutBox, { marginTop: 20 }]}>
        <Text style={[styles.paragraph, { fontFamily: "Helvetica-Bold", marginBottom: 6 }]}>
          {copy.reassurance.heading}
        </Text>
        <Text style={[styles.paragraph, { marginBottom: 0 }]}>{copy.reassurance.body}</Text>
      </View>

      <View style={[styles.calloutHighlight, { marginTop: 16 }]}>
        <Text style={[styles.paragraph, { fontFamily: "Helvetica-Bold", marginBottom: 6 }]}>
          {copy.urgency.heading}
        </Text>
        <Text style={[styles.paragraph, { marginBottom: 0 }]}>{copy.urgency.body}</Text>
      </View>

      <PageFooter pageNum={0} />
    </Page>
  );
}

// ============================================================================
// FULL CTA PAGE (After Guarantee)
// ============================================================================
function CtaPageAfterGuarantee({ applicationLink }: { applicationLink: string }) {
  const copy = REPORT_COPY.ctaPages.afterGuarantee;
  return (
    <Page size="LETTER" style={styles.page}>
      <PageHeader />
      <SectionHeader>{copy.heading}</SectionHeader>

      <Text style={styles.paragraph}>{copy.message}</Text>

      <Text style={styles.sectionTitle}>{copy.subheading}</Text>
      <View style={styles.bulletContainer}>
        {copy.benefits.map((benefit, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon color={colors.primary} />
            </View>
            <Text style={styles.bulletText}>{benefit}</Text>
          </View>
        ))}
      </View>

      <View style={styles.ctaBox}>
        <Text style={[styles.ctaText, { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 }]}>
          Ready to See What&apos;s Possible?
        </Text>
        <Text style={[styles.ctaText, { fontSize: 10, marginBottom: 8 }]}>
          10-15 minutes · No credit impact · No obligation
        </Text>
        <Link src={applicationLink}>
          <Text style={styles.ctaLink}>Start Your Application →</Text>
        </Link>
      </View>

      {/* Testimonial */}
      <View style={{ backgroundColor: colors.cream, borderLeftWidth: 4, borderLeftColor: colors.gold, borderRadius: 8, padding: 16, marginTop: 20 }}>
        <Text style={[styles.paragraph, { fontFamily: "Helvetica-Oblique", marginBottom: 6 }]}>
          {copy.testimonial.quote}
        </Text>
        <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: colors.lightGray }}>
          {copy.testimonial.attribution}
        </Text>
      </View>

      <View style={[styles.calloutBox, { marginTop: 16 }]}>
        <Text style={[styles.paragraph, { fontFamily: "Helvetica-Bold", marginBottom: 6 }]}>
          {copy.reassurance.heading}
        </Text>
        <Text style={[styles.paragraph, { marginBottom: 0 }]}>{copy.reassurance.body}</Text>
      </View>

      <PageFooter pageNum={0} />
    </Page>
  );
}

// ============================================================================
// $5,000 PENALTY GUARANTEE PAGE
// ============================================================================
function GuaranteePage() {
  const copy = REPORT_COPY.guarantee;
  return (
    <Page size="LETTER" style={styles.page}>
      <PageHeader />
      <SectionHeader>{copy.heading}</SectionHeader>

      {/* Certificate Style */}
      <View style={styles.guaranteeCertificate}>
        <View style={styles.guaranteeSeal}>
          <SealIcon />
        </View>
        <Text style={styles.guaranteeAmount}>{copy.certificate.amount}</Text>
        <Text style={styles.guaranteeTitle}>{copy.certificate.title}</Text>
        <Text style={styles.guaranteeText}>{copy.certificate.body}</Text>
        <Text style={[styles.guaranteeText, { marginTop: 8, fontFamily: "Helvetica-Bold" }]}>
          {copy.certificate.subtext}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>{copy.howItWorks.heading}</Text>

      <View style={styles.bulletContainer}>
        {copy.howItWorks.examples.map((example, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>{example}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.paragraph}>{copy.howItWorks.explanation}</Text>

      {/* Ask Your Bank Box */}
      <View style={styles.calloutHighlight}>
        <Text style={[styles.paragraph, { fontFamily: "Helvetica-Bold", marginBottom: 8 }]}>
          {copy.askYourBank.heading}
        </Text>
        <Text style={[styles.paragraph, { fontFamily: "Helvetica-Oblique" }]}>
          {copy.askYourBank.prompt}
        </Text>
        <Text style={[styles.paragraph, { fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 0 }]}>
          {copy.askYourBank.punchline}
        </Text>
      </View>

      <PageFooter pageNum={0} />
    </Page>
  );
}

// ============================================================================
// FIXED RATE STRATEGY PAGES (FULL REWRITE FROM APPROVED COPY)
// ============================================================================
function FixedRatePages() {
  const copy = REPORT_COPY.fixedRate;
  return (
    <>
      {/* Page 1: Intro + When + What We Do + Monthly Monitoring */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader />
        <SectionHeader>{copy.heading}</SectionHeader>

        <Text style={styles.paragraph}>{copy.intro}</Text>

        <Text style={styles.sectionTitle}>{copy.whenItMakesSense.heading}</Text>
        <View style={styles.bulletContainer}>
          {copy.whenItMakesSense.items.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bulletIcon}><CheckIcon /></View>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{copy.whatWeDoDifferently.heading}</Text>
        {replaceAndSplit(copy.whatWeDoDifferently.body, {}).map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        <Text style={styles.sectionTitle}>{copy.monthlyMonitoring.heading}</Text>
        {replaceAndSplit(copy.monthlyMonitoring.body, {}).map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        <PageFooter pageNum={0} />
      </Page>

      {/* Page 2: Strategic Relock + Borrower Comparison */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader />

        <Text style={styles.sectionTitle}>{copy.strategicRelock.heading}</Text>
        <Text style={styles.paragraph}>{copy.strategicRelock.body}</Text>
        <View style={styles.bulletContainer}>
          {copy.strategicRelock.steps.map((step, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bulletIcon}><CheckIcon /></View>
              <Text style={styles.bulletText}>{step}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.paragraph}>{copy.strategicRelock.closing}</Text>

        <Text style={styles.sectionTitle}>{copy.borrowerComparison.heading}</Text>
        <Text style={styles.paragraph}>{copy.borrowerComparison.intro}</Text>

        {/* Borrower A */}
        <View style={[styles.pathBox, styles.pathBoxBank, { marginTop: 12 }]}>
          <View style={styles.pathHeader}>
            <Text style={[styles.pathLabel, styles.pathLabelBank]}>{copy.borrowerComparison.borrowerA.label}</Text>
          </View>
          {copy.borrowerComparison.borrowerA.steps.map((step, i) => (
            <View key={i} style={styles.pathStep}>
              <View style={[styles.pathStepDot, { backgroundColor: colors.lightGray }]} />
              <Text style={styles.pathStepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Borrower B */}
        <View style={[styles.pathBox, styles.pathBoxUs]}>
          <View style={styles.pathHeader}>
            <Text style={[styles.pathLabel, styles.pathLabelUs]}>{copy.borrowerComparison.borrowerB.label}</Text>
          </View>
          {copy.borrowerComparison.borrowerB.steps.map((step, i) => (
            <View key={i} style={styles.pathStep}>
              <View style={[styles.pathStepDot, { backgroundColor: colors.success }]} />
              <Text style={styles.pathStepText}>{step}</Text>
            </View>
          ))}
        </View>

        <PageFooter pageNum={0} />
      </Page>

      {/* Page 3: The Difference + Ask Your Bank */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader />

        <View style={styles.impactBox}>
          <Text style={styles.impactText}>{copy.borrowerComparison.result.heading}</Text>
        </View>

        {replaceAndSplit(copy.borrowerComparison.result.body, {}).map((p, i) => (
          <Text key={i} style={[styles.paragraph, i === 0 ? { fontFamily: "Helvetica-Bold" } : {}]}>{p}</Text>
        ))}

        <Text style={styles.sectionTitle}>Ask Your Bank</Text>
        <View style={styles.calloutHighlight}>
          {replaceAndSplit(copy.askYourBank, {}).map((p, i) => (
            <Text key={i} style={[styles.paragraph, { fontFamily: i === 0 ? "Helvetica-Oblique" : "Helvetica-Bold", marginBottom: i === 0 ? 8 : 0 }]}>{p}</Text>
          ))}
        </View>

        <PageFooter pageNum={0} />
      </Page>
    </>
  );
}

// ============================================================================
// VARIABLE RATE STRATEGY PAGES (FULL REWRITE FROM APPROVED COPY)
// ============================================================================
function VariableRatePages({ vars }: { vars: Record<string, string> }) {
  const copy = REPORT_COPY.variableRate;
  return (
    <>
      {/* Page 1: Intro + When + What We Do + Strategy + How It Plays Out */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader />
        <SectionHeader>{copy.heading}</SectionHeader>

        {replaceAndSplit(copy.intro, vars).map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        <Text style={styles.sectionTitle}>{copy.whenItMakesSense.heading}</Text>
        <View style={styles.bulletContainer}>
          {copy.whenItMakesSense.items.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bulletIcon}><CheckIcon /></View>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{copy.whatWeDoDifferently.heading}</Text>
        <Text style={styles.paragraph}>{replaceVariables(copy.whatWeDoDifferently.body, vars)}</Text>

        <Text style={styles.sectionTitle}>{copy.strategy.heading}</Text>
        <Text style={styles.paragraph}>{replaceVariables(copy.strategy.body, vars)}</Text>

        <PageFooter pageNum={0} />
      </Page>

      {/* Page 2: How It Plays Out + Danger of Going It Alone */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader />

        <Text style={styles.sectionTitle}>{copy.howItPlaysOut.heading}</Text>
        {replaceAndSplit(copy.howItPlaysOut.body, vars).map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        <Text style={styles.sectionTitle}>{copy.dangerOfGoingItAlone.heading}</Text>
        {replaceAndSplit(copy.dangerOfGoingItAlone.body, vars).map((p, i) => (
          <Text key={i} style={[styles.paragraph, { fontSize: i >= 5 ? 10 : 11 }]}>{p}</Text>
        ))}

        <PageFooter pageNum={0} />
      </Page>
    </>
  );
}

// ============================================================================
// CASH BACK STRATEGY PAGES (NEW — FROM APPROVED COPY)
// ============================================================================
function CashBackPages({ vars }: { vars: Record<string, string> }) {
  const copy = REPORT_COPY.cashBack;
  return (
    <>
      {/* Page 1: Intro + When + What We Do + True Story */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader />
        <SectionHeader>{copy.heading}</SectionHeader>

        {replaceAndSplit(copy.intro, vars).map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        <Text style={styles.sectionTitle}>{copy.whenItMakesSense.heading}</Text>
        <View style={styles.bulletContainer}>
          {copy.whenItMakesSense.items.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bulletIcon}><CheckIcon /></View>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{copy.whatWeDoDifferently.heading}</Text>
        {replaceAndSplit(copy.whatWeDoDifferently.body, vars).map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        <Text style={styles.sectionTitle}>{copy.trueStory.heading}</Text>
        {replaceAndSplit(copy.trueStory.body, vars).map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        <PageFooter pageNum={0} />
      </Page>

      {/* Page 2: Math + Outcome + Verification + How It Could Work */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader />

        <Text style={styles.sectionTitle}>{copy.trueStory.math.heading}</Text>
        <View style={styles.bulletContainer}>
          {copy.trueStory.math.lines.map((line, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bulletIcon}><CheckIcon /></View>
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}
        </View>

        {replaceAndSplit(copy.trueStory.outcome, vars).map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        {/* Verification Box */}
        <View style={styles.verificationBox}>
          <View style={styles.verificationHeader}>
            <Text style={styles.verificationHeaderText}>{copy.verificationBox.heading}</Text>
            <Text style={styles.verificationCopyHint}>COPY & PASTE</Text>
          </View>
          <View style={styles.verificationBody}>
            <Text style={styles.verificationInstruction}>{copy.verificationBox.instruction}</Text>
            <Text style={styles.verificationPrompt}>{copy.verificationBox.prompt}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{copy.howItCouldWork.heading}</Text>
        {replaceAndSplit(copy.howItCouldWork.body, vars).map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        <PageFooter pageNum={0} />
      </Page>
    </>
  );
}

// ============================================================================
// WHAT HAPPENS NEXT PAGE
// ============================================================================
function WhatHappensNextPage({ consultant, applicationLink, vars }: { consultant: ConsultantInfo; applicationLink: string; vars: Record<string, string> }) {
  const copy = REPORT_COPY.whatHappensNext;
  return (
    <Page size="LETTER" style={styles.page}>
      <PageHeader />
      <SectionHeader>{copy.heading}</SectionHeader>

      {/* Visual Steps */}
      <View style={styles.stepsRow}>
        {copy.steps.map((step) => (
          <View key={step.number} style={styles.stepBox}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepCircleNumber}>{step.number}</Text>
            </View>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDesc}>{step.description}</Text>
          </View>
        ))}
      </View>

      {/* CTA Box with application link */}
      <View style={styles.ctaBox}>
        <Text style={styles.ctaText}>{copy.ctaBox.heading}</Text>
        <Link src={applicationLink}>
          <Text style={styles.ctaLink}>Start Your Application →</Text>
        </Link>
      </View>

      {/* Advisor Contact */}
      <View style={styles.contactBox}>
        <Text style={styles.contactLabel}>{copy.advisorBlock.label}</Text>
        <Text style={styles.contactName}>{consultant.name}</Text>
        <Text style={styles.contactTitle}>{getAdvisorTitle(consultant.name)}, Inspired Mortgage</Text>
        <Text style={styles.contactDetail}>{consultant.email}</Text>
        {consultant.phone && (
          <Text style={styles.contactDetail}>{consultant.phone}</Text>
        )}
        {consultant.calLink && (
          <Text style={styles.contactLink}>Book a call: {consultant.calLink}</Text>
        )}
      </View>

      <PageFooter pageNum={0} />
    </Page>
  );
}

// ============================================================================
// MAIN PDF DOCUMENT
// ============================================================================
export function ReportPDFDocument({
  clientName,
  date,
  consultant,
  bullets,
  scenario,
  includeDebtConsolidation,
  includeCashBack,
  applicationLink,
  extractedData,
}: ReportPDFProps) {
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

  // Narrow scenario to valid scenario number (1, 2, or 3) or null
  const activeScenario: 1 | 2 | 3 | null = (scenario === 1 || scenario === 2 || scenario === 3) ? scenario : null;

  return (
    <Document>
      {/* 1. Cover Page */}
      <CoverPage clientName={clientName} date={date} consultant={consultant} />

      {/* 2. What You Told Us */}
      <WhatYouToldUsPages bullets={bullets} clientName={clientName} vars={vars} />

      {/* 3. Scenario (if selected, skip if "None"/0/null) */}
      {activeScenario === 1 && <Scenario1Pages data={extractedData} vars={vars} />}
      {activeScenario === 2 && <Scenario2Pages data={extractedData} vars={vars} />}
      {activeScenario === 3 && <Scenario3Pages data={extractedData} vars={vars} />}

      {/* APP LINK #1: After scenario (or after What You Told Us if no scenario) */}
      <CtaPageAfterScenario applicationLink={applicationLink} />

      {/* 4. Debt Consolidation (if checkbox selected) */}
      {includeDebtConsolidation && <DebtConsolidationPage />}

      {/* 5. Our Approach */}
      <OurApproachPage consultant={consultant} vars={vars} />

      {/* 6. $5,000 Penalty Guarantee */}
      <GuaranteePage />

      {/* APP LINK #2: After $5,000 Guarantee */}
      <CtaPageAfterGuarantee applicationLink={applicationLink} />

      {/* 7. Strategy: Fixed Rate Mortgage */}
      <FixedRatePages />

      {/* 8. Strategy: Variable Rate Mortgage */}
      <VariableRatePages vars={vars} />

      {/* 9. Strategy: Cash Back Mortgage (if checkbox selected) */}
      {includeCashBack && <CashBackPages vars={vars} />}

      {/* 10. What Happens Next (CTA) — APP LINK #3 */}
      <WhatHappensNextPage consultant={consultant} applicationLink={applicationLink} vars={vars} />
    </Document>
  );
}
