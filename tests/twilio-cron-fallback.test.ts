/**
 * Twilio Webhook Cron Fallback Tests
 * 
 * Tests that inbound SMS sets nextReviewAt to ensure the 15-min cron
 * picks up the lead if Inngest fails to process the reply.
 * 
 * Production incident 2026-08-26:
 * - Harper Test inbound SMS queued to Inngest but never processed
 * - nextReviewAt was not set, so cron didn't pick it up
 * - Lead never got a reply
 */

import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

// Mock environment
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token_secret';
process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
process.env.TWILIO_PHONE_NUMBER = '+12345678901';

// Mock all dependencies before importing the route
const mockFindLeadByPhone = jest.fn();
const mockLeadUpdate = jest.fn();
const mockCommunicationCreate = jest.fn();
const mockLeadActivityCreate = jest.fn();
const mockWebhookEventCreate = jest.fn();
const mockInngestSend = jest.fn();
const mockSendErrorAlert = jest.fn();

jest.mock('../lib/phone-matching', () => ({
  findLeadByPhone: mockFindLeadByPhone,
}));

jest.mock('../lib/db', () => ({
  prisma: {
    lead: {
      update: mockLeadUpdate,
    },
    communication: {
      create: mockCommunicationCreate,
    },
    leadActivity: {
      create: mockLeadActivityCreate,
    },
    webhookEvent: {
      create: mockWebhookEventCreate,
    },
  },
}));

jest.mock('../lib/inngest', () => ({
  inngest: {
    send: mockInngestSend,
  },
}));

jest.mock('../lib/slack', () => ({
  sendErrorAlert: mockSendErrorAlert,
}));

function computeTwilioSignature(url: string, params: Record<string, string>, authToken: string): string {
  let data = url;
  const sortedKeys = Object.keys(params).sort();
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  const hmac = createHmac('sha1', authToken);
  hmac.update(data);
  return hmac.digest('base64');
}

function createMockNextRequest(
  url: string,
  params: Record<string, string>,
  signature?: string
): NextRequest {
  const parsedUrl = new URL(url);
  const formData = new FormData();
  
  Object.entries(params).forEach(([key, value]) => {
    formData.append(key, value);
  });

  const headers = new Headers();
  headers.set('host', parsedUrl.host);
  headers.set('x-forwarded-proto', parsedUrl.protocol.replace(':', ''));
  if (signature) {
    headers.set('X-Twilio-Signature', signature);
  }

  const mockRequest = {
    url,
    headers,
    formData: async () => formData,
  } as unknown as NextRequest;

  return mockRequest;
}

