/**
 * FinanceVine vendor schema tests
 *
 * The vendor posts leads in a shape that shares almost nothing with the
 * snake_case shape this route has always accepted: capitalized keys with
 * spaces ("Mortgage Balance"), a numeric-looking `"55"` key, Python `None`
 * values, and every financial figure as a string. Both shapes must succeed
 * end to end, forever — the vendor holds the URL and secret and can post
 * either at any moment.
 *
 * These tests pin the adapter (pure, exhaustively) and the route behaviour
 * that depends on it (dedupe, 4xx, consent).
 */

import {
  describeFigureFormats,
  findTrustedFormCert,
  maskFormat,
  normalizeFinanceVinePayload,
  normalizeProvince,
  parseLtv,
  parseMoney,
  parseYesNo,
  payloadKeys,
  presentString,
  toRawDataOverlay,
  toSegmentationInput,
} from '../lib/financevine-payload';
import { deriveLeadSegment } from '../lib/lead-segmentation';

/** The vendor's schema, verbatim from their developer. Values are fictitious. */
const VENDOR_PAYLOAD = {
  id: 'fv-lead-99001',
  first_name: 'Dana',
  last_name: 'Whitfield',
  phone: '6478553592',
  email: 'dana.whitfield@example.com',
  mortgage_type: 'Refinance',
  primary_goal: 'Consolidate debt',
  borrower_profile: "I'm not able to get approved at the bank",
  timeline: 'Within 30 days',
  '55': 'No',
  has_realtor: 'No',
  open_to_sell: 'Yes',
  property_value: '850000',
  'Mortgage Balance': '520000',
  'Equity Take Out': '75000',
  'Down Pay': 'N/A',
  LTV: '61',
  Income: '95000',
  Province: 'ON',
  Zoning: 'Residential',
  'Property Conditions': 'Good',
  'Property Address': '12 Fictional Ave, Toronto',
};

/** The shape the route has accepted since it shipped. Must not regress. */
const SNAKE_CASE_PAYLOAD = {
  first_name: 'Zach',
  last_name: 'Segtest',
  email: 'resub@example.com',
  phone: '+16045551234',
  mortgage_type: 'refinance',
  primary_goal: 'debt consolidation',
  borrower_profile: 'not approved at bank',
  province: 'British Columbia',
};

const expectOk = (result: ReturnType<typeof normalizeFinanceVinePayload>) => {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result.lead;
};

describe('vendor payload — full schema', () => {
  const lead = expectOk(normalizeFinanceVinePayload(VENDOR_PAYLOAD));

  it('maps identity fields', () => {
    expect(lead.vendorLeadId).toBe('fv-lead-99001');
    expect(lead.firstName).toBe('Dana');
    expect(lead.lastName).toBe('Whitfield');
    expect(lead.email).toBe('dana.whitfield@example.com');
  });

  it('normalizes the bare 10-digit phone to E.164', () => {
    expect(lead.phone).toBe('+16478553592');
    expect(lead.phoneRaw).toBe('6478553592');
  });

  it('maps the spaced, capitalized keys', () => {
    expect(lead.mortgageBalance).toEqual({ raw: '520000', parsed: 520000 });
    expect(lead.equityTakeOut).toEqual({ raw: '75000', parsed: 75000 });
    expect(lead.propertyValue).toEqual({ raw: '850000', parsed: 850000 });
    expect(lead.income).toEqual({ raw: '95000', parsed: 95000 });
    expect(lead.zoning).toBe('Residential');
    expect(lead.propertyConditions).toBe('Good');
    expect(lead.propertyAddress).toBe('12 Fictional Ave, Toronto');
  });

  it('maps the yes/no flags, including the "55" key', () => {
    expect(lead.age55Plus).toBe(false);
    expect(lead.hasRealtor).toBe(false);
    expect(lead.openToSell).toBe(true);
  });

  it('passes product and goal strings through unchanged for the aliases', () => {
    expect(lead.mortgageType).toBe('Refinance');
    expect(lead.primaryGoal).toBe('Consolidate debt');
    expect(lead.borrowerProfile).toBe("I'm not able to get approved at the bank");
    expect(lead.timeline).toBe('Within 30 days');
  });

  it('segments the vendor payload with the natural-language aliases intact', () => {
    const segmentation = deriveLeadSegment({
      source: 'financevine',
      rawData: toSegmentationInput(lead),
    });

    expect(segmentation.segment).toBe('alt_private');
    // "Consolidate debt" is an equity take-out, not a refinance.
    expect(segmentation.intent).toBe('equity');
    // PR #28's natural-language decline aliases must still catch this.
    expect(segmentation.bankability).toBe('not_approved');
  });

  it('accepts a Zapier data envelope around the vendor shape', () => {
    const wrapped = expectOk(normalizeFinanceVinePayload({ data: VENDOR_PAYLOAD }));
    expect(wrapped.vendorLeadId).toBe('fv-lead-99001');
    expect(wrapped.phone).toBe('+16478553592');
  });
});

