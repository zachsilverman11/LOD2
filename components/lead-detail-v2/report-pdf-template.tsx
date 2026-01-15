"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Consultant/Advisor details
export type ConsultantInfo = {
  name: string;
  email: string;
  phone?: string;
  calLink?: string;
};

// Props for the PDF template
export type ReportPDFProps = {
  clientName: string;
  date: string;
  consultant: ConsultantInfo;
  bullets: string[];
  mortgageAmount: string;
  annualSavings: string;
  fiveYearSavings: string;
  cashBack: string;
};

// Brand colors
const colors = {
  purple: "#625FFF",
  darkText: "#1C1B1A",
  grayText: "#55514D",
  lightGray: "#8E8983",
  cream: "#FBF3E7",
};

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: colors.darkText,
    lineHeight: 1.5,
  },
  // Cover page styles
  coverPage: {
    padding: 50,
    fontFamily: "Helvetica",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoInspired: {
    fontSize: 32,
    fontFamily: "Helvetica-Oblique",
    color: colors.darkText,
  },
  logoMortgage: {
    fontSize: 32,
    fontFamily: "Helvetica",
    color: colors.darkText,
  },
  tagline: {
    fontSize: 14,
    color: colors.purple,
    letterSpacing: 2,
    marginTop: 8,
    textTransform: "uppercase",
  },
  coverMain: {
    flex: 1,
    justifyContent: "center",
  },
  preparedFor: {
    fontSize: 14,
    color: colors.lightGray,
    marginBottom: 8,
  },
  clientName: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: colors.darkText,
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: colors.lightGray,
  },
  introParagraph: {
    fontSize: 11,
    color: colors.grayText,
    marginTop: 40,
    lineHeight: 1.6,
  },
  coverFooter: {
    borderTopWidth: 1,
    borderTopColor: "#E5E0D8",
    paddingTop: 20,
  },
  consultantLabel: {
    fontSize: 10,
    color: colors.lightGray,
    marginBottom: 4,
  },
  consultantName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.darkText,
  },
  consultantTitle: {
    fontSize: 10,
    color: colors.grayText,
    marginBottom: 8,
  },
  website: {
    fontSize: 10,
    color: colors.purple,
  },
  // Content page styles
  pageHeader: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: colors.darkText,
    marginBottom: 30,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: colors.purple,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.darkText,
    marginTop: 20,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 11,
    color: colors.grayText,
    lineHeight: 1.6,
    marginBottom: 12,
  },
  bulletContainer: {
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  bulletPoint: {
    color: colors.purple,
    fontSize: 11,
    marginRight: 8,
    width: 12,
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    color: colors.grayText,
    lineHeight: 1.5,
  },
  // Numbers page styles
  numbersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 20,
  },
  numberBox: {
    width: "48%",
    marginBottom: 20,
    marginRight: "2%",
    padding: 20,
    backgroundColor: colors.cream,
    borderRadius: 8,
  },
  numberLabel: {
    fontSize: 10,
    color: colors.lightGray,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  numberValue: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: colors.purple,
  },
  numbersExplanation: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#F5F5F5",
    borderRadius: 6,
  },
  // Guarantee page styles
  guaranteeBox: {
    backgroundColor: colors.cream,
    padding: 25,
    borderRadius: 8,
    marginTop: 20,
  },
  guaranteeTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: colors.purple,
    marginBottom: 15,
    textAlign: "center",
  },
  // CTA page styles
  stepContainer: {
    marginTop: 20,
  },
  step: {
    flexDirection: "row",
    marginBottom: 20,
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.purple,
    color: "white",
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    lineHeight: 30,
    marginRight: 15,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.darkText,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 10,
    color: colors.grayText,
    lineHeight: 1.5,
  },
  ctaBox: {
    backgroundColor: colors.purple,
    padding: 20,
    borderRadius: 8,
    marginTop: 30,
    textAlign: "center",
  },
  ctaText: {
    color: "white",
    fontSize: 12,
    marginBottom: 8,
  },
  ctaLink: {
    color: "white",
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  contactBox: {
    marginTop: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E0D8",
    borderRadius: 8,
  },
  contactLabel: {
    fontSize: 10,
    color: colors.lightGray,
    marginBottom: 8,
  },
  pageNumber: {
    position: "absolute",
    bottom: 30,
    right: 50,
    fontSize: 10,
    color: colors.lightGray,
  },
});

