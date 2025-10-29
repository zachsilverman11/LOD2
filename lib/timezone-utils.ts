/**
 * Timezone utilities for Canadian provinces
 * Used to enforce 8am-9pm SMS hours in lead's local time
 */

export function getLocalTime(province: string): Date {
  const now = new Date();

  // Map Canadian provinces to timezones (UTC offsets in hours)
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

  // Adjust for DST (add 1 hour from second Sunday of March to first Sunday of November)
  // Saskatchewan doesn't observe DST
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  // DST is active from March to early November in North America
  // Simple approximation: March 10 - November 3
  let isDST = false;
  if (month > 2 && month < 10) {
    // April through October - always DST
    isDST = true;
  } else if (month === 2 && day >= 10) {
    // Mid-March onward - usually DST
    isDST = true;
  } else if (month === 10 && day < 3) {
    // Early November - still DST
    isDST = true;
  }

  const finalOffset = province === 'Saskatchewan' ? offset : offset + (isDST ? 1 : 0);

  // Calculate local time from UTC
  // Get current UTC time in milliseconds
  const utcTime = now.getTime();

  // Apply timezone offset (convert hours to milliseconds)
  const localTime = new Date(utcTime + (finalOffset * 3600000));

  return localTime;
}

/**
 * Check if current time is within acceptable SMS hours (8am-9pm local)
 */
export function isWithinSMSHours(province: string): boolean {
  const localTime = getLocalTime(province);
  const hour = localTime.getUTCHours(); // Use UTC hours since localTime is stored in UTC

  return hour >= 8 && hour < 21;
}

/**
 * Get formatted local time string for logging
 */
export function getLocalTimeString(province: string): string {
  const localTime = getLocalTime(province);
  const hour = localTime.getUTCHours();
  const minute = localTime.getUTCMinutes();
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12; // Convert 0 to 12, keep 1-11 as is

  // Determine timezone abbreviation
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
  const month = localTime.getUTCMonth();
  const day = localTime.getUTCDate();
  let isDST = false;
  if (month > 2 && month < 10) {
    isDST = true;
  } else if (month === 2 && day >= 10) {
    isDST = true;
  } else if (month === 10 && day < 3) {
    isDST = true;
  }

  const timezoneName = province === 'British Columbia' ? (isDST ? 'PDT' : 'PST') :
                       province === 'Alberta' ? (isDST ? 'MDT' : 'MST') :
                       province === 'Saskatchewan' ? 'CST' :
                       province === 'Ontario' || province === 'Quebec' ? (isDST ? 'EDT' : 'EST') :
                       (isDST ? 'ADT' : 'AST');

  return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm} ${timezoneName}`;
}

/**
 * Calculate the next 8 AM in the lead's local timezone
 * Used for smart retry scheduling when blocked outside SMS hours
 */
export function getNext8AM(province: string): Date {
  const localTime = getLocalTime(province);
  const hour = localTime.getUTCHours();

  // Create a date for 8 AM today in local time
  const next8AM = new Date(localTime);
  next8AM.setUTCHours(8, 0, 0, 0);

  // If it's already past 8 AM today (or we're in the 8am-9pm window),
  // schedule for 8 AM tomorrow
  if (hour >= 8) {
    next8AM.setUTCDate(next8AM.getUTCDate() + 1);
  }

  // Convert back to UTC for database storage
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

  // Check if DST is active for the target date
  const month = next8AM.getUTCMonth();
  const day = next8AM.getUTCDate();
  let isDST = false;
  if (month > 2 && month < 10) {
    isDST = true;
  } else if (month === 2 && day >= 10) {
    isDST = true;
  } else if (month === 10 && day < 3) {
    isDST = true;
  }

  const finalOffset = province === 'Saskatchewan' ? offset : offset + (isDST ? 1 : 0);

  // Convert local 8 AM back to UTC
  // next8AM is currently in "local time" representation, subtract the offset to get UTC
  const utcTime = next8AM.getTime() - (finalOffset * 3600000);

  return new Date(utcTime);
}
