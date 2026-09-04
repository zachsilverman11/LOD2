/**
 * FinanceVine payload adapter
 *
 * FinanceVine posts leads in two different shapes and we must accept both:
 *
 *  1. The shape this route has always accepted — flat snake_case keys
 *     (`first_name`, `mortgage_type`, `age_55_plus`, ...), optionally wrapped
 *     in a Zapier `data` envelope.
 *  2. The vendor's actual documented schema — capitalized keys with spaces
 *     ("Mortgage Balance", "Property Address"), a numeric-looking `"55"` key,
 *     Python `None` values, and every financial figure as a string.
 *
 * Everything downstream of the route (segmentation, lead creation, the
 * re-submission path, Slack) reads ONLY the normalized result produced here.
 * The payload itself is never mutated — the route stores it verbatim.
 *
 * Nothing in this module logs a field VALUE. Schema drift is diagnosed from
 * key sets and from digit-masked format signatures (see `maskFormat`).
 */

import { formatPhoneE164 } from "./lead-segmentation";

/**
 * A financial figure as it arrived plus, when we could make sense of it, the
 * number it denotes. `raw` is kept unconditionally: an unparseable string is
 * data we still want on the record, not a reason to drop the field.
 */
export interface ParsedFigure {
  raw: string;
  parsed: number | null;
}

export interface FinanceVineNormalizedLead {
  /** Vendor's own unique lead id. Primary dedupe key when present. */
  vendorLeadId: string | null;

  firstName: string;
  lastName: string;
  email: string;
  /** E.164. The vendor sends bare 10-digit numbers. */
  phone: string;
  phoneRaw: string;

  mortgageType: string | null;
  primaryGoal: string | null;
  borrowerProfile: string | null;
  timeline: string | null;

  /** The "55" flag — their form only asks it on reverse-mortgage inquiries. */
  age55Plus: boolean | null;
  hasRealtor: boolean | null;
  openToSell: boolean | null;

  /** Canonical full province name, e.g. "Ontario". See `normalizeProvince`. */
  province: string | null;
  provinceRaw: string | null;

  zoning: string | null;
  propertyConditions: string | null;
  propertyAddress: string | null;

  propertyValue: ParsedFigure | null;
  mortgageBalance: ParsedFigure | null;
  equityTakeOut: ParsedFigure | null;
  downPayment: ParsedFigure | null;
  /** Always expressed as a percentage: "0.80", "80" and "80%" all give 80. */
  ltv: ParsedFigure | null;
  income: ParsedFigure | null;

  trustedFormCertUrl: string | null;
}

export type NormalizeResult =
  | { ok: true; lead: FinanceVineNormalizedLead }
  | { ok: false; error: string; problems: string[]; keys: string[] };

/**
 * Values that mean "the vendor has nothing for this field".
 *
 * `None` is Python leaking through their serializer. It will probably arrive
 * as JSON null, but the string "None" and an omitted key are both live
 * possibilities and all three mean the same thing. "N/A" is their form's own
 * "not asked / not answered" value.
 */
const ABSENT_TOKENS = new Set(["", "none", "null", "n/a", "na", "undefined", "-"]);

/** Narrow an arbitrary vendor value to a present string, or null. */
export function presentString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (ABSENT_TOKENS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/** First key that carries a present value. Vendor and snake_case keys mixed. */
function pick(data: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = presentString(data[key]);
    if (value !== null) return value;
  }
  return null;
}

/**
 * "Yes" / "No" / "N/A" → true / false / null.
 * Also accepts the booleans the existing snake_case shape sends.
 */
export function parseYesNo(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const str = presentString(value);
  if (str === null) return null;

  const lower = str.toLowerCase();
  if (["yes", "y", "true", "1"].includes(lower)) return true;
  if (["no", "n", "false", "0"].includes(lower)) return false;
  return null;
}

/**
 * Money as the vendor sends it. Whether "$" and thousands separators are
 * present is NOT confirmed, so parse tolerantly: strip currency furniture and
 * keep the number if what remains is one. The raw string is stored either way.
 */
export function parseMoney(value: unknown): ParsedFigure | null {
  const raw = presentString(value);
  if (raw === null) return null;

  const cleaned = raw.replace(/[$\s,]/g, "").replace(/(cad|usd)$/i, "");
  // Reject anything that isn't a bare number after cleaning ("50k", "approx
  // 400000", "300000-400000"): storing raw beats storing a wrong number.
  const parsed = /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;

  return { raw, parsed: Number.isFinite(parsed) ? parsed : null };
}

