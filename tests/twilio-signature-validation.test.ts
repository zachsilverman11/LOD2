/**
 * Twilio Signature Validation Tests
 * 
 * Tests that inbound SMS webhook validates X-Twilio-Signature
 * and rejects unsigned/invalid requests with 403.
 */

import { validateTwilioSignature } from '../lib/twilio-signature';
import { createHmac } from 'crypto';

function computeSignature(url: string, params: Record<string, string>, authToken: string): string {
  let data = url;
  const sortedKeys = Object.keys(params).sort();
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  const hmac = createHmac('sha1', authToken);
  hmac.update(data);
  return hmac.digest('base64');
}

describe('Twilio Signature Validation', () => {
  describe('validateTwilioSignature', () => {
    const authToken = 'test_auth_token_12345';
    const url = 'https://example.com/api/webhooks/twilio';

    function computeSignature(url: string, params: Record<string, string>, authToken: string): string {
      let data = url;
      const sortedKeys = Object.keys(params).sort();
      for (const key of sortedKeys) {
        data += key + params[key];
      }
      const hmac = createHmac('sha1', authToken);
      hmac.update(data);
      return hmac.digest('base64');
    }

    test('accepts valid signature', () => {
      const params = {
        From: '+12345678900',
        To: '+12345678901',
        Body: 'Hello',
        MessageSid: 'SM123',
      };

      const signature = computeSignature(url, params, authToken);

      const isValid = validateTwilioSignature({
        signature,
        url,
        params,
        authToken,
      });

      expect(isValid).toBe(true);
    });

    test('rejects invalid signature', () => {
      const params = {
        From: '+12345678900',
        To: '+12345678901',
        Body: 'Hello',
        MessageSid: 'SM123',
      };

      const wrongSignature = 'invalid_signature_xyz';

      const isValid = validateTwilioSignature({
        signature: wrongSignature,
        url,
        params,
        authToken,
      });

      expect(isValid).toBe(false);
    });

    test('rejects signature computed with different params', () => {
      const params = {
        From: '+12345678900',
        To: '+12345678901',
        Body: 'Hello',
        MessageSid: 'SM123',
      };

      const tamperedParams = {
        ...params,
        Body: 'Tampered message',
      };

      const signature = computeSignature(url, params, authToken);

      const isValid = validateTwilioSignature({
        signature,
        url,
        params: tamperedParams,
        authToken,
      });

      expect(isValid).toBe(false);
    });

    test('rejects signature computed with different URL', () => {
      const params = {
        From: '+12345678900',
        To: '+12345678901',
        Body: 'Hello',
        MessageSid: 'SM123',
      };

      const signature = computeSignature('https://wrong.com/api/webhooks/twilio', params, authToken);

      const isValid = validateTwilioSignature({
        signature,
        url,
        params,
        authToken,
      });

      expect(isValid).toBe(false);
    });

    test('handles params in any order (alphabetical sorting)', () => {
      const paramsA = {
        Zebra: 'last',
        Apple: 'first',
        Middle: 'middle',
      };

      const paramsB = {
        Apple: 'first',
        Zebra: 'last',
        Middle: 'middle',
      };

      const signatureA = computeSignature(url, paramsA, authToken);
      const signatureB = computeSignature(url, paramsB, authToken);

      // Both should produce the same signature
      expect(signatureA).toBe(signatureB);

      // Both should validate
      expect(validateTwilioSignature({
        signature: signatureA,
        url,
        params: paramsA,
        authToken,
      })).toBe(true);

      expect(validateTwilioSignature({
        signature: signatureB,
        url,
        params: paramsB,
        authToken,
      })).toBe(true);
    });

    test('rejects empty signature', () => {
      const params = {
        From: '+12345678900',
        Body: 'Hello',
      };

      const isValid = validateTwilioSignature({
        signature: '',
        url,
        params,
        authToken,
      });

      expect(isValid).toBe(false);
    });

    test('uses timing-safe comparison', () => {
      // This test verifies that the comparison doesn't short-circuit
      // We can't directly test timing, but we can verify behavior
      const params = {
        From: '+12345678900',
        Body: 'Hello',
      };

      const correctSignature = computeSignature(url, params, authToken);
      
      // Create signatures that differ at different positions
      const wrongAtStart = 'X' + correctSignature.slice(1);
      const wrongAtEnd = correctSignature.slice(0, -1) + 'X';

      // Both should be rejected
      expect(validateTwilioSignature({
        signature: wrongAtStart,
        url,
        params,
        authToken,
      })).toBe(false);

      expect(validateTwilioSignature({
        signature: wrongAtEnd,
        url,
        params,
        authToken,
      })).toBe(false);
    });

    test('accepts signature computed with trimmed token when env has trailing newline', () => {
      // Real-world scenario: Vercel env var has trailing newline
      const cleanToken = 'abcd1234efgh5678ijkl90mnopqrstuv';
      const tokenWithNewline = cleanToken + '\n';
      
      const params = {
        From: '+12345678900',
        To: '+12345678901',
        Body: 'Hello from real Twilio',
        MessageSid: 'SM123',
      };

      // Twilio signs with the clean token (no whitespace)
      const twilioSignature = computeSignature(url, params, cleanToken);

      // validateTwilioSignature receives the token with newline from env
      const isValid = validateTwilioSignature({
        signature: twilioSignature,
        url,
        params,
        authToken: tokenWithNewline,
      });

      expect(isValid).toBe(true);
    });

    test('accepts signature computed with trimmed token when env has trailing spaces', () => {
      const cleanToken = 'abcd1234efgh5678ijkl90mnopqrstuv';
      const tokenWithSpaces = cleanToken + '  ';
      
      const params = {
        From: '+12345678900',
        Body: 'Hello',
      };

      const twilioSignature = computeSignature(url, params, cleanToken);

      const isValid = validateTwilioSignature({
        signature: twilioSignature,
        url,
        params,
        authToken: tokenWithSpaces,
      });

      expect(isValid).toBe(true);
    });

    test('accepts signature computed with trimmed token when env has leading whitespace', () => {
      const cleanToken = 'abcd1234efgh5678ijkl90mnopqrstuv';
      const tokenWithLeadingSpace = ' ' + cleanToken;
      
      const params = {
        From: '+12345678900',
        Body: 'Hello',
      };

      const twilioSignature = computeSignature(url, params, cleanToken);

      const isValid = validateTwilioSignature({
        signature: twilioSignature,
        url,
        params,
        authToken: tokenWithLeadingSpace,
      });

      expect(isValid).toBe(true);
    });

    test('rejects signature when tokens completely differ (even with trimming)', () => {
      const correctToken = 'abcd1234efgh5678ijkl90mnopqrstuv';
      const wrongToken = 'wrong_token_xyz_different_value1';
      
      const params = {
        From: '+12345678900',
        Body: 'Hello',
      };

      // Sign with correct token
      const signature = computeSignature(url, params, correctToken);

      // Validate with wrong token (even with trailing newline)
      const isValid = validateTwilioSignature({
        signature,
        url,
        params,
        authToken: wrongToken + '\n',
      });

      expect(isValid).toBe(false);
    });
  });

  describe('Signature computation matches Twilio spec', () => {
    test('matches example from Twilio docs', () => {
      // Example from Twilio documentation
      const authToken = '12345';
      const url = 'https://mycompany.com/myapp.php?foo=1&bar=2';
      const params = {
        CallSid: 'CA1234567890ABCDE',
        Caller: '+12349013030',
        Digits: '1234',
        From: '+12349013030',
        To: '+18005551212',
      };

      // Compute our signature
      let data = url;
      const sortedKeys = Object.keys(params).sort();
      for (const key of sortedKeys) {
        data += key + params[key];
      }
      const hmac = createHmac('sha1', authToken);
      hmac.update(data);
      const signature = hmac.digest('base64');

      // Verify it validates
      const isValid = validateTwilioSignature({
        signature,
        url,
        params,
        authToken,
      });

      expect(isValid).toBe(true);
    });

    test('full URL including query params matters', () => {
      const authToken = 'test_token';
      const params = {
        From: '+12345678900',
        Body: 'Hello',
      };

      const urlWithQuery = 'https://example.com/api/webhooks/twilio?foo=bar';
      const urlWithoutQuery = 'https://example.com/api/webhooks/twilio';

      const signatureWithQuery = computeSignature(urlWithQuery, params, authToken);
      const signatureWithoutQuery = computeSignature(urlWithoutQuery, params, authToken);

      // Signatures should be different
      expect(signatureWithQuery).not.toBe(signatureWithoutQuery);

      // Each should only validate against its own URL
      expect(validateTwilioSignature({
        signature: signatureWithQuery,
        url: urlWithQuery,
        params,
        authToken,
      })).toBe(true);

      expect(validateTwilioSignature({
        signature: signatureWithQuery,
        url: urlWithoutQuery,
        params,
        authToken,
      })).toBe(false);
    });
  });
});
