import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Smart search query parser
 * Determines search type based on query pattern
 */
function parseSearchQuery(query: string) {
  const trimmed = query.trim().toLowerCase();

  // Empty query
  if (!trimmed) {
    return null;
  }

  // Email search (contains @)
  if (trimmed.includes("@")) {
    return { type: "email" as const, value: trimmed };
  }

  // Phone search (contains 3+ digits)
  if (/\d{3,}/.test(trimmed)) {
    const digitsOnly = trimmed.replace(/\D/g, "");
    return { type: "phone" as const, value: digitsOnly };
  }

  // Full name search (space-separated)
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      type: "fullName" as const,
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
    };
  }

  // Single word search (search both first and last name)
  return { type: "name" as const, value: trimmed };
}

/**
 * GET /api/leads/search?q=sarah
 *
 * Search leads by name, email, or phone
 * Returns lightweight lead data for quick display
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const statusFilter = searchParams.get("status");

    if (!query || query.trim().length < 2) {
      return NextResponse.json([]);
    }

    const parsed = parseSearchQuery(query);
    if (!parsed) {
      return NextResponse.json([]);
    }

    // Build where clause based on search type
    let where: any = {};

    switch (parsed.type) {
      case "email":
        where = {
          email: {
            contains: parsed.value,
            mode: "insensitive",
          },
        };
        break;

      case "phone":
        where = {
          phone: {
            contains: parsed.value,
          },
        };
        break;

      case "fullName":
        where = {
          AND: [
            {
              firstName: {
                contains: parsed.firstName,
                mode: "insensitive",
              },
            },
            {
              lastName: {
                contains: parsed.lastName,
                mode: "insensitive",
              },
            },
          ],
        };
        break;

      case "name":
        where = {
          OR: [
            {
              firstName: {
                contains: parsed.value,
                mode: "insensitive",
              },
            },
            {
              lastName: {
                contains: parsed.value,
                mode: "insensitive",
              },
            },
          ],
        };
        break;
    }

    // Add optional status filter
    if (statusFilter) {
      where = {
        AND: [where, { status: statusFilter }],
      };
    }

    // Execute search
    const leads = await prisma.lead.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        lastContactedAt: true,
        createdAt: true,
        managedByAutonomous: true,
        // Include minimal relations for context
        activities: {
          select: {
            type: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        communications: {
          select: {
            direction: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [
        { lastContactedAt: "desc" }, // Most recently contacted first
        { createdAt: "desc" }, // Then newest first
      ],
      take: 50, // Limit results for performance
    });

    // Format response with helpful metadata
    const results = leads.map((lead) => ({
      id: lead.id,
      name: `${lead.firstName} ${lead.lastName}`,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      lastActivity: lead.activities[0]?.createdAt || lead.communications[0]?.createdAt || lead.createdAt,
      lastActivityType: lead.activities[0]?.type || (lead.communications[0]?.direction === "INBOUND" ? "SMS_RECEIVED" : "SMS_SENT"),
      managedByAutonomous: lead.managedByAutonomous,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("[Search API] Error:", error);
    return NextResponse.json(
      { error: "Search failed", details: String(error) },
      { status: 500 }
    );
  }
}
