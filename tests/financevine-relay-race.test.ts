/**
 * FinanceVine relay: the reply-before-webhook race, both orders.
 *
 * The vendor's intro fires the same instant the lead webhook is delivered, so
 * a fast reply can reach our Twilio before the Lead row exists (roughly half
 * of leads reply quickly). Two orders, one outcome: exactly one Lead row, the
 * first message kept.
 *
 *  A. relay first  → provisional row keyed on the E.164 number → webhook lands,
 *     finds it by phone (its lookup is OR(email, phone)) and UPDATES it: real
 *     name/email/profile land on the same row, no second lead.
 *  B. webhook first → Lead exists → relay attaches to it, no provisional row.
 *
 * Order A exercises the real FinanceVine webhook handler (unmodified) against
 * the provisional row the relay path creates, so the merge contract is pinned
 * from both sides.
 */

process.env.TWILIO_PHONE_NUMBER = '+16045550100';
delete process.env.FINANCEVINE_RELAY_NUMBER;
delete process.env.FINANCEVINE_WEBHOOK_SECRET;

const RELAY_SENDER = '+17785550199';
const LEAD_E164 = '+16478553592';
const LEAD_10 = '6478553592';

// One in-memory "table" of leads shared by both handlers, so the second
// handler sees what the first one wrote.
const leads: any[] = [];

const mockLeadCreate = jest.fn(async ({ data }: any) => {
  const row = { id: `lead-${leads.length + 1}`, nextReviewAt: null, status: 'NEW', managedByAutonomous: true, hollyDisabled: false, ...data };
  leads.push(row);
  return row;
});
const mockLeadUpdate = jest.fn(async ({ where, data }: any) => {
  const row = leads.find((l) => l.id === where.id);
  Object.assign(row, data);
  return row;
});
const mockLeadFindFirst = jest.fn(async ({ where }: any) => {
  const ors: any[] = where.OR ?? [where];
  return leads.find((l) => ors.some((cond) => (cond.email && l.email === cond.email) || (cond.phone && l.phone === cond.phone))) ?? null;
});
const mockFindLeadByPhone = jest.fn(async (phone: string) => leads.find((l) => l.phone === phone) ?? null);
const mockCommunicationCreate = jest.fn(async ({ data }: any) => ({ id: 'comm', ...data }));
const mockInngestSend = jest.fn(async () => ({}));

jest.mock('../lib/phone-matching', () => ({
  findLeadByPhone: (...a: any[]) => mockFindLeadByPhone(...(a as [string])),
}));

jest.mock('../lib/db', () => ({
  prisma: {
    lead: {
      create: (...a: any[]) => mockLeadCreate(...(a as [any])),
      update: (...a: any[]) => mockLeadUpdate(...(a as [any])),
      findFirst: (...a: any[]) => mockLeadFindFirst(...(a as [any])),
    },
    communication: {
      create: (...a: any[]) => mockCommunicationCreate(...(a as [any])),
      findUnique: jest.fn(async () => null),
    },
    leadActivity: { create: jest.fn(async () => ({})) },
    webhookEvent: { create: jest.fn(async () => ({})), updateMany: jest.fn(async () => ({})) },
    cohortConfig: { findFirst: jest.fn(async () => null) },
  },
}));

jest.mock('../lib/inngest', () => ({
  inngest: { send: (...a: any[]) => mockInngestSend(...(a as [any])) },
}));

jest.mock('../lib/slack', () => ({
  sendErrorAlert: jest.fn(async () => ({})),
  sendSlackNotification: jest.fn(async () => ({})),
}));

import { processFinanceVineRelay, provisionalEmailFor } from '../lib/financevine-relay';
import { POST as financeVineWebhook } from '../app/api/webhooks/financevine/route';

const webhookPayload = {
  first_name: 'Sam',
  last_name: 'Lead',
  email: 'sam@example.com',
  phone: LEAD_10, // vendor sends 10 digits, no country code
  mortgage_type: 'refinance',
  primary_goal: 'debt consolidation',
  borrower_profile: 'not approved at bank',
};

const webhookRequest = () =>
  ({
    headers: { get: () => null },
    nextUrl: { searchParams: { get: () => null } },
    json: async () => webhookPayload,
  }) as any;

beforeEach(() => {
  leads.length = 0;
  jest.clearAllMocks();
});

