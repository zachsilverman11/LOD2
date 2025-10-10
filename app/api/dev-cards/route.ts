import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendDevCardNotification } from "@/lib/slack";

// GET all dev cards
export async function GET() {
  try {
    const cards = await prisma.devCard.findMany({
      include: {
        comments: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(cards);
  } catch (error) {
    console.error("Error fetching dev cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch dev cards" },
      { status: 500 }
    );
  }
}

// POST create new dev card
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, type, priority, createdBy, metadata } = body;

    if (!title || !type || !createdBy) {
      return NextResponse.json(
        { error: "Missing required fields: title, type, createdBy" },
        { status: 400 }
      );
    }

    const card = await prisma.devCard.create({
      data: {
        title,
        description,
        type,
        priority: priority || "MEDIUM",
        createdBy,
        metadata: metadata || undefined,
      },
      include: {
        comments: true
      }
    });

    // Send Slack notification for new dev card
    await sendDevCardNotification({
      id: card.id,
      title: card.title,
      type: card.type,
      priority: card.priority,
      createdBy: card.createdBy,
      description: card.description,
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("Error creating dev card:", error);
    return NextResponse.json(
      { error: "Failed to create dev card" },
      { status: 500 }
    );
  }
}