describe('Twilio Webhook Cron Fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWebhookEventCreate.mockResolvedValue({ id: 'test-webhook-event' });
    mockCommunicationCreate.mockResolvedValue({ id: 'test-communication' });
    mockLeadActivityCreate.mockResolvedValue({ id: 'test-activity' });
    mockInngestSend.mockResolvedValue({});
    mockLeadUpdate.mockResolvedValue({});
  });

  test('sets nextReviewAt to now when inbound SMS received', async () => {
    const { POST } = await import('../app/api/webhooks/twilio/route');

    const mockLead = {
      id: 'cmtabaryi0001jq04m5xqvewh',
      phone: '+16048974960',
      firstName: 'Harper',
      lastName: 'Test',
      status: 'CONTACTED',
      consentSms: true,
    };

    mockFindLeadByPhone.mockResolvedValue(mockLead);

    const url = 'https://example.com/api/webhooks/twilio';
    const params = {
      From: '+16048974960',
      To: '+12345678901',
      Body: 'Hi Holly, what rates do you have?',
      MessageSid: 'SM123456',
    };

    const validSignature = computeTwilioSignature(url, params, process.env.TWILIO_AUTH_TOKEN!);
    const request = createMockNextRequest(url, params, validSignature);

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify nextReviewAt was set to now (or very close to now)
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: 'cmtabaryi0001jq04m5xqvewh' },
      data: {
        nextReviewAt: expect.any(Date),
      },
    });

    // Find the update call that sets nextReviewAt (may be second call after status update)
    const nextReviewAtUpdateCall = mockLeadUpdate.mock.calls.find(
      call => call[0].data?.nextReviewAt !== undefined
    );
    
    expect(nextReviewAtUpdateCall).toBeDefined();
    const nextReviewAt = nextReviewAtUpdateCall[0].data.nextReviewAt;
    const now = new Date();
    const diffMs = Math.abs(now.getTime() - nextReviewAt.getTime());
    
    // Should be within 5 seconds of now
    expect(diffMs).toBeLessThan(5000);
  });

  test('sets nextReviewAt even when Inngest fails', async () => {
    const { POST } = await import('../app/api/webhooks/twilio/route');

    const mockLead = {
      id: 'cmtabaryi0001jq04m5xqvewh',
      phone: '+16048974960',
      firstName: 'Harper',
      lastName: 'Test',
      status: 'CONTACTED',
      consentSms: true,
    };

    mockFindLeadByPhone.mockResolvedValue(mockLead);
    mockInngestSend.mockRejectedValue(new Error('Inngest queue failed'));

    const url = 'https://example.com/api/webhooks/twilio';
    const params = {
      From: '+16048974960',
      To: '+12345678901',
      Body: 'Hi Holly!',
      MessageSid: 'SM123456',
    };

    const validSignature = computeTwilioSignature(url, params, process.env.TWILIO_AUTH_TOKEN!);
    const request = createMockNextRequest(url, params, validSignature);

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify nextReviewAt was still set despite Inngest failure
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: 'cmtabaryi0001jq04m5xqvewh' },
      data: {
        nextReviewAt: expect.any(Date),
      },
    });

    // Verify error alert was sent about Inngest failure
    expect(mockSendErrorAlert).toHaveBeenCalledWith({
      error: expect.any(Error),
      context: {
        location: 'webhooks/twilio - Inngest queue send',
        leadId: 'cmtabaryi0001jq04m5xqvewh',
        details: expect.any(Object),
      },
    });
  });

  test('uses deterministic phone matching to find correct lead', async () => {
    const { POST } = await import('../app/api/webhooks/twilio/route');

    const mockLead = {
      id: 'cmtabaryi0001jq04m5xqvewh',
      phone: '+16048974960',
      firstName: 'Harper',
      lastName: 'Test',
      status: 'CONTACTED',
      consentSms: true,
    };

    mockFindLeadByPhone.mockResolvedValue(mockLead);

    const url = 'https://example.com/api/webhooks/twilio';
    const params = {
      From: '+16048974960',
      To: '+12345678901',
      Body: 'Test message',
      MessageSid: 'SM123456',
    };

    const validSignature = computeTwilioSignature(url, params, process.env.TWILIO_AUTH_TOKEN!);
    const request = createMockNextRequest(url, params, validSignature);

    await POST(request);

    // Verify we used the deterministic matching function
    expect(mockFindLeadByPhone).toHaveBeenCalledWith('+16048974960');
  });

  test('STOP message still updates consentSms but does not set nextReviewAt', async () => {
    const { POST } = await import('../app/api/webhooks/twilio/route');

    const mockLead = {
      id: 'test-lead-id',
      phone: '+16048974960',
      firstName: 'Test',
      lastName: 'User',
      status: 'CONTACTED',
      consentSms: true,
    };

    mockFindLeadByPhone.mockResolvedValue(mockLead);
    mockLeadUpdate.mockResolvedValue({ ...mockLead, consentSms: false });

    const url = 'https://example.com/api/webhooks/twilio';
    const params = {
      From: '+16048974960',
      To: '+12345678901',
      Body: 'STOP',
      MessageSid: 'SM123456',
    };

    const validSignature = computeTwilioSignature(url, params, process.env.TWILIO_AUTH_TOKEN!);
    const request = createMockNextRequest(url, params, validSignature);

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify consentSms was updated to false
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: 'test-lead-id' },
      data: { consentSms: false },
    });

    // Verify nextReviewAt was NOT set (STOP handler returns early)
    const updateCalls = mockLeadUpdate.mock.calls;
    const nextReviewAtUpdate = updateCalls.find(
      call => call[0].data?.nextReviewAt !== undefined
    );
    expect(nextReviewAtUpdate).toBeUndefined();
  });

  test('auto-progresses CONTACTED to ENGAGED and sets nextReviewAt', async () => {
    const { POST } = await import('../app/api/webhooks/twilio/route');

    const mockLead = {
      id: 'test-lead-id',
      phone: '+16048974960',
      firstName: 'Test',
      lastName: 'User',
      status: 'CONTACTED',
      consentSms: true,
    };

    mockFindLeadByPhone.mockResolvedValue(mockLead);
    
    // First update is CONTACTED → ENGAGED
    mockLeadUpdate
      .mockResolvedValueOnce({ ...mockLead, status: 'ENGAGED' })
      // Second update is nextReviewAt
      .mockResolvedValueOnce({ ...mockLead, status: 'ENGAGED' });

    const url = 'https://example.com/api/webhooks/twilio';
    const params = {
      From: '+16048974960',
      To: '+12345678901',
      Body: 'Yes, interested!',
      MessageSid: 'SM123456',
    };

    const validSignature = computeTwilioSignature(url, params, process.env.TWILIO_AUTH_TOKEN!);
    const request = createMockNextRequest(url, params, validSignature);

    const response = await POST(request);

    expect(response.status).toBe(200);

    // Verify status was updated to ENGAGED
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: 'test-lead-id' },
      data: { status: 'ENGAGED' },
    });

    // Verify nextReviewAt was set
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: 'test-lead-id' },
      data: {
        nextReviewAt: expect.any(Date),
      },
    });
  });

  test('does not update lastContactedAt on inbound (only nextReviewAt)', async () => {
    const { POST } = await import('../app/api/webhooks/twilio/route');

    const mockLead = {
      id: 'test-lead-id',
      phone: '+16048974960',
      firstName: 'Test',
      lastName: 'User',
      status: 'NURTURING',
      consentSms: true,
    };

    mockFindLeadByPhone.mockResolvedValue(mockLead);

    const url = 'https://example.com/api/webhooks/twilio';
    const params = {
      From: '+16048974960',
      To: '+12345678901',
      Body: 'Test',
      MessageSid: 'SM123456',
    };

    const validSignature = computeTwilioSignature(url, params, process.env.TWILIO_AUTH_TOKEN!);
    const request = createMockNextRequest(url, params, validSignature);

    await POST(request);

    // Verify nextReviewAt was set but lastContactedAt was NOT
    expect(mockLeadUpdate).toHaveBeenCalledWith({
      where: { id: 'test-lead-id' },
      data: {
        nextReviewAt: expect.any(Date),
      },
    });

    const updateCall = mockLeadUpdate.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('lastContactedAt');
  });
});
