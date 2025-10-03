import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail, interpolateTemplate } from "@/lib/email";
import { ActivityType, CommunicationChannel } from "@/app/generated/prisma";
import { z } from "zod";

const sendEmailSchema = z.object({
  leadId: z.string(),
  templateId: z.string().optional(),
  subject: z.string(),
  htmlBody: z.string(),
  textBody: z.string().optional(),
  variables: z.record(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = sendEmailSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { leadId, templateId, subject, htmlBody, textBody, variables } = validationResult.data;

    // Get lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Check email consent
    if (!lead.consentEmail) {
      return NextResponse.json(
        { error: "Lead has not consented to email communication" },
        { status: 403 }
      );
    }

    // Interpolate variables if provided
    const finalSubject = variables ? interpolateTemplate(subject, variables) : subject;
    const finalHtmlBody = variables ? interpolateTemplate(htmlBody, variables) : htmlBody;
    const finalTextBody = textBody && variables ? interpolateTemplate(textBody, variables) : textBody;

    // Send email
    const emailResult = await sendEmail({
      to: lead.email,
      subject: finalSubject,
      html: finalHtmlBody,
      text: finalTextBody,
    });

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId,
        type: ActivityType.EMAIL_SENT,
        channel: CommunicationChannel.EMAIL,
        subject: finalSubject,
        content: finalTextBody || finalHtmlBody.replace(/<[^>]*>/g, '').substring(0, 500),
        metadata: {
          templateId,
          emailId: emailResult.id,
        },
      },
    });

    // Update last contacted
    await prisma.lead.update({
      where: { id: leadId },
      data: { lastContactedAt: new Date() },
    });

    return NextResponse.json({ success: true, emailId: emailResult.id });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
