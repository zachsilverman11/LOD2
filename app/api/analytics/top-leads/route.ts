import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Top Leads API
 * Returns highest-value leads by loan amount
 */
export async function GET() {
  try {
    // Get all active leads (not LOST or CONVERTED)
    const leads = await prisma.lead.findMany({
      where: {
        status: {
          notIn: ["LOST"],
        },
      },
      include: {
        communications: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        appointments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Parse loan amounts and sort by value
    const leadsWithValue = leads
      .map((lead) => {
        const rawData = lead.rawData as any;
        const loanAmount = parseFloat(rawData?.loanAmount || rawData?.loan_amount || "0");
        const purchasePrice = parseFloat(
          rawData?.purchasePrice || rawData?.home_value || rawData?.purchase_price || "0"
        );

        return {
          id: lead.id,
          name: `${lead.firstName} ${lead.lastName}`,
          email: lead.email,
          phone: lead.phone,
          status: lead.status,
          loanAmount: isNaN(loanAmount) ? 0 : loanAmount,
          purchasePrice: isNaN(purchasePrice) ? 0 : purchasePrice,
          loanType: rawData?.loanType || rawData?.lead_type || "Unknown",
          propertyType: rawData?.propertyType || rawData?.prop_type || "Unknown",
          city: rawData?.city || "Unknown",
          province: rawData?.province || rawData?.state || "Unknown",
          creditScore: rawData?.creditScore || rawData?.credit_score || "Unknown",
          createdAt: lead.createdAt,
          lastContactedAt: lead.lastContactedAt,
          lastMessage: lead.communications[0]?.content || null,
          lastMessageAt: lead.communications[0]?.createdAt || null,
          hasAppointment: lead.appointments.length > 0,
          appointmentDate: lead.appointments[0]?.scheduledAt || null,
        };
      })
      .filter((lead) => lead.loanAmount > 0) // Only include leads with loan amounts
      .sort((a, b) => b.loanAmount - a.loanAmount) // Sort by loan amount descending
      .slice(0, 20); // Top 20 leads

    // Calculate total value
    const totalValue = leadsWithValue.reduce((sum, lead) => sum + lead.loanAmount, 0);

    return NextResponse.json({
      success: true,
      data: {
        topLeads: leadsWithValue,
        totalValue,
        count: leadsWithValue.length,
      },
    });
  } catch (error) {
    console.error("Top leads error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch top leads",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
