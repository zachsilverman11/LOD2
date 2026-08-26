/**
 * Holly Agent Timing Tests
 * 
 * Tests for conversion-safety timing rules:
 * 1. FinanceVine 5-min opt-out + 30-min handoff delay
 * 2. Upcoming appointment skip (proactive only)
 * 3. Inbound SMS reply bypass
 */

import { processLeadWithAutonomousAgent } from '../lib/holly/agent';
import { prisma } from '../lib/db';
import { Lead, Communication, Appointment } from '@/app/generated/prisma';

// Mock prisma and other dependencies
jest.mock('../lib/db', () => ({
  prisma: {
    lead: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    leadActivity: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../lib/holly/decision-engine', () => ({
  askHollyToDecide: jest.fn(),
}));

jest.mock('../lib/holly/conversation-handler', () => ({
  executeDecision: jest.fn(),
}));

jest.mock('../lib/deal-intelligence', () => ({
  analyzeDealHealth: jest.fn(() => ({
    daysSinceCreated: 0,
    hoursSinceLastContact: null,
    hasReplied: false,
    hasBooked: false,
    temperature: 'warm',
    engagementTrend: 'neutral',
    urgency: 'medium',
    sentiment: 'neutral',
    nextReviewHours: 24,
  })),
  resolveNextReviewHoursAfterOutbound: jest.fn(() => 24),
}));

jest.mock('../lib/slack', () => ({
  sendSlackNotification: jest.fn(),
}));

describe('Holly Agent Timing Rules', () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: successfully claim the lead
    mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.lead.update.mockResolvedValue({} as any);
    mockPrisma.leadActivity.create.mockResolvedValue({} as any);
  });

  describe('FinanceVine Timing', () => {
    const createFinanceVineLead = (
      minutesSinceIngest: number,
      hasInboundReply: boolean = false
    ): Partial<Lead> & { communications: Communication[], appointments: Appointment[] } => {
      const ingestTime = new Date(Date.now() - minutesSinceIngest * 60 * 1000);
      
      const communications: Communication[] = hasInboundReply
        ? [{
            id: 'comm-1',
            leadId: 'lead-1',
            direction: 'INBOUND',
            channel: 'SMS',
            content: 'Yes, I am interested',
            createdAt: new Date(Date.now() - (minutesSinceIngest - 2) * 60 * 1000),
            updatedAt: new Date(),
          } as Communication]
        : [];

      return {
        id: 'lead-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+16045551234',
        status: 'NEW',
        source: 'financevine',
        segment: 'alt_private',
        hollyDisabled: false,
        managedByAutonomous: true,
        consentSms: true,
        consentEmail: true,
        consentCall: true,
        rawData: {
          source: 'financevine',
          ingestTimestamp: ingestTime.toISOString(),
        },
        createdAt: ingestTime,
        updatedAt: ingestTime,
        communications,
        appointments: [],
        callOutcomes: [],
      } as any;
    };

    it('blocks proactive contact before 5-min opt-out window', async () => {
      const lead = createFinanceVineLead(3); // 3 minutes since ingest
      mockPrisma.lead.findUnique.mockResolvedValue(lead as any);

      const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('FinanceVine opt-out window');
    });

    it('blocks proactive contact before 30-min handoff delay', async () => {
      const lead = createFinanceVineLead(20); // 20 minutes since ingest (past opt-out, before handoff)
      mockPrisma.lead.findUnique.mockResolvedValue(lead as any);

      const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('FinanceVine handoff delay');
    });

    it('allows proactive contact after 30-min handoff delay', async () => {
      const lead = createFinanceVineLead(35); // 35 minutes since ingest
      mockPrisma.lead.findUnique.mockResolvedValue(lead as any);

      // Mock the decision engine to return a wait decision (to avoid full execution)
      const { askHollyToDecide } = require('../lib/holly/decision-engine');
      askHollyToDecide.mockResolvedValue({
        thinking: 'Test decision',
        action: 'wait',
        waitHours: 24,
        confidence: 'high',
      });

      const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

      // Should not be blocked by timing (would proceed to decision engine)
      expect(result.success).toBe(true);
      expect(result.reason).not.toContain('FinanceVine');
    });

    it('allows reactive SMS reply to bypass handoff delay', async () => {
      const lead = createFinanceVineLead(10, true); // 10 minutes, has inbound reply
      mockPrisma.lead.findUnique.mockResolvedValue(lead as any);

      // Mock the decision engine
      const { askHollyToDecide } = require('../lib/holly/decision-engine');
      askHollyToDecide.mockResolvedValue({
        thinking: 'Responding to inbound',
        action: 'wait',
        waitHours: 1,
        confidence: 'high',
      });

      const result = await processLeadWithAutonomousAgent('lead-1', 'sms_reply');

      // Should not be blocked - reactive response allowed
      expect(result.success).toBe(true);
      expect(result.reason).not.toContain('FinanceVine handoff delay');
    });

    it('detects opt-out in first inbound reply', async () => {
      const lead = createFinanceVineLead(10, false);
      // Add an opt-out message
      lead.communications = [{
        id: 'comm-1',
        leadId: 'lead-1',
        direction: 'INBOUND',
        channel: 'SMS',
        content: 'STOP - do not contact me',
        createdAt: new Date(Date.now() - 8 * 60 * 1000),
        updatedAt: new Date(),
      } as Communication];
      
      mockPrisma.lead.findUnique.mockResolvedValue(lead as any);

      const result = await processLeadWithAutonomousAgent('lead-1', 'cron');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('FinanceVine lead opted out');
    });
  });

  describe('Upcoming Appointment Skip', () => {
    const createLeadWithAppointment = (
      appointmentInFuture: boolean = true
    ): Partial<Lead> & { communications: Communication[], appointments: Appointment[] } => {
      const appointmentTime = appointmentInFuture
        ? new Date(Date.now() + 24 * 60 * 60 * 1000) // tomorrow
        : new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday

      return {
        id: 'lead-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '+16045551235',
        status: 'CALL_SCHEDULED',
        source: 'leads_on_demand',
        hollyDisabled: false,
        managedByAutonomous: true,
        consentSms: true,
        rawData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        communications: [],
        appointments: [{
          id: 'apt-1',
          leadId: 'lead-2',
          scheduledFor: appointmentTime,
          scheduledAt: appointmentTime,
          status: 'SCHEDULED',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Appointment],
        callOutcomes: [],
      } as any;
    };

    it('blocks proactive contact when upcoming appointment exists', async () => {
      const lead = createLeadWithAppointment(true);
      mockPrisma.lead.findUnique.mockResolvedValue(lead as any);

      const result = await processLeadWithAutonomousAgent('lead-2', 'cron');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('has scheduled appointment');
    });

    it('allows reactive SMS reply even with upcoming appointment', async () => {
      const lead = createLeadWithAppointment(true);
      mockPrisma.lead.findUnique.mockResolvedValue(lead as any);

      // Mock the decision engine
      const { askHollyToDecide } = require('../lib/holly/decision-engine');
      askHollyToDecide.mockResolvedValue({
        thinking: 'Answering question',
        action: 'wait',
        waitHours: 1,
        confidence: 'high',
      });

      const result = await processLeadWithAutonomousAgent('lead-2', 'sms_reply');

      // Should not be blocked - reactive support allowed
      expect(result.success).toBe(true);
    });

    it('allows proactive contact when appointment is in the past', async () => {
      const lead = createLeadWithAppointment(false);
      mockPrisma.lead.findUnique.mockResolvedValue(lead as any);

      // Mock the decision engine
      const { askHollyToDecide } = require('../lib/holly/decision-engine');
      askHollyToDecide.mockResolvedValue({
        thinking: 'Following up after call',
        action: 'wait',
        waitHours: 24,
        confidence: 'high',
      });

      const result = await processLeadWithAutonomousAgent('lead-2', 'cron');

      // Should not be blocked by appointment (it's in the past)
      expect(result.success).toBe(true);
      expect(result.reason).not.toContain('appointment');
    });
  });

  describe('Non-FinanceVine Sources', () => {
    const createLODLead = (): Partial<Lead> & { communications: Communication[], appointments: Appointment[] } => ({
      id: 'lead-3',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob@example.com',
      phone: '+16045551236',
      status: 'NEW',
      source: 'leads_on_demand',
      hollyDisabled: false,
      managedByAutonomous: true,
      consentSms: true,
      rawData: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      communications: [],
      appointments: [],
      callOutcomes: [],
    } as any);

    it('does not apply FinanceVine delay to LOD leads', async () => {
      const lead = createLODLead();
      mockPrisma.lead.findUnique.mockResolvedValue(lead as any);

      // Mock the decision engine
      const { askHollyToDecide } = require('../lib/holly/decision-engine');
      askHollyToDecide.mockResolvedValue({
        thinking: 'Immediate contact',
        action: 'wait',
        waitHours: 1,
        confidence: 'high',
      });

      const result = await processLeadWithAutonomousAgent('lead-3', 'cron');

      // Should not be blocked by FinanceVine timing
      expect(result.success).toBe(true);
      expect(result.reason).not.toContain('FinanceVine');
    });
  });

  describe('Holly Disabled Flag', () => {
    it('blocks all processing when hollyDisabled is true', async () => {
      const lead: Partial<Lead> & { communications: Communication[], appointments: Appointment[] } = {
        id: 'lead-4',
        firstName: 'Alice',
        lastName: 'Brown',
        email: 'alice@example.com',
        phone: '+16045551237',
        status: 'ENGAGED',
        source: 'leads_on_demand',
        hollyDisabled: true, // Manual relationship mode
        managedByAutonomous: true,
        consentSms: true,
        rawData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        communications: [],
        appointments: [],
        callOutcomes: [],
      } as any;

      mockPrisma.lead.findUnique.mockResolvedValue(lead as any);

      const result = await processLeadWithAutonomousAgent('lead-4', 'cron');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Holly disabled');
    });
  });

  describe('Processing Lock', () => {
    it('prevents duplicate processing when lead is already locked', async () => {
      // First call claims the lock (count = 1)
      mockPrisma.lead.updateMany.mockResolvedValueOnce({ count: 1 });
      
      // Second call fails to claim (count = 0)
      mockPrisma.lead.updateMany.mockResolvedValueOnce({ count: 0 });

      const lead: Partial<Lead> & { communications: Communication[], appointments: Appointment[] } = {
        id: 'lead-5',
        firstName: 'Charlie',
        lastName: 'Davis',
        status: 'NEW',
        hollyDisabled: false,
        managedByAutonomous: true,
        communications: [],
        appointments: [],
      } as any;

      mockPrisma.lead.findUnique.mockResolvedValue(lead as any);

      // First call should succeed in claiming
      const result1 = await processLeadWithAutonomousAgent('lead-5', 'cron');
      
      // Second concurrent call should fail to claim
      const result2 = await processLeadWithAutonomousAgent('lead-5', 'cron');

      expect(result2.success).toBe(false);
      expect(result2.reason).toContain('Already being processed');
    });
  });
});
