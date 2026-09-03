/**
 * FinanceVine route tests — vendor schema at the route level.
 *
 * The adapter is pinned in financevine-vendor-schema.test.ts. What is pinned
 * here is what the ROUTE does with it: both payload shapes reaching lead
 * creation, the vendor id being the primary dedupe key, a bad payload getting
 * a 4xx with the key set logged and no values, and consent surviving a
 * re-submission.
 */

const mockLeadFindFirst = jest.fn();
const mockLeadCreate = jest.fn();
const mockLeadUpdate = jest.fn();
const mockActivityCreate = jest.fn();
const mockWebhookCreate = jest.fn();
const mockWebhookUpdateMany = jest.fn();
const mockCohortFindFirst = jest.fn();
const mockSlack = jest.fn();
const mockErrorAlert = jest.fn();

jest.mock('../lib/db', () => ({
  prisma: {
    webhookEvent: {
      create: (...a: any[]) => mockWebhookCreate(...a),
      updateMany: (...a: any[]) => mockWebhookUpdateMany(...a),
    },
    lead: {
      findFirst: (...a: any[]) => mockLeadFindFirst(...a),
      create: (...a: any[]) => mockLeadCreate(...a),
      update: (...a: any[]) => mockLeadUpdate(...a),
    },
    leadActivity: { create: (...a: any[]) => mockActivityCreate(...a) },
    cohortConfig: { findFirst: (...a: any[]) => mockCohortFindFirst(...a) },
  },
}));

jest.mock('../lib/slack', () => ({
  sendSlackNotification: (...a: any[]) => mockSlack(...a),
  sendErrorAlert: (...a: any[]) => mockErrorAlert(...a),
}));

import { POST, withdrawnConsentChannels } from '../app/api/webhooks/financevine/route';

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

const makeReq = (body: any) =>
  ({
    headers: { get: () => null },
    nextUrl: { searchParams: { get: () => null } },
    json: async () => body,
  }) as any;

const baseExistingLead = {
  id: 'lead-existing',
  email: 'dana.whitfield@example.com',
  vendorLeadId: null as string | null,
  status: 'NURTURING',
  consentSms: true,
  consentEmail: true,
  consentCall: true,
  managedByAutonomous: true,
  hollyDisabled: false,
  nextReviewAt: new Date('2099-01-01T00:00:00.000Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWebhookCreate.mockResolvedValue({});
  mockWebhookUpdateMany.mockResolvedValue({});
  mockCohortFindFirst.mockResolvedValue(null);
  mockLeadFindFirst.mockResolvedValue(null);
  mockLeadCreate.mockImplementation(async (args: any) => ({
    id: 'lead-new',
    ...args.data,
  }));
  mockLeadUpdate.mockImplementation(async (args: any) => ({
    ...baseExistingLead,
    ...args.data,
    id: args.where.id,
  }));
});

const createdData = () => mockLeadCreate.mock.calls[0][0].data;

