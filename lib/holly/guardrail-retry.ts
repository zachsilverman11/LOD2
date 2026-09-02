/**
 * Guardrail retry feedback and loop bounding
 *
 * When a hard guardrail blocks Holly's message, the retry an hour later used
 * to regenerate from identical inputs with no idea what was rejected. For a
 * phrasing violation that is wasteful; for the alt-lending numeric guardrail
 * it is a trap, because the LTV / property value / balance she was blocked
 * for saying are sitting in her briefing and she will likely say them again.
 *
 * This module makes blocked retries informed and bounded:
 *   - the last rejection (message + reasons) is fed back into the next prompt
 *   - consecutive content blocks on a lead are counted
 *   - past GUARDRAIL_ESCALATION_THRESHOLD the lead is handed to a human and
 *     Holly stops retrying until someone messages the lead or the lead replies
 *
 * Everything here is pure and derives its state from the LeadActivity rows the
 * block path already writes (metadata.guardrailBlock), plus the escalation row
 * this feature adds (metadata.guardrailEscalation). No schema change.
 *
 * The streak resets on ANY communication, in either direction:
 *   - an inbound reply changes the inputs, so a fresh attempt is warranted
 *   - an outbound send (Holly's own, or an advisor's manual SMS) means the
 *     block chain was broken — that is what "human intervenes" looks like
 *
 * Guardrails stay hard blocks. Nothing here rewrites a message or weakens a
 * rule; it changes only what the model is told and how many tries it gets.
 */

/** Consecutive content blocks (since the last communication) before escalating. */
export const GUARDRAIL_ESCALATION_THRESHOLD = 3;

/** Retry delay after a content block that has not yet reached the threshold. */
export const GUARDRAIL_RETRY_HOURS = 1;

/**
 * How far out the lead is parked once escalated. A safety net, not a cadence:
 * the awaiting-human gate re-parks (and re-alerts) if nobody has acted by then,
 * so no lead is ever left without a scheduled review or an escalation.
 */
export const GUARDRAIL_ESCALATION_PARK_HOURS = 7 * 24;

export interface GuardrailActivityRow {
  createdAt: Date;
  metadata?: unknown;
}

export interface GuardrailCommunicationRow {
  createdAt: Date;
  direction: string;
}

export interface GuardrailBlockRecord {
  createdAt: Date;
  /** Content errors only (scheduling errors are stripped). */
  errors: string[];
  blockedAction?: string;
  blockedMessage?: string;
}

export interface GuardrailLoopState {
  /** Content blocks since the last communication in either direction. */
  consecutiveBlocks: number;
  /** Most recent content block in the streak, for the retry prompt. */
  lastBlock: GuardrailBlockRecord | null;
  /** An escalation is on file and nobody has messaged the lead since. */
  awaitingHuman: boolean;
  escalatedAt: Date | null;
  /** What ended the previous streak, if anything is on file. */
  lastCommunicationAt: Date | null;
}

/**
 * Scheduling errors are not the model's fault and carry no lesson: the same
 * message will pass at 8am, or once the anti-spam window has elapsed. They are
 * excluded from the streak and from the feedback prompt.
 */
export function isSchedulingError(error: string): boolean {
  return (
    error.includes('Outside SMS hours') ||
    error.includes('can only send 8am-9pm') ||
    error.startsWith('Too soon')
  );
}

/**
 * The reasons the model should act on: non-scheduling, de-duplicated, order
 * preserved. A message tripping both the numeric guardrail and the alt_private
 * phrase bans yields one list with each distinct reason exactly once.
 */
export function contentErrors(errors: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of errors) {
    const error = (raw ?? '').trim();
    if (!error || isSchedulingError(error) || seen.has(error)) continue;
    seen.add(error);
    out.push(error);
  }
  return out;
}

function metadataOf(row: GuardrailActivityRow): Record<string, unknown> {
  const m = row.metadata;
  return m && typeof m === 'object' && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
}

function asBlockRecord(row: GuardrailActivityRow): GuardrailBlockRecord | null {
  const meta = metadataOf(row);
  if (meta.guardrailBlock !== true) return null;
  const rawErrors = Array.isArray(meta.errors) ? (meta.errors as unknown[]) : [];
  const errors = contentErrors(rawErrors.filter((e): e is string => typeof e === 'string'));
  if (errors.length === 0) return null; // pure scheduling block: not a strike
  return {
    createdAt: row.createdAt,
    errors,
    blockedAction: typeof meta.blockedAction === 'string' ? meta.blockedAction : undefined,
    blockedMessage: typeof meta.blockedMessage === 'string' ? meta.blockedMessage : undefined,
  };
}

/**
 * Derive the loop state for a lead from its activity and communication rows.
 * Rows may be passed in any order and may include older rows; only those newer
 * than the latest communication count.
 */
