"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  Line,
  Circle,
  Path,
} from "@react-pdf/renderer";
import { formatCurrency, formatPercent } from "@/lib/mortgage-calculations";

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
  scenario: 1 | 2 | 3;
  includeDebtConsolidation: boolean;
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
  return (
    <Page size="LETTER" style={styles.coverPage}>
      {/* Navy header band */}
      <View style={styles.coverHeaderBand}>
        <View style={styles.coverLogo}>
          <Text style={styles.coverLogoInspired}>inspired </Text>
          <Text style={styles.coverLogoMortgage}>mortgage.</Text>
        </View>
        <Text style={styles.coverTagline}>See lenders compete for your business</Text>
      </View>

      {/* Main content */}
      <View style={styles.coverMain}>
        <Text style={styles.coverPreparedLabel}>Prepared for</Text>
        <Text style={styles.coverClientName}>{clientName}</Text>
        <Text style={styles.coverDate}>{date}</Text>

        {/* Invitation box */}
        <View style={styles.coverInviteBox}>
          <Text style={styles.coverInviteTitle}>
            Your Personalized Mortgage Strategy
          </Text>
          <Text style={styles.coverInviteText}>
            The application isn&apos;t a commitment—it&apos;s how we get lenders to compete for your business. Complete your application and receive a personalized Lender Comparison Report showing:
          </Text>
          <View style={styles.coverInviteBullet}>
            <View style={styles.coverInviteBulletIcon}>
              <CheckIcon color={colors.primary} />
            </View>
            <Text style={styles.coverInviteBulletText}>
              Strategy options designed around where markets are heading
            </Text>
          </View>
          <View style={styles.coverInviteBullet}>
            <View style={styles.coverInviteBulletIcon}>
              <CheckIcon color={colors.primary} />
            </View>
            <Text style={styles.coverInviteBulletText}>
              A clear recommendation based on your goals and risk tolerance
            </Text>
          </View>
          <View style={styles.coverInviteBullet}>
            <View style={styles.coverInviteBulletIcon}>
              <CheckIcon color={colors.primary} />
            </View>
            <Text style={styles.coverInviteBulletText}>
              A side-by-side comparison to any offer you&apos;ve already received
            </Text>
          </View>
        </View>

        <Text style={styles.coverNote}>
          This report takes about 10 minutes to read. The decisions ahead—rate type, lender, timing—will impact your finances for years. This document was built specifically for your situation.
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.coverFooter}>
        <Text style={styles.coverAdvisorLabel}>Your Advisor</Text>
        <Text style={styles.coverAdvisorName}>{consultant.name}</Text>
        <Text style={styles.coverAdvisorTitle}>Mortgage Advisor, Inspired Mortgage</Text>
        <Text style={styles.coverWebsite}>inspired.mortgage</Text>
      </View>
    </Page>
  );
}

// ============================================================================
// WHAT YOU TOLD US PAGE
// ============================================================================
function WhatYouToldUsPages({ bullets }: { bullets: string[] }) {
  return (
    <Page size="LETTER" style={styles.page}>
      <PageHeader />
      <SectionHeader>What You Told Us</SectionHeader>

      <Text style={styles.paragraph}>
        During our discovery call, you shared the following about your situation and goals:
      </Text>

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

      <Text style={[styles.paragraph, { marginTop: 20 }]}>
        We&apos;ve designed your mortgage strategy based on these goals. The following pages explain what happened on your last term and how we can help you move forward differently.
      </Text>

      <PageFooter pageNum={2} />
    </Page>
  );
}

