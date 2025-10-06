import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const body = await request.json();
    const { title, description, assignedTo, createdBy, dueDate } = body;

    if (!title || !assignedTo || !createdBy) {
      return NextResponse.json(
        { error: "Title, assignedTo, and createdBy are required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        leadId: params.leadId,
        title,
        description,
        assignedTo,
        createdBy,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