// Cover Page Component
function CoverPage({ clientName, date, consultant }: {
  clientName: string;
  date: string;
  consultant: ConsultantInfo;
}) {
  return (
    <Page size="LETTER" style={styles.coverPage}>
      <View style={styles.logoContainer}>
        <Text>
          <Text style={styles.logoInspired}>inspired </Text>
          <Text style={styles.logoMortgage}>mortgage.</Text>
        </Text>
        <Text style={styles.tagline}>See lenders compete for your business</Text>
      </View>

      <View style={styles.coverMain}>
        <Text style={styles.preparedFor}>Prepared for</Text>
        <Text style={styles.clientName}>{clientName}</Text>
        <Text style={styles.date}>{date}</Text>

        <Text style={styles.introParagraph}>
          This report summarizes our discovery call and outlines how we can help you achieve your
          mortgage goals. Completing the application does not commit you to anything — it simply
          allows us to gather the information needed to shop your mortgage to multiple lenders
          and present you with your best options.
        </Text>
      </View>

      <View style={styles.coverFooter}>
        <Text style={styles.consultantLabel}>Prepared by</Text>
        <Text style={styles.consultantName}>{consultant.name}</Text>
        <Text style={styles.consultantTitle}>Mortgage Advisor</Text>
        <Text style={styles.website}>inspired.mortgage</Text>
      </View>
    </Page>
  );
}

// What You Told Us Page
function WhatYouToldUsPage({ bullets }: { bullets: string[] }) {
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.pageHeader}>What You Told Us</Text>

      <Text style={styles.paragraph}>
        During our discovery call, you shared the following about your situation and goals:
      </Text>

      <View style={styles.bulletContainer}>
        {bullets.map((bullet, index) => (
          <View key={index} style={styles.bulletRow}>
            <Text style={styles.bulletPoint}>•</Text>
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.paragraph, { marginTop: 20 }]}>
        We&apos;ve designed your mortgage strategy based on these goals. The next step is to
        complete your application so we can present your profile to our network of lenders
        and find you the best possible rate and terms.
      </Text>

      <Text style={styles.pageNumber}>2</Text>
    </Page>
  );
}

// Numbers Page
function NumbersPage({
  mortgageAmount,
  annualSavings,
  fiveYearSavings,
  cashBack,
}: {
  mortgageAmount: string;
  annualSavings: string;
  fiveYearSavings: string;
  cashBack: string;
}) {
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.pageHeader}>Your Numbers at a Glance</Text>

      <Text style={styles.paragraph}>
        Based on the information you provided, here&apos;s a snapshot of the potential
        savings and benefits available to you:
      </Text>

      <View style={styles.numbersGrid}>
        <View style={styles.numberBox}>
          <Text style={styles.numberLabel}>Current Mortgage</Text>
          <Text style={styles.numberValue}>{mortgageAmount}</Text>
        </View>
        <View style={styles.numberBox}>
          <Text style={styles.numberLabel}>Annual Savings</Text>
          <Text style={styles.numberValue}>{annualSavings}</Text>
        </View>
        <View style={styles.numberBox}>
          <Text style={styles.numberLabel}>5-Year Savings</Text>
          <Text style={styles.numberValue}>{fiveYearSavings}</Text>
        </View>
        <View style={styles.numberBox}>
          <Text style={styles.numberLabel}>Potential Cash Back</Text>
          <Text style={styles.numberValue}>{cashBack}</Text>
        </View>
      </View>

      <View style={styles.numbersExplanation}>
        <Text style={styles.sectionTitle}>How We Calculate These Numbers</Text>
        <Text style={styles.paragraph}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Annual Savings: </Text>
          Estimated based on securing a rate 1.25% lower than typical posted rates through
          our lender competition process.
        </Text>
        <Text style={styles.paragraph}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Cash Back: </Text>
          Many lenders offer cash back incentives of up to 3% of your mortgage amount.
          Actual amounts vary by lender and qualification.
        </Text>
        <Text style={[styles.paragraph, { marginBottom: 0 }]}>
          These are estimates only. Your actual savings will depend on your final
          approved rate and terms.
        </Text>
      </View>

      <Text style={styles.pageNumber}>3</Text>
    </Page>
  );
}

