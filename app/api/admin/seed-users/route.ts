import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const teamMembers = [
  {
    email: "greg@inspired.mortgage",
    name: "Greg Williamson",
    role: "ADVISOR" as const,
    calLink: "https://cal.com/team/inspired-mortgage/mortgage-discovery-call",
    isActive: true,
  },
  {
    email: "jakub@inspired.mortgage",
    name: "Jakub Huncik",
    role: "ADVISOR" as const,
    calLink: "https://cal.com/team/inspired-mortgage/mortgage-discovery-call",
    isActive: true,
  },
  {
    email: "zach@inspired.mortgage",
    name: "Zach Silverman",
    role: "ADMIN" as const,
    isActive: true,
  },
  {
    email: "amanda@inspired.mortgage",
    name: "Amanda Schaffner",
    role: "ADMIN" as const,
    isActive: true,
  },
  {
    email: "kelly@inspired.mortgage",
    name: "Kelly Russell",
    role: "ADMIN" as const,
    isActive: true,
  },
];

// One-time use endpoint to seed users
// Call: POST /api/admin/seed-users with header X-Seed-Key: inspired2024
export async function POST(request: NextRequest) {
  const seedKey = request.headers.get("X-Seed-Key");

  // Simple protection - delete this endpoint after use
  if (seedKey !== "inspired2024seed") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { email: string; status: string; id?: string }[] = [];

  try {
    for (const member of teamMembers) {
      const user = await prisma.user.upsert({
        where: { email: member.email },
        update: {
          name: member.name,
          role: member.role,
          calLink: member.calLink,
          isActive: member.isActive,
        },
        create: member,
      });

      results.push({
        email: user.email,
        status: "success",
        id: user.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Users seeded successfully",
      users: results,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed users", details: String(error) },
      { status: 500 }
    );
  }
}

// GET to check existing users
export async function GET(request: NextRequest) {
  const seedKey = request.headers.get("X-Seed-Key");

  if (seedKey !== "inspired2024seed") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch users", details: String(error) },
      { status: 500 }
    );
  }
}