export function resolveGuardrailLoopState(params: {
  activities: GuardrailActivityRow[];
  communications: GuardrailCommunicationRow[];
}): GuardrailLoopState {
  const lastCommunicationAt = params.communications.reduce<Date | null>((latest, c) => {
    if (!(c.createdAt instanceof Date) || isNaN(c.createdAt.getTime())) return latest;
    return !latest || c.createdAt > latest ? c.createdAt : latest;
  }, null);

  const sinceLastComm = params.activities
    .filter((a) => !lastCommunicationAt || a.createdAt > lastCommunicationAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const blocks = sinceLastComm.map(asBlockRecord).filter((b): b is GuardrailBlockRecord => b !== null);
  const escalation = sinceLastComm.find((a) => metadataOf(a).guardrailEscalation === true) ?? null;

  return {
    consecutiveBlocks: blocks.length,
    lastBlock: blocks[0] ?? null,
    awaitingHuman: escalation !== null,
    escalatedAt: escalation?.createdAt ?? null,
    lastCommunicationAt,
  };
}

const NUMERIC_REASON = /GUARDRAIL #8|rate percentage|specific rate|percentage|dollar amount|loan-to-value/i;

/**
 * Prompt context for a retry after a content block. Appended to the decision
 * prompt as extraContext, right before the decision task.
 *
 * Shape: what was rejected (verbatim, so the model has a concrete anchor for
 * "not this"), why (the guardrail's own wording, numbered), and the rules for
 * this attempt — including that the briefing's figures are for understanding
 * only, and that wait/escalate beat a third blocked send.
 */
export function buildGuardrailRetryContext(params: {
  lastBlock: GuardrailBlockRecord;
  /** 1-based number of the attempt about to be made. */
  attempt: number;
  threshold?: number;
}): string {
  const threshold = params.threshold ?? GUARDRAIL_ESCALATION_THRESHOLD;
  const { lastBlock } = params;
  const remaining = Math.max(0, threshold - (params.attempt - 1));
  const numeric = lastBlock.errors.some((e) => NUMERIC_REASON.test(e));

  const reasons = lastBlock.errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
  const rejected = lastBlock.blockedMessage
    ? `Rejected message (never sent — the lead did not see it):\n"${lastBlock.blockedMessage}"`
    : `Rejected action: ${lastBlock.blockedAction ?? 'unknown'} (never executed).`;

  return `
## ⛔ YOUR PREVIOUS ATTEMPT WAS REJECTED BY SAFETY GUARDRAILS (attempt ${params.attempt} of ${threshold})

Your last decision${lastBlock.blockedAction ? ` (${lastBlock.blockedAction})` : ''} was blocked by a hard guardrail and NOT sent.
${rejected}

Why it was rejected:
${reasons}

Rules for this attempt:
- Fix every reason above. A message that repeats any of them will be blocked again. ${remaining <= 1 ? 'This is your last try before this lead is handed to a human.' : `After ${threshold} consecutive blocks this lead is handed to a human and you stop.`}
- ${numeric
    ? 'The figures in your briefing (property value, mortgage balance, LTV, rates, fees) are context for YOUR understanding only. Do not put any of them, or any number derived from them, in the message — not as digits, not spelled out in words, not as a fraction or a range.'
    : 'Do not paraphrase around a banned phrase. The rule bans the meaning, not the wording.'}
- If you cannot say something useful without the blocked content, choose "wait" or "escalate" instead of sending.
`.trim();
}

/**
 * Slack alert body for the team when a lead hits the threshold. Carries the
 * reasons and the blocked action, not the rejected message text (the message
 * may contain the lead's figures; the dashboard activity log has it).
 */
export function buildGuardrailEscalationDetails(params: {
  state: GuardrailLoopState;
  reminder?: boolean;
  threshold?: number;
}): string {
  const threshold = params.threshold ?? GUARDRAIL_ESCALATION_THRESHOLD;
  const { state } = params;
  const reasons = state.lastBlock?.errors.map((e) => `• ${e}`).join('\n') ?? '• (no reasons recorded)';
  const headline = params.reminder
    ? `⏰ Reminder: this lead has been waiting on a human since ${state.escalatedAt?.toISOString() ?? 'an earlier escalation'} — Holly is still not messaging them.`
    : `⛔ Holly was blocked by safety guardrails ${state.consecutiveBlocks} times in a row (threshold ${threshold}). She has stopped retrying — this lead needs a human.`;

  return [
    headline,
    `Last attempted action: ${state.lastBlock?.blockedAction ?? 'unknown'}`,
    'Reasons (most recent attempt):',
    reasons,
    '',
    'Holly will not message this lead again until someone replies to them from the dashboard, or the lead texts back. Turn Holly off on the lead if it should stay manual.',
  ].join('\n');
}
