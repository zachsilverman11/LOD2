import { NextRequest, NextResponse } from "next/server";
import { withdrawConsent } from "@/lib/compliance";
import { z } from "zod";

const withdrawConsentSchema = z.object({
  leadId: z.string(),
  channel: z.enum(["email", "sms", "call", "all"]),
});

/**
 * Withdraw consent for communications (CASL compliance)
 * POST /api/compliance/consent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = withdrawConsentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { leadId, channel } = validationResult.data;

    const result = await withdrawConsent(leadId, channel);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error withdrawing consent:", error);
    return NextResponse.json(
      { error: "Failed to withdraw consent" },
      { status: 500 }
    );
  }
}