describe('vendor payload end to end', () => {
  it('creates a lead from the vendor schema', async () => {
    const res = await POST(makeReq(VENDOR_PAYLOAD));
    const body = await res.json();

    expect(res.status ?? 200).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status).toBe('created');
    expect(body.segment).toBe('alt_private');

    const data = createdData();
    expect(data.firstName).toBe('Dana');
    expect(data.phone).toBe('+16478553592');
    expect(data.vendorLeadId).toBe('fv-lead-99001');
    expect(data.intent).toBe('equity');
    expect(data.bankability).toBe('not_approved');
    expect(data.source).toBe('financevine');
  });

  it('stores the payload exactly as received alongside the normalized fields', async () => {
    await POST(makeReq(VENDOR_PAYLOAD));
    const rawData = createdData().rawData;

    // Verbatim, untouched.
    expect(rawData.financevineRaw).toEqual(VENDOR_PAYLOAD);
    expect(rawData['Mortgage Balance']).toBe('520000');
    expect(rawData['55']).toBe('No');

    // Canonical overlay the rest of the codebase reads.
    expect(rawData.province).toBe('Ontario');
    expect(rawData.mortgage_balance).toBe(520000);
    expect(rawData.mortgage_balance_raw).toBe('520000');
    expect(rawData.ltv_percent).toBe(61);
    expect(rawData.age_55_plus).toBe(false);
    expect(rawData.open_to_sell).toBe(true);
    expect(rawData.phone).toBe('+16478553592');
    expect(rawData.ingestTimestamp).toEqual(expect.any(String));
  });

  it('routes a "55": "Yes" lead to the reverse playbook', async () => {
    await POST(makeReq({ ...VENDOR_PAYLOAD, '55': 'Yes' }));
    expect(createdData().intent).toBe('reverse');
  });

  it('schedules the first Holly contact, as it does for any new lead', async () => {
    const body = await (await POST(makeReq(VENDOR_PAYLOAD))).json();
    expect(body.aiContactScheduled).toBe(true);

    const schedule = mockLeadUpdate.mock.calls.find(
      (c: any[]) => c[0]?.data?.nextReviewAt !== undefined
    );
    expect(schedule).toBeDefined();
  });
});

describe('existing snake_case payload end to end', () => {
  it('creates a lead exactly as it did before the adapter', async () => {
    const body = await (await POST(makeReq(SNAKE_CASE_PAYLOAD))).json();

    expect(body.success).toBe(true);
    expect(body.status).toBe('created');

    const data = createdData();
    expect(data.firstName).toBe('Zach');
    expect(data.phone).toBe('+16045551234');
    expect(data.email).toBe('resub@example.com');
    expect(data.segment).toBe('alt_private');
    expect(data.intent).toBe('equity');
    expect(data.bankability).toBe('not_approved');
    // No vendor id in this shape.
    expect(data.vendorLeadId).toBeNull();
    expect(data.rawData.province).toBe('British Columbia');
  });

  it('dedupes on phone/email when there is no vendor id', async () => {
    mockLeadFindFirst.mockResolvedValue({
      ...baseExistingLead,
      email: 'resub@example.com',
    });

    const body = await (await POST(makeReq(SNAKE_CASE_PAYLOAD))).json();
    expect(body.status).toBe('updated');

    expect(mockLeadFindFirst).toHaveBeenCalledWith({
      where: { OR: [{ email: 'resub@example.com' }, { phone: '+16045551234' }] },
    });
  });
});