/**
 * LTV, always normalized to a percentage.
 *
 * The vendor has now CONFIRMED the convention in writing: LTV is always a
 * ratio. "0.80" means 80%; the first real lead's "1.10" means 110%.
 *
 *   "0.80" → 80
 *   "1.10" → 110    (an underwater property — the case that matters most here)
 *   "0.5"  → 50
 *   0.8    → 80     (a JSON number, not a string)
 *
 * There is deliberately NO "<= 1.0" gate any more. The previous version only
 * multiplied values at or below 1.0, so "0.85" became 85 while "1.10" stayed
 * 1.1 — a 100x error landing precisely on over-100% LTV, which is the
 * underwater case an alt/private book sees most often. See
 * notes/financevine-first-lead-audit.md §2.
 *
 * Two guards remain, and both are about catching a FUTURE format change
 * loudly rather than storing a wrong number quietly:
 *   - An explicit "%" is honoured as a percentage. A value that literally
 *     says "80%" is self-describing, and reading it as a ratio (8000%) would
 *     be perverse.
 *   - A result outside 0-200% is treated as unparseable. If the vendor ever
 *     switches back to sending percentages, "80" would ratio-expand to 8000,
 *     land outside the range, and be reported as UNPARSED with the raw string
 *     preserved — which is exactly the signal we would want.
 */
export function parseLtv(value: unknown): ParsedFigure | null {
  const raw = presentString(value);
  if (raw === null) return null;

  const isExplicitPercent = raw.includes("%");
  const cleaned = raw.replace(/[%\s,]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { raw, parsed: null };

  let parsed = Number(cleaned);
  // Every bare LTV is a ratio, per the vendor. No magnitude gate.
  if (!isExplicitPercent) parsed *= 100;

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 200) {
    return { raw, parsed: null };
  }
  return { raw, parsed: Math.round(parsed * 100) / 100 };
}

const PROVINCE_NAMES: Record<string, string> = {
  ab: "Alberta",
  alberta: "Alberta",
  bc: "British Columbia",
  "british columbia": "British Columbia",
  mb: "Manitoba",
  manitoba: "Manitoba",
  nb: "New Brunswick",
  "new brunswick": "New Brunswick",
  nl: "Newfoundland and Labrador",
  newfoundland: "Newfoundland and Labrador",
  "newfoundland and labrador": "Newfoundland and Labrador",
  ns: "Nova Scotia",
  "nova scotia": "Nova Scotia",
  nt: "Northwest Territories",
  "northwest territories": "Northwest Territories",
  nu: "Nunavut",
  nunavut: "Nunavut",
  on: "Ontario",
  ontario: "Ontario",
  pe: "Prince Edward Island",
  pei: "Prince Edward Island",
  "prince edward island": "Prince Edward Island",
  qc: "Quebec",
  quebec: "Quebec",
  "québec": "Quebec",
  sk: "Saskatchewan",
  saskatchewan: "Saskatchewan",
  yt: "Yukon",
  yukon: "Yukon",
};

/**
 * Normalize to the FULL province name.
 *
 * This is what the rest of the codebase expects, and the strict consumer sets
 * the bar: `getLocalTime` in lib/timezone-utils.ts keys a plain object on
 * "Ontario" / "British Columbia" and silently falls back to PST for anything
 * else — so a two-letter "ON" would put an Ontario lead three hours off and
 * break the 8am–9pm SMS guardrail. `getTimezoneForProvince` accepts either
 * form, so full names satisfy both.
 *
 * Unrecognized input is passed through untouched rather than dropped.
 */
export function normalizeProvince(value: unknown): string | null {
  const raw = presentString(value);
  if (raw === null) return null;

  // Dots are dropped, not spaced: "N.B." must reduce to "nb", not "n b".
  const key = raw.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (PROVINCE_NAMES[key]) return PROVINCE_NAMES[key];

  // "Ontario, Canada" / "ON, CA" — take the leading segment.
  const head = key.split(/\s*,\s*/)[0];
  return PROVINCE_NAMES[head] || raw;
}

/**
 * Replace every digit with 9 so a format can be logged without logging a
 * lead's figures: "$450,000" → "$999,999", "0.82" → "9.99".
 */
export function maskFormat(raw: string): string {
  return raw.replace(/\d/g, "9");
}

const TRUSTED_FORM_URL = /^https?:\/\/cert\.trustedform\.com\/\S+$/i;

/**
 * A TrustedForm certificate may or may not be included, under a key we have
 * not been told. Take any key that names one, else any value that looks like
 * a certificate URL. Absence is never an error.
 */
