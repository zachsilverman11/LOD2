/**
 * Guardrail retry feedback: pure-module pins
 *   - content vs scheduling errors, de-duplication, one coherent reason set
 *   - streak counting, reset on inbound AND outbound, awaiting-human state
 *   - retry prompt shape (rejected message, numbered reasons, figures rule)
 *   - escalation Slack text carries reasons, never the rejected message
 */

import {
  GUARDRAIL_ESCALATION_THRESHOLD,
  buildGuardrailEscalationDetails,
  buildGuardrailRetryContext,
  contentErrors,
  isSchedulingError,
  resolveGuardrailLoopState,
} from '../lib/holly/guardrail-retry';

const ago = (hours: number) => new Date(Date.now() - hours * 3600_000);

const RATE = 'CRITICAL: Message contains a specific rate percentage. Holly CANNOT quote mortgage rates.';
const PHRASE = 'CRITICAL: alt_private segment violation. Message contains banned phrase(s) for alt_private: low rates ...';
const NUMERIC = 'ALT-LENDING GUARDRAIL #8: Message contains a specific percentage.';
const TIME = 'Outside SMS hours (can only send 8am-9pm local time)';
const SPAM = 'Too soon since last unanswered message (5h < 24h)';

const block = (hoursAgo: number, errors: string[], extra: Record<string, unknown> = {}) => ({
  createdAt: ago(hoursAgo),
  metadata: { guardrailBlock: true, blockedAction: 'send_sms', errors, blockedMessage: 'We have low rates at 4.5%', ...extra },
});
const escalation = (hoursAgo: number) => ({ createdAt: ago(hoursAgo), metadata: { guardrailEscalation: true } });
const comm = (hoursAgo: number, direction: 'INBOUND' | 'OUTBOUND') => ({ createdAt: ago(hoursAgo), direction });

describe('content vs scheduling errors', () => {
  it('treats SMS-hours and anti-spam errors as scheduling, everything else as content', () => {
    expect(isSchedulingError(TIME)).toBe(true);
    expect(isSchedulingError(SPAM)).toBe(true);
    expect(isSchedulingError(RATE)).toBe(false);
    expect(isSchedulingError(NUMERIC)).toBe(false);
  });

  it('a message tripping the numeric block AND the phrase bans yields one coherent, de-duplicated reason set', () => {
    const reasons = contentErrors([RATE, PHRASE, NUMERIC, NUMERIC, TIME, '  ', RATE]);
    expect(reasons).toEqual([RATE, PHRASE, NUMERIC]);
  });
});

describe('resolveGuardrailLoopState', () => {
  it('counts consecutive content blocks since the last communication and surfaces the newest one', () => {
    const state = resolveGuardrailLoopState({
      activities: [block(3, [RATE]), block(2, [PHRASE]), block(1, [NUMERIC, PHRASE])],
      communications: [comm(10, 'OUTBOUND'), comm(12, 'INBOUND')],
    });
    expect(state.consecutiveBlocks).toBe(3);
    expect(state.lastBlock?.errors).toEqual([NUMERIC, PHRASE]);
    expect(state.lastBlock?.blockedMessage).toBe('We have low rates at 4.5%');
    expect(state.awaitingHuman).toBe(false);
  });

  it('an inbound reply resets the count', () => {
    const state = resolveGuardrailLoopState({
      activities: [block(3, [RATE]), block(2, [RATE])],
      communications: [comm(1, 'INBOUND')],
    });
    expect(state.consecutiveBlocks).toBe(0);
    expect(state.lastBlock).toBeNull();
  });

  it('an outbound send (Holly or an advisor from the dashboard) also resets the count', () => {
    const state = resolveGuardrailLoopState({
      activities: [block(3, [RATE]), block(2, [RATE]), block(0.5, [PHRASE])],
      communications: [comm(1, 'OUTBOUND')],
    });
    expect(state.consecutiveBlocks).toBe(1);
    expect(state.lastBlock?.errors).toEqual([PHRASE]);
  });

  it('pure scheduling blocks are not strikes and carry no feedback', () => {
    const state = resolveGuardrailLoopState({
      activities: [block(2, [TIME]), block(1, [SPAM])],
      communications: [comm(5, 'INBOUND')],
    });
    expect(state.consecutiveBlocks).toBe(0);
    expect(state.lastBlock).toBeNull();
  });

  it('a mixed block (time + content) is one strike with only the content reasons kept', () => {
    const state = resolveGuardrailLoopState({
      activities: [block(1, [TIME, RATE])],
      communications: [],
    });
    expect(state.consecutiveBlocks).toBe(1);
    expect(state.lastBlock?.errors).toEqual([RATE]);
  });

  it('an escalation newer than the last communication means awaiting human; a reply clears it', () => {
    const waiting = resolveGuardrailLoopState({
      activities: [block(4, [RATE]), block(3, [RATE]), block(2, [RATE]), escalation(2)],
      communications: [comm(6, 'INBOUND')],
    });
    expect(waiting.awaitingHuman).toBe(true);
    expect(waiting.escalatedAt).toBeInstanceOf(Date);

    const cleared = resolveGuardrailLoopState({
      activities: [block(4, [RATE]), block(3, [RATE]), block(2, [RATE]), escalation(2)],
      communications: [comm(6, 'INBOUND'), comm(1, 'INBOUND')],
    });
    expect(cleared.awaitingHuman).toBe(false);
    expect(cleared.consecutiveBlocks).toBe(0);
  });

  it('ignores rows without guardrail metadata and malformed metadata', () => {
    const state = resolveGuardrailLoopState({
      activities: [
        { createdAt: ago(1), metadata: { automated: true } },
        { createdAt: ago(1), metadata: 'nope' },
        { createdAt: ago(1), metadata: null },
        { createdAt: ago(1), metadata: { guardrailBlock: true, errors: 'not-an-array' } },
      ],
      communications: [],
    });
    expect(state.consecutiveBlocks).toBe(0);
  });
});

