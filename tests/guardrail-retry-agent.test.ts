/**
 * Guardrail retry feedback inside the autonomous agent loop
 *
 * Integration-level pins (prisma, decision engine, Slack mocked; the real
 * validateDecision runs) for what the cron does with a lead Holly keeps
 * getting blocked on:
 *   - retry: the previous rejection (message + reasons) reaches the prompt
 *   - count: each content block increments; a reply resets
 *   - threshold: the 3rd consecutive block escalates via Slack, parks 7d, no retry
 *   - awaiting human: cron makes no Claude call, re-parks with a reminder
 *   - a message tripping numeric + phrase bans records one coherent reason set
 *   - every block outcome leaves a scheduled review or an escalation
 */

import { processLeadWithAutonomousAgent } from '../lib/holly/agent';
import { prisma } from '../lib/db';
import { sendSlackNotification } from '../lib/slack';
import {
  GUARDRAIL_ESCALATION_PARK_HOURS,
  GUARDRAIL_ESCALATION_THRESHOLD,
  GUARDRAIL_RETRY_HOURS,
} from '../lib/holly/guardrail-retry';
import { MIN_HOURS_BETWEEN_UNANSWERED_OUTBOUND } from '../lib/holly/guardrails';

jest.mock('../lib/db', () => ({
  prisma: {
    lead: { updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    leadActivity: { create: jest.fn(), findMany: jest.fn() },
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
jest.mock('../lib/timezone-utils', () => ({
  getLocalTime: jest.fn(() => new Date(Date.UTC(2026, 7, 28, 12, 0, 0))),
  getLocalTimeString: jest.fn(() => '12:00 PM'),
  getNext8AM: jest.fn(() => new Date(Date.now() + 12 * 3600_000)),
  getRelativeDatePhrase: jest.fn(() => 'yesterday'),
}));

const mockPrisma = prisma as any;
const mockSlack = sendSlackNotification as jest.Mock;
const { askHollyToDecide } = require('../lib/holly/decision-engine');
const { executeDecision } = require('../lib/holly/conversation-handler');

const ago = (hours: number) => new Date(Date.now() - hours * 3600_000);
const HOUR = 3600_000;

const BLOCKED_MSG = 'Hi Sam, with your LTV around 65% we have low rates from 4.5% available - want to chat?';
const CLEAN_MSG = 'Hi Sam, happy to line up a short call with Jakub to walk through your options. Does Thursday or Friday suit?';

function altPrivateLead(opts: { inboundHoursAgo?: number; outboundHoursAgo?: number } = {}) {
  const comms = [
    { id: 'o1', direction: 'OUTBOUND', channel: 'SMS', content: 'Hi Sam', createdAt: ago(opts.outboundHoursAgo ?? 60) },
    { id: 'i1', direction: 'INBOUND', channel: 'SMS', content: 'Tell me more', createdAt: ago(opts.inboundHoursAgo ?? 50) },
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return {
    id: 'lead-1',
    firstName: 'Sam',
    lastName: 'Lead',
    email: 'sam@example.com',
    phone: '+16045551234',
    status: 'ENGAGED',
    source: 'financevine',
    segment: 'alt_private',
    hollyDisabled: false,
    managedByAutonomous: true,
    consentSms: true,
    rawData: { province: 'British Columbia', segment: 'alt_private' },
    createdAt: ago(80),
    updatedAt: new Date(),
    lastContactedAt: ago(opts.outboundHoursAgo ?? 60),
    nextReviewAt: ago(1),
    communications: comms,
    appointments: [],
    callOutcomes: [],
    activities: [],
  } as any;
}

const priorBlock = (hoursAgo: number, errors: string[]) => ({
  createdAt: ago(hoursAgo),
  metadata: { guardrailBlock: true, blockedAction: 'send_sms', errors, blockedMessage: BLOCKED_MSG },
});
const RATE_ERR = 'CRITICAL: Message contains a specific rate percentage. Holly CANNOT quote mortgage rates.';

const nextReviewWrites = () =>
  mockPrisma.lead.update.mock.calls.map((c: any) => c[0]?.data?.nextReviewAt).filter((d: any) => d instanceof Date) as Date[];
const activityWrites = () => mockPrisma.leadActivity.create.mock.calls.map((c: any) => c[0].data);
const blockWrite = () => activityWrites().find((a: any) => a.metadata?.guardrailBlock === true);
const escalationWrite = () => activityWrites().find((a: any) => a.metadata?.guardrailEscalation === true);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.HOLLY_ALT_LENDING_GUARDRAILS = 'on'; // test process only; production stays off
  mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.lead.update.mockResolvedValue({});
  mockPrisma.leadActivity.create.mockResolvedValue({});
  mockPrisma.leadActivity.findMany.mockResolvedValue([]);
  executeDecision.mockResolvedValue({ success: true, action: 'send_sms' });
});
afterAll(() => {
  delete process.env.HOLLY_ALT_LENDING_GUARDRAILS;
});

describe('first block: informed retry is scheduled', () => {
  it('records a coherent reason set (numeric + rate + phrase bans, each once), counts 1, retries in 1h', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(altPrivateLead());
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'send_sms', message: BLOCKED_MSG, confidence: 'high' });

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect(result.success).toBe(false);
    expect((result as any).guardrailBlocks).toBe(1);
    expect(executeDecision).not.toHaveBeenCalled();
    expect(mockSlack).not.toHaveBeenCalled();

    const write = blockWrite();
    expect(write.metadata.blockedMessage).toBe(BLOCKED_MSG);
    expect(write.metadata.consecutiveBlocks).toBe(1);
    const errors: string[] = write.metadata.errors;
    expect(errors.some((e) => /specific rate percentage/.test(e))).toBe(true);
    expect(errors.some((e) => /alt_private segment violation/.test(e))).toBe(true);
    expect(errors.some((e) => /GUARDRAIL #8: Message contains a specific percentage/.test(e))).toBe(true);
    expect(errors.some((e) => /GUARDRAIL #8: Message discusses loan-to-value/.test(e))).toBe(true);
    expect(new Set(errors).size).toBe(errors.length);

    // Not the model's problem: the prompt was never told anything this time.
    expect(askHollyToDecide.mock.calls[0][2]?.extraContext).toBeUndefined();

    const [next] = nextReviewWrites();
    expect(Math.abs(next.getTime() - (Date.now() + GUARDRAIL_RETRY_HOURS * HOUR))).toBeLessThan(5000);
  });
});

describe('retry: the previous rejection reaches the model', () => {
  it('feeds the rejected message and every reason into the prompt, attempt 2 of 3', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(altPrivateLead());
    mockPrisma.leadActivity.findMany.mockResolvedValue([
      priorBlock(1, [RATE_ERR, 'ALT-LENDING GUARDRAIL #8: Message contains a specific percentage.']),
    ]);
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'send_sms', message: CLEAN_MSG, confidence: 'high' });

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect(result.success).toBe(true);
    const extra = askHollyToDecide.mock.calls[0][2]?.extraContext as string;
    expect(extra).toMatch(/REJECTED BY SAFETY GUARDRAILS \(attempt 2 of 3\)/);
    expect(extra).toContain(`"${BLOCKED_MSG}"`);
    expect(extra).toContain(`1. ${RATE_ERR}`);
    expect(extra).toContain('2. ALT-LENDING GUARDRAIL #8: Message contains a specific percentage.');
    expect(extra).toMatch(/figures in your briefing/);
    expect(executeDecision).toHaveBeenCalledTimes(1);
  });

  it('queries only activities newer than the last communication', async () => {
    const lead = altPrivateLead({ inboundHoursAgo: 2 });
    mockPrisma.lead.findUnique.mockResolvedValue(lead);
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'send_sms', message: CLEAN_MSG, confidence: 'high' });

    await processLeadWithAutonomousAgent('lead-1', 'cron');

    const where = mockPrisma.leadActivity.findMany.mock.calls[0][0].where;
    expect(where.leadId).toBe('lead-1');
    expect(where.type).toBe('NOTE_ADDED');
    expect(where.createdAt.gt.getTime()).toBe(lead.communications[0].createdAt.getTime()); // the 2h-ago reply
  });
});

