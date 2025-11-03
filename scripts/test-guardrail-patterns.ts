/**
 * Test the updated guardrail patterns
 */

// Test messages that SHOULD be allowed (acknowledging existing bookings)
const allowedMessages = [
  "Amazing Barbara Ann! Just saw your 2pm booking come through - Greg's excited to run those numbers for you.",
  "Hi Barbara Ann! We don't have a physical office in Kelowna, but Greg serves clients throughout the Okanagan remotely.",
  "Great! Your booking is confirmed for tomorrow at 3pm.",
  "I see you already booked - perfect!",
  "Just confirmed you booked for 2pm today.",
];

// Test messages that SHOULD be blocked (promising call times)
const blockedMessages = [
  "I'll call you at 5pm tomorrow",
  "Greg will call you at 2:30pm",
  "We'll reach out at 3pm today",
  "I will contact you by 4pm",
  "Someone will call you at noon",
  "The advisor will call you at 5:30",
];

console.log('Testing ALLOWED messages (should pass):');
console.log('='.repeat(60));

for (const msg of allowedMessages) {
  const message = msg.toLowerCase();

  // Check if acknowledging booking
  const isAcknowledgingBooking =
    /saw your.*booking|your.*booking|confirmed.*booking|booking.*through/i.test(message) ||
    /already.*booked|just.*booked|you.*booked/i.test(message);

  let shouldBlock = false;
  if (!isAcknowledgingBooking) {
    const forbiddenPatterns = [
      /will call you (at|around|by)/i,
      /\b(i'll|i will|we'll|we will|going to) call you (at|around|by)/i,
      /\b(greg|advisor|someone|team).*(will|going to) call you (at|around|by)/i,
      /(reach out|contact you|call you) (at|around|by) \d+/i,
      /\b(i'll|i will|we'll|we will) (reach out|call|contact).*(at|around|by) \d+/i,
    ];

    shouldBlock = forbiddenPatterns.some(pattern => pattern.test(message));
  }

  const status = shouldBlock ? '❌ BLOCKED' : '✅ ALLOWED';
  console.log(`\n${status}`);
  console.log(`Message: "${msg}"`);
  console.log(`Is acknowledging booking: ${isAcknowledgingBooking}`);
}

console.log('\n\n');
console.log('Testing BLOCKED messages (should be blocked):');
console.log('='.repeat(60));

for (const msg of blockedMessages) {
  const message = msg.toLowerCase();

  // Check if acknowledging booking
  const isAcknowledgingBooking =
    /saw your.*booking|your.*booking|confirmed.*booking|booking.*through/i.test(message) ||
    /already.*booked|just.*booked|you.*booked/i.test(message);

  let shouldBlock = false;
  if (!isAcknowledgingBooking) {
    const forbiddenPatterns = [
      /will call you (at|around|by)/i,
      /\b(i'll|i will|we'll|we will|going to) call you (at|around|by)/i,
      /\b(greg|advisor|someone|team).*(will|going to) call you (at|around|by)/i,
      /(reach out|contact you|call you) (at|around|by) \d+/i,
      /\b(i'll|i will|we'll|we will) (reach out|call|contact).*(at|around|by) \d+/i,
    ];

    shouldBlock = forbiddenPatterns.some(pattern => pattern.test(message));
  }

  const status = shouldBlock ? '✅ BLOCKED' : '❌ NOT BLOCKED (ERROR!)';
  console.log(`\n${status}`);
  console.log(`Message: "${msg}"`);
  console.log(`Is acknowledging booking: ${isAcknowledgingBooking}`);
}

console.log('\n');