describe('buildGuardrailRetryContext', () => {
  const lastBlock = { createdAt: ago(1), errors: [RATE, PHRASE, NUMERIC], blockedAction: 'send_sms', blockedMessage: 'We have low rates at 4.5%' };

  it('shows the rejected message, every reason numbered once, and the attempt count', () => {
    const ctx = buildGuardrailRetryContext({ lastBlock, attempt: 2 });
    expect(ctx).toMatch(/REJECTED BY SAFETY GUARDRAILS \(attempt 2 of 3\)/);
    expect(ctx).toContain('"We have low rates at 4.5%"');
    expect(ctx).toContain(`1. ${RATE}`);
    expect(ctx).toContain(`2. ${PHRASE}`);
    expect(ctx).toContain(`3. ${NUMERIC}`);
    expect(ctx).toMatch(/never sent/i);
    expect(ctx).toMatch(/"wait" or "escalate"/);
  });

  it('tells the model the briefing figures are for understanding only when a numeric rule fired', () => {
    const ctx = buildGuardrailRetryContext({ lastBlock: { ...lastBlock, errors: [NUMERIC] }, attempt: 2 });
    expect(ctx).toMatch(/figures in your briefing .* for YOUR understanding only/);
    expect(ctx).toMatch(/not spelled out in words/);
  });

  it('uses the meaning-not-wording rule for a pure phrasing block', () => {
    const ctx = buildGuardrailRetryContext({ lastBlock: { ...lastBlock, errors: [PHRASE] }, attempt: 2 });
    expect(ctx).toMatch(/bans the meaning, not the wording/);
  });

  it('warns that the final attempt is the last before a human takes over', () => {
    const ctx = buildGuardrailRetryContext({ lastBlock, attempt: GUARDRAIL_ESCALATION_THRESHOLD });
    expect(ctx).toMatch(/last try before this lead is handed to a human/);
  });

  it('falls back to the blocked action when no message was recorded', () => {
    const ctx = buildGuardrailRetryContext({ lastBlock: { ...lastBlock, blockedMessage: undefined, blockedAction: 'send_booking_link' }, attempt: 2 });
    expect(ctx).toMatch(/Rejected action: send_booking_link/);
  });
});

describe('buildGuardrailEscalationDetails', () => {
  const state = resolveGuardrailLoopState({
    activities: [block(3, [RATE]), block(2, [RATE]), block(1, [NUMERIC, PHRASE])],
    communications: [],
  });

  it('carries the count, the reasons, and what unblocks Holly, but never the rejected message', () => {
    const details = buildGuardrailEscalationDetails({ state });
    expect(details).toMatch(/blocked by safety guardrails 3 times in a row/);
    expect(details).toContain(`• ${NUMERIC}`);
    expect(details).toContain(`• ${PHRASE}`);
    expect(details).toMatch(/Last attempted action: send_sms/);
    expect(details).toMatch(/replies to them from the dashboard, or the lead texts back/);
    expect(details).not.toContain('4.5%');
  });

  it('reminder flavour says the lead is still waiting', () => {
    const details = buildGuardrailEscalationDetails({ state: { ...state, escalatedAt: ago(168) }, reminder: true });
    expect(details).toMatch(/Reminder: this lead has been waiting on a human since/);
  });
});
