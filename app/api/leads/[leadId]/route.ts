import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ActivityType, CommunicationChannel } from "@/app/generated/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId: id } = await params;
  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        activities: {
          orderBy: { createdAt: "desc" },
        },
        appointments: {
          orderBy: { scheduledAt: "desc" },
        },
        communications: {
          orderBy: { createdAt: "desc" },
        },
        notes: {
          orderBy: { createdAt: "desc" },
        },
        tasks: {
          orderBy: { createdAt: "desc" },
        },
        callOutcomes: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Error fetching lead:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId: id } = await params;
  try {
    const body = await request.json();
    const { status, ...otherUpdates } = body;

    console.log(`[PATCH /api/leads/${id}] Updating lead with:`, { status, otherUpdates });

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      console.error(`[PATCH /api/leads/${id}] Lead not found`);
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    console.log(`[PATCH /api/leads/${id}] Current status: ${lead.status}, New status: ${status}`);

    // Update lead
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        ...otherUpdates,
        ...(status && { status }),
        updatedAt: new Date(),
      },
    });

    console.log(`[PATCH /api/leads/${id}] Lead updated successfully to status: ${updatedLead.status}`);

    // Log status change activity
    if (status && status !== lead.status) {
      await prisma.leadActivity.create({
        data: {
          leadId: id,
          type: ActivityType.STATUS_CHANGE,
          channel: CommunicationChannel.SYSTEM,
          content: `Status changed from ${lead.status} to ${status}`,
        },
      });
      console.log(`[PATCH /api/leads/${id}] Status change activity logged`);
    }

    // Log name change activity
    if ((body.firstName && body.firstName !== lead.firstName) || (body.lastName && body.lastName !== lead.lastName)) {
      const oldName = `${lead.firstName} ${lead.lastName}`;
      const newName = `${body.firstName || lead.firstName} ${body.lastName || lead.lastName}`;
      await prisma.leadActivity.create({
        data: {
          leadId: id,
          type: ActivityType.NOTE_ADDED,
          channel: CommunicationChannel.SYSTEM,
          content: `Name updated from "${oldName}" to "${newName}"`,
        },
      });
      console.log(`[PATCH /api/leads/${id}] Name change activity logged`);
    }

    return NextResponse.json(updatedLead);
  } catch (error) {
    console.error(`[PATCH /api/leads/${id}] Error updating lead:`, error);
    return NextResponse.json(
      { error: "Failed to update lead", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