describe('vendor id is the primary dedupe key', () => {
  it('matches the existing lead by vendor id even when the email changed', async () => {
    const existing = {
      ...baseExistingLead,
      vendorLeadId: 'fv-lead-99001',
      email: 'dana.old@example.com',
    };

    // Only the vendorLeadId lookup finds anything: a phone/email lookup for
    // the NEW email would find nothing.
    mockLeadFindFirst.mockImplementation(async (args: any) =>
      args.where?.vendorLeadId === 'fv-lead-99001' ? existing : null
    );

    const body = await (
      await POST(makeReq({ ...VENDOR_PAYLOAD, email: 'dana.new@example.com' }))
    ).json();

    expect(body.status).toBe('updated');
    expect(body.leadId).toBe('lead-existing');

    // The vendor-id lookup happened FIRST...
    expect(mockLeadFindFirst.mock.calls[0][0]).toEqual({
      where: { vendorLeadId: 'fv-lead-99001' },
    });

    // ...and the new email was written onto the same row, not a new one.
    expect(mockLeadCreate).not.toHaveBeenCalled();
    expect(mockLeadUpdate.mock.calls[0][0].data.email).toBe('dana.new@example.com');
  });

  it('does not run a phone/email lookup once the vendor id matched', async () => {
    mockLeadFindFirst.mockImplementation(async (args: any) =>
      args.where?.vendorLeadId ? { ...baseExistingLead, vendorLeadId: 'fv-lead-99001' } : null
    );

    await POST(makeReq(VENDOR_PAYLOAD));

    const orLookups = mockLeadFindFirst.mock.calls.filter((c: any[]) => c[0]?.where?.OR);
    expect(orLookups).toHaveLength(0);
  });

  it('falls back to phone/email when the vendor id is new', async () => {
    mockLeadFindFirst.mockImplementation(async (args: any) =>
      args.where?.OR ? baseExistingLead : null
    );

    const body = await (await POST(makeReq(VENDOR_PAYLOAD))).json();

    expect(body.status).toBe('updated');
    // And the vendor id is backfilled onto the row it matched.
    expect(mockLeadUpdate.mock.calls[0][0].data.vendorLeadId).toBe('fv-lead-99001');
  });

  it('keeps the existing email when the new one already belongs to another lead', async () => {
    const existing = {
      ...baseExistingLead,
      vendorLeadId: 'fv-lead-99001',
      email: 'dana.old@example.com',
    };

    mockLeadFindFirst.mockImplementation(async (args: any) => {
      if (args.where?.vendorLeadId) return existing;
      if (args.where?.email === 'someone.else@example.com') {
        return { ...baseExistingLead, id: 'lead-other', email: 'someone.else@example.com' };
      }
      return null;
    });

    await POST(makeReq({ ...VENDOR_PAYLOAD, email: 'someone.else@example.com' }));

    // Writing the taken address would fail the unique constraint and drop the
    // whole webhook, so the existing address stays.
    expect(mockLeadUpdate.mock.calls[0][0].data.email).toBe('dana.old@example.com');
  });
});

describe('malformed payloads', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

  afterAll(() => warn.mockRestore());

  it('returns 400 naming the missing field and logs the key set', async () => {
    warn.mockClear();
    const { email, ...withoutEmail } = VENDOR_PAYLOAD;

    const res = await POST(makeReq(withoutEmail));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('email is missing');
    expect(body.receivedKeys).toEqual(Object.keys(withoutEmail));

    const logged = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('Rejected payload');
    expect(logged).toContain('Mortgage Balance');

    // Keys only — never a value.
    expect(logged).not.toContain('Whitfield');
    expect(logged).not.toContain('6478553592');
    expect(logged).not.toContain('520000');
    expect(logged).not.toContain('12 Fictional Ave');
  });

  it('returns 400 for a bad phone and touches no lead', async () => {
    const res = await POST(makeReq({ ...VENDOR_PAYLOAD, phone: '123' }));

    expect(res.status).toBe(400);
    expect(mockLeadCreate).not.toHaveBeenCalled();
    expect(mockLeadUpdate).not.toHaveBeenCalled();
    expect(mockLeadFindFirst).not.toHaveBeenCalled();
  });

  it('never stores a body it could not read — only the key set', async () => {
    await POST(makeReq({ ...VENDOR_PAYLOAD, phone: '123' }));

    // Validation runs BEFORE any write, so a malformed POST cannot put an
    // arbitrary body into the audit table.
    expect(mockWebhookCreate).toHaveBeenCalledTimes(1);
    const event = mockWebhookCreate.mock.calls[0][0].data;

    expect(event.eventType).toBe('rejected_payload');
    expect(event.payload.receivedKeys).toEqual(Object.keys(VENDOR_PAYLOAD));

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('Whitfield');
    expect(serialized).not.toContain('520000');
    expect(serialized).not.toContain('12 Fictional Ave');
  });

  it('stores the full payload once it IS readable', async () => {
    await POST(makeReq(VENDOR_PAYLOAD));

    const event = mockWebhookCreate.mock.calls[0][0].data;
    expect(event.eventType).toBe('new_lead');
    expect(event.payload).toEqual(VENDOR_PAYLOAD);
  });

  it('lists every problem on a near-empty payload', async () => {
    const res = await POST(makeReq({ id: 'fv-1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('email'),
        expect.stringContaining('phone'),
      ])
    );
  });
});

