/**
 * Cal.com API integration
 * Docs: https://cal.com/docs/api-reference
 */

const CALCOM_API_URL = "https://api.cal.com/v1";

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

/**
 * Create a new booking in Cal.com
 */
export async function createCalComBooking(
  params: CreateBookingParams
): Promise<CalComBooking> {
  const apiKey = process.env.CALCOM_API_KEY;
  if (!apiKey) {
    throw new Error("CALCOM_API_KEY is not set");
  }

  const response = await fetch(`${CALCOM_API_URL}/bookings`, {
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
 * Get available time slots for an event type
 */
export async function getAvailableSlots(
  eventTypeId: number,
  startTime: string,
  endTime: string,
  timeZone: string = "America/Toronto"
) {
  const apiKey = process.env.CALCOM_API_KEY;
  if (!apiKey) {
    throw new Error("CALCOM_API_KEY is not set");
  }

  const params = new URLSearchParams({
    eventTypeId: eventTypeId.toString(),
    startTime,
    endTime,
    timeZone,
  });

  const response = await fetch(`${CALCOM_API_URL}/slots?${params}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
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
  const apiKey = process.env.CALCOM_API_KEY;
  if (!apiKey) {
    throw new Error("CALCOM_API_KEY is not set");
  }

  const response = await fetch(`${CALCOM_API_URL}/bookings/${bookingId}/cancel`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ reason }),
  });

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
  const apiKey = process.env.CALCOM_API_KEY;
  if (!apiKey) {
    throw new Error("CALCOM_API_KEY is not set");
  }

  const response = await fetch(`${CALCOM_API_URL}/bookings/${bookingUid}/reschedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ start: newStart, reason }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cal.com API error: ${error}`);
  }

  return response.json();
}
