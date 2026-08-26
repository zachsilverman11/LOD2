/**
 * SMS Conversion-Reliability Tests
 * 
 * Tests for two critical bugs:
 * 1. Twilio 21610 opt-out error handling (Bug 1)
 * 2. executeDecision race check and result handling (Bug 2)
 */

// Mock environment variables
process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
process.env.TWILIO_PHONE_NUMBER = '+12345678901';

// Mock fetch globally
global.fetch = jest.fn();

// Create mock functions
const mockLeadUpdate = jest.fn();
const mockCommunicationCreate = jest.fn();
const mockLeadActivityCreate = jest.fn();
const mockLeadFindUnique = jest.fn();
const mockCommunicationFindFirst = jest.fn();

// Mock prisma
jest.mock('../lib/db', () => ({
  prisma: {
    lead: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    communication: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    leadActivity: {
      create: jest.fn(),
    },
  },
}));

// Mock other dependencies
jest.mock('../lib/email', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('../lib/slack', () => ({
  sendErrorAlert: jest.fn(),
  sendSlackNotification: jest.fn(),
}));

jest.mock('../lib/human-delay', () => ({
  quickDelay: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/calcom', () => ({
  getTimezoneForProvince: jest.fn(() => 'America/Vancouver'),
  getAvailableSlots: jest.fn().mockResolvedValue([]),
  getAvailabilityWindow: jest.fn(() => ({ start: new Date(), end: new Date() })),
  CALCOM_AVAILABILITY_DEFAULT_DAYS_AHEAD: 14,
}));

jest.mock('../lib/appointment-status', () => ({
  ACTIVE_APPOINTMENT_STATUSES: ['CONFIRMED', 'PENDING'],
}));

jest.mock('../lib/direct-booking', () => ({
  bookLeadAppointmentDirectly: jest.fn(),
}));

import { sendSms } from '../lib/sms';
import { executeDecision, type ExecuteDecisionResult } from '../lib/holly/conversation-handler';
import { prisma } from '../lib/db';

describe('Bug 1: Twilio 21610 opt-out error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  test('sendSms tags 21610 error with isTwilioOptOut flag', async () => {
    // Mock Twilio API error response with 21610
    const twilioError = {
      code: 21610,
      message: 'Attempt to send to unsubscribed recipient',
      more_info: 'https://www.twilio.com/docs/errors/21610',
      status: 400,
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify(twilioError),
    });

    // Attempt to send SMS
    try {
      await sendSms({
        to: '+12345678900',
        body: 'Test message',
      });
      
      fail('sendSms should have thrown an error');
    } catch (error: any) {
      // Verify the error is tagged with opt-out flags
      expect(error.isTwilioOptOut).toBe(true);
      expect(error.twilioErrorCode).toBe(21610);
      expect(error.message).toContain('Twilio API error');
    }
  });

  test('sendSms handles non-JSON error responses gracefully', async () => {
    // Mock Twilio API error response with invalid JSON
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    // Attempt to send SMS
    try {
      await sendSms({
        to: '+12345678900',
        body: 'Test message',
      });
      
      fail('sendSms should have thrown an error');
    } catch (error: any) {
      // Verify the error is NOT tagged (since JSON parsing failed)
      expect(error.isTwilioOptOut).toBeUndefined();
      expect(error.twilioErrorCode).toBeUndefined();
      expect(error.message).toContain('Twilio API error');
    }
  });

  test('executeDecision handles 21610 error and marks lead as opted out', async () => {
    // Setup mocks
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue({
      id: 'test-lead-id',
      phone: '+12345678900',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      status: 'CONTACTED',
      hollyDisabled: false,
    });

    (prisma.communication.findFirst as jest.Mock).mockResolvedValue(null);

    // Mock Twilio 21610 error
    const twilioError = {
      code: 21610,
      message: 'Attempt to send to unsubscribed recipient',
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify(twilioError),
    });

    // Execute decision
    const result: ExecuteDecisionResult = await executeDecision(
      'test-lead-id',
      {
        action: 'send_sms',
        message: 'Test message',
        reasoning: 'Test reasoning',
      }
    );

    // Verify result indicates failure due to opt-out
    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('opted out');
    expect(result.skipReason).toContain('21610');

    // Verify lead was marked as opted out
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'test-lead-id' },
      data: expect.objectContaining({
        consentSms: false,
        status: 'LOST',
      }),
    });

    // Verify activity was logged
    expect(prisma.leadActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'test-lead-id',
        type: 'NOTE_ADDED',
        subject: '🚫 Lead Opted Out - Twilio Block',
      }),
    });
  });
});

