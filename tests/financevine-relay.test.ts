/**
 * FinanceVine relay tests
 *
 * FinanceVine's intro SMS goes out from ITS number (a 778). Every reply the
 * lead sends to it is forwarded to our Twilio number as
 * "NEW MESSAGE FROM: <number> BODY: <reply>". Replying in that thread would
 * talk to FinanceVine, not the lead.
 *
 * Pinned here:
 *  - format variants and both phone formats parse; junk fails loudly
 *  - a relayed "no" opens the direct thread; each opt-out phrasing suppresses it
 *  - the message is attributed to the lead's real number (provisional lead when
 *    the webhook has not landed), stored as an inbound Communication
 *  - nothing from the 778 ever gets a reply: no TwiML <Message>, no Inngest
 *    event or Lead row carrying the 778
 *  - a malformed relay produces an alert + unprocessed WebhookEvent, not silence
 *  - Twilio retries (same MessageSid) do not double-attribute
 */

import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

process.env.TWILIO_AUTH_TOKEN = 'test_auth_token_secret';
process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
process.env.TWILIO_PHONE_NUMBER = '+16045550100';
delete process.env.FINANCEVINE_RELAY_NUMBER;

const RELAY_SENDER = '+17785550199';
const LEAD_E164 = '+16478553592';
const LEAD_10 = '6478553592';

const mockFindLeadByPhone = jest.fn();
const mockLeadCreate = jest.fn();
const mockLeadUpdate = jest.fn();
const mockCommunicationCreate = jest.fn();
const mockCommunicationFindUnique = jest.fn();
const mockLeadActivityCreate = jest.fn();
const mockWebhookEventCreate = jest.fn();
const mockInngestSend = jest.fn();
const mockSendErrorAlert = jest.fn();
const mockSendSlackNotification = jest.fn();

jest.mock('../lib/phone-matching', () => ({
  findLeadByPhone: (...a: any[]) => mockFindLeadByPhone(...a),
}));

jest.mock('../lib/db', () => ({
  prisma: {
    lead: {
      create: (...a: any[]) => mockLeadCreate(...a),
      update: (...a: any[]) => mockLeadUpdate(...a),
    },
    communication: {
      create: (...a: any[]) => mockCommunicationCreate(...a),
      findUnique: (...a: any[]) => mockCommunicationFindUnique(...a),
    },
    leadActivity: { create: (...a: any[]) => mockLeadActivityCreate(...a) },
    webhookEvent: { create: (...a: any[]) => mockWebhookEventCreate(...a) },
  },
}));

jest.mock('../lib/inngest', () => ({
  inngest: { send: (...a: any[]) => mockInngestSend(...a) },
}));

jest.mock('../lib/slack', () => ({
  sendErrorAlert: (...a: any[]) => mockSendErrorAlert(...a),
  sendSlackNotification: (...a: any[]) => mockSendSlackNotification(...a),
}));

import {
  parseRelayBody,
  normalizeRelayPhone,
  looksLikeRelayFormat,
  isOptOutMessage,
  processFinanceVineRelay,
  provisionalEmailFor,
  buildRelayHandoffContext,
  PROVISIONAL_HOLLY_DELAY_SECONDS,
} from '../lib/financevine-relay';
import { POST } from '../app/api/webhooks/twilio/route';