describe('existing snake_case payload — unchanged', () => {
  const lead = expectOk(normalizeFinanceVinePayload(SNAKE_CASE_PAYLOAD));

  it('still normalizes every field it always did', () => {
    expect(lead.firstName).toBe('Zach');
    expect(lead.lastName).toBe('Segtest');
    expect(lead.email).toBe('resub@example.com');
    expect(lead.phone).toBe('+16045551234');
    expect(lead.mortgageType).toBe('refinance');
    expect(lead.primaryGoal).toBe('debt consolidation');
  });

  it('carries no vendor id, so dedupe falls back to phone/email', () => {
    expect(lead.vendorLeadId).toBeNull();
  });

  it('segments exactly as before', () => {
    const segmentation = deriveLeadSegment({
      source: 'financevine',
      rawData: toSegmentationInput(lead),
    });

    expect(segmentation).toEqual({
      segment: 'alt_private',
      intent: 'equity',
      bankability: 'not_approved',
    });
  });

  it('defaults a missing first name to Unknown, as it always has', () => {
    const lead = expectOk(
      normalizeFinanceVinePayload({ ...SNAKE_CASE_PAYLOAD, first_name: undefined })
    );
    expect(lead.firstName).toBe('Unknown');
    expect(lead.lastName).toBe('Segtest');
  });
});

