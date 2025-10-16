/**
 * TEST: Date parsing fix for DD/MM/YYYY format
 */

import { format } from "date-fns";

function formatFieldValue(value: string): string {
  try {
    let dateValue = value;

    // Handle DD/MM/YYYY format from Leads on Demand (e.g., "12/10/2025 02:44 PM")
    // Convert to MM/DD/YYYY format for JS Date parser
    const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.+)$/;
    const match = String(value).match(ddmmyyyyPattern);
    if (match) {
      const [, day, month, year, time] = match;
      console.log(`  Detected DD/MM/YYYY format:`);
      console.log(`    Day: ${day}, Month: ${month}, Year: ${year}, Time: ${time}`);
      // Convert DD/MM/YYYY to MM/DD/YYYY
      dateValue = `${month}/${day}/${year} ${time}`;
      console.log(`    Converted to: ${dateValue}`);
    }

    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return format(date, "MMM d, yyyy 'at' h:mm a");
    }
  } catch (e) {
    return "ERROR";
  }

  return value;
}

console.log("=".repeat(80));
console.log("DATE PARSING FIX TEST");
console.log("=".repeat(80));
console.log();

// Test case 1: Tina Dixon's actual date
console.log("TEST 1: Tina Dixon's capture_time");
console.log("  Input: '12/10/2025 02:44 PM'");
const result1 = formatFieldValue("12/10/2025 02:44 PM");
console.log(`  Output: "${result1}"`);
console.log(`  Expected: "Oct 12, 2025 at 2:44 PM"`);
console.log(`  Status: ${result1 === "Oct 12, 2025 at 2:44 PM" ? "✅ PASS" : "❌ FAIL"}`);
console.log();

// Test case 2: Different date
console.log("TEST 2: Another date");
console.log("  Input: '15/10/2025 06:02 PM'");
const result2 = formatFieldValue("15/10/2025 06:02 PM");
console.log(`  Output: "${result2}"`);
console.log(`  Expected: "Oct 15, 2025 at 6:02 PM"`);
console.log(`  Status: ${result2 === "Oct 15, 2025 at 6:02 PM" ? "✅ PASS" : "❌ FAIL"}`);
console.log();

// Test case 3: Single-digit day/month
console.log("TEST 3: Single-digit day and month");
console.log("  Input: '5/3/2025 09:15 AM'");
const result3 = formatFieldValue("5/3/2025 09:15 AM");
console.log(`  Output: "${result3}"`);
console.log(`  Expected: "Mar 5, 2025 at 9:15 AM"`);
console.log(`  Status: ${result3 === "Mar 5, 2025 at 9:15 AM" ? "✅ PASS" : "❌ FAIL"}`);
console.log();

// Test case 4: Non-matching format (should pass through unchanged)
console.log("TEST 4: Non-matching format");
console.log("  Input: '2025-10-16T18:45:19.837Z' (ISO format)");
const result4 = formatFieldValue("2025-10-16T18:45:19.837Z");
console.log(`  Output: "${result4}"`);
console.log(`  Expected: "Oct 16, 2025 at ..." (any valid format)`);
console.log(`  Status: ${result4.includes("Oct 16, 2025") ? "✅ PASS" : "❌ FAIL"}`);
console.log();

console.log("=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));
console.log("All tests should PASS. This fix converts DD/MM/YYYY to MM/DD/YYYY before");
console.log("parsing, ensuring dates from Leads on Demand webhook display correctly.");
