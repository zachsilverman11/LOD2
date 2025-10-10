/**
 * Smart name correction utility
 * Detects and fixes reversed first/last names from lead forms
 */

// Common surnames that are often mistakenly entered as first names
const COMMON_SURNAMES = new Set([
  'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis',
  'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson',
  'thomas', 'taylor', 'moore', 'jackson', 'martin', 'lee', 'thompson', 'white',
  'harris', 'clark', 'lewis', 'robinson', 'walker', 'young', 'allen', 'king',
  'wright', 'scott', 'torres', 'nguyen', 'hill', 'flores', 'green', 'adams',
  'nelson', 'baker', 'hall', 'rivera', 'campbell', 'mitchell', 'carter', 'roberts',
  'phillips', 'evans', 'turner', 'diaz', 'parker', 'cruz', 'edwards', 'collins',
  'reyes', 'stewart', 'morris', 'murphy', 'cook', 'rogers', 'morgan', 'peterson',
  'cooper', 'reed', 'bailey', 'bell', 'gomez', 'kelly', 'howard', 'ward',
  'cox', 'richardson', 'wood', 'watson', 'brooks', 'bennett', 'gray', 'james',
  'schopf', 'schmidt', 'schneider', 'fischer', 'weber', 'meyer', 'wagner',
  'becker', 'schulz', 'hoffmann', 'koch', 'richter', 'klein', 'wolf', 'neumann'
]);

// Common first names that are clearly given names
const COMMON_FIRST_NAMES = new Set([
  'michael', 'christopher', 'matthew', 'joshua', 'david', 'james', 'daniel',
  'robert', 'john', 'joseph', 'jason', 'justin', 'andrew', 'ryan', 'william',
  'brian', 'brandon', 'jonathan', 'nicholas', 'anthony', 'kevin', 'eric',
  'steven', 'timothy', 'jeffrey', 'thomas', 'richard', 'charles', 'mark',
  'jennifer', 'jessica', 'ashley', 'sarah', 'amanda', 'melissa', 'michelle',
  'kimberly', 'lisa', 'angela', 'heather', 'stephanie', 'nicole', 'elizabeth',
  'rebecca', 'laura', 'christine', 'rachel', 'catherine', 'amy', 'emily',
  'emma', 'olivia', 'sophia', 'isabella', 'mia', 'charlotte', 'amelia',
  'harper', 'evelyn', 'abigail', 'ella', 'scarlett', 'grace', 'chloe',
  'victoria', 'riley', 'aria', 'lily', 'aubrey', 'zoey', 'hannah', 'liam',
  'noah', 'oliver', 'elijah', 'lucas', 'mason', 'logan', 'alexander', 'ethan',
  'jacob', 'aiden', 'jack', 'luke', 'jayden', 'wyatt', 'owen', 'gabriel'
]);

interface NameCorrectionResult {
  firstName: string;
  lastName: string;
  wasCorrected: boolean;
  reason?: string;
  originalFirstName?: string;
  originalLastName?: string;
}

/**
 * Detect if names are likely reversed and correct them
 */
export function correctNames(
  firstName: string,
  lastName: string
): NameCorrectionResult {
  // Normalize for checking
  const firstLower = firstName.toLowerCase().trim();
  const lastLower = lastName.toLowerCase().trim();

  // Skip correction if either field is empty
  if (!firstName || !lastName) {
    return { firstName, lastName, wasCorrected: false };
  }

  // Detection logic
  let shouldSwap = false;
  let reason = '';

  // Check 1: firstName is a common surname AND lastName is a common first name
  if (COMMON_SURNAMES.has(firstLower) && COMMON_FIRST_NAMES.has(lastLower)) {
    shouldSwap = true;
    reason = 'firstName matches common surname pattern, lastName matches common first name';
  }
  // Check 2: firstName is all lowercase/no capital AND lastName starts with capital
  else if (
    firstLower === firstName && // firstName is all lowercase
    lastName.charAt(0) === lastName.charAt(0).toUpperCase() &&
    lastName.slice(1) === lastName.slice(1).toLowerCase() // lastName is properly capitalized
  ) {
    shouldSwap = true;
    reason = 'firstName is all lowercase, lastName is properly capitalized';
  }
  // Check 3: firstName is a common surname (even if lastName isn't in our list)
  else if (COMMON_SURNAMES.has(firstLower) && lastLower.length >= 3) {
    shouldSwap = true;
    reason = 'firstName matches common surname pattern';
  }

  if (shouldSwap) {
    return {
      firstName: capitalize(lastName),
      lastName: capitalize(firstName),
      wasCorrected: true,
      reason,
      originalFirstName: firstName,
      originalLastName: lastName,
    };
  }

  // No correction needed
  return {
    firstName: capitalize(firstName),
    lastName: capitalize(lastName),
    wasCorrected: false,
  };
}

/**
 * Properly capitalize a name (handle all-caps, all-lowercase, etc.)
 */
function capitalize(name: string): string {
  if (!name) return '';

  // Split on spaces and hyphens to handle compound names
  return name
    .split(/(\s|-)/g)
    .map((part) => {
      if (part === ' ' || part === '-') return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}
