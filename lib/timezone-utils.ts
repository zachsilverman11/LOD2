import { getTimezoneForProvince } from './calcom';

/**
 * Get local time in a specific timezone
 */
export function getLocalTime(province: string): Date {
  const timezone = getTimezoneForProvince(province);
  const now = new Date();
  
  // Create a formatter for the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;
  const hour = parts.find(p => p.type === 'hour')!.value;
  const minute = parts.find(p => p.type === 'minute')!.value;
  const second = parts.find(p => p.type === 'second')!.value;

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
}

/**
 * Get local time string in a specific timezone
 */
export function getLocalTimeString(province: string): string {
  const timezone = getTimezoneForProvince(province);
  const now = new Date();
  
  return now.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });
}

/**
 * Get next 8 AM in lead's timezone for scheduling
 */
export function getNext8AM(province: string): Date {
  const timezone = getTimezoneForProvince(province);
  const now = new Date();

  // Get current time in lead's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')!.value);
  const month = parseInt(parts.find(p => p.type === 'month')!.value);
  const day = parseInt(parts.find(p => p.type === 'day')!.value);
  const hour = parseInt(parts.find(p => p.type === 'hour')!.value);

  // Create 8 AM today in their timezone
  let targetDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T08:00:00`);

  // If it's already past 8 AM in their timezone, go to next day
  if (hour >= 8) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  // Convert back to UTC for storage
  const targetInTZ = new Date(targetDate.toLocaleString('en-US', { timeZone: timezone }));
  const targetInUTC = new Date(targetDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offset = targetInUTC.getTime() - targetInTZ.getTime();
  
  return new Date(targetDate.getTime() + offset);
}

/**
 * Get relative date phrase for a past timestamp in the lead's timezone
 * Examples: "today", "yesterday", "earlier today", "this morning", "this afternoon"
 * 
 * @param eventTime - The timestamp of the event (e.g., when cancellation happened)
 * @param leadTimezone - The lead's timezone (e.g., "America/Vancouver")
 * @param referenceTime - Optional reference time (defaults to now)
 * @returns A human-readable relative date phrase
 */
export function getRelativeDatePhrase(
  eventTime: Date,
  leadTimezone: string,
  referenceTime: Date = new Date()
): string {
  // Get calendar dates in the lead's timezone
  const eventDateStr = eventTime.toLocaleDateString('en-US', {
    timeZone: leadTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const referenceDateStr = referenceTime.toLocaleDateString('en-US', {
    timeZone: leadTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Get hour for time-of-day context
  const eventHour = parseInt(
    eventTime.toLocaleTimeString('en-US', {
      timeZone: leadTimezone,
      hour: '2-digit',
      hour12: false,
    }).split(':')[0]
  );

  // Same calendar day
  if (eventDateStr === referenceDateStr) {
    // More specific if it was earlier in the day
    if (eventHour < 12) {
      return 'this morning';
    } else if (eventHour < 17) {
      return 'this afternoon';
    } else {
      return 'earlier today';
    }
  }

  // Yesterday
  const yesterday = new Date(referenceTime);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDateStr = yesterday.toLocaleDateString('en-US', {
    timeZone: leadTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  if (eventDateStr === yesterdayDateStr) {
    return 'yesterday';
  }

  // 2-6 days ago
  const daysDiff = Math.floor(
    (referenceTime.getTime() - eventTime.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff === 2) return '2 days ago';
  if (daysDiff === 3) return '3 days ago';
  if (daysDiff >= 4 && daysDiff <= 6) return `${daysDiff} days ago`;

  // A week or more
  if (daysDiff === 7) return 'last week';
  if (daysDiff < 14) return 'over a week ago';
  if (daysDiff < 30) return 'a few weeks ago';

  return 'last month';
}
