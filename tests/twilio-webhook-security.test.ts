/**
 * Twilio Webhook Security Integration Tests
 * 
 * Tests the complete webhook flow including signature validation.
 * These tests verify that the webhook properly rejects unauthorized requests.
 */

import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

// Mock environment
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token_secret';
process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
process.env.TWILIO_PHONE_NUMBER = '+12345678901';

// Mock all dependencies before importing the route
jest.mock('../lib/db', () => ({
  prisma: {
    lead: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    webhookEvent: {
      create: jest.fn().mockResolvedValue({ id: 'test-webhook-event' }),
    },
  },
}));

jest.mock('../lib/inngest', () => ({
  inngest: {
    send: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../lib/slack', () => ({
  sendErrorAlert: jest.fn().mockResolvedValue({}),
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

describe('Twilio Webhook Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects request with missing X-Twilio-Signature header', async () => {
    const { POST } = await import('../app/api/webhooks/twilio/route');

    const url = 'https://example.com/api/webhooks/twilio';
    const params = {
      From: '+12345678900',
      To: '+12345678901',
      Body: 'Test message',
      MessageSid: 'SM123456',
    };

    const request = createMockNextRequest(url, params); // No signature

    const response = await POST(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  test('rejects request with invalid X-Twilio-Signature', async () => {
    const { POST } = await import('../app/api/webhooks/twilio/route');

    const url = 'https://example.com/api/webhooks/twilio';
    const params = {
      From: '+12345678900',
      To: '+12345678901',
      Body: 'Test message',
      MessageSid: 'SM123456',
    };

    const invalidSignature = 'this_is_not_a_valid_signature';
    const request = createMockNextRequest(url, params, invalidSignature);

    const response = await POST(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  test('accepts request with valid X-Twilio-Signature', async () => {
    const { POST } = await import('../app/api/webhooks/twilio/route');

    const url = 'https://example.com/api/webhooks/twilio';
    const params = {
      From: '+12345678900',
      To: '+12345678901',
      Body: 'Test message',
      MessageSid: 'SM123456',
    };

    const validSignature = computeTwilioSignature(url, params, process.env.TWILIO_AUTH_TOKEN!);
    const request = createMockNextRequest(url, params, validSignature);

    const response = await POST(request);

    // Should not be 403 (validation passed)
    // Actual status depends on whether lead exists, etc.
    expect(response.status).not.toBe(403);
  });

  test('signature must match the exact URL (including query params)', async () => {
    const { POST } = await import('../app/api/webhooks/twilio/route');

    const urlWithQuery = 'https://example.com/api/webhooks/twilio?foo=bar';
    const urlWithoutQuery = 'https://example.com/api/webhooks/twilio';
    const params = {
      From: '+12345678900',
      To: '+12345678901',
      Body: 'Test message',
      MessageSid: 'SM123456',
    };

    // Sign with query params
    const signature = computeTwilioSignature(urlWithQuery, params, process.env.TWILIO_AUTH_TOKEN!);

    // Try to use signature on URL without query params
    const request = createMockNextRequest(urlWithoutQuery, params, signature);

    const response = await POST(request);

    // Should reject because URL mismatch
    expect(response.status).toBe(403);
  });

  test('signature must include all POST parameters', async () => {
    const { POST } = await import('../app/api/webhooks/twilio/route');

    const url = 'https://example.com/api/webhooks/twilio';
    const originalParams = {
      From: '+12345678900',
      To: '+12345678901',
      Body: 'Original message',
      MessageSid: 'SM123456',
    };

    const tamperedParams = {
      ...originalParams,
      Body: 'Tampered message', // Changed after signing
    };

    // Sign original params
    const signature = computeTwilioSignature(url, originalParams, process.env.TWILIO_AUTH_TOKEN!);

    // Try to use signature with tampered params
    const request = createMockNextRequest(url, tamperedParams, signature);

    const response = await POST(request);

    // Should reject because params don't match
    expect(response.status).toBe(403);
  });
});

describe('Twilio Webhook Security - Missing Auth Token', () => {
  const originalAuthToken = process.env.TWILIO_AUTH_TOKEN;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.TWILIO_AUTH_TOKEN;
  });

  afterEach(() => {
    process.env.TWILIO_AUTH_TOKEN = originalAuthToken;
  });

  test('rejects all requests when TWILIO_AUTH_TOKEN is not configured', async () => {
    // Re-import after env change
    jest.isolateModules(async () => {
      const { POST } = await import('../app/api/webhooks/twilio/route');

      const url = 'https://example.com/api/webhooks/twilio';
      const params = {
        From: '+12345678900',
        To: '+12345678901',
        Body: 'Test message',
        MessageSid: 'SM123456',
      };

      const signature = 'any_signature';
      const request = createMockNextRequest(url, params, signature);

      const response = await POST(request);

      // Should fail closed
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });
});
