/**
 * FinanceVine relay handling
 *
 * FinanceVine sends its intro SMS to a new lead from ITS OWN number (a 778,
 * constant across all leads). Every reply the lead sends to that number is
 * forwarded to our Twilio number wrapped in Twilio's forwarding format:
 *
 *     NEW MESSAGE FROM: <lead number> BODY: <what the lead wrote>
 *
 * The forwarded SMS therefore arrives with From = the vendor's 778, not the
 * lead. Replying in that thread would talk to FinanceVine, not the lead. This
 * module recognises the relay, pulls the lead's real number and words out of
 * the body, attributes them to the right Lead row (creating a provisional row
 * when the lead webhook has not landed yet), records the reply as an inbound
 * Communication so Holly has it as context, and hands off to Holly so her
 * reply goes out as a FRESH outbound from our number to the lead's number.
 *
 * Invariants (pinned by tests/financevine-relay.test.ts):
 *  - Nothing addressed to the 778 ever gets a reply: no TwiML <Message>, no
 *    Inngest event carrying the 778, no Lead row whose phone is the 778.
 *  - A relayed "no" is an answer to the vendor's "any questions right now?",
 *    not disinterest and not an opt-out. It opens the direct thread.
 *  - Explicit opt-out language suppresses outreach immediately and persists.
 *  - A malformed relay fails loudly (Slack alert + unprocessed WebhookEvent),
 *    never silently.
 *
 * See notes/financevine-relay.md.
 */

import { prisma } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/sms";
import { inngest } from "@/lib/inngest";
import { sendErrorAlert, sendSlackNotification } from "@/lib/slack";
import { findLeadByPhone } from "@/lib/phone-matching";
import { ActivityType, CommunicationChannel } from "@/app/generated/prisma";

// ---------------------------------------------------------------------------
// Sender recognition
// ---------------------------------------------------------------------------

/**
 * The vendor's relay number, pinned via env. When set, a relay-format body
 * from any OTHER sender is treated as suspicious (alerted, not processed) and
 * a NON-relay body from this sender is treated as a malformed relay. When not
 * set, recognition falls back to the body format alone — see
 * notes/financevine-relay.md for why the env pin matters.
 */
export function getPinnedRelaySender(): string | null {
  const raw = process.env.FINANCEVINE_RELAY_NUMBER?.trim();
  if (!raw) return null;
  return normalizePhoneNumber(raw);
}

