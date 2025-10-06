import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { leadId: string; taskId: string } }
) {
  try {
    const body = await request.json();
    const { completed } = body;

    const task = await prisma.task.update({
      where: { id: params.taskId },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}
