/**
 * Cal.com API integration — v2
 * Docs: https://cal.com/docs/api-reference/v2
 *
 * Supports:
 * - Get available time slots
 * - Create direct bookings (Holly can book on behalf of leads)
 * - Cancel / reschedule bookings (existing functionality)
 *
 * Auth: Bearer token via CALCOM_API_KEY env var
 * API version header: cal-api-version (default 2024-09-04)
 */

const CALCOM_API_V2_URL = "https://api.cal.com/v2";
const CALCOM_API_VERSION = process.env.CALCOM_API_VERSION || "2024-09-04";

// ─── V1 base URL kept for backward-compatible cancel/reschedule if needed ───
const CALCOM_API_V1_URL = "https://api.cal.com/v1";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalComBooking {
  id: number;
  uid: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees: {
    name: string;
    email: string;
    timeZone: string;
  }[];
  metadata?: Record<string, unknown>;
}

export interface CreateBookingParams {
  eventTypeId: number;
  start: string; // ISO 8601 format
  responses: {
    name: string;
    email: string;
    guests?: string[];
    notes?: string;
  };
  timeZone?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface TimeSlot {
  /** ISO 8601 UTC start time */
  time: string;
  /** Human-friendly formatted time in the lead's timezone */
  displayTime: string;
}

export interface DirectBookingParams {
  eventTypeId: number;
  /** ISO 8601 UTC start time */
  start: string;
  attendee: {
    name: string;
    email: string;
    timeZone: string;
  };
  metadata?: Record<string, unknown>;
}

export interface BookingConfirmation {
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
  attendeeName: string;
  attendeeEmail: string;
  status: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const apiKey = process.env.CALCOM_API_KEY;
  if (!apiKey) {
    throw new Error("CALCOM_API_KEY is not set");
  }
  return apiKey;
}

function getEventTypeId(): number {
  const id = process.env.CALCOM_EVENT_TYPE_ID;
  if (!id) {
    throw new Error("CALCOM_EVENT_TYPE_ID is not set");
  }
  return parseInt(id, 10);
}

/** Standard v2 headers */
function v2Headers(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "cal-api-version": CALCOM_API_VERSION,
  };
}

/**
 * Determine timezone for a lead based on province.
 * BC → America/Vancouver, AB → America/Edmonton, default → America/Vancouver
 */
export function getTimezoneForProvince(province?: string): string {
  if (!province) return "America/Vancouver";
  const p = province.toUpperCase().trim();
  switch (p) {
    case "AB":
    case "ALBERTA":
      return "America/Edmonton";
    case "SK":
    case "SASKATCHEWAN":
      return "America/Regina";
    case "MB":
    case "MANITOBA":
      return "America/Winnipeg";
    case "ON":
    case "ONTARIO":
      return "America/Toronto";
    case "QC":
    case "QUEBEC":
      return "America/Toronto";
    case "NS":
    case "NOVA SCOTIA":
    case "NB":
    case "NEW BRUNSWICK":
    case "PE":
    case "PEI":
    case "PRINCE EDWARD ISLAND":
      return "America/Halifax";
    case "NL":
    case "NEWFOUNDLAND":
    case "NEWFOUNDLAND AND LABRADOR":
      return "America/St_Johns";
    default:
      return "America/Vancouver"; // Default for BC and others
  }
}

// ─── V2: Available Slots ────────────────────────────────────────────────────

/**
 * Get available time slots for a given date range (Cal.com v2).
 *
 * @param startDate - Start date (ISO 8601 date or datetime)
 * @param endDate - End date (ISO 8601 date or datetime)
 * @param timeZone - IANA timezone for formatting display times
 * @param eventTypeId - Cal.com event type ID (defaults to CALCOM_EVENT_TYPE_ID env)
 * @returns Array of available time slots with display-friendly formatting
 */
