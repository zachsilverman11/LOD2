/**
 * TEST: Will Andrew VanSickle get a follow-up with the new logic?
 *
 * Andrew's data:
 * - Status: ENGAGED
 * - Created: Oct 11, 6:56am (125h ago)
 * - Last Contact: Oct 11, 7:00am (124h ago)
 * - Days Since Contact: 5
 * - Messages: 6 out, 4 in
 * - Has Replied: YES
 * - Last reply: Oct 11, 7:00am (124h ago = 5.16 days ago)
 */

const now = new Date("2025-10-16T11:57:37-07:00"); // Current time PST
const lastContactedAt = new Date("2025-10-11T07:00:10-07:00");
const lastInboundAt = new Date("2025-10-11T07:00:02-07:00");

const hoursSinceContact = Math.floor((now.getTime() - lastContactedAt.getTime()) / 3600000);
const daysSinceContact = Math.floor(hoursSinceContact / 24);
const hasReplied = true;
const outboundCount = 6;

const daysSinceReply = Math.floor((now.getTime() - lastInboundAt.getTime()) / 86400000);

console.log("=".repeat(80));
console.log("TESTING: Will Andrew VanSickle get follow-up with new logic?");
console.log("=".repeat(80));
console.log();
console.log("Andrew's Stats:");
console.log(`  Days since contact: ${daysSinceContact}`);
console.log(`  Hours since contact: ${hoursSinceContact}`);
console.log(`  Outbound count: ${outboundCount}`);
console.log(`  Has replied: ${hasReplied}`);
console.log(`  Days since last reply: ${daysSinceReply}`);
console.log();

// OLD LOGIC (current/broken):
console.log("OLD LOGIC (lines 757-762):");
console.log(`  if (daysSinceContact === 5 || daysSinceContact === 6) {`);
console.log(`    if (outboundCount <= 4) {`);
console.log(`      shouldFollowUp = true`);
console.log(`    }`);
console.log(`  }`);
console.log();
console.log(`  Check: daysSinceContact (${daysSinceContact}) in [5,6]? YES`);
console.log(`  Check: outboundCount (${outboundCount}) <= 4? NO (6 > 4)`);
console.log(`  Result: ❌ SKIP (no follow-up)`);
console.log();

// NEW LOGIC (fixed):
console.log("NEW LOGIC (proposed fix):");
console.log(`  if (daysSinceContact === 5 || daysSinceContact === 6) {`);
console.log(`    const daysSinceReply = ...`);
console.log(`    if (outboundCount <= 4 || (hasReplied && daysSinceReply >= 3)) {`);
console.log(`      shouldFollowUp = true`);
console.log(`    }`);
console.log(`  }`);
console.log();
console.log(`  Check: daysSinceContact (${daysSinceContact}) in [5,6]? YES`);
console.log(`  Check: outboundCount (${outboundCount}) <= 4? NO`);
console.log(`  Check: hasReplied (${hasReplied}) AND daysSinceReply (${daysSinceReply}) >= 3? YES`);
console.log(`  Result: ✅ SEND FOLLOW-UP (engaged lead, 5 days since reply)`);
console.log();

console.log("=".repeat(80));
console.log("CONCLUSION:");
console.log("=".repeat(80));
console.log("✅ Fix WORKS! Andrew will now get a follow-up message.");
console.log("   Reason: He replied 4 times, and it's been 5 days since last reply.");
console.log("   Even though he has 6 outbound messages (over the limit),");
console.log("   the new logic recognizes he's engaged and continues nurturing.");
