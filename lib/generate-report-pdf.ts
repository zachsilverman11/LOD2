/**
 * Server-side PDF generation for Post-Discovery Reports
 *
 * This file handles PDF generation for the send-to-client functionality.
 * It uses the same PDF template as the client-side generation.
 */

import ReactPDF from "@react-pdf/renderer";
import React from "react";
import {
  ReportPDFDocument,
  type ReportPDFProps,
  type ConsultantInfo,
  type ExtractedData,
} from "@/components/lead-detail-v2/report-pdf-template";
import { formatCurrency } from "@/lib/mortgage-calculations";

type GenerateReportPDFParams = {
  clientName: string;
  consultant: ConsultantInfo;
  bullets: string[];
  mortgageAmount: number;
  scenario: 1 | 2 | 3;
  includeDebtConsolidation: boolean;
  extractedData: ExtractedData | null;
  date?: string;
};

/**
 * Generate a PDF buffer for a Post-Discovery Report
 */
export async function generateReportPDF(
  params: GenerateReportPDFParams
): Promise<Buffer> {
  const {
    clientName,
    consultant,
    bullets,
    mortgageAmount,
    scenario,
    includeDebtConsolidation,
    extractedData,
    date = new Date().toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  } = params;

  const pdfProps: ReportPDFProps = {
    clientName,
    date,
    consultant,
    bullets,
    mortgageAmount: formatCurrency(mortgageAmount),
    scenario,
    includeDebtConsolidation,
    includeCashBack: false,
    applicationLink: "https://stressfree.mtg-app.com/signup",
    extractedData: extractedData || {},
  };

  // Create the PDF document element
  const document = React.createElement(ReportPDFDocument, pdfProps);

  // Render to stream and convert to buffer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfStream = await ReactPDF.renderToStream(document as any);

  // Convert stream to buffer
  const chunks: Buffer[] = [];
  for await (const chunk of pdfStream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

/**
 * Generate a PDF for a report from the database
 */
export async function generateReportPDFFromRecord(report: {
  consultantName: string;
  bullets: string[];
  mortgageAmount: number;
  scenario: number;
  includeDebtConsolidation: boolean;
  extractedData: unknown;
  createdAt: Date;
  generatedBy: {
    email: string;
    phone: string | null;
    calLink: string | null;
  };
  lead: {
    firstName: string | null;
    lastName: string | null;
  };
}): Promise<Buffer> {
  const clientName =
    `${report.lead.firstName || ""} ${report.lead.lastName || ""}`.trim() ||
    "Client";

  const date = report.createdAt.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return generateReportPDF({
    clientName,
    consultant: {
      name: report.consultantName,
      email: report.generatedBy.email,
      phone: report.generatedBy.phone || undefined,
      calLink: report.generatedBy.calLink || undefined,
    },
    bullets: report.bullets as string[],
    mortgageAmount: report.mortgageAmount,
    scenario: (report.scenario as 1 | 2 | 3) || 1,
    includeDebtConsolidation: report.includeDebtConsolidation || false,
    extractedData: (report.extractedData as ExtractedData) || null,
    date,
  });
}