export async function getAvailableSlots(
  startDate: string,
  endDate: string,
  timeZone: string = "America/Vancouver",
  eventTypeId?: number
): Promise<TimeSlot[]> {
  const apiKey = getApiKey();
  const etId = eventTypeId || getEventTypeId();

  const params = new URLSearchParams({
    eventTypeId: etId.toString(),
    start: startDate,
    end: endDate,
    timeZone,
  });

  const response = await fetch(`${CALCOM_API_V2_URL}/slots?${params}`, {
    headers: v2Headers(apiKey),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Cal.com v2] getAvailableSlots error ${response.status}:`, errorText);
    throw new Error(`Cal.com API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // v2 slots response: { status: "success", data: { slots: { "YYYY-MM-DD": [{ time: "..." }] } } }
  const slotsMap: Record<string, Array<{ time: string }>> = data?.data?.slots || {};

  const slots: TimeSlot[] = [];

  for (const [, daySlots] of Object.entries(slotsMap)) {
    for (const slot of daySlots) {
      const slotDate = new Date(slot.time);
      const displayTime = slotDate.toLocaleString("en-US", {
        timeZone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      slots.push({
        time: slot.time,
        displayTime,
      });
    }
  }

  return slots;
}

/**
 * Get available slots for a specific day, formatted for Holly to present to leads.
 * Returns a human-friendly summary string.
 */
export async function getAvailableSlotsForDay(
  date: string,
  timeZone: string = "America/Vancouver"
): Promise<{ slots: TimeSlot[]; summary: string }> {
  // Build start/end for the full day
  const startDate = date; // e.g. "2025-01-15"
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const endDate = nextDay.toISOString().split("T")[0];

  const slots = await getAvailableSlots(startDate, endDate, timeZone);

  if (slots.length === 0) {
    return {
      slots: [],
      summary: `No available slots on ${date}.`,
    };
  }

  const timeStrings = slots.map((s) => s.displayTime).join(", ");
  return {
    slots,
    summary: `Available times on ${date}: ${timeStrings}`,
  };
}

// ─── V2: Direct Booking ─────────────────────────────────────────────────────

/**
 * Create a direct booking via Cal.com v2 API.
 * Holly uses this to book appointments on behalf of leads.
 *
 * @returns Booking confirmation details
 */
export async function createDirectBooking(
  params: DirectBookingParams
): Promise<BookingConfirmation> {
  const apiKey = getApiKey();

  const body = {
    eventTypeId: params.eventTypeId || getEventTypeId(),
    start: params.start,
    attendee: {
      name: params.attendee.name,
      email: params.attendee.email,
      timeZone: params.attendee.timeZone,
    },
    metadata: params.metadata || {},
  };

  const response = await fetch(`${CALCOM_API_V2_URL}/bookings`, {
    method: "POST",
    headers: v2Headers(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Cal.com v2] createDirectBooking error ${response.status}:`, errorText);
    throw new Error(`Cal.com booking error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const booking = data?.data;

  return {
    uid: booking?.uid || booking?.id?.toString() || "unknown",
    title: booking?.title || "Discovery Call",
    startTime: booking?.startTime || booking?.start || params.start,
    endTime: booking?.endTime || booking?.end || "",
    attendeeName: params.attendee.name,
    attendeeEmail: params.attendee.email,
    status: booking?.status || "ACCEPTED",
  };
}

// ─── Legacy v1 functions (preserved for backward compatibility) ─────────────

/**
 * Create a new booking in Cal.com (v1 — legacy)
 * @deprecated Use createDirectBooking (v2) instead
 */
export async function createCalComBooking(
  params: CreateBookingParams
): Promise<CalComBooking> {
  const apiKey = getApiKey();

  const response = await fetch(`${CALCOM_API_V1_URL}/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cal.com API error: ${error}`);
  }

  return response.json();
}

/**
 * Cancel a booking
 */
export async function cancelCalComBooking(
  bookingId: number,
  reason?: string
): Promise<void> {
  const apiKey = getApiKey();

  const response = await fetch(
    `${CALCOM_API_V1_URL}/bookings/${bookingId}/cancel`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ reason }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cal.com API error: ${error}`);
  }
}

/**
 * Reschedule a booking
 */
export async function rescheduleCalComBooking(
  bookingUid: string,
  newStart: string,
  reason?: string
): Promise<CalComBooking> {
  const apiKey = getApiKey();

  const response = await fetch(
    `${CALCOM_API_V1_URL}/bookings/${bookingUid}/reschedule`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ start: newStart, reason }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cal.com API error: ${error}`);
  }

  return response.json();
}
