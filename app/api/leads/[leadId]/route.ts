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

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Update lead
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        ...otherUpdates,
        ...(status && { status }),
        updatedAt: new Date(),
      },
    });

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
    }

    return NextResponse.json(updatedLead);
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}
