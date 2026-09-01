/**
 * Post-cancellation behaviour inside the autonomous agent loop
 *
 * Integration-level pins (prisma and the decision engine mocked) for what the
 * cron actually does with an advisor-cancelled lead:
 *   - hold: no Claude call, nextReviewAt = apology + 48h
 *   - follow_up_due: exactly one Claude call, with the single-follow-up context
 *   - nurture: no Claude call, nextReviewAt = last send + 14d
 *   - sms_reply trigger is never held
 *   - same-stage move_stage schedules a 14d review, sends nothing
 *   - an anti-spam block reschedules to the earliest legal send, not +1h
 */

import { processLeadWithAutonomousAgent } from '../lib/holly/agent';
import { prisma } from '../lib/db';
import { POST_CANCELLATION_HOLD_HOURS, POST_CANCELLATION_NURTURE_HOURS } from '../lib/holly/post-cancellation';
import { MIN_HOURS_BETWEEN_UNANSWERED_OUTBOUND } from '../lib/holly/guardrails';

jest.mock('../lib/db', () => ({
  prisma: {
    lead: { updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    leadActivity: { create: jest.fn() },
  },
}));
jest.mock('../lib/holly/decision-engine', () => ({ askHollyToDecide: jest.fn() }));
jest.mock('../lib/holly/conversation-handler', () => ({ executeDecision: jest.fn() }));
jest.mock('../lib/slack', () => ({ sendSlackNotification: jest.fn() }));
jest.mock('../lib/conversation-outcome-tracker', () => ({ trackConversationOutcome: jest.fn() }));
jest.mock('../lib/deal-intelligence', () => ({
  analyzeDealHealth: jest.fn(() => ({
    temperature: 'warm',
    engagementTrend: 'stable',
    sentimentSignals: { lastReplyTone: 'neutral', objectionDetected: false, questionCount: 0 },
    contextualUrgency: null,
    leadSourceQuality: 'low',
    motivationLevel: 'unknown',
    reasoningContext: '',
    nextReviewHours: 2,
  })),
  resolveNextReviewHoursAfterOutbound: jest.fn(() => 72),
  countUnansweredOutbound: jest.requireActual('../lib/deal-intelligence').countUnansweredOutbound,
}));
// Pin the lead's local clock to noon so the 8am-9pm SMS-hours rule never interferes.
jest.mock('../lib/timezone-utils', () => ({
  getLocalTime: jest.fn(() => new Date(Date.UTC(2026, 7, 28, 12, 0, 0))),
  getLocalTimeString: jest.fn(() => '12:00 PM'),
  getNext8AM: jest.fn(() => new Date(Date.now() + 12 * 3600_000)),
  getRelativeDatePhrase: jest.fn(() => 'yesterday'),
}));

const mockPrisma = prisma as any;
const { askHollyToDecide } = require('../lib/holly/decision-engine');
const { executeDecision } = require('../lib/holly/conversation-handler');

const ago = (hours: number) => new Date(Date.now() - hours * 3600_000);

function cancelledLead(opts: {
  cancelledHoursAgo: number;
  outboundHoursAgoSinceCancel: number[];
  inboundHoursAgo?: number[];
  status?: string;
  byAdvisor?: boolean;
}) {
  const comms = [
    { id: 'c0', direction: 'INBOUND', channel: 'SMS', content: 'Thursday works', createdAt: ago(opts.cancelledHoursAgo + 24) },
    { id: 'c1', direction: 'OUTBOUND', channel: 'SMS', content: 'Booked you in!', createdAt: ago(opts.cancelledHoursAgo + 23.9) },
    ...opts.outboundHoursAgoSinceCancel.map((hrs, i) => ({
      id: `o${i}`, direction: 'OUTBOUND', channel: 'SMS', content: `msg ${i}`, createdAt: ago(hrs),
    })),
    ...(opts.inboundHoursAgo ?? []).map((hrs, i) => ({
      id: `i${i}`, direction: 'INBOUND', channel: 'SMS', content: 'reply', createdAt: ago(hrs),
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const lastOutbound = comms.find((c) => c.direction === 'OUTBOUND')!;
  return {
    id: 'lead-1',
    firstName: 'Sam',
    lastName: 'Lead',
    email: 'sam@example.com',
    phone: '+16045551234',
    status: opts.status ?? 'NURTURING',
    source: 'financevine',
    segment: 'alt_private',
    hollyDisabled: false,
    managedByAutonomous: true,
    consentSms: true,
    rawData: { province: 'British Columbia', segment: 'alt_private' },
    createdAt: ago(opts.cancelledHoursAgo + 48),
    updatedAt: new Date(),
    lastContactedAt: lastOutbound.createdAt,
    nextReviewAt: ago(1),
    communications: comms,
    appointments: [], // agent.ts only loads ACTIVE appointments; the cancelled one is absent
    callOutcomes: [],
    activities: [
      {
        id: 'a1',
        type: 'APPOINTMENT_CANCELLED',
        createdAt: ago(opts.cancelledHoursAgo),
        content: `Discovery call was cancelled (${opts.byAdvisor === false ? 'by lead' : 'by advisor'})`,
        metadata: { cancelledByAdvisor: opts.byAdvisor !== false, cancelledByLead: opts.byAdvisor === false },
      },
    ],
  } as any;
}

const nextReviewWrites = () =>
  mockPrisma.lead.update.mock.calls
    .map((c: any) => c[0]?.data?.nextReviewAt)
    .filter((d: any) => d instanceof Date) as Date[];

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.lead.update.mockResolvedValue({} as any);
  mockPrisma.leadActivity.create.mockResolvedValue({} as any);
});

describe('advisor cancellation: hold', () => {
  it('makes no Claude call and parks the lead until apology + 48h', async () => {
    const lead = cancelledLead({ cancelledHoursAgo: 5, outboundHoursAgoSinceCancel: [4.9] });
    mockPrisma.lead.findUnique.mockResolvedValue(lead);

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect(result.success).toBe(true);
    expect((result as any).postCancellation).toBe('hold');
    expect(askHollyToDecide).not.toHaveBeenCalled();
    expect(executeDecision).not.toHaveBeenCalled();
    const [next] = nextReviewWrites();
    const expected = lead.lastContactedAt.getTime() + POST_CANCELLATION_HOLD_HOURS * 3600_000;
    expect(Math.abs(next.getTime() - expected)).toBeLessThan(1000);
    const note = mockPrisma.leadActivity.create.mock.calls[0][0].data;
    expect(note.metadata.postCancellation).toBe('hold');
  });

  it('never holds a reactive (sms_reply) run', async () => {
    const lead = cancelledLead({ cancelledHoursAgo: 5, outboundHoursAgoSinceCancel: [4.9], inboundHoursAgo: [0.01] });
    mockPrisma.lead.findUnique.mockResolvedValue(lead);
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'wait', waitHours: 24, confidence: 'high' });

    await processLeadWithAutonomousAgent('lead-1', 'sms_reply');

    expect(askHollyToDecide).toHaveBeenCalledTimes(1);
  });

  it('does not apply to a lead-initiated cancellation', async () => {
    const lead = cancelledLead({ cancelledHoursAgo: 5, outboundHoursAgoSinceCancel: [4.9], byAdvisor: false });
    mockPrisma.lead.findUnique.mockResolvedValue(lead);
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'wait', waitHours: 24, confidence: 'high' });

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect((result as any).postCancellation).toBeUndefined();
    expect(askHollyToDecide).toHaveBeenCalledTimes(1);
  });
});