// ============================================================================
// SCENARIO 1: SUB-2% FIXED -> RENEWAL TRAP
// ============================================================================
function Scenario1Pages({ data }: { data: ExtractedData }) {
  return (
    <>
      <Page size="LETTER" style={styles.page}>
        <PageHeader />
        <SectionHeader>What Happened on Your Last Term</SectionHeader>

        <Text style={styles.paragraph}>
          Here&apos;s the thing: your last term was actually great. You locked in at {displayRate(data.previousRate)}—one of the lowest fixed rates in Canadian history. Your payments were predictable. Your principal was dropping steadily. You did everything right.
        </Text>

        <Text style={styles.paragraphBold}>
          The problem isn&apos;t what happened. The problem is what&apos;s about to happen.
        </Text>

        <Text style={styles.paragraph}>
          You started with a {data.originalAmortization || 25}-year amortization. After five years of payments, you&apos;re now at {data.currentAmortization || 20} years remaining. You made real progress.
        </Text>

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

        <Text style={styles.paragraph}>
          For most people, that&apos;s not manageable. So the bank offers a simple solution: add 5 years back onto your amortization. Payment problem solved.
        </Text>

        <Text style={styles.paragraphBold}>Except here&apos;s what that actually means:</Text>

        {/* Impact Statement */}
        <View style={styles.impactBox}>
          <Text style={styles.impactText}>Five years of payments.</Text>
          <Text style={styles.impactText}>Zero progress.</Text>
          <Text style={styles.impactSubtext}>
            {displayCurrency(data.fiveYearsOfPayments)} out of your pocket — still {data.currentAmortization || 20} years remaining
          </Text>
        </View>

        <PageFooter pageNum={3} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <PageHeader />

        <Text style={styles.sectionTitle}>Two Different Paths Forward</Text>

        {/* Path Comparison */}
        <View style={styles.pathContainer}>
          <View style={[styles.pathBox, styles.pathBoxBank]}>
            <View style={styles.pathHeader}>
              <Text style={[styles.pathLabel, styles.pathLabelBank]}>PATH A: What Your Bank Offers</Text>
            </View>
            <View style={styles.pathStep}>
              <View style={[styles.pathStepDot, { backgroundColor: colors.lightGray }]} />
              <Text style={styles.pathStepText}>Today: {data.currentAmortization || 20} years remaining</Text>
            </View>
            <View style={styles.pathStep}>
              <View style={[styles.pathStepDot, { backgroundColor: colors.lightGray }]} />
              <Text style={styles.pathStepText}>Extend amortization to afford payments</Text>
            </View>
            <View style={styles.pathStep}>
              <View style={[styles.pathStepDot, { backgroundColor: colors.lightGray }]} />
              <Text style={styles.pathStepText}>Year 5: Still {data.currentAmortization || 20} years remaining</Text>
            </View>
            <View style={styles.pathResult}>
              <Text style={[styles.pathResultText, { color: colors.danger }]}>
                → 5 years of payments, 0 years of progress
              </Text>
            </View>
          </View>

          <View style={[styles.pathBox, styles.pathBoxUs]}>
            <View style={styles.pathHeader}>
              <Text style={[styles.pathLabel, styles.pathLabelUs]}>PATH B: Active Management</Text>
            </View>
            <View style={styles.pathStep}>
              <View style={[styles.pathStepDot, { backgroundColor: colors.success }]} />
              <Text style={styles.pathStepText}>Today: {data.currentAmortization || 20} years remaining</Text>
            </View>
            <View style={styles.pathStep}>
              <View style={[styles.pathStepDot, { backgroundColor: colors.success }]} />
              <Text style={styles.pathStepText}>Strategic rate management + cash flow optimization</Text>
            </View>
            <View style={styles.pathStep}>
              <View style={[styles.pathStepDot, { backgroundColor: colors.success }]} />
              <Text style={styles.pathStepText}>Year 5: {(data.currentAmortization || 20) - 5} years remaining</Text>
            </View>
            <View style={styles.pathResult}>
              <Text style={[styles.pathResultText, { color: colors.success }]}>
                → On track to finish ahead of schedule
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>What Active Management Looks Like</Text>

        <View style={styles.storyBox}>
          <View style={styles.storyMoment}>
            <Text style={styles.storyYear}>End of Year One</Text>
            <Text style={styles.storyAction}>
              Rates have climbed to 2.9%. <Text style={styles.storyCallout}>We call you.</Text> &quot;Consider bumping your payment up as if your rate was 2.9%. You won&apos;t feel much difference now, but you&apos;ll thank yourself at renewal.&quot;
            </Text>
          </View>
          <View style={[styles.storyMoment, { marginBottom: 0 }]}>
            <Text style={styles.storyYear}>End of Year Two</Text>
            <Text style={styles.storyAction}>
              Rates hit 3.8%. <Text style={styles.storyCallout}>Another call. Another small increase.</Text> By renewal, your payments have already adjusted gradually—no shock, no scramble.
            </Text>
          </View>
        </View>

        <Text style={styles.paragraphBold}>
          Nobody did that for you last time. We will this time.
        </Text>

        <PageFooter pageNum={4} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <PageHeader />

        <Text style={styles.sectionTitle}>What We Look For</Text>

        <View style={styles.bulletContainer}>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Rate optimization:</Text> Not just today&apos;s rate, but actively managing through the term. If we can save you 0.5% through a strategic relock in year two or three, that savings accelerates your amortization. Every dollar that would have gone to interest now goes to principal.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Debt restructuring:</Text> If you&apos;re carrying other debts, there may be a consolidation play that reduces your total monthly outflow—and puts more toward your mortgage principal.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Cash flow reallocation:</Text> With regular check-ins, we look for moments when you can increase payments—even slightly—to claw back amortization. A small raise. A car loan paid off. A bonus you weren&apos;t expecting.
            </Text>
          </View>
        </View>

        <Text style={[styles.paragraph, { fontFamily: "Helvetica-Oblique", marginTop: 15 }]}>
          Our goal isn&apos;t just to set up your mortgage and disappear. It&apos;s to keep optimizing, keep asking, and keep you moving toward debt-free faster than you thought possible.
        </Text>

        {/* Verification Box */}
        <View style={styles.verificationBox}>
          <View style={styles.verificationHeader}>
            <Text style={styles.verificationHeaderText}>Verify This Yourself</Text>
            <Text style={styles.verificationCopyHint}>COPY & PASTE</Text>
          </View>
          <View style={styles.verificationBody}>
            <Text style={styles.verificationInstruction}>
              Ask any AI tool (ChatGPT, Claude, Google) this question:
            </Text>
            <Text style={styles.verificationPrompt}>
              If a Canadian homeowner had a mortgage at 1.8% for 5 years and now renews at 4.5%, what happens to their payment? If they extend their amortization to keep payments affordable, how much progress do they actually lose? Over a 25-year mortgage, what&apos;s the real cost of extending amortization by 5 years at renewal?
            </Text>
          </View>
        </View>

        <PageFooter pageNum={5} />
      </Page>
    </>
  );
}

