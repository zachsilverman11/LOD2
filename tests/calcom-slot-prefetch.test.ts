/**
 * Cal.com slot pre-fetch efficiency tests.
 *
 * 1. `getAvailableSlots` memoizes per process: Holly asks once per lead per
 *    tick, so a cron pass over N leads used to fire N identical ~21-day
 *    requests at Cal.com. HTTP is mocked here — the assertions are about how
 *    many times `fetch` is reached.
 * 2. Skipping the pre-fetch on the first outbound must not unblock the booking
 *    link Holly is never allowed to send on touch 1.
 */

import { getAvailableSlots, clearSlotCache, CALCOM_SLOT_CACHE_TTL_MS } from '../lib/calcom';
import { validateDecision, HollyDecision } from '../lib/holly/guardrails';
import { Lead } from '@/app/generated/prisma';
import { DealSignals } from '../lib/deal-intelligence';

const SLOTS_RESPONSE = {
  data: {
    '2026-09-01': [{ start: '2026-09-01T17:00:00.000Z' }, { start: '2026-09-01T18:00:00.000Z' }],
    '2026-09-02': [{ start: '2026-09-02T17:00:00.000Z' }],
  },
};

const mockFetch = jest.fn();
let nowMs = Date.parse('2026-08-26T12:00:00.000Z');

describe('getAvailableSlots in-process cache', () => {
  beforeEach(() => {
    clearSlotCache();
    delete process.env.CALCOM_SLOT_CACHE_TTL_MS;
    nowMs = Date.parse('2026-08-26T12:00:00.000Z');
    jest.spyOn(Date, 'now').mockImplementation(() => nowMs);

    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => SLOTS_RESPONSE,
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const start = '2026-08-26T12:00:00.000Z';
  const end = '2026-09-16T12:00:00.000Z';

  it('does not refetch on a second call with the same event, window and timezone', async () => {
    const first = await getAvailableSlots(start, end, 'America/Vancouver');
    const second = await getAvailableSlots(start, end, 'America/Vancouver');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(3);
    expect(second).toEqual(first);
  });

  it('shares a single fetch between concurrent callers', async () => {
    const [a, b, c] = await Promise.all([
      getAvailableSlots(start, end, 'America/Vancouver'),
      getAvailableSlots(start, end, 'America/Vancouver'),
      getAvailableSlots(start, end, 'America/Vancouver'),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('hits the cache for windows that differ only by milliseconds (the cron shape)', async () => {
    // Two leads processed back to back each build their own window from
    // `getAvailabilityWindow()`, i.e. from `new Date()` — so their `start`
    // strings differ by however long the previous lead took.
    const laterStart = '2026-08-26T12:00:01.200Z';
    const laterEnd = '2026-09-16T12:00:01.200Z';

    expect(laterStart).not.toEqual(start);

    await getAvailableSlots(start, end, 'America/Vancouver');
    await getAvailableSlots(laterStart, laterEnd, 'America/Vancouver');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('refetches for a different timezone', async () => {
    await getAvailableSlots(start, end, 'America/Vancouver');
    await getAvailableSlots(start, end, 'America/Toronto');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('refetches for a different event type', async () => {
    await getAvailableSlots(start, end, 'America/Vancouver');
    await getAvailableSlots(start, end, 'America/Vancouver', 3298267);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('refetches once the TTL has elapsed', async () => {
    await getAvailableSlots(start, end, 'America/Vancouver');
    nowMs += CALCOM_SLOT_CACHE_TTL_MS + 1;
    await getAvailableSlots(start, end, 'America/Vancouver');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not cache failures', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'boom',
    });

    await expect(getAvailableSlots(start, end, 'America/Vancouver')).rejects.toThrow(
      /Cal.com API error/
    );

    const retry = await getAvailableSlots(start, end, 'America/Vancouver');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(retry).toHaveLength(3);
  });

  it('hands each caller its own array', async () => {
    const first = await getAvailableSlots(start, end, 'America/Vancouver');
    first.pop();

    const second = await getAvailableSlots(start, end, 'America/Vancouver');

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(3);
  });

  it('is disabled by CALCOM_SLOT_CACHE_TTL_MS=0', async () => {
    process.env.CALCOM_SLOT_CACHE_TTL_MS = '0';

    await getAvailableSlots(start, end, 'America/Vancouver');
    await getAvailableSlots(start, end, 'America/Vancouver');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('first-touch booking link guardrail', () => {
  const mockLead = (): Partial<Lead> => ({
    id: 'test-lead-id',
    email: 'test@example.com',
    phone: '+16045551234',
    firstName: 'Test',
    lastName: 'Lead',
    status: 'NEW',
    source: 'financevine',
    consentSms: true,
    consentEmail: true,
    consentCall: true,
    hollyDisabled: false,
    managedByAutonomous: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    rawData: {},
  });

  const mockSignals: DealSignals = {
    temperature: 'cold',
    engagementTrend: 'stable',
    sentimentSignals: {
      lastReplyTone: 'unknown',
      objectionDetected: false,
      questionCount: 0,
    },
    contextualUrgency: null,
    leadSourceQuality: 'medium',
    motivationLevel: 'unknown',
    reasoningContext: 'Brand new lead, no replies yet',
    nextReviewHours: 24,
  };

  // Skipping the pre-fetch leaves availabilitySlotsProvided false; without the
  // companion flag that would quietly unblock the link on touch 1.
  it('blocks send_booking_link when the pre-fetch was skipped', () => {
    const decision: HollyDecision = {
      thinking: 'Just send them the link',
      action: 'send_booking_link',
      message: 'Here is my calendar - grab any time that works!',
      confidence: 'high',
      _availabilitySlotsProvided: false,
      _availabilityPrefetchSkipped: true,
    };

    const validation = validateDecision(decision, {
      lead: mockLead() as any,
      signals: mockSignals,
      availabilitySlotsProvided: false,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes('first touch'))).toBe(true);
  });

  // Asserts on the first-touch error specifically, not on isValid: other hard
  // rules (SMS quiet hours, for one) are clock-dependent.
  it('does not raise the first-touch error when slots were genuinely unavailable', () => {
    const decision: HollyDecision = {
      thinking: 'Availability fetch failed and they asked for a link',
      action: 'send_booking_link',
      message: 'Here is my calendar - grab any time that works!',
      confidence: 'high',
      _availabilitySlotsProvided: false,
      _availabilityPrefetchSkipped: false,
    };

    const validation = validateDecision(decision, {
      lead: mockLead() as any,
      signals: mockSignals,
      availabilitySlotsProvided: false,
    });

    expect(validation.errors.some((e) => e.includes('first touch'))).toBe(false);
  });
});
