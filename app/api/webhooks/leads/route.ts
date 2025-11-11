import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { webhookLeadSchema } from "@/lib/validation";
import { verifyWebhookSignature } from "@/lib/webhook-security";
import { LeadStatus, ActivityType, CommunicationChannel } from "@/app/generated/prisma";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify webhook signature
    const signature = request.headers.get("x-webhook-signature");
    const rawBody = await request.text();

    if (!signature || !process.env.WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Missing signature or webhook secret not configured" },
        { status: 401 }
      );
    }

    const isValid = verifyWebhookSignature(
      rawBody,
      signature,
      process.env.WEBHOOK_SECRET
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // 2. Parse and validate payload
    const body = JSON.parse(rawBody);
    const validationResult = webhookLeadSchema.safeParse(body);

    if (!validationResult.success) {
      // Log the webhook event even if validation fails
      await prisma.webhookEvent.create({
        data: {
          source: "lead_provider",
          eventType: "lead.received",
          payload: body,
          processed: false,
          error: JSON.stringify(validationResult.error.errors),
        },
      });

      return NextResponse.json(
        { error: "Invalid payload", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const leadData = validationResult.data;

    // 3. Check for duplicate lead (by email)
    const existingLead = await prisma.lead.findUnique({
      where: { email: leadData.email.toLowerCase() },
    });

    if (existingLead) {
      // Update existing lead with new data
      const updatedLead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          phone: leadData.phone || existingLead.phone,
          firstName: leadData.firstName,
          lastName: leadData.lastName,
          source: leadData.source || existingLead.source,
          consentEmail: leadData.consentEmail || existingLead.consentEmail,
          consentSms: leadData.consentSms || existingLead.consentSms,
          consentCall: leadData.consentCall || existingLead.consentCall,
          rawData: (leadData.metadata || existingLead.rawData) as any,
          updatedAt: new Date(),
        },
      });

      // Log duplicate webhook event
      await prisma.webhookEvent.create({
        data: {
          source: "lead_provider",
          eventType: "lead.duplicate",
          payload: body,
          processed: true,
        },
      });

      // Log activity
      await prisma.leadActivity.create({
        data: {
          leadId: existingLead.id,
          type: ActivityType.WEBHOOK_RECEIVED,
          channel: CommunicationChannel.SYSTEM,
          content: "Duplicate lead received - updated existing record",
          metadata: leadData.metadata as any,
        },
      });

      return NextResponse.json({
        success: true,
        leadId: updatedLead.id,
        duplicate: true,
      });
    }

    // 4. Get current cohort config for new lead assignment
    const cohortConfig = await prisma.cohortConfig.findFirst({
      orderBy: { createdAt: "desc" }, // Get most recent config
    });

    // 5. Create new lead
    const newLead = await prisma.lead.create({
      data: {
        email: leadData.email.toLowerCase(),
        phone: leadData.phone,
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        status: LeadStatus.NEW,
        source: leadData.source,
        consentEmail: leadData.consentEmail,
        consentSms: leadData.consentSms,
        consentCall: leadData.consentCall,
        rawData: leadData.metadata,
        managedByAutonomous: true, // Use Holly autonomous agent for all new leads
        cohort: cohortConfig?.currentCohortName || "COHORT_1", // Assign current cohort
        cohortStartDate: cohortConfig?.cohortStartDate || new Date(),
        activities: {
          create: {
            type: ActivityType.WEBHOOK_RECEIVED,
            channel: CommunicationChannel.SYSTEM,
            content: "New lead received from webhook",
            metadata: leadData.metadata as any,
          },
        },
      },
    });

    // 5. Log successful webhook event
    await prisma.webhookEvent.create({
      data: {
        source: "lead_provider",
        eventType: "lead.created",
        payload: body,
        processed: true,
      },
    });

    // 6. TODO: Trigger automation workflows
    // This will be implemented in the automation phase

    return NextResponse.json({
      success: true,
      leadId: newLead.id,
      duplicate: false,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);

    // Log failed webhook event
    try {
      await prisma.webhookEvent.create({
        data: {
          source: "lead_provider",
          eventType: "lead.error",
          payload: {},
          processed: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    } catch (dbError) {
      console.error("Failed to log webhook error:", dbError);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