describe('advisor cancellation: the single follow-up', () => {
  it('asks Holly once, with the no-second-apology context, after the hold has elapsed', async () => {
    const lead = cancelledLead({ cancelledHoursAgo: 50, outboundHoursAgoSinceCancel: [49.9] });
    mockPrisma.lead.findUnique.mockResolvedValue(lead);
    askHollyToDecide.mockResolvedValue({
      thinking: 't',
      action: 'send_sms',
      message: 'Whenever you are ready, reply with a day that works and I will line it up with Jakub.',
      confidence: 'high',
    });
    executeDecision.mockResolvedValue({ success: true, action: 'send_sms' });

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect(result.success).toBe(true);
    expect(askHollyToDecide).toHaveBeenCalledTimes(1);
    const extra = askHollyToDecide.mock.calls[0][2]?.extraContext as string;
    expect(extra).toMatch(/POST-CANCELLATION FOLLOW-UP \(THE ONLY ONE\)/);
    expect(extra).toMatch(/Do NOT apologise again/);
    expect(extra).toMatch(/alt_private lead: no Mortgage Strategy Report/);
    expect(executeDecision).toHaveBeenCalledTimes(1);
  });
});

describe('advisor cancellation: nurture', () => {
  it('after apology + follow-up are unanswered, makes no Claude call and goes quiet for 14 days from the last send', async () => {
    const lead = cancelledLead({ cancelledHoursAgo: 60, outboundHoursAgoSinceCancel: [59.9, 10] });
    mockPrisma.lead.findUnique.mockResolvedValue(lead);

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect((result as any).postCancellation).toBe('nurture');
    expect(askHollyToDecide).not.toHaveBeenCalled();
    const [next] = nextReviewWrites();
    const expected = lead.lastContactedAt.getTime() + POST_CANCELLATION_NURTURE_HOURS * 3600_000;
    expect(Math.abs(next.getTime() - expected)).toBeLessThan(1000);
  });

  it('parks an ENGAGED lead in NURTURING when it reaches the nurture phase', async () => {
    const lead = cancelledLead({ cancelledHoursAgo: 60, outboundHoursAgoSinceCancel: [59.9, 10], status: 'ENGAGED' });
    mockPrisma.lead.findUnique.mockResolvedValue(lead);

    await processLeadWithAutonomousAgent('lead-1', 'cron');

    const write = mockPrisma.lead.update.mock.calls.find((c: any) => c[0]?.data?.status)?.[0].data;
    expect(write?.status).toBe('NURTURING');
  });
});

