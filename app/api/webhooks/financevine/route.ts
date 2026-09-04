import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSlackNotification, sendErrorAlert } from "@/lib/slack";
import { correctNames } from "@/lib/name-correction";
import { deriveLeadSegment } from "@/lib/lead-segmentation";
import {
  describeFigureFormats,
  normalizeFinanceVinePayload,
  payloadKeys,
  toRawDataOverlay,
  toSegmentationInput,
} from "@/lib/financevine-payload";

/**
 * Statuses the autonomous Holly cron will NOT act on. Mirrors the eligibility
 * filter in lib/holly/agent.ts (:1016) — pulling `nextReviewAt` forward for a
 * lead in any of these states is a no-op, so we notify a human instead.
 */
const HOLLY_CRON_INELIGIBLE_STATUSES = [
  "LOST",
  "CONVERTED",
  "DEALS_WON",
  "APPLICATION_STARTED",
  "CALL_SCHEDULED",
];

/**
 * FinanceVine timing: 5-min opt-out window on their number + ~30-min handoff
 * delay before the first Inspired SMS.
 */
const FINANCEVINE_HANDOFF_DELAY_MINUTES = 30;

/**
 * Would the autonomous cron pick this lead up at all?
 */
export function isHollyContactable(lead: {
  status: string;
  consentSms: boolean;
  managedByAutonomous: boolean;
  hollyDisabled: boolean;
}): boolean {
  return (
    lead.consentSms &&
    lead.managedByAutonomous &&
    !lead.hollyDisabled &&
    !HOLLY_CRON_INELIGIBLE_STATUSES.includes(lead.status)
  );
}

/**
 * A re-submission is a strong buying signal, so it should never sit behind a
 * cadence set by an older conversation. Pull `nextReviewAt` forward to the
 * handoff delay when the lead is contactable and its current review is further
 * out (or unset) — but NEVER push it later, which would delay a lead already
 * due for contact.
 */
export function resolveResubmissionReview(
  lead: {
    status: string;
    consentSms: boolean;
    managedByAutonomous: boolean;
    hollyDisabled: boolean;
    nextReviewAt: Date | null;
  },
  handoffAt: Date
): { shouldSchedule: boolean; reason: string } {
  if (!isHollyContactable(lead)) {
    return {
      shouldSchedule: false,
      reason: `lead is not in the autonomous cron's scope (status ${lead.status}${
        lead.hollyDisabled ? ", Holly disabled" : ""
      }${lead.consentSms ? "" : ", SMS consent withdrawn"})`,
    };
  }

  if (lead.nextReviewAt !== null && lead.nextReviewAt <= handoffAt) {
    return {
      shouldSchedule: false,
      reason: `already due sooner (${lead.nextReviewAt.toISOString()})`,
    };
  }

  return {
    shouldSchedule: true,
    reason:
      lead.nextReviewAt === null
        ? "no review was scheduled"
        : `review was ${lead.nextReviewAt.toISOString()}`,
  };
}

/**
 * Which communication channels this lead has WITHDRAWN consent for.
 *
 * `consentSms: false` is the opt-out marker across the codebase — Twilio sets
 * it on a STOP reply (app/api/webhooks/twilio/route.ts:99) and on a carrier
 * unsubscribe, and CASL withdrawal sets any of the three
 * (lib/compliance.ts:145).
 *
 * It exists because re-submitting the FinanceVine form must NOT be read as
 * fresh consent. The vendor SMS-verifies leads, so the create path grants all
 * three channels — but on the update path a lead who opted out would have had
 * `consentSms: true` written straight back over their opt-out, putting them
 * back in Holly's reach on the next cron pass. A withdrawal is never undone by
 * a form re-fill; only the lead can restore it.
 */
export function withdrawnConsentChannels(lead: {
  consentSms: boolean;
  consentEmail: boolean;
  consentCall: boolean;
}): string[] {
  const withdrawn: string[] = [];
  if (!lead.consentSms) withdrawn.push("SMS");
  if (!lead.consentEmail) withdrawn.push("email");
  if (!lead.consentCall) withdrawn.push("call");
  return withdrawn;
}

/**
 * Webhook endpoint for FinanceVine leads via Zapier
 * 
 * These are typically private/alternative leads:
 * - Income issues
 * - Bruised credit
 * - Need funds ASAP
 * - Construction/unusual property
 * - Bank said no or borrower unsure
 * 
 * Exclusive Google-search leads, SMS-verified.
 * 
 * Handoff timing:
 * - Wait 5 minutes after ingest (FinanceVine processes opt-outs on their number)
 * - If lead hasn't inbound-replied to us, wait ~30 minutes before first Inspired SMS
 * - If they inbound on our number sooner, reply immediately
 */
