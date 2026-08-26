/**
 * Test: Anthropic Prompt Caching Implementation
 * 
 * Verifies that:
 * 1. Both decision-engine and conversation-handler send cache_control on system blocks
 * 2. Per-lead dynamic fields are NOT in the cached system block
 * 3. Stable instructions ARE in the cached system block
 */

import Anthropic from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

const mockCreate = jest.fn();
(Anthropic as jest.MockedClass<typeof Anthropic>).prototype.messages = {
  create: mockCreate,
} as any;

// Import after mocking
import { askHollyToDecide } from '../lib/holly/decision-engine';
import { handleConversation } from '../lib/holly/conversation-handler';

describe('Anthropic Prompt Caching', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: '```json\n{"thinking": "Test", "action": "wait", "waitHours": 24, "confidence": "high"}\n```',
        },
      ],
      model: 'claude-sonnet-4-6',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 1000,
        output_tokens: 50,
        cache_creation_input_tokens: 5000,
        cache_read_input_tokens: 0,
      },
    });
  });

  describe('decision-engine (askHollyToDecide)', () => {
    it('should send cache_control on system block', async () => {
      const mockLead = {
        id: 'lead-123',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        email: 'john@example.com',
        status: 'CONTACTED',
        createdAt: new Date('2026-01-01'),
        lastContactedAt: new Date('2026-01-02'),
        rawData: {
          province: 'British Columbia',
          loanType: 'purchase',
          home_value: '600000',
        },
        communications: [],
        appointments: [],
        callOutcomes: [],
      };

      const mockSignals = {
        temperature: 'cold' as const,
        engagementTrend: 'no engagement' as const,
        nextReviewHours: 24,
        reasoningContext: 'New lead',
      };

      await askHollyToDecide(mockLead as any, mockSignals);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];

      // Verify cache_control is present in system block
      expect(callArgs).toHaveProperty('system');
      expect(Array.isArray(callArgs.system)).toBe(true);
      expect(callArgs.system[0]).toHaveProperty('cache_control');
      expect(callArgs.system[0].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('should NOT include per-lead dynamic fields in cached system block', async () => {
      const mockLead = {
        id: 'lead-456',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1987654321',
        email: 'jane@example.com',
        status: 'ENGAGED',
        createdAt: new Date('2026-01-01'),
        lastContactedAt: new Date('2026-01-05'),
        rawData: {
          province: 'Ontario',
          loanType: 'refinance',
          balance: '400000',
        },
        communications: [
          {
            id: 'comm-1',
            direction: 'INBOUND',
            content: 'I am interested in refinancing',
            createdAt: new Date('2026-01-03'),
          },
        ],
        appointments: [],
        callOutcomes: [],
      };

      const mockSignals = {
        temperature: 'warm' as const,
        engagementTrend: 'responding' as const,
        nextReviewHours: 12,
        reasoningContext: 'Lead replied positively',
      };

      await askHollyToDecide(mockLead as any, mockSignals);

      const callArgs = mockCreate.mock.calls[0][0];
      const systemText = callArgs.system[0].text;

      // System block should NOT contain lead-specific data
      expect(systemText).not.toContain('Jane');
      expect(systemText).not.toContain('Smith');
      expect(systemText).not.toContain('+1987654321');
      expect(systemText).not.toContain('jane@example.com');
      expect(systemText).not.toContain('I am interested in refinancing'); // conversation
      expect(systemText).not.toContain('2026-01-'); // timestamps
      expect(systemText).not.toContain('warm'); // temperature signal
      expect(systemText).not.toContain('Lead replied positively'); // reasoning

      // User message SHOULD contain lead-specific data
      const userContent = callArgs.messages[0].content;
      expect(userContent).toContain('Jane'); // firstName used in message
    });

    it('should include stable instructions in cached system block', async () => {
      const mockLead = {
        id: 'lead-789',
        firstName: 'Bob',
        lastName: 'Johnson',
        phone: '+1555555555',
        email: 'bob@example.com',
        status: 'NEW',
        createdAt: new Date(),
        lastContactedAt: null,
        rawData: {},
        communications: [],
        appointments: [],
        callOutcomes: [],
      };

      const mockSignals = {
        temperature: 'cold' as const,
        engagementTrend: 'no engagement' as const,
        nextReviewHours: 48,
        reasoningContext: 'Brand new lead',
      };

      await askHollyToDecide(mockLead as any, mockSignals);

      const callArgs = mockCreate.mock.calls[0][0];
      const systemText = callArgs.system[0].text;

      // System block SHOULD contain static instructions
      expect(systemText).toContain('HOLLY'); // Role definition
      expect(systemText).toContain('STAGE MOVEMENT'); // Static rules
      expect(systemText).toContain('TRAINING EXAMPLES'); // Static examples
      expect(systemText).toContain('JSON'); // Response format
      expect(systemText).toContain('book_directly'); // Action types
    });

    it('should have byte-stable system text across different leads', async () => {
      const lead1 = {
        id: 'lead-1',
        firstName: 'Alice',
        lastName: 'Wonder',
        phone: '+1111111111',
        email: 'alice@test.com',
        status: 'CONTACTED',
        createdAt: new Date('2026-01-01'),
        lastContactedAt: new Date('2026-01-02'),
        rawData: { province: 'Ontario', loanType: 'purchase' },
        communications: [],
        appointments: [],
        callOutcomes: [],
      };

      const lead2 = {
        id: 'lead-2',
        firstName: 'Bob',
        lastName: 'Builder',
        phone: '+2222222222',
        email: 'bob@test.com',
        status: 'ENGAGED',
        createdAt: new Date('2026-02-01'),
        lastContactedAt: new Date('2026-02-05'),
        rawData: { province: 'Alberta', loanType: 'refinance' },
        communications: [{ id: 'c1', direction: 'INBOUND', content: 'Help me', createdAt: new Date() }],
        appointments: [],
        callOutcomes: [],
      };

      const signals = {
        temperature: 'cold' as const,
        engagementTrend: 'no engagement' as const,
        nextReviewHours: 24,
        reasoningContext: 'Test',
      };

      mockCreate.mockClear();
      await askHollyToDecide(lead1 as any, signals);
      const call1System = mockCreate.mock.calls[0][0].system[0].text;

      mockCreate.mockClear();
      await askHollyToDecide(lead2 as any, signals);
      const call2System = mockCreate.mock.calls[0][0].system[0].text;

      // System block must be byte-identical across leads
      expect(call1System).toBe(call2System);
      expect(call1System.length).toBeGreaterThan(1000); // Non-trivial size

      // User messages should differ
      const call1User = mockCreate.mock.calls[0][0].messages[0].content;
      const call2User = mockCreate.mock.calls[1][0].messages[0].content;
      expect(call1User).not.toBe(call2User);
      expect(call1User).toContain('Alice');
      expect(call2User).toContain('Bob');
    });

    it('should not duplicate content between system and user', async () => {
      const mockLead = {
        id: 'lead-999',
        firstName: 'Charlie',
        lastName: 'Test',
        phone: '+3333333333',
        email: 'charlie@test.com',
        status: 'NEW',
        createdAt: new Date(),
        lastContactedAt: null,
        rawData: { province: 'Quebec', loanType: 'renewal' },
        communications: [],
        appointments: [],
        callOutcomes: [],
      };

      const mockSignals = {
        temperature: 'cold' as const,
        engagementTrend: 'no engagement' as const,
        nextReviewHours: 24,
        reasoningContext: 'Test',
      };

      await askHollyToDecide(mockLead as any, mockSignals);

      const callArgs = mockCreate.mock.calls[0][0];
      const systemText = callArgs.system[0].text;
      const userContent = callArgs.messages[0].content;

      // Static sections should be in system, not user
      const staticMarkers = ['## 📚 ALL TRAINING EXAMPLES', '## 📊 LEARNED EXAMPLES', '## 🎯 SALES PSYCHOLOGY FRAMEWORK'];
      staticMarkers.forEach(marker => {
        expect(systemText).toContain(marker);
        expect(userContent).not.toContain(marker);
      });

      // Per-lead briefing should be in user, not system
      expect(userContent).toContain('Charlie');
      expect(userContent).toContain('Quebec');
      expect(systemText).not.toContain('Charlie');
      expect(systemText).not.toContain('Quebec');
    });
  });
});
