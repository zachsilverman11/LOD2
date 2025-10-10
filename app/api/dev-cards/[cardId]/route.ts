import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET single dev card
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const card = await prisma.devCard.findUnique({
      where: { id: cardId },
      include: {
        comments: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(card);
  } catch (error) {
    console.error("Error fetching dev card:", error);
    return NextResponse.json(
      { error: "Failed to fetch dev card" },
      { status: 500 }
    );
  }
}

// PATCH update dev card
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const body = await request.json();
    const { status, title, description, type, priority, metadata } = body;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (priority !== undefined) updateData.priority = priority;
    if (metadata !== undefined) updateData.metadata = metadata;

    // If moving to DEPLOYED, set deployedAt timestamp
    if (status === "DEPLOYED") {
      updateData.deployedAt = new Date();
    }

    const card = await prisma.devCard.update({
      where: { id: cardId },
      data: updateData,
      include: {
        comments: true
      }
    });

    return NextResponse.json(card);
  } catch (error) {
    console.error("Error updating dev card:", error);
    return NextResponse.json(
      { error: "Failed to update dev card" },
      { status: 500 }
    );
  }
}

// DELETE dev card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    await prisma.devCard.delete({
      where: { id: cardId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting dev card:", error);
    return NextResponse.json(
      { error: "Failed to delete dev card" },
      { status: 500 }
    );
  }
}
