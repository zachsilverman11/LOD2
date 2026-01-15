import ReactPDF from "@react-pdf/renderer";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import React from "react";

// Consultant/Advisor details
type ConsultantInfo = {
  name: string;
  email: string;
  phone?: string;
  calLink?: string;
};

// Props for the PDF template
type ReportPDFProps = {
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
  return React.createElement(Page, { size: "LETTER", style: styles.coverPage },
    React.createElement(View, { style: styles.logoContainer },
      React.createElement(Text, null,
        React.createElement(Text, { style: styles.logoInspired }, "inspired "),
        React.createElement(Text, { style: styles.logoMortgage }, "mortgage.")
      ),
      React.createElement(Text, { style: styles.tagline }, "See lenders compete for your business")
    ),
    React.createElement(View, { style: styles.coverMain },
      React.createElement(Text, { style: styles.preparedFor }, "Prepared for"),
      React.createElement(Text, { style: styles.clientName }, clientName),
      React.createElement(Text, { style: styles.date }, date),
      React.createElement(Text, { style: styles.introParagraph },
        "This report summarizes our discovery call and outlines how we can help you achieve your mortgage goals. Completing the application does not commit you to anything — it simply allows us to gather the information needed to shop your mortgage to multiple lenders and present you with your best options."
      )
    ),
    React.createElement(View, { style: styles.coverFooter },
      React.createElement(Text, { style: styles.consultantLabel }, "Prepared by"),
      React.createElement(Text, { style: styles.consultantName }, consultant.name),
      React.createElement(Text, { style: styles.consultantTitle }, "Mortgage Advisor"),
      React.createElement(Text, { style: styles.website }, "inspired.mortgage")
    )
  );
}

