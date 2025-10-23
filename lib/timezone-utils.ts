/**
 * Timezone utilities for Canadian provinces
 * Used to enforce 8am-9pm SMS hours in lead's local time
 */

export function getLocalTime(province: string): Date {
  const now = new Date();

  // Map Canadian provinces to timezones (UTC offsets)
  const timezoneOffsets: Record<string, number> = {
    'British Columbia': -8,  // PST
    'Alberta': -7,           // MST
    'Saskatchewan': -6,      // CST (no DST)
    'Manitoba': -6,          // CST
    'Ontario': -5,           // EST
    'Quebec': -5,            // EST
    'New Brunswick': -4,     // AST
    'Nova Scotia': -4,       // AST
    'Prince Edward Island': -4,  // AST
    'Newfoundland and Labrador': -3.5,  // NST
  };

  const offset = timezoneOffsets[province] || -8; // Default to PST (BC)

  // Adjust for DST (rough estimate - add 1 hour from March-November)
  // Saskatchewan doesn't observe DST
  const month = now.getMonth();
  const isDST = month >= 2 && month <= 10; // March (2) to November (10)
  const finalOffset = province === 'Saskatchewan' ? offset : offset + (isDST ? 1 : 0);

  // Calculate local time
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const localTime = new Date(utc + (3600000 * finalOffset));

  return localTime;
}

/**
 * Check if current time is within acceptable SMS hours (8am-9pm local)
 */
export function isWithinSMSHours(province: string): boolean {
  const localTime = getLocalTime(province);
  const hour = localTime.getHours();

  return hour >= 8 && hour < 21;
}

/**
 * Get formatted local time string for logging
 */
export function getLocalTimeString(province: string): string {
  const localTime = getLocalTime(province);
  return localTime.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });
}

/**
 * Calculate the next 8 AM in the lead's local timezone
 * Used for smart retry scheduling when blocked outside SMS hours
 */
export function getNext8AM(province: string): Date {
  const localTime = getLocalTime(province);
  const hour = localTime.getHours();

  // Create a date for 8 AM today in local time
  const next8AM = new Date(localTime);
  next8AM.setHours(8, 0, 0, 0);

  // If it's already past 8 AM today (or we're in the 8am-9pm window),
  // schedule for 8 AM tomorrow
  if (hour >= 8) {
    next8AM.setDate(next8AM.getDate() + 1);
  }

  // Convert back to UTC for database storage
  // We need to reverse the timezone offset calculation
  const timezoneOffsets: Record<string, number> = {
    'British Columbia': -8,
    'Alberta': -7,
    'Saskatchewan': -6,
    'Manitoba': -6,
    'Ontario': -5,
    'Quebec': -5,
    'New Brunswick': -4,
    'Nova Scotia': -4,
    'Prince Edward Island': -4,
    'Newfoundland and Labrador': -3.5,
  };

  const offset = timezoneOffsets[province] || -8;
  const month = next8AM.getMonth();
  const isDST = month >= 2 && month <= 10;
  const finalOffset = province === 'Saskatchewan' ? offset : offset + (isDST ? 1 : 0);

  // Convert local 8 AM back to UTC
  const utcTime = next8AM.getTime() - (3600000 * finalOffset) + (new Date().getTimezoneOffset() * 60000);

  return new Date(utcTime);
}