// ============================================================================
// SCENARIO 2: VARIABLE -> PANIC LOCK
// ============================================================================
function Scenario2Pages({ data }: { data: ExtractedData }) {
  return (
    <>
      <Page size="LETTER" style={styles.page}>
        <PageHeader />
        <SectionHeader>What Happened on Your Last Term</SectionHeader>

        <Text style={styles.paragraph}>
          In 2021 or early 2022, you were in a variable rate mortgage—probably around {displayRate(data.originalRate)}. It was even lower than fixed at the time. Smart move.
        </Text>

        <Text style={styles.paragraph}>
          Then rates started climbing. And climbing. By late 2022, your rate had crossed 4%. By 2023, it was pushing toward 6%. Your payments were increasing with every Bank of Canada announcement, and the news was relentless.
        </Text>

        <Text style={styles.paragraph}>
          At some point—probably when your rate hit {displayRate(data.lockInRate)}—you called your bank and locked in. Three-year fixed. Maybe five. You needed the bleeding to stop.
        </Text>

        <Text style={styles.paragraphBold}>
          That decision felt right. But here&apos;s what it cost you.
        </Text>

        {/* Cost Highlight */}
        <View style={styles.costHighlight}>
          <Text style={styles.costLabel}>The Cost of Panic Locking</Text>
          <Text style={styles.costValue}>{displayCurrency(data.estimatedExtraInterest)}</Text>
          <Text style={styles.costSubtext}>in extra interest over your term</Text>
        </View>

        <Text style={styles.paragraph}>
          By the time you locked in, you&apos;d already paid thousands in extra interest during the climb. Then you locked into a rate 1.5-2% higher than where rates eventually settled. Meanwhile, rates started falling—but you were stuck.
        </Text>

        <PageFooter pageNum={3} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <PageHeader />

        <Text style={styles.sectionTitle}>This Wasn&apos;t Your Fault</Text>

        <Text style={styles.paragraph}>
          You weren&apos;t a mortgage expert—you shouldn&apos;t have to be. But the person who <Text style={{ fontFamily: "Helvetica-Oblique" }}>was</Text> supposed to be watching your mortgage wasn&apos;t watching.
        </Text>

        <Text style={styles.paragraph}>
          No one called you at 3.5% to say &quot;consider locking in now before it gets worse.&quot; No one reached out when rates started falling to discuss whether breaking and relocking made sense. You were left to react alone, under stress, with incomplete information.
        </Text>

        <Text style={styles.sectionTitle}>What Could Happen Again</Text>

        <Text style={styles.paragraph}>
          You&apos;re about to make another multi-year commitment. If rates drop after you lock in—and no one is watching—you&apos;ll miss the window again. If you take variable and rates spike—and no one calls you—you&apos;ll ride it up just like last time.
        </Text>

        <Text style={styles.paragraphBold}>
          The pattern only breaks if someone is actually paying attention. That&apos;s what we do.
        </Text>

        <Text style={styles.sectionTitle}>Our Approach</Text>

        <View style={styles.bulletContainer}>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              We monitor rates continuously and alert you when action makes sense
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              We calculate break-even scenarios so you know exactly when locking in (or breaking out) is worth it
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              We stay in touch throughout your term—not just at renewal time
            </Text>
          </View>
        </View>

        {/* Verification Box */}
        <View style={styles.verificationBox}>
          <View style={styles.verificationHeader}>
            <Text style={styles.verificationHeaderText}>Verify This Yourself</Text>
            <Text style={styles.verificationCopyHint}>COPY & PASTE</Text>
          </View>
          <View style={styles.verificationBody}>
            <Text style={styles.verificationInstruction}>
              Ask any AI tool (ChatGPT, Claude, Google) this question:
            </Text>
            <Text style={styles.verificationPrompt}>
              What happened to Canadian variable rate mortgage holders between 2022 and 2024? How much did rates increase? What happened to people who panicked and locked into fixed rates at the peak? Did rates eventually fall, and what did that cost people who locked in too late?
            </Text>
          </View>
        </View>

        <PageFooter pageNum={4} />
      </Page>
    </>
  );
}

