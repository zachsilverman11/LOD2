import crypto from "crypto";

/**
 * Verify webhook signature using HMAC SHA256
 * @param payload - The raw request payload
 * @param signature - The signature from the request header
 * @param secret - The webhook secret
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Generate an idempotency key from the lead data
 * Used for deduplication
 */
export function generateIdempotencyKey(email: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  const data = `${email.toLowerCase()}-${Math.floor(ts / (1000 * 60 * 60))}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}
