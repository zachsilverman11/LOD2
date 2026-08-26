/**
 * Twilio signature validation
 * Docs: https://www.twilio.com/docs/usage/security#validating-requests
 */

import { createHmac } from "crypto";

export interface TwilioSignatureValidationParams {
  signature: string;
  url: string;
  params: Record<string, string>;
  authToken: string;
}

/**
 * Validate Twilio request signature
 * 
 * Twilio signs all webhook requests with HMAC-SHA1 of:
 * - The full URL Twilio called (including https://, host, path, query)
 * - All POST parameters in alphabetical order
 */
export function validateTwilioSignature({
  signature,
  url,
  params,
  authToken,
}: TwilioSignatureValidationParams): boolean {
  // Trim auth token to handle trailing newlines/whitespace from env vars
  // Twilio signs with the actual 32-char token (no whitespace)
  const trimmedAuthToken = authToken.trim();

  // Build the string to sign: URL + sorted params
  let data = url;

  // Sort params alphabetically by key
  const sortedKeys = Object.keys(params).sort();
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  // Compute HMAC-SHA1
  const hmac = createHmac("sha1", trimmedAuthToken);
  hmac.update(data);
  const expectedSignature = hmac.digest("base64");

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(expectedSignature, signature);
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
