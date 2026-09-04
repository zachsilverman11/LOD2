/**
 * FinanceVine follow-up fixes — LTV convention and the down-payment goal.
 *
 * Both defects were found by the FIRST real vendor payload, not by review.
 * See notes/financevine-first-lead-audit.md.
 *
 * 1. LTV always arrives as a RATIO (vendor-confirmed in writing). The old
 *    parser only multiplied values at or below 1.0, so "0.85" became 85 while
 *    "1.10" stayed 1.1 — a 100x error landing exactly on over-100% LTV, the
 *    underwater case an alt/private book sees most.
 * 2. "Refinance my property" + "Down payment for purchase" classified as
 *    refinance. A homeowner refinancing to fund a down payment on another
 *    property is an equity take-out.
 */

import {
  normalizeFinanceVinePayload,
  parseLtv,
  parseMoney,
  toRawDataOverlay,
  toSegmentationInput,
} from '../lib/financevine-payload';
import { deriveLeadSegment } from '../lib/lead-segmentation';

const expectOk = (result: ReturnType<typeof normalizeFinanceVinePayload>) => {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result.lead;
};

/** The first real vendor payload's shape, values fictionalised. */
const REAL_SHAPE = {
  id: '1534741851',
  first_name: 'Test',
  last_name: 'Test',
  phone: '6478553592',
  email: 'test@example.com',
  mortgage_type: 'Refinance my property',
  primary_goal: 'Down payment for purchase',
  borrower_profile: "I'm able to get approved at the bank",
  timeline: 'N/A',
  '55': 'N/A',
  has_realtor: 'N/A',
  open_to_sell: 'N/A',
  property_value: '750000',
  mortgage_balance: '1100000',
  equity_take_out: '0',
  down_pay: 'N/A',
  ltv: '1.10',
  income: 'N/A',
  province: 'British Columbia',
  zoning: 'Urban property',
  property_conditions: 'None of the above',
  property_address: '',
  trustedform: 'https://cert.trustedform.com/11111',
};

describe('LTV is always a ratio', () => {
  const cases: Array<[string | number, number]> = [
    ['0.80', 80],
    ['1.10', 110],
    ['0.5', 50],
    [0.8, 80],
    ['0.85', 85],
    ['1.0', 100],
    ['0.615', 61.5],
    ['1.5', 150],
    [1.1, 110],
    ['0', 0],
  ];

  cases.forEach(([raw, parsed]) => {
    it(`reads ${JSON.stringify(raw)} as ${parsed}%`, () => {
      expect(parseLtv(raw)?.parsed).toBe(parsed);
    });
  });

  it('keeps the raw string exactly as sent', () => {
    expect(parseLtv('1.10')).toEqual({ raw: '1.10', parsed: 110 });
    expect(parseLtv('0.80')).toEqual({ raw: '0.80', parsed: 80 });
  });

  it('keeps the raw form of a JSON number', () => {
    expect(parseLtv(0.8)).toEqual({ raw: '0.8', parsed: 80 });
  });

  // THE regression this fix exists for: the old parser gated multiplication
  // on `parsed <= 1`, so anything over 100% LTV was stored 100x too low.
  it('does NOT leave an over-100% LTV unmultiplied', () => {
    expect(parseLtv('1.10')?.parsed).not.toBe(1.1);
    expect(parseLtv('1.35')?.parsed).toBe(135);
  });

  it('still honours an explicit percent sign', () => {
    // Self-describing; reading it as a ratio would give 8000%.
    expect(parseLtv('80%')).toEqual({ raw: '80%', parsed: 80 });
  });

  it('flags a format regression instead of storing a wrong number', () => {
    // If the vendor ever switched back to percentages, "80" ratio-expands to
    // 8000, falls outside 0-200 and is reported UNPARSED with raw preserved.
    expect(parseLtv('80')).toEqual({ raw: '80', parsed: null });
  });

  it('stores an unparseable LTV raw', () => {
    expect(parseLtv('about eighty')).toEqual({ raw: 'about eighty', parsed: null });
  });

  it('carries the ratio through to the stored overlay', () => {
    const overlay = toRawDataOverlay(expectOk(normalizeFinanceVinePayload(REAL_SHAPE)));
    expect(overlay.ltv_percent).toBe(110);
    expect(overlay.ltv_percent_raw).toBe('1.10');
  });
});

describe('money accepts JSON numbers and digit strings alike', () => {
  // The vendor says property_value and mortgage_balance are integers with no
  // symbols — possibly JSON numbers rather than strings.
  it('parses an integer JSON number and a digit string to the same value', () => {
    expect(parseMoney(750000)).toEqual({ raw: '750000', parsed: 750000 });
    expect(parseMoney('750000')).toEqual({ raw: '750000', parsed: 750000 });
    expect(parseMoney(750000)?.parsed).toBe(parseMoney('750000')?.parsed);
  });

  it('stores the same value through the payload either way', () => {
    const asString = toRawDataOverlay(
      expectOk(normalizeFinanceVinePayload(REAL_SHAPE))
    );
    const asNumber = toRawDataOverlay(
      expectOk(
        normalizeFinanceVinePayload({
          ...REAL_SHAPE,
          property_value: 750000,
          mortgage_balance: 1100000,
        })
      )
    );

    expect(asNumber.property_value).toBe(asString.property_value);
    expect(asNumber.mortgage_balance).toBe(asString.mortgage_balance);
    expect(asNumber.property_value).toBe(750000);
    expect(asNumber.mortgage_balance).toBe(1100000);
  });

  it('handles a zero as a real answer, not an absence', () => {
    expect(parseMoney(0)).toEqual({ raw: '0', parsed: 0 });
    expect(parseMoney('0')).toEqual({ raw: '0', parsed: 0 });
  });
});