// Guarantee Page
function GuaranteePage() {
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.pageHeader}>The $5,000 Mortgage Penalty Guarantee</Text>

      <View style={styles.guaranteeBox}>
        <Text style={styles.guaranteeTitle}>Our Promise to You</Text>
        <Text style={[styles.paragraph, { textAlign: "center", marginBottom: 0 }]}>
          If your mortgage penalty ever exceeds $5,000 when refinancing with us,
          we&apos;ll cover the difference — guaranteed.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>How It Works</Text>
      <Text style={styles.paragraph}>
        Traditional lenders often lock you into mortgages with steep penalties — sometimes
        tens of thousands of dollars — if you need to refinance early. This traps homeowners
        in unfavorable terms even when better options exist.
      </Text>

      <Text style={styles.paragraph}>
        Our No Penalty Program partners with lenders who offer fair, capped penalties.
        Combined with our guarantee, you&apos;ll never pay more than $5,000 to break your
        mortgage when you refinance through Inspired Mortgage.
      </Text>

      <Text style={styles.sectionTitle}>Why This Matters</Text>
      <View style={styles.bulletContainer}>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletPoint}>•</Text>
          <Text style={styles.bulletText}>
            Life changes — job relocations, family growth, or investment opportunities
            shouldn&apos;t cost you thousands in penalties
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletPoint}>•</Text>
          <Text style={styles.bulletText}>
            Take advantage of falling rates without being trapped by your current lender
          </Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bulletPoint}>•</Text>
          <Text style={styles.bulletText}>
            Access your home equity when you need it, on your terms
          </Text>
        </View>
      </View>

      <Text style={[styles.paragraph, { marginTop: 20, fontFamily: "Helvetica-Oblique" }]}>
        Terms and conditions apply. The guarantee covers the difference between your actual
        penalty and $5,000 when refinancing through Inspired Mortgage within your current term.
      </Text>

      <Text style={styles.pageNumber}>4</Text>
    </Page>
  );
}

// What Happens Next Page
function WhatHappensNextPage({ consultant }: { consultant: ConsultantInfo }) {
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.pageHeader}>What Happens Next</Text>

      <Text style={styles.paragraph}>
        Getting started is simple. Here&apos;s what to expect over the next few days:
      </Text>

      <View style={styles.stepContainer}>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>1</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Complete Your Application</Text>
            <Text style={styles.stepDescription}>
              Click the secure link below to fill out your mortgage application. This takes
              about 10-15 minutes and does not affect your credit score. The application
              allows us to present your full profile to lenders.
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>2</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Receive Your Lender Comparison Report</Text>
            <Text style={styles.stepDescription}>
              Within 24-48 hours, we&apos;ll shop your mortgage to our network of 30+ lenders.
              You&apos;ll receive a personalized report comparing your best options — rates,
              terms, and features side by side.
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={styles.stepNumber}>3</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Schedule Your Follow-Up Call</Text>
            <Text style={styles.stepDescription}>
              We&apos;ll review your options together, answer any questions, and help you
              choose the best path forward. There&apos;s no pressure — just clear information
              to help you make the right decision.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.ctaBox}>
        <Text style={styles.ctaText}>Ready to get started?</Text>
        <Text style={styles.ctaLink}>Your application link will be sent separately</Text>
      </View>

      <View style={styles.contactBox}>
        <Text style={styles.contactLabel}>Questions? Reach out anytime:</Text>
        <Text style={styles.consultantName}>{consultant.name}</Text>
        <Text style={styles.consultantTitle}>Mortgage Advisor, Inspired Mortgage</Text>
        <Text style={[styles.paragraph, { marginTop: 8, marginBottom: 0, fontSize: 10 }]}>
          {consultant.email}
        </Text>
        {consultant.phone && (
          <Text style={[styles.paragraph, { marginBottom: 0, fontSize: 10 }]}>
            {consultant.phone}
          </Text>
        )}
        {consultant.calLink && (
          <Text style={[styles.website, { marginTop: 8 }]}>
            Book a call: {consultant.calLink}
          </Text>
        )}
      </View>

      <Text style={styles.pageNumber}>5</Text>
    </Page>
  );
}

// Main PDF Document
export function ReportPDFDocument({
  clientName,
  date,
  consultant,
  bullets,
  mortgageAmount,
  annualSavings,
  fiveYearSavings,
  cashBack,
}: ReportPDFProps) {
  return (
    <Document>
      <CoverPage
        clientName={clientName}
        date={date}
        consultant={consultant}
      />
      <WhatYouToldUsPage bullets={bullets} />
      <NumbersPage
        mortgageAmount={mortgageAmount}
        annualSavings={annualSavings}
        fiveYearSavings={fiveYearSavings}
        cashBack={cashBack}
      />
      <GuaranteePage />
      <WhatHappensNextPage consultant={consultant} />
    </Document>
  );
}
