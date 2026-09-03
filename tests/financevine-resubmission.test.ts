/**
 * FinanceVine Re-Submission Tests
 *
 * A returning lead who re-fills the FinanceVine form is a fresh buying signal.
 * The update path used to do neither of the things a new lead gets: no Slack
 * notification fired, and nextReviewAt was left on whatever cadence an older
 * conversation had set — so a re-submission was a silent row mutation.
 *
 * These tests pin the scheduling decision directly (it is a pure function) and
 * the two invariants that matter: always notify, and never push a review later.
 */

import {
  isHollyContactable,
  resolveResubmissionReview,
} from '../app/api/webhooks/financevine/route';

describe('FinanceVine re-submission scheduling', () => {
  const handoffAt = new Date('2026-09-03T12:30:00.000Z');

  const contactable = {
    status: 'NURTURING',
    consentSms: true,
    managedByAutonomous: true,
    hollyDisabled: false,
    nextReviewAt: null as Date | null,
  };

  describe('isHollyContactable', () => {
    it('accepts a lead the autonomous cron would act on', () => {
      expect(isHollyContactable(contactable)).toBe(true);
    });

    // Mirrors the notIn filter in lib/holly/agent.ts
    const ineligible = [
      'LOST',
      'CONVERTED',
      'DEALS_WON',
      'APPLICATION_STARTED',
      'CALL_SCHEDULED',
    ];

    ineligible.forEach((status) => {
      it(`rejects status ${status}`, () => {
        expect(isHollyContactable({ ...contactable, status })).toBe(false);
      });
    });

    it('rejects a lead with Holly disabled', () => {
      expect(isHollyContactable({ ...contactable, hollyDisabled: true })).toBe(false);
    });

    it('rejects a lead not managed by the autonomous agent', () => {
      expect(isHollyContactable({ ...contactable, managedByAutonomous: false })).toBe(false);
    });

    it('rejects a lead without SMS consent', () => {
      expect(isHollyContactable({ ...contactable, consentSms: false })).toBe(false);
    });
  });

  describe('resolveResubmissionReview', () => {
    it('schedules when no review was set', () => {
      const result = resolveResubmissionReview(contactable, handoffAt);

      expect(result.shouldSchedule).toBe(true);
      expect(result.reason).toContain('no review was scheduled');
    });

    it('pulls a later review forward', () => {
      // The real case: a lead parked 34h out by an older conversation.
      const result = resolveResubmissionReview(
        { ...contactable, nextReviewAt: new Date('2026-09-04T03:00:00.000Z') },
        handoffAt
      );

      expect(result.shouldSchedule).toBe(true);
      expect(result.reason).toContain('2026-09-04T03:00:00.000Z');
    });

    it('NEVER pushes an earlier review later', () => {
      const dueSooner = new Date('2026-09-03T12:00:00.000Z'); // before handoffAt
      const result = resolveResubmissionReview(
        { ...contactable, nextReviewAt: dueSooner },
        handoffAt
      );

      expect(result.shouldSchedule).toBe(false);
      expect(result.reason).toContain('already due sooner');
    });

    it('leaves a review exactly at the handoff time alone', () => {
      const result = resolveResubmissionReview(
        { ...contactable, nextReviewAt: new Date(handoffAt) },
        handoffAt
      );

      expect(result.shouldSchedule).toBe(false);
    });

    it('does not schedule a lead outside the cron scope, and says why', () => {
      const result = resolveResubmissionReview(
        { ...contactable, status: 'CONVERTED', nextReviewAt: null },
        handoffAt
      );

      expect(result.shouldSchedule).toBe(false);
      expect(result.reason).toContain('CONVERTED');
    });

    it('names Holly being disabled in the reason', () => {
      const result = resolveResubmissionReview(
        { ...contactable, hollyDisabled: true, nextReviewAt: null },
        handoffAt
      );

      expect(result.shouldSchedule).toBe(false);
      expect(result.reason).toContain('Holly disabled');
    });
  });
});

