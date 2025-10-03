import { NextResponse } from "next/server";
import { initiateCall } from "@/lib/voice-ai";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { leadId } = await req.json();

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    // Get the lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.phone) {
      return NextResponse.json({ error: "Lead has no phone number" }, { status: 400 });
    }

    // Initiate the call
    const result = await initiateCall({
      phoneNumber: lead.phone,
      metadata: {
        leadId: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
      },
    });

    // Log the activity
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "CALL_INITIATED",
        channel: "VOICE",
        metadata: { callId: result.id },
      },
    });

    return NextResponse.json({
      success: true,
      callId: result.id,
      status: result.status,
    });
  } catch (error) {
    console.error("Error initiating call:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initiate call" },
      { status: 500 }
    );
  }
}
