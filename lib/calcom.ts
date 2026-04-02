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
// Different Cal.com v2 API versions are required per endpoint:
// - Slots endpoint works with 2024-09-04
// - Bookings endpoint requires 2024-08-13
const CALCOM_API_VERSION_SLOTS = "2024-09-04";
const CALCOM_API_VERSION_BOOKINGS = "2024-08-13";

// ─── Public booking endpoint (same as cal.com booking page — no auth needed) ───
const CALCOM_PUBLIC_BOOKING_URL = "https://app.cal.com/api/book/event";


// ─── Known event type ID (discovered from public booking page) ───
const DEFAULT_EVENT_TYPE_ID = 3298267;

// ─── Types ──────────────────────────────────────────────────────────────────

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
  id?: number;
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
  attendeeName: string;
  attendeeEmail: string;
  status: string;
  meetingUrl?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

/** Default horizon for Holly slot pre-fetch (sync prompts with `getAvailabilityWindow()`). */
export const CALCOM_AVAILABILITY_DEFAULT_DAYS_AHEAD = 21;

/**
 * Single source of truth for Cal.com slots query range.
 * Returns ISO 8601 datetimes accepted by `getAvailableSlots` (same format both Holly paths use).
 */
export function getAvailabilityWindow(
  daysAhead: number = CALCOM_AVAILABILITY_DEFAULT_DAYS_AHEAD
): { start: string; end: string } {
  const start = new Date();
  const end = new Date(start.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

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
  // Use slug-based approach (no auth required) as primary, fall back to eventTypeId
  const params = new URLSearchParams({
    start: startDate,
    end: endDate,
    timeZone,
  });

  // Prefer slug-based lookup (no API key needed — works like the public booking page)
  const teamSlug = process.env.CALCOM_TEAM_SLUG || "inspired-mortgage";
  const eventSlug = process.env.CALCOM_EVENT_SLUG || "mortgage-discovery-call";

  if (!eventTypeId) {
    params.set("teamSlug", teamSlug);
    params.set("eventTypeSlug", eventSlug);
  } else {
    params.set("eventTypeId", eventTypeId.toString());
  }

  const response = await fetch(`${CALCOM_API_V2_URL}/slots?${params}`, {
    headers: {
      "cal-api-version": CALCOM_API_VERSION_SLOTS,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Cal.com v2] getAvailableSlots error ${response.status}:`, errorText);
    throw new Error(`Cal.com API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // v2 slots response: { status: "success", data: { "YYYY-MM-DD": [{ start: "..." }] } }
  // Note: response shape is data.data (outer = fetch json, inner = cal response)
  const slotsMap: Record<string, Array<{ start?: string; time?: string }>> = data?.data || {};

  const slots: TimeSlot[] = [];

  for (const [, daySlots] of Object.entries(slotsMap)) {
    if (!Array.isArray(daySlots)) continue;
    for (const slot of daySlots) {
      const slotTime = slot.start || slot.time;
      if (!slotTime) continue;
      const slotDate = new Date(slotTime);
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
        time: slotTime,
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
  // IMPORTANT: Do NOT send an Authorization header here.
  // The team event type (round-robin) is public — no auth needed.
  // When we authenticated with Zach's personal API key, Cal.com treated him
  // as the organizer and routed every booking to his personal calendar instead
  // of round-robin-ing to Greg / Jakub.  Unauthenticated v2 bookings respect
  // the team's scheduling type correctly.
  const eventTypeId = params.eventTypeId || parseInt(process.env.CALCOM_EVENT_TYPE_ID || "") || DEFAULT_EVENT_TYPE_ID;

  const body = {
    eventTypeId,
    start: params.start,
    attendee: {
      name: params.attendee.name,
      email: params.attendee.email,
      timeZone: params.attendee.timeZone,
      language: "en",
    },
    metadata: {
      source: "holly-direct-booking",
      ...(params.metadata || {}),
    },
  };

  const response = await fetch(`${CALCOM_API_V2_URL}/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cal-api-version": CALCOM_API_VERSION_BOOKINGS,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Cal.com] createDirectBooking error ${response.status}:`, errorText);
    throw new Error(`Cal.com booking error (${response.status}): ${errorText}`);
  }

  const responseBody = await response.json();
  const booking = responseBody?.data || responseBody?.booking || responseBody;
  const bookingId =
    typeof booking?.id === "number"
      ? booking.id
      : typeof booking?.id === "string"
      ? parseInt(booking.id, 10)
      : undefined;

  return {
    id: Number.isFinite(bookingId) ? bookingId : undefined,
    uid: booking?.uid || booking?.id?.toString() || "unknown",
    title: booking?.title || "Mortgage Discovery Call",
    startTime: booking?.startTime || booking?.start || params.start,
    endTime: booking?.endTime || booking?.end || "",
    attendeeName: params.attendee.name,
    attendeeEmail: params.attendee.email,
    status: booking?.status || "ACCEPTED",
    meetingUrl:
      booking?.meetingUrl ||
      booking?.location ||
      booking?.references?.meetingUrl ||
      undefined,
  };
}