describe('Bug 2: executeDecision race check and result handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue({
      id: 'test-lead-id',
      phone: '+12345678900',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      status: 'CONTACTED',
      hollyDisabled: false,
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ sid: 'SM123', status: 'sent' }),
    });
  });

  test('executeDecision blocks duplicate proactive sends within 30s', async () => {
    // Mock recent outbound message (25 seconds ago)
    const recentOutbound = {
      id: 'comm-123',
      content: 'Previous message',
      createdAt: new Date(Date.now() - 25000), // 25 seconds ago
      direction: 'OUTBOUND',
    };

    (prisma.communication.findFirst as jest.Mock).mockResolvedValue(recentOutbound);

    // Execute decision WITHOUT triggerSource (defaults to cron/proactive)
    const result: ExecuteDecisionResult = await executeDecision(
      'test-lead-id',
      {
        action: 'send_sms',
        message: 'Test message',
        reasoning: 'Test reasoning',
      }
    );

    // Verify send was blocked
    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('Duplicate blocked');
    expect(result.skipReason).toContain('25s ago');

    // Verify no SMS was sent
    expect(global.fetch).not.toHaveBeenCalled();

    // Verify activity was logged
    expect(prisma.leadActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'test-lead-id',
        subject: '🔒 Duplicate Message Blocked',
      }),
    });
  });

  test('executeDecision allows reactive SMS replies even with recent outbound', async () => {
    // Mock recent outbound message (25 seconds ago)
    const recentOutbound = {
      id: 'comm-123',
      content: 'Previous message',
      createdAt: new Date(Date.now() - 25000), // 25 seconds ago
      direction: 'OUTBOUND',
    };

    (prisma.communication.findFirst as jest.Mock).mockResolvedValue(recentOutbound);

    // Execute decision WITH triggerSource='sms_reply' (reactive)
    const result: ExecuteDecisionResult = await executeDecision(
      'test-lead-id',
      {
        action: 'send_sms',
        message: 'Reply to their question',
        reasoning: 'Answering their question',
      },
      'sms_reply' // This should bypass the 30s check
    );

    // Verify send was NOT blocked
    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();

    // Verify SMS was sent
    expect(global.fetch).toHaveBeenCalled();

    // Verify communication was created
    expect(prisma.communication.create).toHaveBeenCalled();
  });

  test('executeDecision returns distinguishable results for different outcomes', async () => {
    // Test 1: Successful send
    (prisma.communication.findFirst as jest.Mock).mockResolvedValue(null);

    const successResult = await executeDecision(
      'test-lead-id',
      {
        action: 'send_sms',
        message: 'Test message',
        reasoning: 'Test',
      }
    );

    expect(successResult.success).toBe(true);
    expect(successResult.action).toBe('send_sms');
    expect(successResult.skipped).toBeUndefined();

    // Test 2: Skipped duplicate
    (prisma.communication.findFirst as jest.Mock).mockResolvedValue({
      id: 'comm-123',
      content: 'Previous test message',
      createdAt: new Date(Date.now() - 10000),
      direction: 'OUTBOUND',
    });

    const skippedResult = await executeDecision(
      'test-lead-id',
      {
        action: 'send_sms',
        message: 'Test message',
        reasoning: 'Test',
      }
    );

    expect(skippedResult.success).toBe(false);
    expect(skippedResult.action).toBe('send_sms');
    expect(skippedResult.skipped).toBe(true);
    expect(skippedResult.skipReason).toBeDefined();

    // Test 3: do_nothing action
    (prisma.communication.findFirst as jest.Mock).mockResolvedValue(null);

    const doNothingResult = await executeDecision(
      'test-lead-id',
      {
        action: 'do_nothing',
        reasoning: 'No action needed',
      }
    );

    expect(doNothingResult.success).toBe(true);
    expect(doNothingResult.action).toBe('do_nothing');
    expect(doNothingResult.skipped).toBe(true);
  });

  test('executeDecision respects hollyDisabled flag', async () => {
    // Mock lead with Holly disabled
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue({
      id: 'test-lead-id',
      phone: '+12345678900',
      firstName: 'Test',
      lastName: 'User',
      hollyDisabled: true, // Holly is disabled
    });

    const result = await executeDecision(
      'test-lead-id',
      {
        action: 'send_sms',
        message: 'Test message',
        reasoning: 'Test',
      }
    );

    // Verify send was blocked
    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('Holly disabled');

    // Verify no SMS was sent
    expect(global.fetch).not.toHaveBeenCalled();

    // Verify activity was logged
    expect(prisma.leadActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'test-lead-id',
        subject: '🛑 Holly Action Blocked - Manual Disable',
      }),
    });
  });
});
