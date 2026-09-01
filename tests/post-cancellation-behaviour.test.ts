/**
 * Post-cancellation behaviour (advisor-initiated cancellations)
 *
 * Background (notes/post-cancellation-diagnosis.md): after an advisor
 * cancelled a booked call on 2026-08-27, Holly sent six follow-ups in four
 * days to a silent lead, two per day, every one apologising, one promising
 * "last one from me for a while" and another six hours later, and one pitching
 * the Mortgage Strategy Report to an alt_private lead.
 *
 * These tests pin the intended behaviour:
 *   1. One apology, then a 48h hold, then at most one follow-up, then nurture.
 *   2. Never two outbounds in one day to a lead who has not replied.
 *   3. The advisor is told to own the apology (Slack) on an advisor-cancel.
 *   4. No Strategy Report / cash back / booking-hook copy for alt_private.
 *   5. A "last one" promise is never sendable.
 *   6. move_stage to the current stage is a wait, and always schedules.
 */

import {
  resolvePostCancellationPolicy,
  isAdvisorCancellation,
  buildCancellationSlackDetails,
  buildPostCancellationFollowUpContext,
  POST_CANCELLATION_HOLD_HOURS,
  POST_CANCELLATION_NURTURE_HOURS,
} from '../lib/holly/post-cancellation';
import {
  validateDecision,
  detectFinalityPromise,
  MIN_HOURS_BETWEEN_UNANSWERED_OUTBOUND,
  HollyDecision,
} from '../lib/holly/guardrails';
import {
  buildReportPreSellSection,
  buildCashBackSection,
  buildBookingHookLines,
} from '../lib/holly/playbook-sections';
import { getConversationGuidance } from '../lib/holly/brain';
import { resolveStageMove, defaultReviewHoursForStage } from '../lib/holly/stage-move';

const T0 = Date.UTC(2026, 7, 27, 20, 33, 0); // 2026-08-27 13:33 PT, the real cancellation time
const h = (hours: number) => new Date(T0 + hours * 3600_000);

const advisorCancel = (at = h(0)) => ({
  type: 'APPOINTMENT_CANCELLED',
  createdAt: at,
  content: 'Discovery call was cancelled (by advisor)',
  metadata: { cancelledByAdvisor: true, cancelledByLead: false },
});
const leadCancel = (at = h(0)) => ({
  type: 'APPOINTMENT_CANCELLED',
  createdAt: at,
  content: 'Discovery call was cancelled (by lead)',
  metadata: { cancelledByAdvisor: false, cancelledByLead: true },
});
const out = (at: Date) => ({ direction: 'OUTBOUND', createdAt: at });
const inb = (at: Date) => ({ direction: 'INBOUND', createdAt: at });

describe('isAdvisorCancellation', () => {
  it('reads the metadata flag when present', () => {
    expect(isAdvisorCancellation(advisorCancel())).toBe(true);
    expect(isAdvisorCancellation(leadCancel())).toBe(false);
  });

  it('falls back to the legacy "(by advisor)" content suffix for records written before the flag', () => {
    expect(
      isAdvisorCancellation({ type: 'APPOINTMENT_CANCELLED', createdAt: h(0), content: 'Call cancelled: sick (by advisor)', metadata: { cancelledBy: 'x' } })
    ).toBe(true);
    expect(
      isAdvisorCancellation({ type: 'APPOINTMENT_CANCELLED', createdAt: h(0), content: 'Call cancelled (by lead)', metadata: {} })
    ).toBe(false);
  });

  it('ignores other activity types', () => {
    expect(isAdvisorCancellation({ type: 'NOTE_ADDED', createdAt: h(0), content: '(by advisor)' })).toBe(false);
  });
});