describe('absence: "", "N/A" and null all read as absent', () => {
  // The vendor offered to normalize these to "None" server-side and we
  // declined, so the adapter must keep handling all three itself.
  const absentForms: Array<[string, unknown]> = [
    ['an empty string', ''],
    ['"N/A"', 'N/A'],
    ['null', null],
  ];

  absentForms.forEach(([label, value]) => {
    describe(label, () => {
      it('is absent for a plain string field', () => {
        const lead = expectOk(
          normalizeFinanceVinePayload({ ...REAL_SHAPE, zoning: value })
        );
        expect(lead.zoning).toBeNull();
      });

      it('is absent for a money field', () => {
        const lead = expectOk(
          normalizeFinanceVinePayload({ ...REAL_SHAPE, property_value: value })
        );
        expect(lead.propertyValue).toBeNull();
      });

      it('is absent for a yes/no flag field', () => {
        const lead = expectOk(
          normalizeFinanceVinePayload({ ...REAL_SHAPE, has_realtor: value })
        );
        expect(lead.hasRealtor).toBeNull();
      });

      it('is absent for the LTV field', () => {
        const lead = expectOk(
          normalizeFinanceVinePayload({ ...REAL_SHAPE, ltv: value })
        );
        expect(lead.ltv).toBeNull();
      });

      it('writes nothing to the overlay for that field', () => {
        const overlay = toRawDataOverlay(
          expectOk(normalizeFinanceVinePayload({ ...REAL_SHAPE, property_value: value }))
        );
        expect(overlay).not.toHaveProperty('property_value');
        expect(overlay).not.toHaveProperty('property_value_raw');
      });
    });
  });
});

describe('down payment as a goal', () => {
  const intentOf = (payload: Record<string, unknown>) =>
    deriveLeadSegment({
      source: 'financevine',
      rawData: toSegmentationInput(expectOk(normalizeFinanceVinePayload(payload))),
    }).intent;

  it('classifies the real test lead as equity, not refinance', () => {
    // mortgage_type "Refinance my property" + goal "Down payment for
    // purchase" = pulling equity out to fund a second property.
    expect(intentOf(REAL_SHAPE)).toBe('equity');
  });

  it('leaves a genuine purchase lead as purchase', () => {
    // Same goal, but the product says they are buying — "down payment" is
    // the money going IN, not equity coming out.
    expect(
      intentOf({
        ...REAL_SHAPE,
        mortgage_type: 'Purchase a property',
        primary_goal: 'Down payment for purchase',
      })
    ).toBe('purchase');
  });

  it('gates on mortgage_type, not on the goal mentioning a purchase', () => {
    // The goal here says nothing about a purchase, and the product does.
    // The gate must still refuse to call it equity.
    expect(
      intentOf({
        ...REAL_SHAPE,
        mortgage_type: 'Purchase a property',
        primary_goal: 'Down payment',
      })
    ).toBe('purchase');
  });

  it('refuses equity for a "buy" product even though the branch below misses it', () => {
    // PRE-EXISTING GAP, unrelated to this fix and deliberately not widened
    // here: the purchase branch only tests `loanType.includes('purchase')`,
    // so a product string of "Buy a home" reaches 'unknown'. What this fix
    // guarantees is the part it owns — the down-payment gate does NOT let a
    // buying lead be labelled an equity take-out.
    const intent = intentOf({
      ...REAL_SHAPE,
      mortgage_type: 'Buy a home',
      primary_goal: 'Down payment',
    });

    expect(intent).not.toBe('equity');
    expect(intent).toBe('unknown');
  });

  it('catches the goal phrased without the full word', () => {
    expect(
      intentOf({ ...REAL_SHAPE, primary_goal: 'Need a down pay for another place' })
    ).toBe('equity');
  });

  it('does not fire when the goal never mentions a down payment', () => {
    expect(
      intentOf({ ...REAL_SHAPE, primary_goal: 'Lower my monthly payment' })
    ).toBe('refinance');
  });

  it('leaves the existing equity aliases working', () => {
    expect(intentOf({ ...REAL_SHAPE, primary_goal: 'Consolidate debt' })).toBe('equity');
    expect(intentOf({ ...REAL_SHAPE, primary_goal: 'Take out equity' })).toBe('equity');
    expect(intentOf({ ...REAL_SHAPE, primary_goal: 'Need cash' })).toBe('equity');
  });

  it('still lets the reverse branch win over a down-payment goal', () => {
    expect(intentOf({ ...REAL_SHAPE, '55': 'Yes' })).toBe('reverse');
  });

  it('leaves the rest of the real payload classified as before', () => {
    const segmentation = deriveLeadSegment({
      source: 'financevine',
      rawData: toSegmentationInput(expectOk(normalizeFinanceVinePayload(REAL_SHAPE))),
    });
    expect(segmentation.segment).toBe('alt_private');
    expect(segmentation.bankability).toBe('bank_approved');
  });
});