describe('the figure-format log line carries no values', () => {
  it('masks every digit', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    await POST(makeReq({ ...VENDOR_PAYLOAD, 'Mortgage Balance': '$520,000' }));

    const formatLine = log.mock.calls
      .map((c) => String(c[0]))
      .find((line) => line.includes('figure formats'));

    expect(formatLine).toBeDefined();
    expect(formatLine).toContain('mortgage_balance=$999,999');
    expect(formatLine).not.toContain('520');
    expect(formatLine).not.toContain('Whitfield');

    log.mockRestore();
  });
});

/**
 * Consent. A lead who replied STOP has `consentSms: false`
 * (app/api/webhooks/twilio/route.ts:99); a CASL withdrawal sets any of the
 * three (lib/compliance.ts:145). Re-filling the vendor's form is NOT consent:
 * the update path used to write `consentSms: true` straight back over an
 * opt-out, putting the lead back in Holly's reach on the next cron pass.
 */
describe('consent survives a re-submission', () => {
  const optedOut = {
    ...baseExistingLead,
    consentSms: false,
    nextReviewAt: null as Date | null,
  };

  beforeEach(() => {
    mockLeadFindFirst.mockImplementation(async (args: any) =>
      args.where?.email === undefined || args.where?.OR || args.where?.vendorLeadId
        ? optedOut
        : null
    );
    mockLeadUpdate.mockImplementation(async (args: any) => ({
      ...optedOut,
      ...args.data,
      id: args.where.id,
    }));
  });

  it('never re-asserts consent on the update path', async () => {
    await POST(makeReq(VENDOR_PAYLOAD));

    const updateData = mockLeadUpdate.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('consentSms');
    expect(updateData).not.toHaveProperty('consentEmail');
    expect(updateData).not.toHaveProperty('consentCall');
  });

  it('leaves the opted-out lead opted out', async () => {
    await POST(makeReq(VENDOR_PAYLOAD));

    const wroteConsent = mockLeadUpdate.mock.calls.some(
      (c: any[]) => c[0]?.data?.consentSms === true
    );
    expect(wroteConsent).toBe(false);
  });

  it('schedules no review for an opted-out lead', async () => {
    const body = await (await POST(makeReq(VENDOR_PAYLOAD))).json();

    expect(body.status).toBe('updated');
    expect(body.aiContactScheduled).toBe(false);

    const schedule = mockLeadUpdate.mock.calls.find(
      (c: any[]) => c[0]?.data?.nextReviewAt !== undefined
    );
    expect(schedule).toBeUndefined();
  });

  it('still notifies Slack, and says the consent was not re-granted', async () => {
    await POST(makeReq(VENDOR_PAYLOAD));

    expect(mockSlack).toHaveBeenCalledTimes(1);
    const notification = mockSlack.mock.calls[0][0];
    expect(notification.type).toBe('lead_updated');
    expect(notification.details).toContain('NOT rescheduled');
    expect(notification.details).toContain('SMS consent withdrawn');
    expect(notification.details).toContain('NOT re-granted');
  });

  it('grants consent on the CREATE path, where the vendor SMS-verified it', async () => {
    mockLeadFindFirst.mockResolvedValue(null);

    await POST(makeReq(VENDOR_PAYLOAD));

    expect(createdData().consentSms).toBe(true);
    expect(createdData().consentEmail).toBe(true);
    expect(createdData().consentCall).toBe(true);
  });

  it('names each withdrawn channel', () => {
    expect(
      withdrawnConsentChannels({ consentSms: true, consentEmail: true, consentCall: true })
    ).toEqual([]);
    expect(
      withdrawnConsentChannels({ consentSms: false, consentEmail: true, consentCall: true })
    ).toEqual(['SMS']);
    expect(
      withdrawnConsentChannels({ consentSms: false, consentEmail: false, consentCall: false })
    ).toEqual(['SMS', 'email', 'call']);
  });
});