export async function POST(req: NextRequest) {
  try {
    // Optional webhook authentication
    const webhookSecret = process.env.FINANCEVINE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const headerSecret = req.headers.get("X-Webhook-Secret");
      const querySecret = req.nextUrl.searchParams.get("key");
      const providedSecret = headerSecret || querySecret;

      if (providedSecret !== webhookSecret) {
        console.warn("[FinanceVine] Webhook authentication failed - invalid secret");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    } else {
      console.warn("[FinanceVine] FINANCEVINE_WEBHOOK_SECRET not set - webhook is unauthenticated");
    }

    const payload = await req.json();

    console.log("[FinanceVine] Received lead - processing");

    // === PAYLOAD ADAPTER ===
    // FinanceVine posts two different shapes (their documented schema with
    // capitalized/spaced keys and Python `None`s, and the flat snake_case
    // shape this route has always taken). Both are normalized to one internal
    // input here, at the edge; NOTHING below this line reads the payload for
    // lead fields. See lib/financevine-payload.ts.
    const normalized = normalizeFinanceVinePayload(payload);

    if (!normalized.ok) {
      // Keys only, never values — this is what makes a schema drift
      // diagnosable from Vercel logs without exposing a lead's data.
      console.warn(
        `[FinanceVine] Rejected payload: ${normalized.error}. Received keys: ${JSON.stringify(
          normalized.keys
        )}`
      );

      // Record the drift, keys only. A rejected body is never stored: we do
      // not know what is in it, we are not creating a lead from it, and the
      // key set is the whole diagnostic. This write happens AFTER validation
      // on purpose — a malformed POST must not be able to put an arbitrary
      // body into the audit table.
      await prisma.webhookEvent.create({
        data: {
          source: "financevine",
          eventType: "rejected_payload",
          payload: { receivedKeys: normalized.keys, problems: normalized.problems },
          processed: true,
        },
      });

      return NextResponse.json(
        {
          error: normalized.error,
          problems: normalized.problems,
          receivedKeys: normalized.keys,
        },
        { status: 400 }
      );
    }

    // Log the webhook. Only a payload we could actually read gets stored.
    await prisma.webhookEvent.create({
      data: {
        source: "financevine",
        eventType: "new_lead",
        payload,
        processed: false,
      },
    });

    const input = normalized.lead;
    const {
      vendorLeadId,
      email,
      phone,
      mortgageType,
      primaryGoal,
      borrowerProfile,
    } = input;

    // Whether LTV arrives as "80", "80%" or "0.80", and whether money carries
    // "$" and commas, is not yet confirmed by the vendor. Log the SHAPE of
    // every figure (digits masked) so the real formats can be read off the
    // logs and this parser tightened, without a figure ever being printed.
    console.log(
      `[FinanceVine] Payload keys: ${JSON.stringify(
        payloadKeys(payload)
      )} | figure formats: ${describeFigureFormats(input)}`
    );

    // Parse and correct names
    const nameCorrectionResult = correctNames(input.firstName, input.lastName);
    const correctedFirstName = nameCorrectionResult.firstName;
    const correctedLastName = nameCorrectionResult.lastName;

    // Derive segment, intent, bankability from the normalized strings. The
    // vendor's value set is NOT enumerated, so the strings are passed straight
    // through to the natural-language aliases rather than matched to an enum.
    const segmentation = deriveLeadSegment({
      source: "financevine",
      rawData: toSegmentationInput(input),
    });

    // rawData: the payload EXACTLY as received, plus a canonical snake_case
    // overlay for the consumers that read loose keys off rawData (province for
    // timezone/SMS-hours, goal for prompts) and the parsed financials. The
    // untouched payload is also kept verbatim under `financevineRaw` so the
    // overlay can never be mistaken for what the vendor actually sent.
    const rawDataForLead = {
      ...(payload as Record<string, unknown>),
      ...toRawDataOverlay(input),
      financevineRaw: payload,
      ingestTimestamp: new Date().toISOString(), // For timing logic
    };

    // === DEDUPE ===
    // The vendor's own lead id comes first: the same vendor lead must never
    // create twice, even when they change the email they submit with.
    // Phone/email remain the fallback, so the snake_case shape (which carries
    // no vendor id) dedupes exactly as it always has.
    let existingLead = vendorLeadId
      ? await prisma.lead.findFirst({ where: { vendorLeadId } })
      : null;

    const dedupeKey = existingLead ? "vendorLeadId" : "phone/email";

    if (!existingLead) {
      existingLead = await prisma.lead.findFirst({
        where: {
          OR: [{ email }, { phone }],
        },
      });
    }

    if (existingLead) {
      console.log(
        `[FinanceVine] Matched existing lead ${existingLead.id} on ${dedupeKey}`
      );
    }

    // `email` is unique on Lead. When we matched on the vendor id and the lead
    // arrives with a NEW email, that email may already belong to a different
    // row — writing it would fail the whole webhook on a unique violation.
    // Keep the existing address in that case and say so.
    let emailForUpdate = email;
    if (existingLead && existingLead.email !== email) {
      const emailOwner = await prisma.lead.findFirst({ where: { email } });
      if (emailOwner && emailOwner.id !== existingLead.id) {
        console.warn(
          `[FinanceVine] Lead ${existingLead.id} submitted an email already held by ${emailOwner.id} - keeping the existing address`
        );
        emailForUpdate = existingLead.email;
      }
    }

    let lead;
    let resubmissionScheduled = false;

    if (existingLead) {
      // Update existing lead with new data
      lead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          firstName: correctedFirstName,
          lastName: correctedLastName,
          phone,
          email: emailForUpdate,
          source: "financevine",
          vendorLeadId: vendorLeadId ?? existingLead.vendorLeadId,
          segment: segmentation.segment,
          intent: segmentation.intent,
          bankability: segmentation.bankability,
          rawData: rawDataForLead,
          // NO consent fields here, deliberately. See withdrawnConsentChannels:
          // an opt-out or a CASL withdrawal must survive a re-submission, and
          // a channel that is already consented needs no rewrite. The create
          // path below is the only place consent is granted.
          updatedAt: new Date(),
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "WEBHOOK_RECEIVED",
          content: "Updated lead from FinanceVine webhook",
          metadata: payload,
        },
      });

      console.log(`[FinanceVine] Updated existing lead: ${lead.id}, source: financevine`);

      // === RE-SUBMISSION HANDLING ===
      // A returning lead re-filling the form is a fresh buying signal. Previously
      // the update path did neither of the two things below: no Slack fired and
      // nextReviewAt was left on whatever cadence an older conversation had set,
      // so a re-submission was a silent row mutation.
      const handoffAt = new Date(
        Date.now() + FINANCEVINE_HANDOFF_DELAY_MINUTES * 60 * 1000
      );
      const review = resolveResubmissionReview(lead, handoffAt);

      if (review.shouldSchedule) {
        try {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { nextReviewAt: handoffAt },
          });
          resubmissionScheduled = true;

          await prisma.leadActivity.create({
            data: {
              leadId: lead.id,
              type: "NOTE_ADDED",
              content: `🔁 Re-submitted the FinanceVine form. Next review pulled forward to ${handoffAt.toISOString()} (${review.reason}).`,
            },
          });

          console.log(
            `[FinanceVine] Re-submission: pulled nextReviewAt forward to ${handoffAt.toISOString()} for ${lead.id}`
          );
        } catch (error) {
          console.error("[FinanceVine] Failed to pull review forward:", error);
          await sendErrorAlert({
            error: error instanceof Error ? error : new Error(String(error)),
            context: {
              location: "webhooks/financevine - re-submission scheduling",
              leadId: lead.id,
            },
          });
        }
      } else {
        console.log(
          `[FinanceVine] Re-submission: left nextReviewAt alone for ${lead.id} — ${review.reason}`
        );
      }

      // Always notify, contactable or not. When we cannot schedule (lead is LOST,
      // converted, has a call booked, or Holly is off), the Slack message IS the
      // handoff to a human.
      const resubGoal = primaryGoal || mortgageType || "mortgage inquiry";
      const resubScheduleNote = resubmissionScheduled
        ? `Holly review pulled forward to ${handoffAt.toISOString()}.`
        : `Holly review NOT rescheduled — ${review.reason}.`;

      // Surface a withdrawal explicitly. Re-submitting the form does not undo
      // it, so a human needs to know why nothing automated will happen.
      const withdrawn = withdrawnConsentChannels(lead);
      const consentNote =
        withdrawn.length > 0
          ? `\n⚠️ Consent previously withdrawn for: ${withdrawn.join(", ")} — NOT re-granted by this re-submission.`
          : "";

      await sendSlackNotification({
        type: "lead_updated",
        leadName: `${correctedFirstName} ${correctedLastName}`,
        leadId: lead.id,
        details: `Re-submitted the FinanceVine form: ${resubGoal}\n\nStatus ${lead.status} · segment ${segmentation.segment} · intent ${segmentation.intent} · bankability ${segmentation.bankability}\n${resubScheduleNote}${consentNote}`,
      });
    } else {
      // Get current cohort config
      const cohortConfig = await prisma.cohortConfig.findFirst({
        orderBy: { createdAt: "desc" },
      });

      // Create new lead
      lead = await prisma.lead.create({
        data: {
          firstName: correctedFirstName,
          lastName: correctedLastName,
          email,
          phone,
          status: "NEW",
          source: "financevine",
          vendorLeadId,
          segment: segmentation.segment,
          intent: segmentation.intent,
          bankability: segmentation.bankability,
          rawData: rawDataForLead,
          consentSms: true, // FinanceVine leads are SMS-verified
          consentEmail: true,
          consentCall: true,
          managedByAutonomous: true,
          cohort: cohortConfig?.currentCohortName || "COHORT_1",
          cohortStartDate: cohortConfig?.cohortStartDate || new Date(),
        },
      });

      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "WEBHOOK_RECEIVED",
          content: "New lead created from FinanceVine webhook",
          metadata: payload,
        },
      });

      // Log name correction if it occurred
      if (nameCorrectionResult.wasCorrected) {
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: "NOTE_ADDED",
            content: `✅ Name auto-corrected: "${nameCorrectionResult.originalFirstName} ${nameCorrectionResult.originalLastName}" → "${correctedFirstName} ${correctedLastName}"`,
            metadata: {
              reason: nameCorrectionResult.reason,
              originalFirstName: nameCorrectionResult.originalFirstName,
              originalLastName: nameCorrectionResult.originalLastName,
              correctedFirstName,
              correctedLastName,
            },
          },
        });
      }

      console.log(`[FinanceVine] Created new lead: ${lead.id}, source: financevine`);

      // Send Slack notification for new lead
      const goalInfo = primaryGoal || mortgageType || "mortgage inquiry";
      const bankabilityNote =
        borrowerProfile && borrowerProfile.toLowerCase().includes("not approved")
          ? " (bank said no)"
          : borrowerProfile && borrowerProfile.toLowerCase().includes("unsure")
          ? " (unsure about bank approval)"
          : "";

      const slackDetails = nameCorrectionResult.wasCorrected
        ? `${goalInfo}${bankabilityNote}\n\n✅ Name auto-corrected from "${nameCorrectionResult.originalFirstName} ${nameCorrectionResult.originalLastName}"`
        : `${goalInfo}${bankabilityNote}`;

      await sendSlackNotification({
        type: "new_lead",
        leadName: `${correctedFirstName} ${correctedLastName}`,
        leadId: lead.id,
        details: slackDetails,
      });
    }

    // Mark webhook as processed
    await prisma.webhookEvent.updateMany({
      where: {
        source: "financevine",
        payload: { equals: payload },
        processed: false,
      },
      data: { processed: true },
    });

    // 🚀 AUTONOMOUS HOLLY CONTACT - Only for new leads
    // FinanceVine timing: 5-min opt-out window + 30-min handoff delay
    // Set nextReviewAt to ~30 minutes from now so the cron will pick it up after the handoff delay
    if (!existingLead && lead.consentSms) {
      console.log(`[Autonomous Holly] Scheduling FinanceVine lead for first contact in ~30 minutes: ${lead.id}`);

      try {
        const nextReviewAt = new Date(Date.now() + FINANCEVINE_HANDOFF_DELAY_MINUTES * 60 * 1000);

        await prisma.lead.update({
          where: { id: lead.id },
          data: { nextReviewAt },
        });

        console.log(`[Autonomous Holly] ✅ FinanceVine lead scheduled for review at ${nextReviewAt.toISOString()}`);
      } catch (error) {
        console.error("[Autonomous Holly] Failed to schedule FinanceVine lead:", error);

        // Send error alert to Slack
        await sendErrorAlert({
          error: error instanceof Error ? error : new Error(String(error)),
          context: {
            location: "webhooks/financevine - Autonomous Holly scheduling",
            leadId: lead.id,
            details: { firstName: correctedFirstName, lastName: correctedLastName, phone: lead.phone },
          },
        });

        // Don't fail the webhook - just log the error
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: "NOTE_ADDED",
            content: `Failed to schedule with autonomous agent: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      status: existingLead ? "updated" : "created",
      segment: segmentation.segment,
      aiContactScheduled: existingLead
        ? resubmissionScheduled
        : lead.consentSms,
    });
  } catch (error) {
    console.error("[FinanceVine] Webhook error:", error);

    // Send critical error alert to Slack
    await sendErrorAlert({
      error: error instanceof Error ? error : new Error(String(error)),
      context: {
        location: "webhooks/financevine - Webhook processing",
        details: { message: "Failed to process incoming webhook" },
      },
    });

    return NextResponse.json(
      {
        error: "Failed to process webhook",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "FinanceVine Webhook",
    timestamp: new Date().toISOString(),
    note: "FinanceVine leads via Zapier. Typical profile: alt/private (income, credit, speed, construction, bank said no). Handoff timing: 5min opt-out + 30min delay before first Inspired SMS.",
  });
}
