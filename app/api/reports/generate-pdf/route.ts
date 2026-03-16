import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateReportHTML, type ReportHTMLProps } from "@/lib/generate-report-html";
import { generatePDFFromHTML } from "@/lib/generate-report-puppeteer";
import { getAdvisorPhone } from "@/lib/report-copy";

function normalizeScenario(scenario: unknown): 0 | 1 | 2 | 3 {
  if (scenario === null || scenario === undefined || scenario === "") {
    return 0;
  }

  const parsedScenario = Number(scenario);

  if ([0, 1, 2, 3].includes(parsedScenario)) {
    return parsedScenario as 0 | 1 | 2 | 3;
  }

  throw new Error("Scenario must be 0, 1, 2, or 3");
}

/**
 * POST /api/reports/generate-pdf
 *
 * Generate a PDF report using the HTML/Puppeteer pipeline.
 * Returns the PDF as a binary blob.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      clientName,
      date,
      consultant,
      bullets,
      mortgageAmount,
      scenario,
      includeDebtConsolidation,
      includeCashBack,
      applicationLink,
      extractedData,
    } = body;

    // Validate required fields
    if (!clientName || !date || !consultant || !bullets || !mortgageAmount) {
      return NextResponse.json(
        { error: "Missing required fields: clientName, date, consultant, bullets, mortgageAmount" },
        { status: 400 }
      );
    }

    // Validate consultant has required fields (phone is optional)
    if (!consultant.name || !consultant.email) {
      return NextResponse.json(
        { error: "Consultant must have name and email" },
        { status: 400 }
      );
    }

    let validatedScenario: 0 | 1 | 2 | 3;
    try {
      validatedScenario = normalizeScenario(scenario);
    } catch {
      return NextResponse.json(
        { error: "Scenario must be 0, 1, 2, or 3" },
        { status: 400 }
      );
    }

    // Build the report props
    const reportProps: ReportHTMLProps = {
      clientName,
      date,
      consultant: {
        name: consultant.name,
        email: consultant.email,
        phone: getAdvisorPhone(consultant.name, consultant.phone),
        calLink: consultant.calLink || "",
      },
      bullets: bullets as string[],
      mortgageAmount: String(mortgageAmount),
      scenario: validatedScenario,
      includeDebtConsolidation: includeDebtConsolidation || false,
      includeCashBack: includeCashBack || false,
      applicationLink: applicationLink || "https://stressfree.mtg-app.com/signup",
      extractedData: extractedData || {},
    };

    // Generate HTML
    const html = generateReportHTML(reportProps);

    // Generate PDF from HTML using Puppeteer
    const pdfBuffer = await generatePDFFromHTML({
      html,
      printBackground: true,
    });

    // Return PDF as binary response
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Post-Discovery-Report-${clientName.replace(/\s+/g, "-")}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Configure route for larger payloads and longer timeouts
 * Puppeteer PDF generation can take several seconds
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
    responseLimit: "10mb",
  },
  maxDuration: 60, // 60 seconds timeout for Vercel
};
