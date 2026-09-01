/**
 * Post-cancellation behaviour (advisor-initiated cancellations)
 *
 * A cancellation by the advisor is a relationship moment the advisor should
 * own, not an automation trigger. After the Cal.com webhook sends Holly's one
 * apology + rebook offer, this module decides what the autonomous cron may do:
 *
 *   apology_due   — no outbound since the cancellation (webhook send was skipped
 *                   or failed): Holly may send the single apology.
 *   hold          — the apology went out less than HOLD_HOURS ago: do nothing,
 *                   no Claude call, next review at apology + HOLD_HOURS.
 *   follow_up_due — the hold has elapsed and only the apology has been sent:
 *                   Holly may send ONE light follow-up (no second apology).
 *   nurture       — apology + follow-up have both gone unanswered: hand the lead
 *                   to long-term nurture, no message, next review NURTURE_HOURS
 *                   after the last outbound.
 *   none          — no advisor cancellation on file, the lead has replied since
 *                   the cancellation, or the nurture hand-off window has passed
 *                   (normal cadence resumes: reply handling, the zero-reply
 *                   ladder in deal-intelligence, NURTURING reviews).
 *
 * Lead-initiated cancellations are deliberately NOT covered here; they keep the
 * existing flow (acknowledge, ask what happened, offer to rebook).
 *
 * Pure: no I/O, so it is unit-testable and cheap to call before any Claude call.
 */

export const POST_CANCELLATION_HOLD_HOURS = 48;
export const POST_CANCELLATION_NURTURE_HOURS = 14 * 24;

export type PostCancellationPhase =
  | 'none'
  | 'apology_due'
  | 'hold'
  | 'follow_up_due'
  | 'nurture';

export interface PostCancellationActivity {
  type: string;
  createdAt: Date;
  content?: string | null;
  metadata?: unknown;
}

export interface PostCancellationCommunication {
  direction: string;
  createdAt: Date;
}

export interface PostCancellationPolicy {
  phase: PostCancellationPhase;
  /** When the cron should look at this lead again, for hold / nurture. */
  nextReviewAt?: Date;
  /** The advisor-cancellation activity this policy is anchored on. */
  cancelledAt?: Date;
  /** Outbound messages sent since the cancellation (apology included). */
  outboundSinceCancellation: number;
  reason: string;
}

/**
 * True when an APPOINTMENT_CANCELLED activity records an advisor-initiated
 * cancellation. New records carry `metadata.cancelledByAdvisor`; records
 * written before that field existed are recognised by the "(by advisor)"
 * suffix the webhook has always appended to the content.
 */
export function isAdvisorCancellation(activity: PostCancellationActivity): boolean {
  if (activity.type !== 'APPOINTMENT_CANCELLED') return false;
  const meta = (activity.metadata ?? null) as { cancelledByAdvisor?: unknown } | null;
  if (meta && typeof meta.cancelledByAdvisor === 'boolean') return meta.cancelledByAdvisor;
  return /\(by advisor\)/i.test(activity.content ?? '');
}