describe('count increments and resets', () => {
  it('a second consecutive block counts 2 and still retries in 1h (no escalation yet)', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(altPrivateLead());
    mockPrisma.leadActivity.findMany.mockResolvedValue([priorBlock(1, [RATE_ERR])]);
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'send_sms', message: BLOCKED_MSG, confidence: 'high' });

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect((result as any).guardrailBlocks).toBe(2);
    expect((result as any).escalated).toBeUndefined();
    expect(blockWrite().metadata.consecutiveBlocks).toBe(2);
    expect(mockSlack).not.toHaveBeenCalled();
    const [next] = nextReviewWrites();
    expect(Math.abs(next.getTime() - (Date.now() + GUARDRAIL_RETRY_HOURS * HOUR))).toBeLessThan(5000);
  });

  it('a reply after two blocks resets: no feedback in the prompt, the next block counts 1', async () => {
    // Blocks at 5h and 4h ago, then the lead replied 2h ago.
    mockPrisma.lead.findUnique.mockResolvedValue(altPrivateLead({ inboundHoursAgo: 2 }));
    mockPrisma.leadActivity.findMany.mockResolvedValue([priorBlock(5, [RATE_ERR]), priorBlock(4, [RATE_ERR])]);
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'send_sms', message: BLOCKED_MSG, confidence: 'high' });

    const result = await processLeadWithAutonomousAgent('lead-1', 'sms_reply');

    expect(askHollyToDecide.mock.calls[0][2]?.extraContext).toBeUndefined();
    expect((result as any).guardrailBlocks).toBe(1);
    expect(mockSlack).not.toHaveBeenCalled();
  });

  it('a scheduling-only block (anti-spam) is not a strike and reschedules to the earliest legal send', async () => {
    // Last outbound 5h ago and unanswered → "Too soon". Two content blocks already on file.
    const lead = altPrivateLead({ outboundHoursAgo: 5, inboundHoursAgo: 50 });
    mockPrisma.lead.findUnique.mockResolvedValue(lead);
    mockPrisma.leadActivity.findMany.mockResolvedValue([priorBlock(3, [RATE_ERR]), priorBlock(2, [RATE_ERR])]);
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'send_sms', message: CLEAN_MSG, confidence: 'high' });

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/Too soon/);
    expect((result as any).guardrailBlocks).toBe(2);
    expect((result as any).escalated).toBeUndefined();
    expect(mockSlack).not.toHaveBeenCalled();
    const [next] = nextReviewWrites();
    const expected = lead.lastContactedAt.getTime() + MIN_HOURS_BETWEEN_UNANSWERED_OUTBOUND * HOUR + 60_000;
    expect(Math.abs(next.getTime() - expected)).toBeLessThan(1000);
  });
});