// ============================================================================
// SCENARIO 3: FIXED PAYMENT VARIABLE -> NEGATIVE AMORTIZATION
// ============================================================================
function Scenario3Pages({ data }: { data: ExtractedData }) {
  return (
    <>
      <Page size="LETTER" style={styles.page}>
        <PageHeader />
        <SectionHeader>What Happened on Your Last Term</SectionHeader>

        <Text style={styles.paragraph}>
          In 2021 or 2022, you had a variable rate mortgage with a fixed payment—probably around {displayCurrency(data.fixedPayment)} per month. Your rate was somewhere in the {displayRate(data.originalRate)} range. Life was good.
        </Text>

        <Text style={styles.paragraph}>
          Then rates exploded. From 2% to 6% in less than two years.
        </Text>

        <Text style={styles.paragraph}>
          But here&apos;s the thing: <Text style={{ fontFamily: "Helvetica-Bold" }}>your payment never changed.</Text> Same amount every month. Same automatic withdrawal. Nothing looked different. So why would you think anything was wrong?
        </Text>

        <Text style={styles.sectionTitle}>Here&apos;s What Was Actually Happening</Text>

        <Text style={styles.paragraph}>
          Your mortgage payment is split between principal (paying down what you owe) and interest (what the bank charges). When rates rise but your payment stays the same, the interest portion grows—and the principal portion shrinks.
        </Text>

        <Text style={styles.paragraph}>
          At a certain point, your entire payment was going to interest. Your balance wasn&apos;t moving at all.
        </Text>

        <Text style={styles.paragraph}>
          Then it got worse. When even your full payment couldn&apos;t cover the interest, the unpaid interest got added to your balance. <Text style={{ fontFamily: "Helvetica-Bold" }}>Your mortgage was actually growing.</Text> This is called negative amortization.
        </Text>

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

        <Text style={styles.sectionTitle}>This Wasn&apos;t Your Fault</Text>

        <Text style={styles.paragraph}>
          Your bank set this up. They chose the fixed-payment structure. And when rates climbed to the point where your mortgage was going backwards, they never called. Never warned you. Never suggested you increase your payment or lock in.
        </Text>

        <Text style={styles.paragraph}>
          You had no way of knowing. The statements didn&apos;t scream &quot;emergency.&quot; The payments looked normal. The damage was invisible until it was done.
        </Text>

        <Text style={styles.sectionTitle}>What Could Happen Again</Text>

        <Text style={styles.paragraph}>
          If you go back to the same bank—or any lender who treats mortgages as &quot;set and forget&quot;—you&apos;re trusting that this won&apos;t happen again. But the conditions haven&apos;t changed. Rates can still move. Banks still won&apos;t call.
        </Text>

        <Text style={styles.paragraphBold}>
          The only thing that changes the outcome is having someone who&apos;s actually watching.
        </Text>

        {/* Verification Box */}
        <View style={styles.verificationBox}>
          <View style={styles.verificationHeader}>
            <Text style={styles.verificationHeaderText}>Verify This Yourself</Text>
            <Text style={styles.verificationCopyHint}>COPY & PASTE</Text>
          </View>
          <View style={styles.verificationBody}>
            <Text style={styles.verificationInstruction}>
              Ask any AI tool (ChatGPT, Claude, Google) this question:
            </Text>
            <Text style={styles.verificationPrompt}>
              Explain what happens to a Canadian variable rate mortgage when interest rates rise rapidly but the lender keeps the monthly payment the same. How does the principal vs interest split change? What is negative amortization? What happened to many Canadian variable rate mortgage holders between 2022 and 2024?
            </Text>
          </View>
        </View>

        <PageFooter pageNum={4} />
      </Page>
    </>
  );
}