describe('same-stage move_stage no longer spins', () => {
  it('schedules a 14-day review and sends nothing when Holly "moves" a NURTURING lead to NURTURING', async () => {
    const lead = cancelledLead({ cancelledHoursAgo: 60, outboundHoursAgoSinceCancel: [59.9], inboundHoursAgo: [30] });
    lead.activities = []; // plain silent NURTURING lead, no cancellation policy in play
    mockPrisma.lead.findUnique.mockResolvedValue(lead);
    askHollyToDecide.mockResolvedValue({
      thinking: 'Lead has gone quiet, moving to nurturing',
      action: 'move_stage',
      newStage: 'NURTURING',
      message: 'No worries, I will check back in a couple of weeks.',
      confidence: 'high',
    });

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect(result.success).toBe(true);
    expect((result as any).sameStage).toBe(true);
    expect(executeDecision).not.toHaveBeenCalled();
    const statusWrite = mockPrisma.lead.update.mock.calls.find((c: any) => c[0]?.data?.status);
    expect(statusWrite).toBeUndefined();
    const [next] = nextReviewWrites();
    expect(Math.abs(next.getTime() - (Date.now() + 14 * 24 * 3600_000))).toBeLessThan(5000);
  });

  it('schedules a 24h review for an invalid transition instead of leaving the lead due', async () => {
    const lead = cancelledLead({ cancelledHoursAgo: 60, outboundHoursAgoSinceCancel: [59.9], inboundHoursAgo: [30] });
    lead.activities = [];
    mockPrisma.lead.findUnique.mockResolvedValue(lead);
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'move_stage', newStage: 'WAITING_FOR_APPLICATION', confidence: 'high' });

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect(result.success).toBe(false);
    const [next] = nextReviewWrites();
    expect(Math.abs(next.getTime() - (Date.now() + 24 * 3600_000))).toBeLessThan(5000);
  });
});

describe('anti-spam block reschedules to the earliest legal send', () => {
  it('sets nextReviewAt to lastContactedAt + 24h (+1 min), not +1h, so a blocked lead is not re-asked hourly', async () => {
    // Silent NURTURING lead, no cancellation, last outbound 5h ago and unanswered.
    const lead = cancelledLead({ cancelledHoursAgo: 100, outboundHoursAgoSinceCancel: [5], inboundHoursAgo: [30] });
    lead.activities = [];
    mockPrisma.lead.findUnique.mockResolvedValue(lead);
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'send_sms', message: 'Quick check-in: does Thursday or Friday suit for a short call?', confidence: 'high' });

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/Too soon/);
    expect(executeDecision).not.toHaveBeenCalled();
    const [next] = nextReviewWrites();
    const expected = lead.lastContactedAt.getTime() + MIN_HOURS_BETWEEN_UNANSWERED_OUTBOUND * 3600_000 + 60_000;
    expect(Math.abs(next.getTime() - expected)).toBeLessThan(1000);
  });
});