// What You Told Us Page
function WhatYouToldUsPage({ bullets }: { bullets: string[] }) {
  return React.createElement(Page, { size: "LETTER", style: styles.page },
    React.createElement(Text, { style: styles.pageHeader }, "What You Told Us"),
    React.createElement(Text, { style: styles.paragraph },
      "During our discovery call, you shared the following about your situation and goals:"
    ),
    React.createElement(View, { style: styles.bulletContainer },
      ...bullets.map((bullet, index) =>
        React.createElement(View, { key: index, style: styles.bulletRow },
          React.createElement(Text, { style: styles.bulletPoint }, "•"),
          React.createElement(Text, { style: styles.bulletText }, bullet)
        )
      )
    ),
    React.createElement(Text, { style: { ...styles.paragraph, marginTop: 20 } },
      "We've designed your mortgage strategy based on these goals. The next step is to complete your application so we can present your profile to our network of lenders and find you the best possible rate and terms."
    ),
    React.createElement(Text, { style: styles.pageNumber }, "2")
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
  return React.createElement(Page, { size: "LETTER", style: styles.page },
    React.createElement(Text, { style: styles.pageHeader }, "Your Numbers at a Glance"),
    React.createElement(Text, { style: styles.paragraph },
      "Based on the information you provided, here's a snapshot of the potential savings and benefits available to you:"
    ),
    React.createElement(View, { style: styles.numbersGrid },
      React.createElement(View, { style: styles.numberBox },
        React.createElement(Text, { style: styles.numberLabel }, "Current Mortgage"),
        React.createElement(Text, { style: styles.numberValue }, mortgageAmount)
      ),
      React.createElement(View, { style: styles.numberBox },
        React.createElement(Text, { style: styles.numberLabel }, "Annual Savings"),
        React.createElement(Text, { style: styles.numberValue }, annualSavings)
      ),
      React.createElement(View, { style: styles.numberBox },
        React.createElement(Text, { style: styles.numberLabel }, "5-Year Savings"),
        React.createElement(Text, { style: styles.numberValue }, fiveYearSavings)
      ),
      React.createElement(View, { style: styles.numberBox },
        React.createElement(Text, { style: styles.numberLabel }, "Potential Cash Back"),
        React.createElement(Text, { style: styles.numberValue }, cashBack)
      )
    ),
    React.createElement(View, { style: styles.numbersExplanation },
      React.createElement(Text, { style: styles.sectionTitle }, "How We Calculate These Numbers"),
      React.createElement(Text, { style: styles.paragraph },
        "Annual Savings: Estimated based on securing a rate 1.25% lower than typical posted rates through our lender competition process."
      ),
      React.createElement(Text, { style: styles.paragraph },
        "Cash Back: Many lenders offer cash back incentives of up to 3% of your mortgage amount. Actual amounts vary by lender and qualification."
      ),
      React.createElement(Text, { style: { ...styles.paragraph, marginBottom: 0 } },
        "These are estimates only. Your actual savings will depend on your final approved rate and terms."
      )
    ),
    React.createElement(Text, { style: styles.pageNumber }, "3")
  );
}

// Guarantee Page
function GuaranteePage() {
  return React.createElement(Page, { size: "LETTER", style: styles.page },
    React.createElement(Text, { style: styles.pageHeader }, "The $5,000 Mortgage Penalty Guarantee"),
    React.createElement(View, { style: styles.guaranteeBox },
      React.createElement(Text, { style: styles.guaranteeTitle }, "Our Promise to You"),
      React.createElement(Text, { style: { ...styles.paragraph, textAlign: "center", marginBottom: 0 } },
        "If your mortgage penalty ever exceeds $5,000 when refinancing with us, we'll cover the difference — guaranteed."
      )
    ),
    React.createElement(Text, { style: styles.sectionTitle }, "How It Works"),
    React.createElement(Text, { style: styles.paragraph },
      "Traditional lenders often lock you into mortgages with steep penalties — sometimes tens of thousands of dollars — if you need to refinance early. This traps homeowners in unfavorable terms even when better options exist."
    ),
    React.createElement(Text, { style: styles.paragraph },
      "Our No Penalty Program partners with lenders who offer fair, capped penalties. Combined with our guarantee, you'll never pay more than $5,000 to break your mortgage when you refinance through Inspired Mortgage."
    ),
    React.createElement(Text, { style: styles.sectionTitle }, "Why This Matters"),
    React.createElement(View, { style: styles.bulletContainer },
      React.createElement(View, { style: styles.bulletRow },
        React.createElement(Text, { style: styles.bulletPoint }, "•"),
        React.createElement(Text, { style: styles.bulletText },
          "Life changes — job relocations, family growth, or investment opportunities shouldn't cost you thousands in penalties"
        )
      ),
      React.createElement(View, { style: styles.bulletRow },
        React.createElement(Text, { style: styles.bulletPoint }, "•"),
        React.createElement(Text, { style: styles.bulletText },
          "Take advantage of falling rates without being trapped by your current lender"
        )
      ),
      React.createElement(View, { style: styles.bulletRow },
        React.createElement(Text, { style: styles.bulletPoint }, "•"),
        React.createElement(Text, { style: styles.bulletText },
          "Access your home equity when you need it, on your terms"
        )
      )
    ),
    React.createElement(Text, { style: { ...styles.paragraph, marginTop: 20, fontFamily: "Helvetica-Oblique" } },
      "Terms and conditions apply. The guarantee covers the difference between your actual penalty and $5,000 when refinancing through Inspired Mortgage within your current term."
    ),
    React.createElement(Text, { style: styles.pageNumber }, "4")
  );
}

// What Happens Next Page
function WhatHappensNextPage({ consultant }: { consultant: ConsultantInfo }) {
  return React.createElement(Page, { size: "LETTER", style: styles.page },
    React.createElement(Text, { style: styles.pageHeader }, "What Happens Next"),
    React.createElement(Text, { style: styles.paragraph },
      "Getting started is simple. Here's what to expect over the next few days:"
    ),
    React.createElement(View, { style: styles.stepContainer },
      React.createElement(View, { style: styles.step },
        React.createElement(Text, { style: styles.stepNumber }, "1"),
        React.createElement(View, { style: styles.stepContent },
          React.createElement(Text, { style: styles.stepTitle }, "Complete Your Application"),
          React.createElement(Text, { style: styles.stepDescription },
            "Click the secure link below to fill out your mortgage application. This takes about 10-15 minutes and does not affect your credit score. The application allows us to present your full profile to lenders."
          )
        )
      ),
      React.createElement(View, { style: styles.step },
        React.createElement(Text, { style: styles.stepNumber }, "2"),
        React.createElement(View, { style: styles.stepContent },
          React.createElement(Text, { style: styles.stepTitle }, "Receive Your Lender Comparison Report"),
          React.createElement(Text, { style: styles.stepDescription },
            "Within 24-48 hours, we'll shop your mortgage to our network of 30+ lenders. You'll receive a personalized report comparing your best options — rates, terms, and features side by side."
          )
        )
      ),
      React.createElement(View, { style: styles.step },
        React.createElement(Text, { style: styles.stepNumber }, "3"),
        React.createElement(View, { style: styles.stepContent },
          React.createElement(Text, { style: styles.stepTitle }, "Schedule Your Follow-Up Call"),
          React.createElement(Text, { style: styles.stepDescription },
            "We'll review your options together, answer any questions, and help you choose the best path forward. There's no pressure — just clear information to help you make the right decision."
          )
        )
      )
    ),
    React.createElement(View, { style: styles.ctaBox },
      React.createElement(Text, { style: styles.ctaText }, "Ready to get started?"),
      React.createElement(Text, { style: styles.ctaLink }, "Your application link will be sent separately")
    ),
    React.createElement(View, { style: styles.contactBox },
      React.createElement(Text, { style: styles.contactLabel }, "Questions? Reach out anytime:"),
      React.createElement(Text, { style: styles.consultantName }, consultant.name),
      React.createElement(Text, { style: styles.consultantTitle }, "Mortgage Advisor, Inspired Mortgage"),
      React.createElement(Text, { style: { ...styles.paragraph, marginTop: 8, marginBottom: 0, fontSize: 10 } }, consultant.email),
      consultant.phone ? React.createElement(Text, { style: { ...styles.paragraph, marginBottom: 0, fontSize: 10 } }, consultant.phone) : null,
      consultant.calLink ? React.createElement(Text, { style: { ...styles.website, marginTop: 8 } }, `Book a call: ${consultant.calLink}`) : null
    ),
    React.createElement(Text, { style: styles.pageNumber }, "5")
  );
}

// Main PDF Document
function ReportPDFDocument(props: ReportPDFProps) {
  return React.createElement(Document, null,
    React.createElement(CoverPage, {
      clientName: props.clientName,
      date: props.date,
      consultant: props.consultant,
    }),
    React.createElement(WhatYouToldUsPage, { bullets: props.bullets }),
    React.createElement(NumbersPage, {
      mortgageAmount: props.mortgageAmount,
      annualSavings: props.annualSavings,
      fiveYearSavings: props.fiveYearSavings,
      cashBack: props.cashBack,
    }),
    React.createElement(GuaranteePage),
    React.createElement(WhatHappensNextPage, { consultant: props.consultant })
  );
}

// Format currency helper
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Generate PDF buffer
export async function generateReportPDF(params: {
  clientName: string;
  consultant: ConsultantInfo;
  bullets: string[];
  mortgageAmount: number;
  date?: string;
}): Promise<Buffer> {
  const { clientName, consultant, bullets, mortgageAmount, date } = params;

  const formattedDate = date || new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const annualSavings = mortgageAmount * 0.0125;
  const fiveYearSavings = annualSavings * 5;
  const cashBack = mortgageAmount * 0.03;

  const document = React.createElement(ReportPDFDocument, {
    clientName,
    date: formattedDate,
    consultant,
    bullets,
    mortgageAmount: formatCurrency(mortgageAmount),
    annualSavings: formatCurrency(annualSavings),
    fiveYearSavings: formatCurrency(fiveYearSavings),
    cashBack: formatCurrency(cashBack),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfStream = await ReactPDF.renderToStream(document as any);

  // Convert stream to buffer
  const chunks: Buffer[] = [];
  for await (const chunk of pdfStream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