// ============================================================================
// DEBT CONSOLIDATION PAGE
// ============================================================================
function DebtConsolidationPage() {
  return (
    <Page size="LETTER" style={styles.page}>
      <PageHeader />
      <SectionHeader>The Opportunity You Might Not See</SectionHeader>

      <Text style={styles.paragraph}>
        There&apos;s something we look for on every file that most banks never mention—because it doesn&apos;t help them.
      </Text>

      <Text style={styles.paragraph}>
        When you bring us your full financial picture—not just your mortgage, but your debts, your cash flow, your goals—we sometimes find restructuring opportunities that change everything.
      </Text>

      <Text style={styles.sectionTitle}>A Real Example From This Week</Text>

      <Text style={styles.paragraph}>
        A client came to us with a straightforward renewal. $215,000 mortgage at $1,200/month with 20 years remaining. Standard stuff. But he also had:
      </Text>

      {/* Debt Table */}
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
        <View style={[styles.debtTableRow, styles.debtTableRowAlt]}>
          <Text style={[styles.debtTableCell, { width: "45%" }]}>Car loan</Text>
          <Text style={[styles.debtTableCell, { width: "27.5%", textAlign: "right" }]}>$75,000</Text>
          <Text style={[styles.debtTableCell, { width: "27.5%", textAlign: "right" }]}>$1,555/mo</Text>
        </View>
        <View style={styles.debtTableRow}>
          <Text style={[styles.debtTableCell, { width: "45%" }]}>Home renovation loan</Text>
          <Text style={[styles.debtTableCell, { width: "27.5%", textAlign: "right" }]}>$46,000</Text>
          <Text style={[styles.debtTableCell, { width: "27.5%", textAlign: "right" }]}>$450/mo</Text>
        </View>
        <View style={styles.debtTableTotal}>
          <Text style={[styles.debtTableCellBold, { width: "45%" }]}>TOTAL</Text>
          <Text style={[styles.debtTableCellBold, { width: "27.5%", textAlign: "right" }]}>$336,000</Text>
          <Text style={[styles.debtTableCellPrimary, { width: "27.5%", textAlign: "right" }]}>$3,205/mo</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>What We Found</Text>

      <Text style={styles.paragraph}>
        By consolidating everything into a single mortgage of $336,000—and keeping his total payment at the same $3,205 he was already paying—we reduced his total time to debt-free from 20 years to <Text style={{ fontFamily: "Helvetica-Bold" }}>10 years.</Text>
      </Text>

      <View style={styles.impactBox}>
        <Text style={styles.impactText}>Same monthly cash flow.</Text>
        <Text style={styles.impactText}>Half the time to debt-free.</Text>
      </View>

      <Text style={styles.paragraph}>
        He had no idea this was possible. His bank certainly wasn&apos;t going to tell him.
      </Text>

      <Text style={styles.paragraphBold}>
        Consolidating doesn&apos;t add debt. It repositions it.
      </Text>

      <PageFooter pageNum={6} />
    </Page>
  );
}