describe('threshold: escalate to a human and stop', () => {
  it(`the ${GUARDRAIL_ESCALATION_THRESHOLD}rd consecutive block escalates via Slack with the reasons, parks 7d, no send`, async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(altPrivateLead());
    mockPrisma.leadActivity.findMany.mockResolvedValue([priorBlock(2, [RATE_ERR]), priorBlock(1, [RATE_ERR])]);
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'send_sms', message: BLOCKED_MSG, confidence: 'high' });

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect(result.success).toBe(false);
    expect((result as any).escalated).toBe(true);
    expect((result as any).guardrailBlocks).toBe(GUARDRAIL_ESCALATION_THRESHOLD);
    expect(executeDecision).not.toHaveBeenCalled();

    expect(mockSlack).toHaveBeenCalledTimes(1);
    const alert = mockSlack.mock.calls[0][0];
    expect(alert.type).toBe('lead_escalated');
    expect(alert.leadId).toBe('lead-1');
    expect(alert.details).toMatch(/3 times in a row/);
    expect(alert.details).toMatch(/alt_private segment violation/);
    expect(alert.details).toMatch(/GUARDRAIL #8/);
    expect(alert.details).not.toContain(BLOCKED_MSG);

    const esc = escalationWrite();
    expect(esc.metadata.consecutiveBlocks).toBe(3);
    expect(esc.metadata.source).toBe('agent');

    const [next] = nextReviewWrites();
    expect(Math.abs(next.getTime() - (Date.now() + GUARDRAIL_ESCALATION_PARK_HOURS * HOUR))).toBeLessThan(5000);
  });

  it('once escalated, a cron run makes no Claude call and re-parks with a reminder', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(altPrivateLead());
    mockPrisma.leadActivity.findMany.mockResolvedValue([
      priorBlock(4, [RATE_ERR]), priorBlock(3, [RATE_ERR]), priorBlock(2, [RATE_ERR]),
      { createdAt: ago(2), metadata: { guardrailEscalation: true } },
    ]);

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect(result.success).toBe(false);
    expect((result as any).escalated).toBe(true);
    expect(askHollyToDecide).not.toHaveBeenCalled();
    expect(executeDecision).not.toHaveBeenCalled();
    expect(mockSlack).toHaveBeenCalledTimes(1);
    expect(mockSlack.mock.calls[0][0].details).toMatch(/Reminder: this lead has been waiting on a human/);
    expect(escalationWrite().metadata.guardrailEscalationReminder).toBe(true);
    const [next] = nextReviewWrites();
    expect(Math.abs(next.getTime() - (Date.now() + GUARDRAIL_ESCALATION_PARK_HOURS * HOUR))).toBeLessThan(5000);
  });

  it('the lead replying after escalation puts Holly back to work (reactive run, fresh count)', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(altPrivateLead({ inboundHoursAgo: 0.1 }));
    mockPrisma.leadActivity.findMany.mockResolvedValue([]); // the DB query is bounded by the reply
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'send_sms', message: CLEAN_MSG, confidence: 'high' });

    const result = await processLeadWithAutonomousAgent('lead-1', 'sms_reply');

    expect(result.success).toBe(true);
    expect(askHollyToDecide).toHaveBeenCalledTimes(1);
    expect(executeDecision).toHaveBeenCalledTimes(1);
    expect(mockSlack).not.toHaveBeenCalled();
  });

  it('a threshold reached on the cron nudge path is honoured by the agent without a new attempt', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(altPrivateLead());
    mockPrisma.leadActivity.findMany.mockResolvedValue([priorBlock(3, [RATE_ERR]), priorBlock(2, [RATE_ERR]), priorBlock(1, [RATE_ERR])]);

    const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

    expect((result as any).escalated).toBe(true);
    expect(askHollyToDecide).not.toHaveBeenCalled();
    expect(mockSlack).toHaveBeenCalledTimes(1);
    expect(nextReviewWrites()).toHaveLength(1);
  });
});

describe('no lead is left without a review or an escalation', () => {
  const outcomes: Array<[string, () => void]> = [
    ['1st content block', () => mockPrisma.leadActivity.findMany.mockResolvedValue([])],
    ['2nd content block', () => mockPrisma.leadActivity.findMany.mockResolvedValue([priorBlock(1, [RATE_ERR])])],
    ['3rd content block (escalation)', () => mockPrisma.leadActivity.findMany.mockResolvedValue([priorBlock(2, [RATE_ERR]), priorBlock(1, [RATE_ERR])])],
    ['awaiting human', () => mockPrisma.leadActivity.findMany.mockResolvedValue([{ createdAt: ago(1), metadata: { guardrailEscalation: true } }])],
  ];

  it.each(outcomes)('%s writes exactly one nextReviewAt in the future', async (_label, arrange) => {
    mockPrisma.lead.findUnique.mockResolvedValue(altPrivateLead());
    arrange();
    askHollyToDecide.mockResolvedValue({ thinking: 't', action: 'send_sms', message: BLOCKED_MSG, confidence: 'high' });

    await processLeadWithAutonomousAgent('lead-1', 'cron');

    const writes = nextReviewWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0].getTime()).toBeGreaterThan(Date.now());
  });
});
