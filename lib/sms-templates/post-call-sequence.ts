/**
 * Post-Call SMS Sequence
 *
 * 4-message SMS drip sent after a report is delivered:
 *   SMS 1 (immediate): Report notification + "pages 3-5 are important"
 *   SMS 2 (Day 2): Follow-up + mention spouse/partner
 *   SMS 3 (Day 5): Urgency — renewal/rates moving
 *   SMS 4 (Day 10): Soft check-in (no "last message" framing; cadence may continue)
 *
 * These are AUTOMATED sequences, NOT Holly-generated.
 * Type: automated_sequence
 *
 * Each message includes the application link.
 */

const APPLICATION_URL = 'https://stressfree.mtg-app.com/signup';

export interface PostCallSmsParams {
  clientFirstName: string;
  advisorName: string;
}

/**
 * SMS 1 — Immediate (sent with report): Report notification
 */
export function buildReportNotificationSms(params: PostCallSmsParams): string {
  const { clientFirstName, advisorName } = params;
  return `Hi ${clientFirstName}! Your Mortgage Strategy Report from ${advisorName} just hit your inbox 📩 Pages 3-5 are where the magic is. Take a look tonight. When you're ready to move forward: ${APPLICATION_URL}`;
}

/**
 * SMS 2 — Day 2: Follow-up + mention sharing with partner
 */
export function buildDay2FollowUpSms(params: PostCallSmsParams): string {
  const { clientFirstName } = params;
  return `Hey ${clientFirstName}, did you get a chance to look at your mortgage report? If you're making this decision with someone, forward them the email. It's designed to be easy to share. Ready to take the next step? ${APPLICATION_URL}`;
}

/**
 * SMS 3 — Day 5: Urgency — renewal/rates context
 */
export function buildDay5UrgencySms(params: PostCallSmsParams): string {
  const { clientFirstName } = params;
  return `Hi ${clientFirstName}, quick heads up: rates have been moving and your report numbers are based on today's market. The sooner you lock in, the better your options. Your secure application takes ~15 min: ${APPLICATION_URL}`;
}

/**
 * SMS 4 — Day 10: Final touch — friendly close
 */
export function buildDay10FinalSms(params: PostCallSmsParams): string {
  const { clientFirstName } = params;
  return `Hey ${clientFirstName}, circling back on your mortgage report. If the timing isn't right, totally get it. If you're still thinking about it, your application link is here whenever you're ready: ${APPLICATION_URL}. Wishing you the best! 🏡`;
}
