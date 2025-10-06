import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const body = await request.json();
    const { content, createdBy } = body;

    if (!content || !createdBy) {
      return NextResponse.json(
        { error: "Content and createdBy are required" },
        { status: 400 }
      );
    }

    const note = await prisma.note.create({
      data: {
        leadId: params.leadId,
        content,
        createdBy,
      },
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