export function findTrustedFormCert(data: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, "");
    if (!normalizedKey.includes("trustedform") && !normalizedKey.includes("certurl")) {
      continue;
    }
    const str = presentString(value);
    if (str !== null) return str;
  }

  for (const value of Object.values(data)) {
    const str = presentString(value);
    if (str !== null && TRUSTED_FORM_URL.test(str)) return str;
  }
  return null;
}

const EMAIL_SHAPE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/**
 * A North American number, digits only. The vendor sends 10 digits with no
 * country code (e.g. 6478553592); the existing shape sends E.164.
 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return formatPhoneE164(digits);
  if (digits.length === 11 && digits.startsWith("1")) return formatPhoneE164(digits);
  return null;
}

/**
 * Unwrap a Zapier `data` envelope. Both shapes may arrive either way.
 */
export function unwrapPayload(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return null;
  }
  const outer = payload as Record<string, unknown>;
  const inner = outer.data;
  if (typeof inner === "object" && inner !== null && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return outer;
}

/** Key set only — never values. Safe to put in Vercel logs. */
export function payloadKeys(payload: unknown): string[] {
  const data = unwrapPayload(payload);
  return data ? Object.keys(data) : [];
}

/**
 * Normalize either payload shape into the single internal lead input.
 *
 * Returns a structured failure rather than throwing, so the route can answer
 * 4xx with the problem named and log the received key set.
 */
export function normalizeFinanceVinePayload(payload: unknown): NormalizeResult {
  const data = unwrapPayload(payload);
  if (!data) {
    return {
      ok: false,
      error: "Payload is not a JSON object",
      problems: ["payload must be a JSON object"],
      keys: [],
    };
  }

  const keys = Object.keys(data);
  const problems: string[] = [];

  const email = pick(data, ["email", "Email", "email_address", "Email Address"]);
  if (email === null) {
    problems.push("email is missing or empty");
  } else if (!EMAIL_SHAPE.test(email)) {
    problems.push("email is not a valid email address");
  }

  const phoneRaw = pick(data, ["phone", "Phone", "phone_number", "Phone Number"]);
  let phone: string | null = null;
  if (phoneRaw === null) {
    problems.push("phone is missing or empty");
  } else {
    phone = normalizePhone(phoneRaw);
    if (phone === null) {
      problems.push(
        "phone is not a 10-digit North American number (or 11 digits starting with 1)"
      );
    }
  }

  if (problems.length > 0) {
    return {
      ok: false,
      error: `Invalid FinanceVine payload: ${problems.join("; ")}`,
      problems,
      keys,
    };
  }

  const provinceRaw = pick(data, ["Province", "province", "State", "state"]);

  return {
    ok: true,
    lead: {
      vendorLeadId: pick(data, ["id", "lead_id", "Lead_ID", "leadId", "unique_id", "ID"]),

      firstName: pick(data, ["first_name", "firstName", "First Name"]) || "Unknown",
      lastName: pick(data, ["last_name", "lastName", "Last Name"]) || "",
      email: email as string,
      phone: phone as string,
      phoneRaw: phoneRaw as string,

      mortgageType: pick(data, [
        "mortgage_type",
        "Mortgage Type",
        "loan_type",
        "loanType",
      ]),
      primaryGoal: pick(data, ["primary_goal", "Primary Goal", "goal"]),
      borrowerProfile: pick(data, ["borrower_profile", "Borrower Profile"]),
      timeline: pick(data, ["timeline", "Timeline"]),

      age55Plus: firstDefinedFlag(data, ["55", "age_55_plus", "55+", "Age 55+"]),
      hasRealtor: firstDefinedFlag(data, ["has_realtor", "Has Realtor", "realtor"]),
      openToSell: firstDefinedFlag(data, [
        "open_to_sell",
        "open_to_selling",
        "Open to Sell",
        "Open to Selling",
      ]),

      province: normalizeProvince(provinceRaw),
      provinceRaw,

      zoning: pick(data, ["Zoning", "zoning"]),
      propertyConditions: pick(data, ["Property Conditions", "property_conditions"]),
      propertyAddress: pick(data, ["Property Address", "property_address", "address"]),

      propertyValue: parseMoney(firstPresent(data, ["property_value", "Property Value"])),
      mortgageBalance: parseMoney(
        firstPresent(data, ["Mortgage Balance", "mortgage_balance", "balance"])
      ),
      equityTakeOut: parseMoney(
        firstPresent(data, ["Equity Take Out", "equity_take_out", "Equity Take-Out"])
      ),
      downPayment: parseMoney(
        firstPresent(data, ["Down Pay", "down_pay", "down_payment", "Down Payment"])
      ),
      ltv: parseLtv(firstPresent(data, ["LTV", "ltv", "ltv_percent", "LTV%"])),
      income: parseMoney(firstPresent(data, ["Income", "income", "annual_income"])),

      trustedFormCertUrl: findTrustedFormCert(data),
    },
  };
}