export function isPinnedRelaySender(from: string): boolean {
  const pinned = getPinnedRelaySender();
  if (!pinned) return false;
  return normalizePhoneNumber(from) === pinned;
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

/**
 * Twilio's forwarding format. Labels are matched case-insensitively, the
 * colon after each label is optional, and whitespace/newlines between the
 * parts are tolerated. `BODY` is matched lazily so a lead whose reply itself
 * contains the word "body" is still split at the first label.
 */
const RELAY_BODY_PATTERN =
  /^\s*NEW\s+MESSAGE\s+FROM\s*:?\s*([^\n]*?)\s*(?:\n\s*)?BODY\s*:?\s*([\s\S]*)$/i;

/**
 * Cheap pre-check used to decide whether the relay branch applies at all.
 * Anchored to the start: a forwarded message always BEGINS with the label,
 * whereas a lead writing "I got a new message from my bank" does not.
 */
export function looksLikeRelayFormat(body: string): boolean {
  return /^\s*NEW\s+MESSAGE\s+FROM\b/i.test(body);
}

/**
 * Normalise the number inside a relay body to E.164. FinanceVine's webhook
 * sends 10 digits with no country code; the relay body may carry the same, or
 * 11 digits with a leading 1, or full E.164, or punctuation. Anything else is
 * rejected rather than guessed at — a wrong number here would text a stranger.
 */
export function normalizeRelayPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export type ParsedRelay =
  | { ok: true; leadPhone: string; message: string }
  | { ok: false; reason: string };

export function parseRelayBody(body: string): ParsedRelay {
  const match = RELAY_BODY_PATTERN.exec(body);
  if (!match) {
    return { ok: false, reason: "body does not match NEW MESSAGE FROM / BODY format" };
  }

  const leadPhone = normalizeRelayPhone(match[1]);
  if (!leadPhone) {
    return { ok: false, reason: "number in relay body is not a 10/11-digit North American number" };
  }

  const message = match[2].trim();
  if (!message) {
    return { ok: false, reason: "relay body carries no message text" };
  }

  return { ok: true, leadPhone, message };
}

// ---------------------------------------------------------------------------
// Opt-out classification
// ---------------------------------------------------------------------------

/**
 * Genuine opt-out language. Deliberately explicit: the vendor's intro asks
 * "any questions right now?", so "no", "nope", "no thanks", "not right now"
 * are answers to that question and must NOT match. Shared with the agent's
 * FinanceVine first-inbound guard so both paths agree on what an opt-out is.
 */
export const OPT_OUT_PATTERNS: RegExp[] = [
  /\bstop\b/i,
  /\bunsubscribe\b/i,
  /\bopt\s*(?:-\s*)?out\b/i,
  /\b(?:don'?t|do\s+not|dont|never|quit|stop)\s+(?:ever\s+)?(?:contact|text|message|msg|call|bother|email)\b/i,
  /\bremove\s+me\b/i,
  /\btake\s+me\s+off\b/i,
  /\bleave\s+me\s+alone\b/i,
  // "not interested" as a stance. "not interested in refinancing, I want to
  // buy" is a topic correction, not an opt-out, hence the negative lookahead.
  /\b(?:not|no\s+longer|isn'?t|aren'?t|am\s+not|i'?m\s+not|we'?re\s+not)\s+interested\b(?!\s+in\b)/i,
  /\bwrong\s+(?:number|person)\b/i,
];

export function isOptOutMessage(message: string): boolean {
  return OPT_OUT_PATTERNS.some((pattern) => pattern.test(message));
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

export const PROVISIONAL_EMAIL_DOMAIN = "provisional.invalid";

/**
 * Placeholder email for a provisional row. Lead.email is required and unique;
 * the FinanceVine webhook replaces it with the real address when it lands
 * (its existing-lead lookup is OR(email, phone), so it finds the row by phone).
 */
export function provisionalEmailFor(leadPhone: string): string {
  return `financevine-relay-${leadPhone.replace(/\D/g, "")}@${PROVISIONAL_EMAIL_DOMAIN}`;
}

/**
 * Head start given to the vendor webhook when the reply beat it. The webhook
 * fires the same instant the intro does, so a couple of minutes is enough for
 * it to land and replace the placeholder name/profile before Holly opens.
 */
export const PROVISIONAL_HOLLY_DELAY_SECONDS = 120;

export type RelayOutcome =
  | { kind: "malformed"; reason: string }
  | { kind: "unexpected_sender"; reason: string }
  | { kind: "duplicate"; leadId: string }
  | { kind: "opt_out"; leadId: string; provisional: boolean }
  | { kind: "queued"; leadId: string; provisional: boolean; leadPhone: string };

export interface RelayInput {
  from: string;
  body: string;
  messageSid?: string;
}

function maskDigits(value: string): string {
  return value.replace(/\d/g, "#");
}

async function failLoudly(
  input: RelayInput,
  reason: string,
  eventType: "sms.relay.malformed" | "sms.relay.unexpected_sender"
): Promise<void> {
  console.error(`[FinanceVine Relay] ❌ ${eventType}: ${reason}`);

  await prisma.webhookEvent.create({
    data: {
      source: "twilio",
      eventType,
      payload: { from: input.from, body: input.body, messageSid: input.messageSid ?? null },
      processed: false,
      error: reason,
    },
  });

  await sendErrorAlert({
    error: new Error(`FinanceVine relay ${eventType}: ${reason}`),
    context: {
      location: "webhooks/twilio - FinanceVine relay",
      details: {
        messageSid: input.messageSid,
        fromShape: maskDigits(input.from),
        bodyShape: maskDigits(input.body).slice(0, 120),
        bodyLength: input.body.length,
      },
    },
  });
}

/**
 * Process one inbound Twilio message that is (or claims to be) a FinanceVine
 * relay. Never sends anything to `input.from`. The caller must respond to
 * Twilio with EMPTY TwiML regardless of the outcome.
 */
export async function processFinanceVineRelay(input: RelayInput): Promise<RelayOutcome> {
  const pinnedSender = getPinnedRelaySender();
  const fromNormalized = normalizePhoneNumber(input.from);

  // A relay-format body from someone other than the pinned vendor number is
  // either a misconfiguration or someone trying to make Holly text a number of
  // their choosing. Alert, and do not act on the body.
  if (pinnedSender && fromNormalized !== pinnedSender) {
    const reason = `relay-format body from a sender other than FINANCEVINE_RELAY_NUMBER`;
    await failLoudly(input, reason, "sms.relay.unexpected_sender");
    return { kind: "unexpected_sender", reason };
  }

  const parsed = parseRelayBody(input.body);
  if (!parsed.ok) {
    await failLoudly(input, parsed.reason, "sms.relay.malformed");
    return { kind: "malformed", reason: parsed.reason };
  }

  const ourNumber = process.env.TWILIO_PHONE_NUMBER
    ? normalizePhoneNumber(process.env.TWILIO_PHONE_NUMBER)
    : null;
  if (parsed.leadPhone === fromNormalized || (ourNumber && parsed.leadPhone === ourNumber)) {
    const reason = "number in relay body is the relay sender or our own number";
    await failLoudly(input, reason, "sms.relay.malformed");
    return { kind: "malformed", reason };
  }

  const { leadPhone, message } = parsed;

  // Twilio retries webhooks it thinks failed. Communication.twilioSid is
  // unique, so a retry must be a no-op rather than a crash or a second reply.
  if (input.messageSid) {
    const existing = await prisma.communication.findUnique({
      where: { twilioSid: input.messageSid },
      select: { leadId: true },
    });
    if (existing) {
      console.log(`[FinanceVine Relay] ↩️  Duplicate MessageSid, already attributed to ${existing.leadId}`);
      return { kind: "duplicate", leadId: existing.leadId };
    }
  }

  // Attribution: the lead's REAL number, never the sender's.
  let lead = await findLeadByPhone(leadPhone);
  let provisional = false;

  if (!lead) {
    // Reply beat the webhook. Create a provisional row keyed on the normalised
    // number; the webhook's OR(email, phone) lookup will find and fill it in.
    provisional = true;
    const now = new Date();
    lead = await prisma.lead.create({
      data: {
        email: provisionalEmailFor(leadPhone),
        phone: leadPhone,
        firstName: "Unknown",
        lastName: "",
        status: "NEW",
        source: "financevine",
        segment: "alt_private",
        consentSms: true,
        consentEmail: false,
        consentCall: false,
        rawData: {
          source: "financevine",
          provisional: true,
          provisionalReason: "relayed reply arrived before the FinanceVine lead webhook",
          relayFirstSeenAt: now.toISOString(),
          ingestTimestamp: now.toISOString(),
        },
      },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: ActivityType.NOTE_ADDED,
        channel: CommunicationChannel.SYSTEM,
        content:
          "Provisional lead created from a FinanceVine relayed reply that arrived before the lead webhook. The webhook will fill in name, email and profile when it lands.",
        metadata: { provisional: true, relay: true, messageSid: input.messageSid ?? null },
      },
    });

    console.log(`[FinanceVine Relay] 🆕 Provisional lead ${lead.id} created ahead of webhook`);
  }

  // Store the lead's words (not the wrapper) so Holly and the dashboard see
  // exactly what the lead said. Relay provenance lives in metadata.
  await prisma.communication.create({
    data: {
      leadId: lead.id,
      channel: CommunicationChannel.SMS,
      direction: "INBOUND",
      content: message,
      twilioSid: input.messageSid,
      metadata: {
        from: leadPhone,
        relay: true,
        relayedVia: fromNormalized,
        relaySource: "financevine",
      },
    },
  });

  const optOut = isOptOutMessage(message);

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: ActivityType.SMS_RECEIVED,
      channel: CommunicationChannel.SMS,
      content: optOut
        ? `Lead opted out in a reply relayed from FinanceVine's intro: "${message}"`
        : `Reply relayed from FinanceVine's intro: "${message}"`,
      metadata: {
        messageSid: input.messageSid ?? null,
        from: leadPhone,
        relay: true,
        relayedVia: fromNormalized,
        optOut,
      },
    },
  });

  if (optOut) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { consentSms: false, nextReviewAt: null },
    });
    console.log(`[FinanceVine Relay] 🚫 Lead ${lead.id} opted out via relay; outreach suppressed`);
    return { kind: "opt_out", leadId: lead.id, provisional };
  }

  if (lead.status === "CONTACTED") {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "ENGAGED" } });
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: ActivityType.STATUS_CHANGE,
        channel: CommunicationChannel.SYSTEM,
        content: "Lead status changed from CONTACTED to ENGAGED (replied via FinanceVine relay)",
      },
    });
  }

  if (provisional) {
    await sendSlackNotification({
      type: "new_lead",
      leadName: "FinanceVine lead (details pending)",
      leadId: lead.id,
      details:
        "Replied to FinanceVine's intro before the lead webhook arrived. Provisional record created from the relay; Holly opens the direct thread shortly.",
    });
  }

  // Hand off to Holly. Her reply goes to lead.phone (the lead's real number)
  // from our Twilio number: a brand-new direct thread. A provisional lead gets
  // a short delay so the vendor webhook can land first.
  const delaySeconds = provisional ? PROVISIONAL_HOLLY_DELAY_SECONDS : 0;
  try {
    await inngest.send({
      name: "lead/reply",
      data: {
        leadId: lead.id,
        message,
        phone: leadPhone,
        relay: true,
        ...(delaySeconds > 0 ? { delaySeconds } : {}),
      },
    });
    console.log(`[Inngest] ✅ Queued relay reply for lead ${lead.id}${delaySeconds ? ` (delay ${delaySeconds}s)` : ""}`);
  } catch (error) {
    console.error(`[Inngest] ❌ Failed to queue relay reply for lead ${lead.id}:`, error);
    await sendErrorAlert({
      error: error instanceof Error ? error : new Error(String(error)),
      context: {
        location: "webhooks/twilio - FinanceVine relay Inngest queue send",
        leadId: lead.id,
      },
    });
  }

  // Cron fallback, mirroring the direct-inbound path: due now (or after the
  // provisional head start) so the 15-min autonomous cron picks the lead up
  // if Inngest does not.
  await prisma.lead.update({
    where: { id: lead.id },
    data: { nextReviewAt: new Date(Date.now() + delaySeconds * 1000) },
  });

  return { kind: "queued", leadId: lead.id, provisional, leadPhone };
}