describe('reply-before-webhook race', () => {
  it('order A: relay first, then webhook merges into the provisional row (no duplicate, first message kept)', async () => {
    const relay = await processFinanceVineRelay({
      from: RELAY_SENDER,
      body: `NEW MESSAGE FROM: ${LEAD_10} BODY: no`,
      messageSid: 'SM-a1',
    });
    expect(relay.kind).toBe('queued');
    expect(leads).toHaveLength(1);
    expect(leads[0].phone).toBe(LEAD_E164);
    expect(leads[0].email).toBe(provisionalEmailFor(LEAD_E164));
    const provisionalId = leads[0].id;

    const res = await financeVineWebhook(webhookRequest());
    const json = await res.json();

    expect(json.status).toBe('updated');
    expect(json.leadId).toBe(provisionalId);
    expect(leads).toHaveLength(1);
    expect(mockLeadCreate).toHaveBeenCalledTimes(1);

    // Real identity replaced the placeholders on the same row.
    expect(leads[0].email).toBe('sam@example.com');
    expect(leads[0].firstName).toBe('Sam');
    expect(leads[0].phone).toBe(LEAD_E164);
    expect(leads[0].segment).toBe('alt_private');
    expect(leads[0].source).toBe('financevine');

    // The first message was stored against that row before the webhook landed.
    expect(mockCommunicationCreate).toHaveBeenCalledTimes(1);
    expect(mockCommunicationCreate.mock.calls[0][0].data).toMatchObject({ leadId: provisionalId, direction: 'INBOUND', content: 'no' });

    // Holly was queued toward the lead's number with the provisional head start,
    // and the webhook did not push her review later than that.
    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    expect(mockInngestSend.mock.calls[0][0].data).toMatchObject({ leadId: provisionalId, phone: LEAD_E164, delaySeconds: 120 });
    expect(leads[0].nextReviewAt.getTime() - Date.now()).toBeLessThan(3 * 60 * 1000);
  });

  it('order B: webhook first, then relay attaches to the existing lead (no provisional row)', async () => {
    const res = await financeVineWebhook(webhookRequest());
    const json = await res.json();
    expect(json.status).toBe('created');
    expect(leads).toHaveLength(1);
    const leadId = leads[0].id;
    expect(leads[0].phone).toBe(LEAD_E164);

    const relay = await processFinanceVineRelay({
      from: RELAY_SENDER,
      body: `NEW MESSAGE FROM: ${LEAD_10} BODY: no`,
      messageSid: 'SM-b1',
    });

    expect(relay).toEqual({ kind: 'queued', leadId, provisional: false, leadPhone: LEAD_E164 });
    expect(leads).toHaveLength(1);
    expect(mockLeadCreate).toHaveBeenCalledTimes(1); // the webhook's create only
    expect(mockCommunicationCreate.mock.calls[0][0].data).toMatchObject({ leadId, direction: 'INBOUND', content: 'no' });

    // The 30-minute handoff wait collapses: the lead already replied.
    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    expect(mockInngestSend.mock.calls[0][0].data).toMatchObject({ leadId, phone: LEAD_E164 });
    expect(mockInngestSend.mock.calls[0][0].data.delaySeconds).toBeUndefined();
    expect(Math.abs(leads[0].nextReviewAt.getTime() - Date.now())).toBeLessThan(5_000);
  });

  it('order A with an opt-out: the row is created opted out; the inbound text is kept for the agent guard', async () => {
    const relay = await processFinanceVineRelay({
      from: RELAY_SENDER,
      body: `NEW MESSAGE FROM: ${LEAD_10} BODY: STOP`,
      messageSid: 'SM-a2',
    });
    expect(relay.kind).toBe('opt_out');
    expect(leads[0].consentSms).toBe(false);
    expect(mockInngestSend).not.toHaveBeenCalled();
    expect(mockCommunicationCreate.mock.calls[0][0].data).toMatchObject({ direction: 'INBOUND', content: 'STOP' });

    // Documented gap (notes/financevine-relay.md): the unmodified webhook's
    // update path re-asserts consentSms. The stored inbound "STOP" is what
    // keeps Holly's FinanceVine first-inbound guard closed on the cron path.
    await financeVineWebhook(webhookRequest());
    expect(leads).toHaveLength(1);
  });
});