/** Raw value of the first key that is present at all (pre-parse). */
function firstPresent(data: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (presentString(data[key]) !== null) return data[key];
  }
  return null;
}

function firstDefinedFlag(
  data: Record<string, unknown>,
  keys: string[]
): boolean | null {
  for (const key of keys) {
    const flag = parseYesNo(data[key]);
    if (flag !== null) return flag;
  }
  return null;
}

/**
 * The snake_case view of a normalized lead, for the two consumers that read
 * loose keys rather than typed fields: `deriveLeadSegment` and everything that
 * reaches into `lead.rawData` (province for timezone, goal for prompts).
 *
 * The route spreads this OVER the payload as received, so the vendor's own
 * keys survive untouched alongside canonical ones.
 */
export function toRawDataOverlay(
  lead: FinanceVineNormalizedLead
): Record<string, unknown> {
  const overlay: Record<string, unknown> = {
    first_name: lead.firstName,
    last_name: lead.lastName,
    email: lead.email,
    phone: lead.phone,
  };

  const set = (key: string, value: unknown) => {
    if (value !== null && value !== undefined) overlay[key] = value;
  };

  set("vendor_lead_id", lead.vendorLeadId);
  set("mortgage_type", lead.mortgageType);
  set("primary_goal", lead.primaryGoal);
  set("borrower_profile", lead.borrowerProfile);
  set("timeline", lead.timeline);
  set("age_55_plus", lead.age55Plus);
  set("has_realtor", lead.hasRealtor);
  set("open_to_sell", lead.openToSell);
  set("province", lead.province);
  set("zoning", lead.zoning);
  set("property_conditions", lead.propertyConditions);
  set("property_address", lead.propertyAddress);
  set("trusted_form_cert_url", lead.trustedFormCertUrl);

  const figures: Array<[string, ParsedFigure | null]> = [
    ["property_value", lead.propertyValue],
    ["mortgage_balance", lead.mortgageBalance],
    ["equity_take_out", lead.equityTakeOut],
    ["down_payment", lead.downPayment],
    ["ltv_percent", lead.ltv],
    ["income", lead.income],
  ];

  for (const [key, figure] of figures) {
    if (!figure) continue;
    // Both forms, always: the parsed number when we could read it, and the
    // string exactly as the vendor sent it either way.
    overlay[`${key}_raw`] = figure.raw;
    if (figure.parsed !== null) overlay[key] = figure.parsed;
  }

  return overlay;
}

/**
 * Segmentation input. deriveLeadSegment/deriveIntent read loose snake_case
 * keys; the vendor's product and goal strings are passed through verbatim so
 * the natural-language aliases can do their work — nothing is enum-matched
 * here, because the vendor's value set is not enumerated.
 */
export function toSegmentationInput(
  lead: FinanceVineNormalizedLead
): Record<string, unknown> {
  return {
    mortgage_type: lead.mortgageType,
    primary_goal: lead.primaryGoal,
    borrower_profile: lead.borrowerProfile,
    // The "55" flag reaches deriveIntent here. Their form only asks it on
    // reverse-mortgage inquiries, so "Yes" is a reverse signal on its own —
    // it must catch a reverse lead even when the product string is one we
    // have never seen.
    age_55_plus: lead.age55Plus === true,
    timeline: lead.timeline,
  };
}

/**
 * One-line, value-free log of the financial formats seen on this payload, so
 * an unconfirmed format ("80%" vs "0.80", "$450,000" vs "450000") can be
 * confirmed from Vercel logs. Digits are masked; only shape survives.
 */
export function describeFigureFormats(lead: FinanceVineNormalizedLead): string {
  const entries: Array<[string, ParsedFigure | null]> = [
    ["property_value", lead.propertyValue],
    ["mortgage_balance", lead.mortgageBalance],
    ["equity_take_out", lead.equityTakeOut],
    ["down_pay", lead.downPayment],
    ["ltv", lead.ltv],
    ["income", lead.income],
  ];

  const parts = entries
    .filter(([, figure]) => figure !== null)
    .map(
      ([name, figure]) =>
        `${name}=${maskFormat(figure!.raw)}${figure!.parsed === null ? " (UNPARSED)" : ""}`
    );

  return parts.length > 0 ? parts.join(" ") : "none present";
}