describe('resolvePostCancellationPolicy', () => {
  it('is "none" without an advisor cancellation (lead-initiated cancellations keep the existing flow)', () => {
    expect(resolvePostCancellationPolicy({ activities: [], communications: [out(h(-1))], now: h(1) }).phase).toBe('none');
    expect(resolvePostCancellationPolicy({ activities: [leadCancel()], communications: [out(h(0.01))], now: h(1) }).phase).toBe('none');
  });

  it('lets the apology go out if nothing has been sent since the cancellation', () => {
    const p = resolvePostCancellationPolicy({ activities: [advisorCancel()], communications: [out(h(-24))], now: h(0.2) });
    expect(p.phase).toBe('apology_due');
  });

  it('holds for 48h after the apology, with the next review at exactly apology + 48h', () => {
    const apologyAt = h(0.01);
    const p = resolvePostCancellationPolicy({ activities: [advisorCancel()], communications: [out(h(-24)), out(apologyAt)], now: h(0.25) });
    expect(p.phase).toBe('hold');
    expect(p.nextReviewAt?.getTime()).toBe(apologyAt.getTime() + POST_CANCELLATION_HOLD_HOURS * 3600_000);
    expect(p.outboundSinceCancellation).toBe(1);
  });

  it('would have held at every point where the real second..fourth messages were sent (4.7h, 18.5h, 22.7h after the apology)', () => {
    const apologyAt = h(0);
    for (const hoursLater of [4.7, 18.5, 22.7, 47.9]) {
      const p = resolvePostCancellationPolicy({ activities: [advisorCancel()], communications: [out(apologyAt)], now: h(hoursLater) });
      expect(p.phase).toBe('hold');
    }
  });

  it('allows exactly one follow-up once the hold has elapsed', () => {
    const p = resolvePostCancellationPolicy({ activities: [advisorCancel()], communications: [out(h(0))], now: h(48.1) });
    expect(p.phase).toBe('follow_up_due');
  });

  it('moves to nurture after apology + follow-up are both unanswered, quiet for 14 days from the last send', () => {
    const followUpAt = h(49);
    const p = resolvePostCancellationPolicy({ activities: [advisorCancel()], communications: [out(h(0)), out(followUpAt)], now: h(50) });
    expect(p.phase).toBe('nurture');
    expect(p.nextReviewAt?.getTime()).toBe(followUpAt.getTime() + POST_CANCELLATION_NURTURE_HOURS * 3600_000);
  });

  it('stays in nurture even if more outbounds somehow accumulated (never re-opens the follow-up window)', () => {
    const p = resolvePostCancellationPolicy({ activities: [advisorCancel()], communications: [out(h(0)), out(h(49)), out(h(60))], now: h(61) });
    expect(p.phase).toBe('nurture');
  });

  it('returns to the normal cadence once the nurture window has passed', () => {
    const p = resolvePostCancellationPolicy({ activities: [advisorCancel()], communications: [out(h(0)), out(h(49))], now: h(49 + POST_CANCELLATION_NURTURE_HOURS + 1) });
    expect(p.phase).toBe('none');
  });

  it('ends the policy the moment the lead replies after the cancellation', () => {
    const p = resolvePostCancellationPolicy({ activities: [advisorCancel()], communications: [out(h(0)), inb(h(1))], now: h(2) });
    expect(p.phase).toBe('none');
    expect(p.reason).toMatch(/replied/);
  });

  it('does not count inbounds from before the cancellation as a reply', () => {
    const p = resolvePostCancellationPolicy({ activities: [advisorCancel()], communications: [inb(h(-25)), out(h(-24)), out(h(0.01))], now: h(1) });
    expect(p.phase).toBe('hold');
  });

  it('anchors on the most recent advisor cancellation', () => {
    const p = resolvePostCancellationPolicy({
      activities: [advisorCancel(h(-500)), advisorCancel(h(0))],
      communications: [out(h(-499)), out(h(-400)), out(h(0.01))],
      now: h(1),
    });
    expect(p.phase).toBe('hold');
    expect(p.cancelledAt?.getTime()).toBe(h(0).getTime());
  });
});

describe('advisor notification on advisor-cancel', () => {
  it('escalates to the team and tells the advisor to own the apology', () => {
    const alert = buildCancellationSlackDetails({ cancelledByAdvisor: true, advisorName: 'Jakub', cancellationReason: 'Conflict' });
    expect(alert.type).toBe('lead_escalated');
    expect(alert.details).toMatch(/Jakub cancelled/);
    expect(alert.details).toMatch(/reach out personally/i);
    expect(alert.details).toMatch(/Reason: Conflict/);
    expect(alert.details).toMatch(new RegExp(`${POST_CANCELLATION_HOLD_HOURS}h`));
  });

  it('keeps the lead-initiated cancellation as a plain going-cold notice', () => {
    const alert = buildCancellationSlackDetails({ cancelledByAdvisor: false });
    expect(alert.type).toBe('lead_rotting');
    expect(alert.details).toMatch(/cancelled by lead/);
    expect(alert.details).not.toMatch(/reach out personally/i);
  });
});

