import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all active users with ADVISOR role
    const advisors = await prisma.user.findMany({
      where: {
        role: "ADVISOR",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        calLink: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(advisors);
  } catch (error) {
    console.error("Error fetching advisors:", error);
    return NextResponse.json(
      { error: "Failed to fetch advisors" },
      { status: 500 }
    );
  }
}