describe('absent values', () => {
  // "None" is Python leaking through their serializer. It will probably arrive
  // as JSON null, but the string and an omitted key are both live
  // possibilities, and "N/A" is their form's own unanswered value.
  const forms: Array<[string, () => Record<string, unknown>]> = [
    ['JSON null', () => ({ ...VENDOR_PAYLOAD, 'Mortgage Balance': null })],
    ['the string "None"', () => ({ ...VENDOR_PAYLOAD, 'Mortgage Balance': 'None' })],
    ['the string "none"', () => ({ ...VENDOR_PAYLOAD, 'Mortgage Balance': 'none' })],
    ['the string "N/A"', () => ({ ...VENDOR_PAYLOAD, 'Mortgage Balance': 'N/A' })],
    ['the string "n/a"', () => ({ ...VENDOR_PAYLOAD, 'Mortgage Balance': 'n/a' })],
    ['an empty string', () => ({ ...VENDOR_PAYLOAD, 'Mortgage Balance': '' })],
    ['whitespace only', () => ({ ...VENDOR_PAYLOAD, 'Mortgage Balance': '   ' })],
    [
      'an omitted key',
      () => {
        const { 'Mortgage Balance': _omitted, ...rest } = VENDOR_PAYLOAD;
        return rest;
      },
    ],
  ];

  forms.forEach(([label, build]) => {
    it(`reads ${label} as absent`, () => {
      const lead = expectOk(normalizeFinanceVinePayload(build()));
      expect(lead.mortgageBalance).toBeNull();
    });
  });

  it('reads every absent form as absent for every field type', () => {
    const lead = expectOk(
      normalizeFinanceVinePayload({
        ...VENDOR_PAYLOAD,
        timeline: 'N/A',
        '55': 'N/A',
        has_realtor: null,
        open_to_sell: 'None',
        property_value: null,
        'Down Pay': 'N/A',
        LTV: 'None',
        Income: 'N/A',
        Zoning: null,
        'Property Conditions': 'None',
        'Property Address': null,
      })
    );

    expect(lead.timeline).toBeNull();
    expect(lead.age55Plus).toBeNull();
    expect(lead.hasRealtor).toBeNull();
    expect(lead.openToSell).toBeNull();
    expect(lead.propertyValue).toBeNull();
    expect(lead.downPayment).toBeNull();
    expect(lead.ltv).toBeNull();
    expect(lead.income).toBeNull();
    expect(lead.zoning).toBeNull();
    expect(lead.propertyConditions).toBeNull();
    expect(lead.propertyAddress).toBeNull();
  });

  it('does not treat a zero figure as absent', () => {
    const lead = expectOk(
      normalizeFinanceVinePayload({ ...VENDOR_PAYLOAD, 'Mortgage Balance': '0' })
    );
    expect(lead.mortgageBalance).toEqual({ raw: '0', parsed: 0 });
  });

  it('presentString handles the absent tokens directly', () => {
    ['', '  ', 'None', 'none', 'NULL', 'N/A', 'na', '-'].forEach((token) => {
      expect(presentString(token)).toBeNull();
    });
    expect(presentString(null)).toBeNull();
    expect(presentString(undefined)).toBeNull();
    expect(presentString('Ontario')).toBe('Ontario');
  });
});