describe('the single follow-up prompt', () => {
  it('forbids a second apology and any cadence promise', () => {
    const ctx = buildPostCancellationFollowUpContext({ firstName: 'Sam', cancelledAt: h(0), isAltPrivate: false });
    expect(ctx).toMatch(/Do NOT apologise again/);
    expect(ctx).toMatch(/Do NOT promise this is your last message/);
    expect(ctx).not.toMatch(/alt_private/);
  });

  it('withholds the conventional hooks for alt_private', () => {
    const ctx = buildPostCancellationFollowUpContext({ firstName: 'Sam', cancelledAt: h(0), isAltPrivate: true });
    expect(ctx).toMatch(/no Mortgage Strategy Report, no rate-vs-cost hook, no cash back/);
  });
});

describe('guardrails: one outbound per day to a non-responding lead', () => {
  const baseLead = (lastContactedHoursAgo: number, repliedSince: boolean) => {
    const now = Date.now();
    const lastContactedAt = new Date(now - lastContactedHoursAgo * 3600_000);
    return {
      id: 'lead-1',
      firstName: 'Sam',
      lastName: 'Lead',
      phone: '+16045551234',
      status: 'NURTURING',
      consentSms: true,
      hollyDisabled: false,
      segment: 'prime_other',
      rawData: { province: 'British Columbia' },
      lastContactedAt,
      communications: [
        { direction: 'OUTBOUND', content: 'earlier', createdAt: lastContactedAt },
        ...(repliedSince ? [{ direction: 'INBOUND', content: 'hi', createdAt: new Date(lastContactedAt.getTime() + 60_000) }] : []),
      ],
    } as any;
  };
  const send = (message = 'Hi Sam, does Thursday or Friday work better for a quick call?'): HollyDecision => ({
    thinking: 't',
    action: 'send_sms',
    message,
    confidence: 'high',
  });
  const tooSoon = (errors: string[]) => errors.find((e) => e.startsWith('Too soon'));

  it('is 24 hours', () => {
    expect(MIN_HOURS_BETWEEN_UNANSWERED_OUTBOUND).toBe(24);
  });

  it('blocks a second message 5h after an unanswered one (the old 4h rule let this through)', () => {
    const v = validateDecision(send(), { lead: baseLead(5, false), signals: {} as any });
    expect(tooSoon(v.errors)).toMatch(/24h minimum/);
  });

  it('blocks at 23.9h and allows at 24.1h', () => {
    expect(tooSoon(validateDecision(send(), { lead: baseLead(23.9, false), signals: {} as any }).errors)).toBeDefined();
    expect(tooSoon(validateDecision(send(), { lead: baseLead(24.1, false), signals: {} as any }).errors)).toBeUndefined();
  });

  it('does not apply once the lead has replied since our last message (conversational mode)', () => {
    expect(tooSoon(validateDecision(send(), { lead: baseLead(0.1, true), signals: {} as any }).errors)).toBeUndefined();
  });

  it('never blocks wait or escalate', () => {
    const wait: HollyDecision = { thinking: 't', action: 'wait', waitHours: 48, confidence: 'high' };
    expect(tooSoon(validateDecision(wait, { lead: baseLead(0.1, false), signals: {} as any }).errors)).toBeUndefined();
  });
});

describe('guardrails: a "last one" promise is never made', () => {
  const finality = (errors: string[]) => errors.find((e) => e.startsWith('Finality promise'));
  const lead = {
    id: 'lead-1', firstName: 'Sam', lastName: 'Lead', phone: '+16045551234', status: 'NURTURING',
    consentSms: true, hollyDisabled: false, rawData: { province: 'British Columbia' }, lastContactedAt: null, communications: [],
  } as any;

  it.each([
    "No pressure at all, this is the last one from me for a while. If timing changes, I'm here.",
    'This is my final message on this, promise.',
    "I won't reach out again unless you want me to.",
    "I'll stop messaging now. Best of luck.",
    "Going to leave you be. Reply anytime.",
    "I'm closing your file for now.",
  ])('blocks: %s', (message) => {
    expect(detectFinalityPromise(message)).not.toBeNull();
    const v = validateDecision({ thinking: 't', action: 'send_sms', message, confidence: 'high' }, { lead, signals: {} as any });
    expect(finality(v.errors)).toBeDefined();
  });

  it.each([
    "No rush at all. I'll check back in less often; reply whenever suits.",
    'Whenever you are ready, just reply with a day that works and I will set it up.',
    'Last week you mentioned Thursday works best. Still true?',
    'Our final approval turnaround is usually quick once the call is done.',
  ])('allows: %s', (message) => {
    expect(detectFinalityPromise(message)).toBeNull();
    const v = validateDecision({ thinking: 't', action: 'send_sms', message, confidence: 'high' }, { lead, signals: {} as any });
    expect(finality(v.errors)).toBeUndefined();
  });
});