// ============================================================================
// OUR APPROACH - GREG VERSION
// ============================================================================
function GregApproachPage() {
  return (
    <Page size="LETTER" style={styles.page}>
      <PageHeader />
      <SectionHeader>Our Approach</SectionHeader>

      <Text style={styles.sectionTitle}>Why We Do Things Differently</Text>

      <Text style={styles.paragraph}>
        I&apos;ve been in this industry for over 30 years. I&apos;ve seen every rate cycle, every market panic, every &quot;this time is different&quot; moment. And here&apos;s what I&apos;ve learned: the mortgage industry is built to serve lenders, not clients.
      </Text>

      <Text style={styles.paragraph}>
        Banks want you to sign and forget. They profit when you don&apos;t ask questions, don&apos;t shop around, and don&apos;t realize there&apos;s a better option. The entire system is designed to keep you passive.
      </Text>

      <Text style={styles.paragraph}>
        We built Inspired Mortgage to be the opposite.
      </Text>

      <Text style={styles.sectionTitle}>What That Means in Practice</Text>

      <View style={styles.bulletContainer}>
        <View style={styles.bulletRow}>
          <View style={styles.bulletIcon}>
            <CheckIcon />
          </View>
          <Text style={styles.bulletText}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>We don&apos;t disappear after closing.</Text> We stay in touch throughout your term, watching for opportunities to save you money or accelerate your payoff.
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <View style={styles.bulletIcon}>
            <CheckIcon />
          </View>
          <Text style={styles.bulletText}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>We explain the &quot;why,&quot; not just the &quot;what.&quot;</Text> You&apos;ll understand your options well enough to make confident decisions.
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <View style={styles.bulletIcon}>
            <CheckIcon />
          </View>
          <Text style={styles.bulletText}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>We look for the play your bank won&apos;t mention.</Text> Debt consolidation, rate relocks, penalty arbitrage—there&apos;s often a move that changes your trajectory.
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <View style={styles.bulletIcon}>
            <CheckIcon />
          </View>
          <Text style={styles.bulletText}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>We put our money where our mouth is.</Text> Our $5,000 Penalty Guarantee isn&apos;t marketing—it&apos;s our commitment that you&apos;ll never be trapped.
          </Text>
        </View>
      </View>

      <Text style={styles.paragraph}>
        After 30 years, I could have retired. Instead, I built this. Because I got tired of watching good people get taken advantage of by a system that doesn&apos;t care about them.
      </Text>

      <Text style={styles.paragraphBold}>
        You deserve better. Let us show you what that looks like.
      </Text>

      <View style={styles.advisorBox}>
        <Text style={styles.contactName}>Greg Williamson</Text>
        <Text style={styles.contactTitle}>Founder, Inspired Mortgage</Text>
        <Text style={[styles.contactDetail, { fontFamily: "Helvetica-Oblique" }]}>
          30+ years in mortgage lending
        </Text>
      </View>

      <PageFooter pageNum={7} />
    </Page>
  );
}

// ============================================================================
// OUR APPROACH - JAKUB VERSION
// ============================================================================
function JakubApproachPage() {
  return (
    <Page size="LETTER" style={styles.page}>
      <PageHeader />
      <SectionHeader>Our Approach</SectionHeader>

      <Text style={styles.sectionTitle}>Why We Do Things Differently</Text>

      <Text style={styles.paragraph}>
        I got into real estate 10 years ago because I loved helping people find their homes. But I kept seeing the same thing: clients would find the perfect house, then get crushed by a mortgage process that treated them like a number.
      </Text>

      <Text style={styles.paragraph}>
        Banks and big brokerages move fast. Close the deal, collect the commission, move on. Nobody asks what happens to that family over the next five years. Nobody checks if rates move. Nobody optimizes.
      </Text>

      <Text style={styles.paragraph}>
        That&apos;s not how I work.
      </Text>

      <Text style={styles.sectionTitle}>What That Means in Practice</Text>

      <View style={styles.bulletContainer}>
        <View style={styles.bulletRow}>
          <View style={styles.bulletIcon}>
            <CheckIcon />
          </View>
          <Text style={styles.bulletText}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>I treat every file like it&apos;s my own mortgage.</Text> Because I&apos;ve been there. I know what it feels like to wonder if you&apos;re getting a fair deal.
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <View style={styles.bulletIcon}>
            <CheckIcon />
          </View>
          <Text style={styles.bulletText}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>I stay in your corner for the whole term.</Text> Not just at signing, not just at renewal—throughout. When there&apos;s an opportunity, I&apos;ll reach out.
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <View style={styles.bulletIcon}>
            <CheckIcon />
          </View>
          <Text style={styles.bulletText}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>I explain everything until it makes sense.</Text> No jargon, no pressure. If you have questions, we answer them.
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <View style={styles.bulletIcon}>
            <CheckIcon />
          </View>
          <Text style={styles.bulletText}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>I look for the angle your bank misses.</Text> Whether it&apos;s consolidating debt, timing a rate lock, or finding a better lender fit.
          </Text>
        </View>
      </View>

      <Text style={styles.paragraph}>
        The mortgage industry has enough people who see you as a transaction. I see you as a relationship. And I&apos;m going to earn that relationship by doing things differently.
      </Text>

      <View style={styles.advisorBox}>
        <Text style={styles.contactName}>Jakub Zajac</Text>
        <Text style={styles.contactTitle}>Mortgage Advisor, Inspired Mortgage</Text>
        <Text style={[styles.contactDetail, { fontFamily: "Helvetica-Oblique" }]}>
          10 years in real estate and mortgage lending
        </Text>
      </View>

      <PageFooter pageNum={7} />
    </Page>
  );
}