/**
 * Route-level: the update path must ALWAYS notify, whether or not it could
 * reschedule. When it cannot schedule, the Slack message IS the handoff.
 */
describe('FinanceVine webhook update path', () => {
  const mockLeadUpdate = jest.fn();
  const mockLeadFindFirst = jest.fn();
  const mockActivityCreate = jest.fn();
  const mockSlack = jest.fn();

  jest.mock('../lib/db', () => ({
    prisma: {
      webhookEvent: { create: jest.fn(), updateMany: jest.fn() },
      lead: { findFirst: (...a: any[]) => mockLeadFindFirst(...a), update: (...a: any[]) => mockLeadUpdate(...a) },
      leadActivity: { create: (...a: any[]) => mockActivityCreate(...a) },
      cohortConfig: { findFirst: jest.fn() },
    },
  }));

  jest.mock('../lib/slack', () => ({
    sendSlackNotification: (...a: any[]) => mockSlack(...a),
    sendErrorAlert: jest.fn(),
  }));

  const makeReq = (body: any) =>
    ({
      headers: { get: () => null },
      nextUrl: { searchParams: { get: () => null } },
      json: async () => body,
    }) as any;

  const payload = {
    first_name: 'Zach',
    last_name: 'Segtest',
    email: 'resub@example.com',
    phone: '+16045551234',
    mortgage_type: 'refinance',
    primary_goal: 'debt consolidation',
    borrower_profile: 'not approved at bank',
  };

  const baseLead = {
    id: 'lead-1',
    status: 'NURTURING',
    consentSms: true,
    managedByAutonomous: true,
    hollyDisabled: false,
    nextReviewAt: new Date('2099-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.resetModules();
    mockLeadUpdate.mockReset();
    mockLeadFindFirst.mockReset();
    mockActivityCreate.mockReset();
    mockSlack.mockReset();
  });

  it('notifies Slack and pulls the review forward for a contactable lead', async () => {
    mockLeadFindFirst.mockResolvedValue(baseLead);
    mockLeadUpdate.mockResolvedValue(baseLead);

    const { POST } = require('../app/api/webhooks/financevine/route');
    const res = await POST(makeReq(payload));
    const body = await res.json();

    expect(body.status).toBe('updated');
    expect(body.aiContactScheduled).toBe(true);

    // Slack fired on the update path
    expect(mockSlack).toHaveBeenCalledTimes(1);
    expect(mockSlack.mock.calls[0][0].type).toBe('lead_updated');

    // Second lead.update is the schedule pull-forward
    const scheduleCall = mockLeadUpdate.mock.calls.find(
      (c: any[]) => c[0]?.data?.nextReviewAt !== undefined
    );
    expect(scheduleCall).toBeDefined();
    expect(scheduleCall[0].data.nextReviewAt.getTime()).toBeLessThan(
      baseLead.nextReviewAt.getTime()
    );
  });

  it('still notifies Slack when the lead is out of cron scope, and schedules nothing', async () => {
    mockLeadFindFirst.mockResolvedValue({ ...baseLead, status: 'CONVERTED' });
    mockLeadUpdate.mockResolvedValue({ ...baseLead, status: 'CONVERTED' });

    const { POST } = require('../app/api/webhooks/financevine/route');
    const res = await POST(makeReq(payload));
    const body = await res.json();

    expect(body.aiContactScheduled).toBe(false);

    expect(mockSlack).toHaveBeenCalledTimes(1);
    expect(mockSlack.mock.calls[0][0].type).toBe('lead_updated');
    expect(mockSlack.mock.calls[0][0].details).toContain('NOT rescheduled');

    const scheduleCall = mockLeadUpdate.mock.calls.find(
      (c: any[]) => c[0]?.data?.nextReviewAt !== undefined
    );
    expect(scheduleCall).toBeUndefined();
  });
});