describe('alt_private gets no off-playbook hooks in the decision prompt', () => {
  const offPlaybook = /Strategy Report|cash back|rate comparisons|rate-vs-cost|penalty/i;

  it('report pre-sell: conventional leads are told to use it, alt_private leads are told not to', () => {
    expect(buildReportPreSellSection({ isAltPrivate: false, hasUpcomingAppointment: false })).toMatch(/MUST reference the personalised Mortgage Strategy Report/);
    const alt = buildReportPreSellSection({ isAltPrivate: true, hasUpcomingAppointment: false });
    expect(alt).toMatch(/Do NOT mention the Mortgage Strategy Report/);
    expect(alt).not.toMatch(/MUST reference/);
    expect(alt).toMatch(/lenders beyond the banks/);
  });

  it('cash back: available to conventional zero-reply leads at touch 3+, forbidden for alt_private at every touch', () => {
    expect(buildCashBackSection({ isAltPrivate: false, outboundCount: 5, inboundCount: 0 })).toMatch(/You MAY introduce the cash back angle/);
    const alt = buildCashBackSection({ isAltPrivate: true, outboundCount: 5, inboundCount: 0 });
    expect(alt).toMatch(/FORBIDDEN at every touch/);
    expect(alt).not.toMatch(/You MAY/);
  });

  it('booking hook: alt_private is told there is no hook beyond the call', () => {
    expect(buildBookingHookLines({ isAltPrivate: false, hookName: 'Rate vs Cost', hookAngle: 'x' })).toMatch(/Rate vs Cost/);
    const alt = buildBookingHookLines({ isAltPrivate: true, hookName: 'Rate vs Cost', hookAngle: 'x' });
    expect(alt).not.toMatch(/Rate vs Cost/);
    expect(alt).toMatch(/none \(alt_private\)/);
  });

  it('touch 4+ zero-engagement psychology does not tell alt_private to deploy the report / rate-vs-cost / cash back', () => {
    const conventional = getConversationGuidance(5, false, false);
    expect(conventional.approach).toMatch(/Mortgage Strategy Report/);
    const alt = getConversationGuidance(5, false, true);
    expect(alt.approach).not.toMatch(offPlaybook);
    expect(alt.avoid.join(' ')).toMatch(/off-playbook for alt_private/);
    // Engaged leads and touches 1-3 are unchanged by the flag.
    expect(getConversationGuidance(5, true, true)).toBe(getConversationGuidance(5, true, false));
    expect(getConversationGuidance(2, false, true)).toBe(getConversationGuidance(2, false, false));
  });
});

describe('stage moves always schedule a next review', () => {
  it('treats a move to the current stage as a wait with the stage default cadence', () => {
    const r = resolveStageMove('NURTURING', 'NURTURING');
    expect(r.kind).toBe('same_stage');
    expect(r.nextReviewHours).toBe(defaultReviewHoursForStage('NURTURING'));
    expect(r.nextReviewHours).toBe(14 * 24);
  });

  it('gives an invalid transition a 24h review instead of leaving the lead due', () => {
    const r = resolveStageMove('NURTURING', 'WAITING_FOR_APPLICATION');
    expect(r.kind).toBe('invalid');
    expect(r.nextReviewHours).toBe(24);
  });

  it('keeps the existing valid transitions and their cadences', () => {
    expect(resolveStageMove('ENGAGED', 'NURTURING')).toEqual({ kind: 'ok', nextReviewHours: 14 * 24 });
    expect(resolveStageMove('CONTACTED', 'LOST')).toEqual({ kind: 'ok', nextReviewHours: 24 * 365 });
    expect(resolveStageMove('CALL_SCHEDULED', 'WAITING_FOR_APPLICATION')).toEqual({ kind: 'ok', nextReviewHours: 48 });
  });
});