describe('phone normalization', () => {
  const cases: Array<[string, string]> = [
    ['6478553592', '+16478553592'],
    ['(647) 855-3592', '+16478553592'],
    ['647-855-3592', '+16478553592'],
    ['647.855.3592', '+16478553592'],
    ['16478553592', '+16478553592'],
    ['1 647 855 3592', '+16478553592'],
    ['+16478553592', '+16478553592'],
  ];

  cases.forEach(([input, expected]) => {
    it(`normalizes ${input.replace(/\d/g, '9')} to E.164`, () => {
      const lead = expectOk(
        normalizeFinanceVinePayload({ ...VENDOR_PAYLOAD, phone: input })
      );
      expect(lead.phone).toBe(expected);
      expect(lead.phoneRaw).toBe(input);
    });
  });

  it('rejects a number that is not North American', () => {
    const result = normalizeFinanceVinePayload({ ...VENDOR_PAYLOAD, phone: '5551234' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.join(' ')).toContain('10-digit');
  });
});

describe('money parsing', () => {
  // Whether the vendor sends "$" and commas is NOT confirmed — a sample
  // payload has been requested. Every plausible form parses; anything else
  // stores raw rather than failing or guessing.
  const parseable: Array<[string, number]> = [
    ['450000', 450000],
    ['$450000', 450000],
    ['450,000', 450000],
    ['$450,000', 450000],
    ['$450,000.00', 450000],
    ['450000.50', 450000.5],
    [' $1,250,000 ', 1250000],
    ['450000 CAD', 450000],
  ];

  parseable.forEach(([raw, parsed]) => {
    it(`parses ${maskFormat(raw)}`, () => {
      expect(parseMoney(raw)).toEqual({ raw: raw.trim(), parsed });
    });
  });

  const unparseable = ['450k', 'approx 450000', '400000-500000', 'a lot', '1.2M'];

  unparseable.forEach((raw) => {
    it(`stores ${maskFormat(raw)} raw without failing`, () => {
      expect(parseMoney(raw)).toEqual({ raw, parsed: null });
    });
  });

  it('keeps the raw string on the normalized lead even when unparseable', () => {
    const lead = expectOk(
      normalizeFinanceVinePayload({ ...VENDOR_PAYLOAD, 'Mortgage Balance': '450k' })
    );
    expect(lead.mortgageBalance).toEqual({ raw: '450k', parsed: null });
  });
});

describe('LTV parsing', () => {
  // The vendor has since CONFIRMED in writing that LTV is always a ratio:
  // "0.80" means 80%. These cases were written while that was still unknown;
  // the bare-percentage readings ("80" -> 80, "61" -> 61) encoded the wrong
  // guess and are corrected here. Full coverage of the confirmed convention
  // lives in financevine-ltv-and-equity.test.ts.
  const cases: Array<[string, number]> = [
    ['80%', 80],
    ['0.80', 80],
    ['0.8', 80],
    ['0.615', 61.5],
    ['1.10', 110],
    [' 75 % ', 75],
  ];

  cases.forEach(([raw, parsed]) => {
    it(`reads ${maskFormat(raw)} as ${parsed}%`, () => {
      expect(parseLtv(raw)).toEqual({ raw: raw.trim(), parsed });
    });
  });

  it('stores an unparseable LTV raw', () => {
    expect(parseLtv('about eighty')).toEqual({ raw: 'about eighty', parsed: null });
  });

  it('refuses an implausible percentage rather than recording it', () => {
    expect(parseLtv('8000')).toEqual({ raw: '8000', parsed: null });
  });

  it('flags a bare percentage as unparseable now that ratios are confirmed', () => {
    // "80" ratio-expands to 8000, lands outside 0-200 and is reported with
    // the raw string preserved — the signal we want if the vendor's format
    // ever changes back.
    expect(parseLtv('80')).toEqual({ raw: '80', parsed: null });
  });

  it('treats an explicit percent above 1 as a percent, not a ratio', () => {
    expect(parseLtv('1%')).toEqual({ raw: '1%', parsed: 1 });
  });
});

describe('yes/no flags', () => {
  it('reads the vendor strings', () => {
    expect(parseYesNo('Yes')).toBe(true);
    expect(parseYesNo('yes')).toBe(true);
    expect(parseYesNo('No')).toBe(false);
    expect(parseYesNo('N/A')).toBeNull();
    expect(parseYesNo(null)).toBeNull();
    expect(parseYesNo(undefined)).toBeNull();
  });

  it('still reads the booleans the existing shape sends', () => {
    expect(parseYesNo(true)).toBe(true);
    expect(parseYesNo(false)).toBe(false);
  });
});

describe('the "55" reverse flag reaches intent derivation', () => {
  // Their form only asks this on reverse-mortgage inquiries, so "Yes" is a
  // reverse signal on its own — it must catch a reverse lead even when the
  // product string is one we have never seen.
  it('"55": "Yes" produces reverse intent', () => {
    const lead = expectOk(
      normalizeFinanceVinePayload({ ...VENDOR_PAYLOAD, '55': 'Yes' })
    );
    expect(lead.age55Plus).toBe(true);

    const segmentation = deriveLeadSegment({
      source: 'financevine',
      rawData: toSegmentationInput(lead),
    });
    expect(segmentation.intent).toBe('reverse');
  });

  it('beats a familiar product string that would otherwise read as equity', () => {
    const segmentation = deriveLeadSegment({
      source: 'financevine',
      rawData: toSegmentationInput(
        expectOk(
          normalizeFinanceVinePayload({
            ...VENDOR_PAYLOAD,
            '55': 'Yes',
            mortgage_type: 'Refinance',
            primary_goal: 'Consolidate debt',
          })
        )
      ),
    });
    expect(segmentation.intent).toBe('reverse');
  });

  it('catches a reverse lead whose product string is unfamiliar', () => {
    const segmentation = deriveLeadSegment({
      source: 'financevine',
      rawData: toSegmentationInput(
        expectOk(
          normalizeFinanceVinePayload({
            ...VENDOR_PAYLOAD,
            '55': 'Yes',
            mortgage_type: 'Lifetime Advance Plan',
            primary_goal: 'Supplement retirement',
          })
        )
      ),
    });
    expect(segmentation.intent).toBe('reverse');
  });

  it('"55": "No" does not force reverse', () => {
    const segmentation = deriveLeadSegment({
      source: 'financevine',
      rawData: toSegmentationInput(expectOk(normalizeFinanceVinePayload(VENDOR_PAYLOAD))),
    });
    expect(segmentation.intent).not.toBe('reverse');
  });

  it('leaves the existing reverse aliases working without the flag', () => {
    const segmentation = deriveLeadSegment({
      source: 'financevine',
      rawData: toSegmentationInput(
        expectOk(
          normalizeFinanceVinePayload({
            ...VENDOR_PAYLOAD,
            '55': 'N/A',
            mortgage_type: 'Home Equity Conversion Mortgage',
          })
        )
      ),
    });
    expect(segmentation.intent).toBe('reverse');
  });

  it('still honours the legacy boolean age_55_plus key', () => {
    expect(
      deriveLeadSegment({ source: 'financevine', rawData: { age_55_plus: true } }).intent
    ).toBe('reverse');
  });
});

describe('province normalization', () => {
  // getLocalTime (lib/timezone-utils.ts) keys a plain object on FULL province
  // names and silently defaults to PST otherwise — a two-letter code would put
  // an Ontario lead three hours off and break the 8am-9pm SMS guardrail.
  const cases: Array<[string, string]> = [
    ['ON', 'Ontario'],
    ['on', 'Ontario'],
    ['Ontario', 'Ontario'],
    ['BC', 'British Columbia'],
    ['British Columbia', 'British Columbia'],
    ['AB', 'Alberta'],
    ['Ontario, Canada', 'Ontario'],
    ['ON, CA', 'Ontario'],
    ['N.B.', 'New Brunswick'],
  ];

  cases.forEach(([raw, expected]) => {
    it(`normalizes "${raw}" to "${expected}"`, () => {
      expect(normalizeProvince(raw)).toBe(expected);
    });
  });

  it('passes an unrecognized province through rather than dropping it', () => {
    expect(normalizeProvince('Atlantis')).toBe('Atlantis');
  });

  it('puts the full name on the rawData overlay for the timezone consumers', () => {
    const lead = expectOk(normalizeFinanceVinePayload(VENDOR_PAYLOAD));
    expect(lead.province).toBe('Ontario');
    expect(lead.provinceRaw).toBe('ON');
    expect(toRawDataOverlay(lead).province).toBe('Ontario');
  });
});

describe('TrustedForm certificate', () => {
  it('picks up a certificate under a named key', () => {
    const lead = expectOk(
      normalizeFinanceVinePayload({
        ...VENDOR_PAYLOAD,
        xxTrustedFormCertUrl: 'https://cert.trustedform.com/abc123',
      })
    );
    expect(lead.trustedFormCertUrl).toBe('https://cert.trustedform.com/abc123');
  });

  it('picks up a certificate under an unexpected key by its URL shape', () => {
    expect(
      findTrustedFormCert({ some_unknown_key: 'https://cert.trustedform.com/xyz789' })
    ).toBe('https://cert.trustedform.com/xyz789');
  });

  it('does not fail when absent', () => {
    const lead = expectOk(normalizeFinanceVinePayload(VENDOR_PAYLOAD));
    expect(lead.trustedFormCertUrl).toBeNull();
  });
});

describe('rawData overlay', () => {
  const lead = expectOk(normalizeFinanceVinePayload(VENDOR_PAYLOAD));
  const overlay = toRawDataOverlay(lead);

  it('stores every figure raw, and parsed where parseable', () => {
    expect(overlay.mortgage_balance).toBe(520000);
    expect(overlay.mortgage_balance_raw).toBe('520000');
    // VENDOR_PAYLOAD carries LTV "61", which under the confirmed ratio
    // convention is out of range and so stores raw-only.
    expect(overlay.ltv_percent).toBeUndefined();
    expect(overlay.ltv_percent_raw).toBe('61');
  });

  it('stores the raw string even when the number could not be read', () => {
    const messy = toRawDataOverlay(
      expectOk(
        normalizeFinanceVinePayload({ ...VENDOR_PAYLOAD, 'Mortgage Balance': '450k' })
      )
    );
    expect(messy.mortgage_balance_raw).toBe('450k');
    expect(messy.mortgage_balance).toBeUndefined();
  });

  it('stores the yes/no flags and the vendor id', () => {
    expect(overlay.age_55_plus).toBe(false);
    expect(overlay.has_realtor).toBe(false);
    expect(overlay.open_to_sell).toBe(true);
    expect(overlay.vendor_lead_id).toBe('fv-lead-99001');
  });

  it('omits absent fields rather than writing nulls over them', () => {
    expect(overlay).not.toHaveProperty('down_payment');
    expect(overlay).not.toHaveProperty('down_payment_raw');
  });
});

describe('malformed payloads', () => {
  it('rejects a payload with no email and names the problem', () => {
    const { email, ...withoutEmail } = VENDOR_PAYLOAD;
    const result = normalizeFinanceVinePayload(withoutEmail);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('email is missing');
    expect(result.keys).toContain('Mortgage Balance');
    expect(result.keys).not.toContain('email');
  });

  it('rejects a payload with no phone and names the problem', () => {
    const { phone, ...withoutPhone } = VENDOR_PAYLOAD;
    const result = normalizeFinanceVinePayload(withoutPhone);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('phone is missing');
  });

  it('reports every problem at once', () => {
    const result = normalizeFinanceVinePayload({ id: 'fv-1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toHaveLength(2);
  });

  it('rejects a malformed email address', () => {
    const result = normalizeFinanceVinePayload({
      ...VENDOR_PAYLOAD,
      email: 'not-an-email',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('not a valid email');
  });

  it('rejects a non-object payload', () => {
    expect(normalizeFinanceVinePayload('nope').ok).toBe(false);
    expect(normalizeFinanceVinePayload(null).ok).toBe(false);
    expect(normalizeFinanceVinePayload([1, 2]).ok).toBe(false);
  });

  it('reports the received key set, and only keys', () => {
    const { email, ...withoutEmail } = VENDOR_PAYLOAD;
    const result = normalizeFinanceVinePayload(withoutEmail);
    if (result.ok) throw new Error('expected failure');

    expect(result.keys).toEqual(Object.keys(withoutEmail));
    // Nothing in the diagnostics may carry a value.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Whitfield');
    expect(serialized).not.toContain('6478553592');
    expect(serialized).not.toContain('520000');
  });

  it('payloadKeys unwraps a Zapier envelope', () => {
    expect(payloadKeys({ data: VENDOR_PAYLOAD })).toEqual(Object.keys(VENDOR_PAYLOAD));
  });
});

describe('figure-format logging', () => {
  // The formats are unconfirmed; the log line is how we confirm them from
  // Vercel without a lead's figures ever appearing in it.
  it('masks every digit', () => {
    const line = describeFigureFormats(
      expectOk(
        normalizeFinanceVinePayload({
          ...VENDOR_PAYLOAD,
          'Mortgage Balance': '$520,000',
          LTV: '0.61',
        })
      )
    );

    expect(line).toContain('mortgage_balance=$999,999');
    expect(line).toContain('ltv=9.99');
    expect(line).not.toMatch(/[1-8]/);
  });

  it('flags a figure it could not parse', () => {
    const line = describeFigureFormats(
      expectOk(
        normalizeFinanceVinePayload({ ...VENDOR_PAYLOAD, 'Mortgage Balance': '520k' })
      )
    );
    expect(line).toContain('(UNPARSED)');
  });

  it('says so when no figures are present', () => {
    const line = describeFigureFormats(
      expectOk(
        normalizeFinanceVinePayload({
          email: 'a@b.com',
          phone: '6045551234',
        })
      )
    );
    expect(line).toBe('none present');
  });
});