// ============================================================================
// STRATEGIES PAGES
// ============================================================================
function StrategiesPages() {
  return (
    <>
      {/* Fixed Rate Strategy */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader />
        <SectionHeader>Fixed Rate Strategy</SectionHeader>

        <Text style={styles.paragraph}>
          A fixed rate mortgage locks in your interest rate for the entire term—typically 3 to 5 years. Your payment stays exactly the same no matter what happens in the market.
        </Text>

        <Text style={styles.sectionTitle}>When Fixed Makes Sense</Text>

        <View style={styles.bulletContainer}>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              You prefer predictability and want to know exactly what your payment will be
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              You&apos;re budgeting tightly and can&apos;t absorb payment increases
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              You believe rates are likely to rise from current levels
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>What We Do Differently</Text>

        <Text style={styles.paragraph}>
          Most people sign their fixed rate and forget about it. We don&apos;t let that happen. Throughout your term, we monitor rates. If they drop significantly, we&apos;ll calculate whether breaking and relocking makes financial sense.
        </Text>

        <View style={styles.calloutHighlight}>
          <Text style={styles.paragraph}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Real example: </Text>
            Client locked in at 5.2% for 5 years. Rates dropped to 3.9% in year 2. Breaking early cost $4,200 in penalty but saved $11,000 over the remaining term. <Text style={{ fontFamily: "Helvetica-Bold" }}>Net savings: $6,800.</Text>
          </Text>
        </View>

        <PageFooter pageNum={8} />
      </Page>

      {/* Variable Rate Strategy */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader />
        <SectionHeader>Variable Rate Strategy</SectionHeader>

        <Text style={styles.paragraph}>
          A variable rate mortgage moves with the Bank of Canada&apos;s prime rate. When the BOC raises or lowers rates, your mortgage rate adjusts accordingly.
        </Text>

        <Text style={styles.sectionTitle}>When Variable Makes Sense</Text>

        <View style={styles.bulletContainer}>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              You can handle some payment fluctuation
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              You believe rates are likely to stay flat or decrease
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              You want lower penalties if you need to break your mortgage
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              Historically, variable rates have beaten fixed more often than not
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>What We Do Differently</Text>

        <Text style={styles.paragraph}>
          We set up &quot;trigger points&quot; for your mortgage—specific rate levels where we&apos;ll reach out to discuss locking in. If the BOC starts hiking aggressively, you&apos;ll hear from us before panic sets in.
        </Text>

        <View style={styles.calloutHighlight}>
          <Text style={styles.paragraph}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Real example: </Text>
            Client took variable at prime - 0.9% in early 2022. When prime crossed 4.5% in Q3 2022, we reached out and discussed locking in at 4.89%—before the worst hikes hit. <Text style={{ fontFamily: "Helvetica-Bold" }}>They avoided 18 months at 6%+.</Text>
          </Text>
        </View>

        <PageFooter pageNum={9} />
      </Page>

      {/* $5,000 Penalty Guarantee */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader />
        <SectionHeader>The $5,000 Penalty Guarantee</SectionHeader>

        {/* Certificate Style */}
        <View style={styles.guaranteeCertificate}>
          <View style={styles.guaranteeSeal}>
            <SealIcon />
          </View>
          <Text style={styles.guaranteeAmount}>$5,000</Text>
          <Text style={styles.guaranteeTitle}>Maximum Penalty Guarantee</Text>
          <Text style={styles.guaranteeText}>
            If your mortgage penalty ever exceeds $5,000 when refinancing with us, we&apos;ll cover the difference — guaranteed.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>How It Works</Text>

        <Text style={styles.paragraph}>
          Traditional lenders often lock you into mortgages with steep penalties—sometimes tens of thousands of dollars—if you need to refinance early. Our No Penalty Program partners with lenders who offer fair, capped penalties.
        </Text>

        <View style={styles.calloutHighlight}>
          <Text style={styles.paragraph}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Example: </Text>
            If your penalty is $8,000, you pay $5,000 and we cover $3,000. If your penalty is $12,000, you pay $5,000 and we cover $7,000.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Why This Matters</Text>

        <View style={styles.bulletContainer}>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              Life changes—job relocations, family growth—shouldn&apos;t cost you thousands
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              Take advantage of falling rates without being trapped
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={styles.bulletIcon}>
              <CheckIcon />
            </View>
            <Text style={styles.bulletText}>
              Access your home equity when you need it, on your terms
            </Text>
          </View>
        </View>

        <Text style={[styles.paragraph, { fontSize: 9, color: colors.lightGray, marginTop: 15 }]}>
          Terms and conditions apply. The guarantee covers the difference between your actual penalty and $5,000 when refinancing through Inspired Mortgage within your current term.
        </Text>

        <PageFooter pageNum={10} />
      </Page>
    </>
  );
}

// ============================================================================
// WHAT HAPPENS NEXT PAGE
// ============================================================================
function WhatHappensNextPage({ consultant }: { consultant: ConsultantInfo }) {
  return (
    <Page size="LETTER" style={styles.page}>
      <PageHeader />
      <SectionHeader>What Happens Next</SectionHeader>

      <Text style={styles.paragraph}>
        Getting started is simple. Here&apos;s what to expect:
      </Text>

      {/* Visual Steps */}
      <View style={styles.stepsRow}>
        <View style={styles.stepBox}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepCircleNumber}>1</Text>
          </View>
          <Text style={styles.stepTitle}>Complete Your Application</Text>
          <Text style={styles.stepDesc}>
            10-15 minutes. Does not affect your credit score.
          </Text>
        </View>

        <View style={styles.stepBox}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepCircleNumber}>2</Text>
          </View>
          <Text style={styles.stepTitle}>Receive Your Report</Text>
          <Text style={styles.stepDesc}>
            Within 24-48 hours. Compare 30+ lenders side by side.
          </Text>
        </View>

        <View style={styles.stepBox}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepCircleNumber}>3</Text>
          </View>
          <Text style={styles.stepTitle}>Make Your Decision</Text>
          <Text style={styles.stepDesc}>
            No pressure. Just clear information.
          </Text>
        </View>
      </View>

      <View style={styles.ctaBox}>
        <Text style={styles.ctaText}>Ready to see what&apos;s possible?</Text>
        <Text style={styles.ctaLink}>Your application link has been sent to your email</Text>
      </View>

      <View style={styles.contactBox}>
        <Text style={styles.contactLabel}>Questions? Reach out anytime</Text>
        <Text style={styles.contactName}>{consultant.name}</Text>
        <Text style={styles.contactTitle}>Mortgage Advisor, Inspired Mortgage</Text>
        <Text style={styles.contactDetail}>{consultant.email}</Text>
        {consultant.phone && (
          <Text style={styles.contactDetail}>{consultant.phone}</Text>
        )}
        {consultant.calLink && (
          <Text style={styles.contactLink}>Book a call: {consultant.calLink}</Text>
        )}
      </View>

      <PageFooter pageNum={11} />
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
  extractedData,
}: ReportPDFProps) {
  const isGreg = consultant.name.toLowerCase().includes("greg");

  return (
    <Document>
      {/* Page 1: Cover */}
      <CoverPage clientName={clientName} date={date} consultant={consultant} />

      {/* Page 2: What You Told Us */}
      <WhatYouToldUsPages bullets={bullets} />

      {/* Pages 3-5: Scenario-specific content */}
      {scenario === 1 && <Scenario1Pages data={extractedData} />}
      {scenario === 2 && <Scenario2Pages data={extractedData} />}
      {scenario === 3 && <Scenario3Pages data={extractedData} />}

      {/* Optional: Debt Consolidation */}
      {includeDebtConsolidation && <DebtConsolidationPage />}

      {/* Our Approach (Greg or Jakub version) */}
      {isGreg ? <GregApproachPage /> : <JakubApproachPage />}

      {/* Strategies */}
      <StrategiesPages />

      {/* What Happens Next */}
      <WhatHappensNextPage consultant={consultant} />
    </Document>
  );
}