const existingLead = {
  id: 'lead-existing',
  phone: LEAD_E164,
  email: 'lead@example.com',
  firstName: 'Sam',
  lastName: 'Lead',
  status: 'NEW',
  consentSms: true,
  source: 'financevine',
  segment: 'alt_private',
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.FINANCEVINE_RELAY_NUMBER;
  mockCommunicationFindUnique.mockResolvedValue(null);
  mockLeadCreate.mockImplementation(async ({ data }: any) => ({ id: 'lead-provisional', ...data }));
  mockLeadUpdate.mockResolvedValue({});
  mockCommunicationCreate.mockResolvedValue({ id: 'comm-1' });
  mockLeadActivityCreate.mockResolvedValue({ id: 'act-1' });
  mockWebhookEventCreate.mockResolvedValue({ id: 'evt-1' });
  mockInngestSend.mockResolvedValue({});
  mockSendErrorAlert.mockResolvedValue({});
  mockSendSlackNotification.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

describe('parseRelayBody', () => {
  const okCases: Array<[string, string, string, string]> = [
    ['canonical', `NEW MESSAGE FROM: ${LEAD_10} BODY: no`, LEAD_E164, 'no'],
    ['E.164 number', `NEW MESSAGE FROM: ${LEAD_E164} BODY: yes, a few questions`, LEAD_E164, 'yes, a few questions'],
    ['11 digits', `NEW MESSAGE FROM: 1${LEAD_10} BODY: hi`, LEAD_E164, 'hi'],
    ['punctuated number', `NEW MESSAGE FROM: (647) 855-3592 BODY: hi`, LEAD_E164, 'hi'],
    ['spaced E.164', `NEW MESSAGE FROM: +1 647-855-3592 BODY: hi`, LEAD_E164, 'hi'],
    ['lowercase labels', `new message from: ${LEAD_10} body: hi there`, LEAD_E164, 'hi there'],
    ['no colons', `NEW MESSAGE FROM ${LEAD_10} BODY hi`, LEAD_E164, 'hi'],
    ['newline between parts', `NEW MESSAGE FROM: ${LEAD_10}\nBODY: what are my options`, LEAD_E164, 'what are my options'],
    ['leading whitespace', `  \nNEW MESSAGE FROM: ${LEAD_10} BODY: ok`, LEAD_E164, 'ok'],
    ['multi-line reply', `NEW MESSAGE FROM: ${LEAD_10} BODY: line one\nline two`, LEAD_E164, 'line one\nline two'],
    ['reply mentions body', `NEW MESSAGE FROM: ${LEAD_10} BODY: the body of the house is fine`, LEAD_E164, 'the body of the house is fine'],
    ['reply contains a colon', `NEW MESSAGE FROM: ${LEAD_10} BODY: Question: can you help?`, LEAD_E164, 'Question: can you help?'],
  ];

  it.each(okCases)('parses %s', (_label, body, phone, message) => {
    expect(parseRelayBody(body)).toEqual({ ok: true, leadPhone: phone, message });
  });

  const badCases: Array<[string, string]> = [
    ['plain text', 'hey is this the mortgage people?'],
    ['missing BODY', `NEW MESSAGE FROM: ${LEAD_10}`],
    ['missing number', 'NEW MESSAGE FROM: BODY: hello'],
    ['short number', 'NEW MESSAGE FROM: 5551234 BODY: hello'],
    ['non-NA number', 'NEW MESSAGE FROM: +447700900123 BODY: hello'],
    ['empty reply', `NEW MESSAGE FROM: ${LEAD_10} BODY:   `],
  ];

  it.each(badCases)('rejects %s', (_label, body) => {
    expect(parseRelayBody(body).ok).toBe(false);
  });
});

describe('normalizeRelayPhone', () => {
  it('normalises both vendor phone formats to E.164', () => {
    expect(normalizeRelayPhone(LEAD_10)).toBe(LEAD_E164);
    expect(normalizeRelayPhone(`1${LEAD_10}`)).toBe(LEAD_E164);
    expect(normalizeRelayPhone(LEAD_E164)).toBe(LEAD_E164);
    expect(normalizeRelayPhone('647.855.3592')).toBe(LEAD_E164);
  });

  it('refuses to guess at anything else', () => {
    expect(normalizeRelayPhone('8553592')).toBeNull();
    expect(normalizeRelayPhone('+447700900123')).toBeNull();
    expect(normalizeRelayPhone('')).toBeNull();
  });
});

describe('looksLikeRelayFormat', () => {
  it('matches the forwarding format and nothing a lead would type', () => {
    expect(looksLikeRelayFormat(`NEW MESSAGE FROM: ${LEAD_10} BODY: no`)).toBe(true);
    expect(looksLikeRelayFormat('new message from 6478553592 body hi')).toBe(true);
    expect(looksLikeRelayFormat('I got a new message from my bank, no body wants to help')).toBe(false);
    expect(looksLikeRelayFormat('STOP')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Opt-out classification
// ---------------------------------------------------------------------------

describe('isOptOutMessage', () => {
  const optOuts = [
    'STOP',
    'stop',
    'Please stop texting me',
    'unsubscribe',
    'Unsubscribe me',
    "don't contact me",
    'dont contact me',
    'Do not contact me again',
    "don't text me",
    "Don't call me",
    'remove me',
    'Remove me from your list',
    'take me off your list',
    'Not interested',
    "I'm not interested",
    'no longer interested',
    'leave me alone',
    'wrong number',
    'opt out',
    'opt-out',
  ];

  it.each(optOuts)('treats %p as an opt-out', (text) => {
    expect(isOptOutMessage(text)).toBe(true);
  });

  const answersToAnyQuestions = [
    'no',
    'No',
    'NO',
    'no.',
    'Nope',
    'nah',
    'No thanks',
    'no thank you',
    'Not right now',
    'not at the moment',
    'Nothing right now',
    'no questions',
    'No, not yet',
    'no not really',
    'yes',
    'Maybe later',
    'not sure',
    "I'm not interested in refinancing, I want to buy",
    'What are my options?',
  ];

  it.each(answersToAnyQuestions)('does NOT treat %p as an opt-out', (text) => {
    expect(isOptOutMessage(text)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

describe('processFinanceVineRelay', () => {
  it('attributes a relayed reply to the existing lead by the number in the body', async () => {
    mockFindLeadByPhone.mockResolvedValue(existingLead);

    const outcome = await processFinanceVineRelay({
      from: RELAY_SENDER,
      body: `NEW MESSAGE FROM: ${LEAD_10} BODY: What are my options?`,
      messageSid: 'SM1',
    });

    expect(outcome).toEqual({ kind: 'queued', leadId: 'lead-existing', provisional: false, leadPhone: LEAD_E164 });
    expect(mockFindLeadByPhone).toHaveBeenCalledWith(LEAD_E164);
    expect(mockLeadCreate).not.toHaveBeenCalled();

    const comm = mockCommunicationCreate.mock.calls[0][0].data;
    expect(comm.leadId).toBe('lead-existing');
    expect(comm.direction).toBe('INBOUND');
    expect(comm.content).toBe('What are my options?');
    expect(comm.twilioSid).toBe('SM1');
    expect(comm.metadata).toMatchObject({ from: LEAD_E164, relay: true, relayedVia: RELAY_SENDER });

    const evt = mockInngestSend.mock.calls[0][0];
    expect(evt.name).toBe('lead/reply');
    expect(evt.data).toMatchObject({ leadId: 'lead-existing', phone: LEAD_E164, message: 'What are my options?', relay: true });
    expect(evt.data.delaySeconds).toBeUndefined();

    const nextReview = mockLeadUpdate.mock.calls.find((c) => c[0].data.nextReviewAt)?.[0].data.nextReviewAt as Date;
    expect(Math.abs(nextReview.getTime() - Date.now())).toBeLessThan(5_000);
  });

  it('creates a provisional lead keyed on the normalised number when the webhook has not arrived', async () => {
    mockFindLeadByPhone.mockResolvedValue(null);

    const outcome = await processFinanceVineRelay({
      from: RELAY_SENDER,
      body: `NEW MESSAGE FROM: ${LEAD_10} BODY: no`,
      messageSid: 'SM2',
    });

    expect(outcome).toEqual({ kind: 'queued', leadId: 'lead-provisional', provisional: true, leadPhone: LEAD_E164 });

    const created = mockLeadCreate.mock.calls[0][0].data;
    expect(created.phone).toBe(LEAD_E164);
    expect(created.email).toBe(provisionalEmailFor(LEAD_E164));
    expect(created.source).toBe('financevine');
    expect(created.segment).toBe('alt_private');
    expect(created.consentSms).toBe(true);
    expect(created.rawData).toMatchObject({ provisional: true, source: 'financevine' });
    expect(created.rawData.ingestTimestamp).toBeDefined();

    // The first message is not lost: stored against the provisional row.
    const comm = mockCommunicationCreate.mock.calls[0][0].data;
    expect(comm.leadId).toBe('lead-provisional');
    expect(comm.content).toBe('no');

    // Holly gets a head start so the webhook can fill the profile in first.
    const evt = mockInngestSend.mock.calls[0][0];
    expect(evt.data).toMatchObject({ leadId: 'lead-provisional', phone: LEAD_E164, delaySeconds: PROVISIONAL_HOLLY_DELAY_SECONDS });

    const nextReview = mockLeadUpdate.mock.calls.find((c) => c[0].data.nextReviewAt)?.[0].data.nextReviewAt as Date;
    expect(nextReview.getTime() - Date.now()).toBeGreaterThan((PROVISIONAL_HOLLY_DELAY_SECONDS - 5) * 1000);

    expect(mockSendSlackNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'new_lead', leadId: 'lead-provisional' }));
  });

  it('a relayed "no" opens the direct thread rather than suppressing it', async () => {
    mockFindLeadByPhone.mockResolvedValue(existingLead);

    const outcome = await processFinanceVineRelay({
      from: RELAY_SENDER,
      body: `NEW MESSAGE FROM: ${LEAD_10} BODY: No`,
      messageSid: 'SM3',
    });

    expect(outcome.kind).toBe('queued');
    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    expect(mockLeadUpdate.mock.calls.some((c) => c[0].data.consentSms === false)).toBe(false);
    expect(mockLeadActivityCreate.mock.calls[0][0].data.metadata.optOut).toBe(false);
  });

  const optOutPhrasings = ['STOP', 'unsubscribe', "don't contact me", 'remove me', 'Not interested', 'no longer interested'];

  it.each(optOutPhrasings)('a relayed %p suppresses outreach immediately and persists the opt-out', async (text) => {
    mockFindLeadByPhone.mockResolvedValue(existingLead);

    const outcome = await processFinanceVineRelay({
      from: RELAY_SENDER,
      body: `NEW MESSAGE FROM: ${LEAD_10} BODY: ${text}`,
      messageSid: `SM-${text}`,
    });

    expect(outcome).toEqual({ kind: 'opt_out', leadId: 'lead-existing', provisional: false });
    expect(mockInngestSend).not.toHaveBeenCalled();
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: 'lead-existing' },
      data: { consentSms: false, nextReviewAt: null },
    });
    // Stored so Holly's own first-inbound guard sees the words too.
    expect(mockCommunicationCreate.mock.calls[0][0].data.content).toBe(text);
    expect(mockLeadActivityCreate.mock.calls[0][0].data.metadata).toMatchObject({ optOut: true, relay: true });
  });

  it('an opt-out that beats the webhook still creates the provisional row, opted out', async () => {
    mockFindLeadByPhone.mockResolvedValue(null);

    const outcome = await processFinanceVineRelay({
      from: RELAY_SENDER,
      body: `NEW MESSAGE FROM: ${LEAD_10} BODY: STOP`,
      messageSid: 'SM4',
    });

    expect(outcome).toEqual({ kind: 'opt_out', leadId: 'lead-provisional', provisional: true });
    expect(mockLeadCreate).toHaveBeenCalledTimes(1);
    expect(mockInngestSend).not.toHaveBeenCalled();
    expect(mockLeadUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { consentSms: false, nextReviewAt: null } }));
  });

  it('never produces a lead, event or reply addressed to the relay sender', async () => {
    mockFindLeadByPhone.mockResolvedValue(null);

    await processFinanceVineRelay({
      from: RELAY_SENDER,
      body: `NEW MESSAGE FROM: ${LEAD_10} BODY: hello`,
      messageSid: 'SM5',
    });

    expect(mockFindLeadByPhone).not.toHaveBeenCalledWith(RELAY_SENDER);
    for (const call of mockLeadCreate.mock.calls) expect(call[0].data.phone).not.toBe(RELAY_SENDER);
    for (const call of mockInngestSend.mock.calls) expect(call[0].data.phone).not.toBe(RELAY_SENDER);
    for (const call of mockCommunicationCreate.mock.calls) expect(call[0].data.metadata.from).not.toBe(RELAY_SENDER);
  });

  it('fails loudly on a malformed relay instead of dropping it', async () => {
    mockFindLeadByPhone.mockResolvedValue(existingLead);

    const outcome = await processFinanceVineRelay({
      from: RELAY_SENDER,
      body: 'NEW MESSAGE FROM: 12345 BODY: hi',
      messageSid: 'SM6',
    });

    expect(outcome.kind).toBe('malformed');
    expect(mockSendErrorAlert).toHaveBeenCalledTimes(1);
    expect(mockSendErrorAlert.mock.calls[0][0].context.location).toContain('FinanceVine relay');
    expect(mockWebhookEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: 'sms.relay.malformed', processed: false }) })
    );
    expect(mockLeadCreate).not.toHaveBeenCalled();
    expect(mockCommunicationCreate).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('treats a relay whose embedded number is the sender or our own number as malformed', async () => {
    for (const number of [RELAY_SENDER, process.env.TWILIO_PHONE_NUMBER as string]) {
      jest.clearAllMocks();
      mockCommunicationFindUnique.mockResolvedValue(null);
      const outcome = await processFinanceVineRelay({
        from: RELAY_SENDER,
        body: `NEW MESSAGE FROM: ${number} BODY: hi`,
        messageSid: 'SM7',
      });
      expect(outcome.kind).toBe('malformed');
      expect(mockSendErrorAlert).toHaveBeenCalledTimes(1);
      expect(mockInngestSend).not.toHaveBeenCalled();
    }
  });

  it('does not double-attribute a Twilio retry of the same MessageSid', async () => {
    mockFindLeadByPhone.mockResolvedValue(existingLead);
    mockCommunicationFindUnique.mockResolvedValue({ leadId: 'lead-existing' });

    const outcome = await processFinanceVineRelay({
      from: RELAY_SENDER,
      body: `NEW MESSAGE FROM: ${LEAD_10} BODY: hello again`,
      messageSid: 'SM-dup',
    });

    expect(outcome).toEqual({ kind: 'duplicate', leadId: 'lead-existing' });
    expect(mockCommunicationCreate).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('with the sender pinned, a relay-format body from anyone else is alerted and not acted on', async () => {
    process.env.FINANCEVINE_RELAY_NUMBER = RELAY_SENDER;
    mockFindLeadByPhone.mockResolvedValue(null);

    const outcome = await processFinanceVineRelay({
      from: '+16045550123',
      body: `NEW MESSAGE FROM: ${LEAD_10} BODY: hi`,
      messageSid: 'SM8',
    });

    expect(outcome.kind).toBe('unexpected_sender');
    expect(mockSendErrorAlert).toHaveBeenCalledTimes(1);
    expect(mockWebhookEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: 'sms.relay.unexpected_sender', processed: false }) })
    );
    expect(mockLeadCreate).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('with the sender pinned, the pinned sender is accepted in any phone format', async () => {
    process.env.FINANCEVINE_RELAY_NUMBER = '7785550199';
    mockFindLeadByPhone.mockResolvedValue(existingLead);

    const outcome = await processFinanceVineRelay({
      from: RELAY_SENDER,
      body: `NEW MESSAGE FROM: ${LEAD_10} BODY: hi`,
      messageSid: 'SM9',
    });

    expect(outcome.kind).toBe('queued');
  });
});

// ---------------------------------------------------------------------------
// Route: end to end through the signed Twilio webhook
// ---------------------------------------------------------------------------

function computeTwilioSignature(url: string, params: Record<string, string>, authToken: string): string {
  let data = url;
  for (const key of Object.keys(params).sort()) data += key + params[key];
  return createHmac('sha1', authToken).update(data).digest('base64');
}

function signedRequest(params: Record<string, string>): NextRequest {
  const url = 'https://lod2.vercel.app/api/webhooks/twilio';
  const parsedUrl = new URL(url);
  const formData = new FormData();
  Object.entries(params).forEach(([k, v]) => formData.append(k, v));
  const headers = new Headers();
  headers.set('host', parsedUrl.host);
  headers.set('x-forwarded-proto', 'https');
  headers.set('X-Twilio-Signature', computeTwilioSignature(url, params, process.env.TWILIO_AUTH_TOKEN as string));
  return { url, headers, formData: async () => formData } as unknown as NextRequest;
}

describe('Twilio webhook: relay branch', () => {
  it('a relayed reply from the 778 gets empty TwiML and queues Holly toward the lead', async () => {
    mockFindLeadByPhone.mockResolvedValue(existingLead);

    const res = await POST(
      signedRequest({ From: RELAY_SENDER, To: process.env.TWILIO_PHONE_NUMBER as string, Body: `NEW MESSAGE FROM: ${LEAD_10} BODY: no`, MessageSid: 'SM-r1' })
    );

    expect(res.status).toBe(200);
    const twiml = await res.text();
    expect(twiml).not.toContain('<Message');
    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    expect(mockInngestSend.mock.calls[0][0].data.phone).toBe(LEAD_E164);
    expect(mockWebhookEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: 'sms.relay', processed: true }) })
    );
  });

  it('a relayed STOP gets empty TwiML, not the unsubscribe confirmation the direct path sends', async () => {
    mockFindLeadByPhone.mockResolvedValue(existingLead);

    const res = await POST(
      signedRequest({ From: RELAY_SENDER, To: process.env.TWILIO_PHONE_NUMBER as string, Body: `NEW MESSAGE FROM: ${LEAD_10} BODY: STOP`, MessageSid: 'SM-r2' })
    );

    const twiml = await res.text();
    expect(twiml).not.toContain('<Message');
    expect(twiml).not.toContain('unsubscribed');
    expect(mockInngestSend).not.toHaveBeenCalled();
    expect(mockLeadUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { consentSms: false, nextReviewAt: null } }));
  });

  it('a malformed relay is alerted and gets empty TwiML', async () => {
    process.env.FINANCEVINE_RELAY_NUMBER = RELAY_SENDER;

    const res = await POST(
      signedRequest({ From: RELAY_SENDER, To: process.env.TWILIO_PHONE_NUMBER as string, Body: 'Forwarding failed', MessageSid: 'SM-r3' })
    );

    expect(await res.text()).not.toContain('<Message');
    expect(mockSendErrorAlert).toHaveBeenCalledTimes(1);
    expect(mockInngestSend).not.toHaveBeenCalled();
    expect(mockFindLeadByPhone).not.toHaveBeenCalled();
    expect(mockWebhookEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: 'sms.relay', processed: false }) })
    );
  });

  it('once the direct thread exists, direct replies and further relays attach to the same lead', async () => {
    mockFindLeadByPhone.mockResolvedValue(existingLead);

    // Direct reply from the lead's own number to ours: normal path.
    await POST(signedRequest({ From: LEAD_E164, To: process.env.TWILIO_PHONE_NUMBER as string, Body: 'Thursday works', MessageSid: 'SM-d1' }));
    // Another reply to the 778, relayed.
    await POST(
      signedRequest({ From: RELAY_SENDER, To: process.env.TWILIO_PHONE_NUMBER as string, Body: `NEW MESSAGE FROM: ${LEAD_10} BODY: actually Friday`, MessageSid: 'SM-r4' })
    );

    expect(mockLeadCreate).not.toHaveBeenCalled();
    const commLeadIds = mockCommunicationCreate.mock.calls.map((c) => c[0].data.leadId);
    expect(commLeadIds).toEqual(['lead-existing', 'lead-existing']);
    const contents = mockCommunicationCreate.mock.calls.map((c) => c[0].data.content);
    expect(contents).toEqual(['Thursday works', 'actually Friday']);
    const eventLeadIds = mockInngestSend.mock.calls.map((c) => c[0].data.leadId);
    expect(eventLeadIds).toEqual(['lead-existing', 'lead-existing']);
    for (const c of mockInngestSend.mock.calls) expect(c[0].data.phone).toBe(LEAD_E164);
  });

  it('a direct message from a BC (778) lead that is not in relay format still takes the normal path', async () => {
    mockFindLeadByPhone.mockResolvedValue({ ...existingLead, id: 'lead-bc', phone: '+17785550001' });

    await POST(signedRequest({ From: '+17785550001', To: process.env.TWILIO_PHONE_NUMBER as string, Body: 'hi, is this Inspired?', MessageSid: 'SM-bc' }));

    expect(mockFindLeadByPhone).toHaveBeenCalledWith('+17785550001');
    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    expect(mockInngestSend.mock.calls[0][0].data.leadId).toBe('lead-bc');
    expect(mockSendErrorAlert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Holly context
// ---------------------------------------------------------------------------

describe('buildRelayHandoffContext', () => {
  const at = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000);

  it('is silent when the latest inbound did not come through the relay', () => {
    expect(
      buildRelayHandoffContext({
        firstName: 'Sam',
        communications: [{ direction: 'INBOUND', content: 'hi', metadata: { from: LEAD_E164 }, createdAt: at(1) }],
      })
    ).toBeUndefined();
    expect(buildRelayHandoffContext({ firstName: 'Sam', communications: [] })).toBeUndefined();
  });

  it('frames a relayed "no" as an answer to "any questions?", not a decline', () => {
    const ctx = buildRelayHandoffContext({
      firstName: 'Sam',
      communications: [{ direction: 'INBOUND', content: 'no', metadata: { relay: true }, createdAt: at(1) }],
    });
    expect(ctx).toContain('FIRST message they will ever see from this number');
    expect(ctx).toContain('NOT disinterest and NOT an opt-out');
    expect(ctx).toContain('FinanceVine');
    expect(ctx).not.toContain('Their name is not on file');
  });

  it('tells Holly not to use a placeholder name on a provisional lead', () => {
    const ctx = buildRelayHandoffContext({
      firstName: 'Unknown',
      communications: [{ direction: 'INBOUND', content: 'What are my options?', metadata: { relay: true }, createdAt: at(1) }],
    });
    expect(ctx).toContain('Their name is not on file');
    expect(ctx).toContain('answer it in their terms');
  });

  it('notes an existing direct thread when we have already sent outbound', () => {
    const ctx = buildRelayHandoffContext({
      firstName: 'Sam',
      communications: [
        { direction: 'OUTBOUND', content: 'Hi Sam, Holly here', createdAt: at(10) },
        { direction: 'INBOUND', content: 'ok', metadata: { relay: true }, createdAt: at(1) },
      ],
    });
    expect(ctx).toContain('treat both threads as one conversation');
  });
});
