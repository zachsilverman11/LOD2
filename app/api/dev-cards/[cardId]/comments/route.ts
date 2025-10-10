import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST create new comment on a dev card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const body = await request.json();
    const { content, authorName } = body;

    if (!content || !authorName) {
      return NextResponse.json(
        { error: "Missing required fields: content, authorName" },
        { status: 400 }
      );
    }

    const comment = await prisma.devCardComment.create({
      data: {
        cardId,
        content,
        authorName,
      }
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