// ---------------------------------------------------------------------------
// Holly context
// ---------------------------------------------------------------------------

/**
 * Extra briefing for Holly when the latest inbound reached us through the
 * relay. Holly is then about to send the FIRST message the lead will ever see
 * from our number, in answer to something they said to the vendor's number.
 */
export function buildRelayHandoffContext(lead: {
  firstName?: string | null;
  communications?: Array<{ direction: string; content: string; metadata?: unknown; createdAt?: Date }>;
}): string | undefined {
  const comms = lead.communications ?? [];
  const inbound = comms
    .filter((c) => c.direction === "INBOUND")
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  const latest = inbound[0];
  const meta = latest?.metadata as { relay?: boolean } | null | undefined;
  if (!latest || !meta?.relay) return undefined;

  const hasOurOutbound = comms.some((c) => c.direction === "OUTBOUND");
  const nameKnown = !!lead.firstName && lead.firstName !== "Unknown";
  const bareNo = /^\W*(no|nope|nah|not\s+(right\s+)?now|not\s+at\s+the\s+moment|no\s+thanks?|nothing)\W*$/i.test(
    latest.content.trim()
  );

  return `## 📨 RELAYED REPLY — CONTINUATION FROM FINANCEVINE'S NUMBER

The lead's latest message ("${latest.content.trim()}") was sent to FinanceVine's intro text, which came from a DIFFERENT number and asked whether they had any questions right now. It was forwarded to us. ${
    hasOurOutbound
      ? "The lead has also been messaging with you on this number; treat both threads as one conversation."
      : "You are about to send the FIRST message they will ever see from this number."
  }

How to handle it:
- Open as a continuation of the FinanceVine handoff, not as a cold first contact. In the first line make the number change feel expected: you are picking up from the FinanceVine text, on behalf of Inspired Mortgage (name it), from our own number.
- Answer what they actually said. Do not re-ask a question they just answered.
${
  bareNo
    ? `- Their "${latest.content.trim()}" answers "any questions right now?". It is NOT disinterest and NOT an opt-out. Do not treat it as a decline, do not apologise for reaching out. Open warmly, acknowledge that they have no questions yet, and offer the short call as the easy next step.`
    : `- If the reply reads as a question or a situation, answer it in their terms before offering the call.`
}
${nameKnown ? "" : "- Their name is not on file yet. Do NOT address them as \"Unknown\" or with any placeholder; open without a name."}
- Every existing rule for this segment still applies in full (no rates, no figures, no approval language, no bankable programs).`;
}
