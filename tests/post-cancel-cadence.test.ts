/**
 * Post-cancellation / replied-then-silent follow-up cadence
 *
 * Background (notes/post-cancel-cadence-diagnosis.md): after an advisor
 * cancelled a booked call, Holly sent 5 follow-ups in 4 days and was blocked
 * on 8 more attempts, because a lead who had replied once was scheduled for
 * review every 2-6 hours forever. The zero-reply backoff (3d, 4d, 5d, 7d…)
 * only applied to leads who had *never* replied. These tests pin the intended
 * behaviour: backoff keys on "outbounds since the lead's last message", not on
 * "has the lead ever replied".
 */

import {
  resolveNextReviewHoursAfterOutbound,
  nextReviewHoursAfterZeroReplyOutbound,
  countUnansweredOutbound,
} from '../lib/deal-intelligence';
import type { DealSignals } from '../lib/deal-intelligence';

const signals = (overrides: Partial<DealSignals> = {}): DealSignals =>
  ({
    temperature: 'warm',
    engagementTrend: 'stable',
    sentimentSignals: { lastReplyTone: 'neutral', objectionDetected: false, questionCount: 0 },
    contextualUrgency: null,
    leadSourceQuality: 'low',
    motivationLevel: 'unknown',
    reasoningContext: '',
    nextReviewHours: 2, // what 'warm' resolves to in analyzeDealHealth
    ...overrides,
  }) as DealSignals;

const t = (isoOrOffsetHours: number) => new Date(Date.UTC(2026, 7, 27, 12, 0, 0) + isoOrOffsetHours * 3600_000);

describe('countUnansweredOutbound', () => {
  it('is 0 when the lead spoke last', () => {
    expect(
      countUnansweredOutbound([
        { direction: 'OUTBOUND', createdAt: t(0) },
        { direction: 'INBOUND', createdAt: t(1) },
      ])
    ).toBe(0);
  });

  it('counts only outbounds after the most recent inbound, regardless of order given', () => {
    expect(
      countUnansweredOutbound([
        { direction: 'OUTBOUND', createdAt: t(5) },
        { direction: 'OUTBOUND', createdAt: t(3) },
        { direction: 'INBOUND', createdAt: t(2) },
        { direction: 'OUTBOUND', createdAt: t(1) },
        { direction: 'INBOUND', createdAt: t(0) },
      ])
    ).toBe(2);
  });

  it('equals the outbound count when the lead has never replied', () => {
    expect(
      countUnansweredOutbound([
        { direction: 'OUTBOUND', createdAt: t(0) },
        { direction: 'OUTBOUND', createdAt: t(1) },
        { direction: 'OUTBOUND', createdAt: t(2) },
      ])
    ).toBe(3);
  });

  it('handles empty / missing', () => {
    expect(countUnansweredOutbound([])).toBe(0);
    expect(countUnansweredOutbound(null)).toBe(0);
    expect(countUnansweredOutbound(undefined)).toBe(0);
  });
});

describe('resolveNextReviewHoursAfterOutbound', () => {
  it('keeps the conversational cadence when replying to the lead\'s latest message', () => {
    expect(
      resolveNextReviewHoursAfterOutbound({
        signals: signals(),
        inboundCount: 3,
        outboundCountBeforeThisSend: 6,
        unansweredOutboundBeforeThisSend: 0,
      })
    ).toBe(2);
  });

  it('backs off once the lead has gone quiet after replying (the post-cancellation case)', () => {
    // Cancellation SMS went out (unanswered = 1). Holly sends follow-up #1 → 3 days, not 2 hours.
    expect(
      resolveNextReviewHoursAfterOutbound({
        signals: signals(),
        inboundCount: 6,
        outboundCountBeforeThisSend: 9,
        unansweredOutboundBeforeThisSend: 1,
      })
    ).toBe(nextReviewHoursAfterZeroReplyOutbound(2));
    // …and keeps widening.
    expect(
      resolveNextReviewHoursAfterOutbound({
        signals: signals(),
        inboundCount: 6,
        outboundCountBeforeThisSend: 12,
        unansweredOutboundBeforeThisSend: 4,
      })
    ).toBe(nextReviewHoursAfterZeroReplyOutbound(5));
  });

  it('is monotonically non-decreasing in the unanswered count', () => {
    let prev = 0;
    for (let unanswered = 1; unanswered <= 10; unanswered++) {
      const h = resolveNextReviewHoursAfterOutbound({
        signals: signals(),
        inboundCount: 1,
        outboundCountBeforeThisSend: unanswered + 1,
        unansweredOutboundBeforeThisSend: unanswered,
      });
      expect(h).toBeGreaterThanOrEqual(prev);
      expect(h).toBeGreaterThanOrEqual(72);
      prev = h;
    }
  });

  it('never-replied leads keep the existing zero-reply ladder', () => {
    for (const sent of [0, 1, 2, 5]) {
      expect(
        resolveNextReviewHoursAfterOutbound({
          signals: signals({ temperature: 'cold', nextReviewHours: 24 }),
          inboundCount: 0,
          outboundCountBeforeThisSend: sent,
          unansweredOutboundBeforeThisSend: sent,
        })
      ).toBe(nextReviewHoursAfterZeroReplyOutbound(sent + 1));
    }
  });

  it('hot leads (booked call, accepted offer) are exempt from the backoff', () => {
    expect(
      resolveNextReviewHoursAfterOutbound({
        signals: signals({ temperature: 'hot', nextReviewHours: 0.5 }),
        inboundCount: 2,
        outboundCountBeforeThisSend: 5,
        unansweredOutboundBeforeThisSend: 3,
      })
    ).toBe(0.5);
  });

  it('without the unanswered count, behaves exactly as before (callers not yet migrated)', () => {
    expect(
      resolveNextReviewHoursAfterOutbound({ signals: signals(), inboundCount: 1, outboundCountBeforeThisSend: 7 })
    ).toBe(2);
    expect(
      resolveNextReviewHoursAfterOutbound({ signals: signals(), inboundCount: 0, outboundCountBeforeThisSend: 2 })
    ).toBe(nextReviewHoursAfterZeroReplyOutbound(3));
  });
});