export function resolvePostCancellationPolicy(params: {
  activities: ReadonlyArray<PostCancellationActivity> | null | undefined;
  communications: ReadonlyArray<PostCancellationCommunication> | null | undefined;
  now?: Date;
  holdHours?: number;
  nurtureHours?: number;
}): PostCancellationPolicy {
  const now = params.now ?? new Date();
  const holdMs = (params.holdHours ?? POST_CANCELLATION_HOLD_HOURS) * 3600_000;
  const nurtureMs = (params.nurtureHours ?? POST_CANCELLATION_NURTURE_HOURS) * 3600_000;

  const cancellation = (params.activities ?? [])
    .filter(isAdvisorCancellation)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  if (!cancellation) {
    return { phase: 'none', outboundSinceCancellation: 0, reason: 'No advisor-initiated cancellation on file' };
  }

  const cancelledAt = cancellation.createdAt;
  const since = (params.communications ?? []).filter(
    (c) => c.createdAt.getTime() >= cancelledAt.getTime()
  );

  if (since.some((c) => c.direction === 'INBOUND')) {
    return {
      phase: 'none',
      cancelledAt,
      outboundSinceCancellation: since.filter((c) => c.direction === 'OUTBOUND').length,
      reason: 'Lead has replied since the cancellation; normal conversation flow applies',
    };
  }

  const outbound = since
    .filter((c) => c.direction === 'OUTBOUND')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const count = outbound.length;
  const lastOutboundAt = outbound[0]?.createdAt;

  if (count === 0) {
    return {
      phase: 'apology_due',
      cancelledAt,
      outboundSinceCancellation: 0,
      reason: 'Advisor cancelled and no apology has gone out yet',
    };
  }

  if (count === 1) {
    const holdUntil = new Date(lastOutboundAt!.getTime() + holdMs);
    if (now.getTime() < holdUntil.getTime()) {
      return {
        phase: 'hold',
        nextReviewAt: holdUntil,
        cancelledAt,
        outboundSinceCancellation: 1,
        reason: `Apology sent; holding until ${holdUntil.toISOString()} before the single follow-up`,
      };
    }
    return {
      phase: 'follow_up_due',
      cancelledAt,
      outboundSinceCancellation: 1,
      reason: 'Apology sent and unanswered for the hold period; one light follow-up allowed',
    };
  }

  const nurtureUntil = new Date(lastOutboundAt!.getTime() + nurtureMs);
  if (now.getTime() < nurtureUntil.getTime()) {
    return {
      phase: 'nurture',
      nextReviewAt: nurtureUntil,
      cancelledAt,
      outboundSinceCancellation: count,
      reason: 'Apology and follow-up both unanswered; long-term nurture, no further automated touches for now',
    };
  }

  return {
    phase: 'none',
    cancelledAt,
    outboundSinceCancellation: count,
    reason: 'Nurture hand-off window has passed; normal NURTURING cadence resumes',
  };
}

/**
 * Prompt context for the one follow-up Holly may send after the advisor's
 * cancellation. Rendered into the decision prompt only in `follow_up_due`.
 */
export function buildPostCancellationFollowUpContext(params: {
  firstName: string;
  cancelledAt: Date;
  isAltPrivate: boolean;
}): string {
  const { firstName, isAltPrivate } = params;
  return `
---

## 🤝 POST-CANCELLATION FOLLOW-UP (THE ONLY ONE)

Our advisor cancelled ${firstName}'s booked call. Holly already sent one apology with a rebook offer, and ${firstName} has not replied since. The advisor has been asked to reach out personally.

This is the single automated follow-up after that cancellation. After this message Holly goes quiet and the lead moves to long-term nurture; silence here is "deciding", not "lost".

**Rules for this message:**
- Do NOT apologise again. The apology was sent once; repeating it makes the cancellation bigger, not smaller.
- One short, low-pressure line. Make it easy to say "yes, book me" or "not now" and just as easy to say nothing.
- Offer a specific way back in (a couple of real times if available, or "reply with a day that works").
- Do NOT promise this is your last message, and do NOT announce future cadence. Say nothing about it.
${isAltPrivate ? '- This is an alt_private lead: no Mortgage Strategy Report, no rate-vs-cost hook, no cash back, no bankable programs. The call is about understanding their situation and whether a path exists.' : ''}
- If you judge that even one more message would be too much, choose \`wait\` and let the lead come back on their own.
`;
}

/**
 * Slack alert text for the team when a cancellation comes in. The advisor who
 * cancelled owns the apology; Holly's automation is deliberately restrained.
 */
export function buildCancellationSlackDetails(params: {
  cancelledByAdvisor: boolean;
  advisorName?: string | null;
  cancellationReason?: string | null;
  hollyDisabled?: boolean;
}): { type: 'lead_escalated' | 'lead_rotting'; details: string } {
  const reasonLine = params.cancellationReason ? `\nReason: ${params.cancellationReason}` : '';
  if (params.cancelledByAdvisor) {
    const who = params.advisorName ? `${params.advisorName} cancelled` : 'The advisor cancelled';
    return {
      type: 'lead_escalated',
      details:
        `📅 ${who} this lead's booked call.${reasonLine}\n\n` +
        `👤 *Please reach out personally to apologise and rebook.* The person who cancelled should own this.\n\n` +
        `🤖 Holly: one short apology + rebook offer now${params.hollyDisabled ? ' (skipped: Holly disabled)' : ''}, ` +
        `then holds for ${POST_CANCELLATION_HOLD_HOURS}h, at most one further follow-up, then long-term nurture.`,
    };
  }
  return {
    type: 'lead_rotting',
    details: `Appointment cancelled by lead${reasonLine}\nHolly will reach out to re-engage${params.hollyDisabled ? ' (when re-enabled)' : ''}.`,
  };
}
