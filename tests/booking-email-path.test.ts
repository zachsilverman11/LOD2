/**
 * Direct-booking email path
 *
 * Background (notes/booking-flow-diagnosis.md): since 2026-03-27 the decision
 * prompt has gated `book_directly` on "this lead has an email on file (see
 * lead profile in context)", but the briefing never rendered an email until
 * b0edc6b. Holly repeatedly reasoned "no email on file, can't book_directly"
 * and either asked leads for an email the system already had, or fell back to
 * SMS/link. These tests pin the three properties that close that gap:
 *
 *   1. The briefing renders the Lead row's email when it is passed explicitly.
 *   2. The briefing still renders it when only rawData carries it.
 *   3. Execution books with the Lead record's email — the model's relayed
 *      value never overrides the system of record.
 */

import { buildHollyBriefing } from '../lib/holly/brain';

// --- direct-booking mocks -------------------------------------------------
const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();
const mockLeadUpdate = jest.fn();
const mockActivityCreate = jest.fn();
const mockCreateDirectBooking = jest.fn();

jest.mock('../lib/db', () => ({
  prisma: {
    lead: { findUnique: (...a: any[]) => mockFindUnique(...a), update: (...a: any[]) => mockLeadUpdate(...a) },
    appointment: { upsert: (...a: any[]) => mockUpsert(...a) },
    leadActivity: { create: (...a: any[]) => mockActivityCreate(...a) },
  },
}));
jest.mock('../lib/sms', () => ({ sendSms: jest.fn() }));
jest.mock('../lib/slack', () => ({ sendSlackNotification: jest.fn() }));
jest.mock('../lib/calcom', () => ({
  createDirectBooking: (...a: any[]) => mockCreateDirectBooking(...a),
}));

import { bookLeadAppointmentDirectly } from '../lib/direct-booking';

const baseBriefingParams = {
  conversationContext: {
    touchNumber: 4,
    hasReplied: true,
    daysInPipeline: 1,
    messageHistory: 'Lead: Thursday 3:20 works',
    lastMessageFrom: 'lead' as const,
  },
  appointments: [],
  applicationStatus: {},
};

describe('briefing renders the email the booking prompt gates on', () => {
  const leadData = {
    first_name: 'Harper',
    last_name: 'Test',
    mortgage_type: 'refinance',
    province: 'BC',
    segment: 'alt_private',
    source: 'financevine',
  };

  it('prints "Email on file" from the explicit leadEmail (Lead row) even when rawData has no email key', () => {
    const briefing = buildHollyBriefing({
      ...baseBriefingParams,
      leadData,
      leadEmail: 'lead@example.com',
    } as any);
    expect(briefing).toContain('**Email on file:** lead@example.com');
    expect(briefing).toContain('book_directly');
    expect(briefing).not.toContain('No email on file');
  });

  it('falls back to rawData.email when leadEmail is not passed', () => {
    const briefing = buildHollyBriefing({
      ...baseBriefingParams,
      leadData: { ...leadData, email: 'raw@example.com' },
    } as any);
    expect(briefing).toContain('**Email on file:** raw@example.com');
  });

  it('prefers the Lead row over rawData when both exist', () => {
    const briefing = buildHollyBriefing({
      ...baseBriefingParams,
      leadData: { ...leadData, email: 'stale-vendor@example.com' },
      leadEmail: 'row@example.com',
    } as any);
    expect(briefing).toContain('**Email on file:** row@example.com');
    expect(briefing).not.toContain('stale-vendor@example.com');
  });

  it('only tells Holly to ask for an email when there genuinely is none', () => {
    const briefing = buildHollyBriefing({
      ...baseBriefingParams,
      leadData,
      leadEmail: null,
    } as any);
    expect(briefing).toContain('No email on file');
  });
});

describe('direct booking uses the Lead record as the attendee email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: 'lead-1',
      firstName: 'Harper',
      lastName: 'Test',
      email: 'record@example.com',
      phone: '+16045550000',
      status: 'ENGAGED',
    });
    mockCreateDirectBooking.mockResolvedValue({
      uid: 'uid-1',
      id: 42,
      startTime: '2026-09-03T22:20:00.000Z',
      endTime: '2026-09-03T22:40:00.000Z',
      meetingUrl: 'https://cal.com/booking/uid-1',
    });
    mockUpsert.mockResolvedValue({ id: 'appt-1' });
    mockLeadUpdate.mockResolvedValue({});
    mockActivityCreate.mockResolvedValue({});
  });

  it('books with the record email when the model omitted bookingLeadEmail', async () => {
    const result = await bookLeadAppointmentDirectly(
      'lead-1',
      { bookingStartTime: '2026-09-03T22:20:00.000Z' },
      { sendConfirmationSms: false, sendSlackNotification: false }
    );
    expect(mockCreateDirectBooking).toHaveBeenCalledTimes(1);
    expect(mockCreateDirectBooking.mock.calls[0][0].attendee.email).toBe('record@example.com');
    expect(result.attendeeEmail).toBe('record@example.com');
  });

  it('books with the record email even when the model relayed a different one', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await bookLeadAppointmentDirectly(
      'lead-1',
      { bookingStartTime: '2026-09-03T22:20:00.000Z', bookingLeadEmail: 'typo@example.com' },
      { sendConfirmationSms: false, sendSlackNotification: false }
    );
    expect(mockCreateDirectBooking.mock.calls[0][0].attendee.email).toBe('record@example.com');
    expect(result.attendeeEmail).toBe('record@example.com');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('differs from the Lead record'));
    warn.mockRestore();
  });

  it('uses the model value only when the record has no email', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'lead-1', firstName: 'H', lastName: 'T', email: '', phone: '+16045550000', status: 'ENGAGED',
    });
    await bookLeadAppointmentDirectly(
      'lead-1',
      { bookingStartTime: '2026-09-03T22:20:00.000Z', bookingLeadEmail: 'given@example.com' },
      { sendConfirmationSms: false, sendSlackNotification: false }
    );
    expect(mockCreateDirectBooking.mock.calls[0][0].attendee.email).toBe('given@example.com');
  });

  it('refuses to book when neither the record nor the model has an email', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'lead-1', firstName: 'H', lastName: 'T', email: '', phone: '+16045550000', status: 'ENGAGED',
    });
    await expect(
      bookLeadAppointmentDirectly('lead-1', { bookingStartTime: '2026-09-03T22:20:00.000Z' })
    ).rejects.toThrow(/does not have an email/);
    expect(mockCreateDirectBooking).not.toHaveBeenCalled();
  });
});
