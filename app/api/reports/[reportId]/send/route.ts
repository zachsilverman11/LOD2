import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateReportPDF } from "@/lib/generate-report-pdf";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reportId } = await params;

    // Fetch the report with lead and advisor details
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            consentEmail: true,
          },
        },
        generatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            calLink: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Check if lead has email
    if (!report.lead.email) {
      return NextResponse.json(
        { error: "Lead does not have an email address" },
        { status: 400 }
      );
    }

    // Check email consent
    if (report.lead.consentEmail === false) {
      return NextResponse.json(
        { error: "Lead has not consented to receive emails" },
        { status: 400 }
      );
    }

    // Generate the PDF
    const clientName = `${report.lead.firstName || ""} ${report.lead.lastName || ""}`.trim() || "Client";
    const pdfBuffer = await generateReportPDF({
      clientName,
      consultant: {
        name: report.consultantName,
        email: report.generatedBy.email,
        phone: report.generatedBy.phone || undefined,
        calLink: report.generatedBy.calLink || undefined,
      },
      bullets: report.bullets as string[],
      mortgageAmount: report.mortgageAmount,
      date: report.createdAt.toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });

    // Convert buffer to base64 for email attachment
    const pdfBase64 = pdfBuffer.toString("base64");

    // Build the email HTML
    const emailHtml = buildReportEmailHtml({
      clientFirstName: report.lead.firstName || "there",
      advisorName: report.consultantName,
      advisorEmail: report.generatedBy.email,
      advisorPhone: report.generatedBy.phone || undefined,
      advisorCalLink: report.generatedBy.calLink || undefined,
    });

    // Send the email with SendGrid
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;

    if (!sendgridApiKey) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    if (!fromEmail) {
      return NextResponse.json(
        { error: "FROM_EMAIL not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sendgridApiKey}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: report.lead.email }],
            subject: "Your Mortgage Strategy Report from Inspired Mortgage",
          },
        ],
        from: { email: fromEmail, name: "Inspired Mortgage" },
        reply_to: { email: report.generatedBy.email, name: report.consultantName },
        content: [
          {
            type: "text/html",
            value: emailHtml,
          },
        ],
        attachments: [
          {
            content: pdfBase64,
            filename: `${clientName.replace(/\s+/g, "-")}-Mortgage-Strategy-Report.pdf`,
            type: "application/pdf",
            disposition: "attachment",
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SendGrid error:", errorText);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    // Update the report with sent info
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        sentAt: new Date(),
        sentToEmail: report.lead.email,
      },
      include: {
        generatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            calLink: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      report: updatedReport,
    });
  } catch (error) {
    console.error("Error sending report:", error);
    return NextResponse.json(
      { error: "Failed to send report" },
      { status: 500 }
    );
  }
}

// Build the branded email HTML for sending reports
function buildReportEmailHtml(params: {
  clientFirstName: string;
  advisorName: string;
  advisorEmail: string;
  advisorPhone?: string;
  advisorCalLink?: string;
}): string {
  const { clientFirstName, advisorName, advisorEmail, advisorPhone, advisorCalLink } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #FBF3E7;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #625FFF 0%, #B1AFFF 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 32px;
      font-weight: 800;
    }
    .header .brand-name {
      font-style: italic;
      font-weight: 800;
    }
    .header .tagline {
      color: #FBF3E7;
      font-size: 14px;
      margin-top: 8px;
    }
    .content {
      padding: 40px 30px;
      color: #1C1B1A;
      line-height: 1.6;
    }
    .content h2 {
      color: #625FFF;
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .content p {
      margin: 16px 0;
      color: #1C1B1A;
    }
    .highlight-box {
      background-color: #FBF3E7;
      border-left: 4px solid #625FFF;
      padding: 20px;
      margin: 24px 0;
      border-radius: 0 8px 8px 0;
    }
    .highlight-box p {
      margin: 0;
    }
    .cta-button {
      display: inline-block;
      background-color: #625FFF;
      color: #ffffff !important;
      padding: 16px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 24px 0;
    }
    .footer {
      background-color: #F5F5F5;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #E4DDD3;
    }
    .footer-signature {
      color: #1C1B1A;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .footer-title {
      color: #55514D;
      font-size: 14px;
      margin-bottom: 16px;
    }
    .footer-contact {
      color: #55514D;
      font-size: 14px;
      margin: 8px 0;
    }
    .footer-contact a {
      color: #625FFF;
      text-decoration: none;
    }
    .footer-disclaimer {
      color: #999;
      font-size: 12px;
      margin-top: 20px;
      line-height: 1.4;
    }
    @media only screen and (max-width: 600px) {
      .header { padding: 30px 20px; }
      .header h1 { font-size: 28px; }
      .content { padding: 30px 20px; }
      .footer { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>
        <span class="brand-name">inspired</span> <span style="font-weight: 900;">mortgage.</span>
      </h1>
      <div class="tagline">See Lenders Compete for Your Business</div>
    </div>

    <!-- Content -->
    <div class="content">
      <h2>Hi ${clientFirstName},</h2>

      <p>Thank you for taking the time to speak with me about your mortgage goals. It was great learning more about your situation and what you're hoping to achieve.</p>

      <div class="highlight-box">
        <p><strong>Attached is your personalized Mortgage Strategy Report</strong> summarizing our conversation and outlining your potential savings.</p>
      </div>

      <p>This report includes:</p>
      <ul style="margin: 16px 0; padding-left: 24px;">
        <li style="margin: 8px 0;">A summary of what you shared with me</li>
        <li style="margin: 8px 0;">Your estimated savings and potential cash back</li>
        <li style="margin: 8px 0;">Our $5,000 Mortgage Penalty Guarantee</li>
        <li style="margin: 8px 0;">Clear next steps to move forward</li>
      </ul>

      <p>The next step is to complete your secure mortgage application. This takes about 10-15 minutes and <strong>does not affect your credit score</strong>. Once submitted, I'll shop your mortgage to 30+ lenders and present you with your best options.</p>

      ${advisorCalLink ? `<p style="text-align: center;"><a href="${advisorCalLink}" class="cta-button">Book Your Follow-Up Call</a></p>` : ""}

      <p>If you have any questions at all, please don't hesitate to reach out. I'm here to help!</p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-signature">${advisorName}</div>
      <div class="footer-title">Mortgage Advisor, Inspired Mortgage</div>
      <div class="footer-contact">
        <a href="mailto:${advisorEmail}">${advisorEmail}</a>
      </div>
      ${advisorPhone ? `<div class="footer-contact">${advisorPhone}</div>` : ""}
      ${advisorCalLink ? `<div class="footer-contact"><a href="${advisorCalLink}" style="color: #625FFF; font-weight: 600;">📅 Schedule a Call</a></div>` : ""}
      <div class="footer-disclaimer">
        You received this email because you recently had a discovery call with Inspired Mortgage.<br>
        Questions? Just reply to this email anytime.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
