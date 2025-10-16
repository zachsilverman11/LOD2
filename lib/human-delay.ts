/**
 * Human-like delay system for Holly's responses
 *
 * Makes Holly appear more human by simulating:
 * 1. Reading time (based on message length)
 * 2. Thinking time (based on complexity)
 * 3. Typing time (based on response length)
 */

/**
 * Calculate human-like delay before responding
 *
 * @param incomingMessage - The message Holly received (to calculate reading time)
 * @param responseMessage - The message Holly will send (to calculate typing time)
 * @returns Delay in milliseconds
 */
export function calculateHumanDelay(
  incomingMessage?: string,
  responseMessage?: string
): number {
  // Base thinking time (always present)
  const baseThinkingTime = 2000; // 2 seconds minimum

  // Reading time: ~200 words per minute = ~3.3 words per second = ~300ms per word
  // Average word is ~5 characters, so ~60ms per character
  const readingTime = incomingMessage
    ? Math.min(incomingMessage.length * 60, 8000) // Cap at 8 seconds
    : 0;

  // Typing time: Average person types ~40 words per minute = ~0.67 words per second
  // That's about ~3.3 characters per second = ~300ms per character
  // But Holly types faster (she's good at this), so ~150ms per character
  const typingTime = responseMessage
    ? Math.min(responseMessage.length * 150, 10000) // Cap at 10 seconds
    : 2000; // Default 2 seconds if no response yet

  // Add some randomness to appear more human (+/- 20%)
  const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2

  // Total delay
  const totalDelay = (baseThinkingTime + readingTime + typingTime) * randomFactor;

  // Minimum 3 seconds, maximum 15 seconds
  const clampedDelay = Math.min(Math.max(totalDelay, 3000), 15000);

  console.log(`[Human Delay] Calculated delay: ${Math.round(clampedDelay / 1000)}s`, {
    baseThinking: `${baseThinkingTime}ms`,
    reading: `${Math.round(readingTime)}ms (${incomingMessage?.length || 0} chars)`,
    typing: `${Math.round(typingTime)}ms (${responseMessage?.length || 0} chars)`,
    randomFactor: randomFactor.toFixed(2),
    total: `${Math.round(clampedDelay)}ms`,
  });

  return clampedDelay;
}

/**
 * Delay execution to simulate human response time
 */
export async function humanDelay(
  incomingMessage?: string,
  responseMessage?: string
): Promise<void> {
  const delayMs = calculateHumanDelay(incomingMessage, responseMessage);

  console.log(`[Human Delay] Waiting ${Math.round(delayMs / 1000)} seconds before responding...`);

  await new Promise(resolve => setTimeout(resolve, delayMs));

  console.log(`[Human Delay] ✅ Delay complete, sending message now`);
}

/**
 * Get a quick delay for follow-up messages (when sending multiple messages)
 */
export function calculateQuickDelay(): number {
  // For follow-up messages (like SMS + Email), use a shorter delay
  // 1-3 seconds to simulate switching between apps
  return 1000 + Math.random() * 2000;
}

/**
 * Quick delay for multi-channel messages
 */
export async function quickDelay(): Promise<void> {
  const delayMs = calculateQuickDelay();
  console.log(`[Human Delay] Quick delay: ${Math.round(delayMs / 1000)}s`);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}
