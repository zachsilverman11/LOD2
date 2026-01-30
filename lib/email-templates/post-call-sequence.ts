/**
 * Post-Call Email Sequence
 *
 * 3-email drip sequence sent after a report is delivered:
 *   Email 1 (immediate): Report delivery — branded, with CTAs
 *   Email 2 (Day 3): Gentle follow-up — did you read it?
 *   Email 3 (Day 7): Final touch — friendly close
 *
 * These are AUTOMATED sequences, NOT Holly-generated.
 * Type: automated_sequence
 */

const APPLICATION_URL = 'https://stressfree.mtg-app.com/signup';

export interface PostCallEmailParams {
  clientFirstName: string;
  advisorName: string;
  advisorEmail: string;
  advisorPhone?: string;
  advisorCalLink?: string;
}

/**
 * Email 1 — Immediate: "Your Mortgage Strategy Report is ready — here's what to do next"
 *
 * Full branded version with three CTAs:
 * 1. Read it tonight (pages 3-5)
 * 2. Share with partner
 * 3. Complete your application
 *
 * P.S.: "If something in the report surprises you, good. That's the point."
 */
export function buildReportDeliveryEmail(params: PostCallEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { clientFirstName, advisorName, advisorEmail, advisorPhone, advisorCalLink } = params;

  const subject = 'Your Mortgage Strategy Report is ready — here\'s what to do next';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #FBF3E7;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #625FFF 0%, #B1AFFF 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 32px;
      font-weight: 800;
    }
    .header .brand-name {
      font-style: italic;
      font-weight: 800;
    }
    .header .tagline {
      color: #FBF3E7;
      font-size: 14px;
      margin-top: 8px;
    }
    .content {
      padding: 40px 30px;
      color: #1C1B1A;
      line-height: 1.7;
    }
    .content h2 {
      color: #625FFF;
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .content p {
      margin: 16px 0;
      color: #1C1B1A;
    }
    .highlight-box {
      background-color: #FBF3E7;
      border-left: 4px solid #625FFF;
      padding: 20px;
      margin: 24px 0;
      border-radius: 0 8px 8px 0;
    }
    .highlight-box p {
      margin: 0;
    }
    .step-box {
      background-color: #F8F7FF;
      border-radius: 12px;
      padding: 24px;
      margin: 20px 0;
    }
    .step-number {
      display: inline-block;
      background-color: #625FFF;
      color: #ffffff;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      text-align: center;
      line-height: 32px;
      font-weight: 700;
      font-size: 16px;
      margin-right: 12px;
    }
    .step-title {
      font-weight: 700;
      font-size: 18px;
      color: #1C1B1A;
    }
    .step-desc {
      margin: 8px 0 0 44px;
      color: #55514D;
      font-size: 15px;
    }
    .cta-button {
      display: inline-block;
      background-color: #625FFF;
      color: #ffffff !important;
      padding: 16px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 24px 0;
    }
    .ps-section {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #E4DDD3;
      font-style: italic;
      color: #55514D;
    }
    .footer {
      background-color: #F5F5F5;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #E4DDD3;
    }
    .footer-signature {
      color: #1C1B1A;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .footer-title {
      color: #55514D;
      font-size: 14px;
      margin-bottom: 16px;
    }
    .footer-contact {
      color: #55514D;
      font-size: 14px;
      margin: 8px 0;
    }
    .footer-contact a {
      color: #625FFF;
      text-decoration: none;
    }
    .footer-disclaimer {
      color: #999;
      font-size: 12px;
      margin-top: 20px;
      line-height: 1.4;
    }
    @media only screen and (max-width: 600px) {
      .header { padding: 30px 20px; }
      .header h1 { font-size: 28px; }
      .content { padding: 30px 20px; }
      .footer { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>
        <span class="brand-name">inspired</span> <span style="font-weight: 900;">mortgage.</span>
      </h1>
      <div class="tagline">See Lenders Compete for Your Business</div>
    </div>

    <!-- Content -->
    <div class="content">
      <h2>Hi ${clientFirstName},</h2>

      <p>Great news — your personalized <strong>Mortgage Strategy Report</strong> is ready and attached to this email.</p>

      <p>This isn't a generic rate sheet. It's a breakdown of your specific mortgage situation, built from the conversation you had with ${advisorName}. Everything in here is tailored to <em>your</em> numbers, <em>your</em> goals, and <em>your</em> options.</p>

      <div class="highlight-box">
        <p><strong>📎 Your report is attached as a PDF.</strong> Open it on a computer or tablet for the best experience.</p>
      </div>

      <p style="font-size: 18px; font-weight: 700; color: #625FFF; margin-top: 32px;">Here's what to do next:</p>

      <div class="step-box">
        <div>
          <span class="step-number">1</span>
          <span class="step-title">Read it tonight</span>
        </div>
        <p class="step-desc">Pay special attention to <strong>pages 3–5</strong> — that's where the real insights are. Most people are surprised by what they find.</p>
      </div>

      <div class="step-box">
        <div>
          <span class="step-number">2</span>
          <span class="step-title">Share it with your partner</span>
        </div>
        <p class="step-desc">The report is designed to be shared. Forward this email or hand them the PDF — it explains everything without the jargon.</p>
      </div>

      <div class="step-box">
        <div>
          <span class="step-number">3</span>
          <span class="step-title">Complete your application</span>
        </div>
        <p class="step-desc">Ready to move forward? Your secure application takes about 10–15 minutes and <strong>does not affect your credit score</strong>.</p>
      </div>

      <p style="text-align: center;">
        <a href="${APPLICATION_URL}" class="cta-button">Start Your Application →</a>
      </p>

      <p>Once you submit, ${advisorName} will shop your mortgage to 30+ lenders and come back with your best options. No obligation — just clarity.</p>

      ${advisorCalLink ? `<p>Have questions about the report? <a href="${advisorCalLink}" style="color: #625FFF; font-weight: 600;">Book a quick follow-up call</a> anytime.</p>` : ''}

      <div class="ps-section">
        <p><strong>P.S.</strong> If something in the report surprises you, good. That's the point. Most people don't realize what they're leaving on the table until they see the numbers side by side.</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-signature">${advisorName}</div>
      <div class="footer-title">Mortgage Advisor, Inspired Mortgage</div>
      <div class="footer-contact">
        <a href="mailto:${advisorEmail}">${advisorEmail}</a>
      </div>
      ${advisorPhone ? `<div class="footer-contact">${advisorPhone}</div>` : ''}
      ${advisorCalLink ? `<div class="footer-contact"><a href="${advisorCalLink}" style="color: #625FFF; font-weight: 600;">📅 Schedule a Call</a></div>` : ''}
      <div class="footer-disclaimer">
        You received this email because you recently had a discovery call with Inspired Mortgage.<br>
        Questions? Just reply to this email anytime.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Hi ${clientFirstName},

Great news — your personalized Mortgage Strategy Report is ready and attached to this email.

This isn't a generic rate sheet. It's a breakdown of your specific mortgage situation, built from the conversation you had with ${advisorName}.

HERE'S WHAT TO DO NEXT:

1. READ IT TONIGHT
   Pay special attention to pages 3–5 — that's where the real insights are. Most people are surprised by what they find.

2. SHARE IT WITH YOUR PARTNER
   The report is designed to be shared. Forward this email or hand them the PDF — it explains everything without the jargon.

3. COMPLETE YOUR APPLICATION
   Ready to move forward? Your secure application takes about 10–15 minutes and does not affect your credit score.

   Start here: ${APPLICATION_URL}

Once you submit, ${advisorName} will shop your mortgage to 30+ lenders and come back with your best options. No obligation — just clarity.

${advisorCalLink ? `Have questions about the report? Book a follow-up call: ${advisorCalLink}` : ''}

P.S. If something in the report surprises you, good. That's the point. Most people don't realize what they're leaving on the table until they see the numbers side by side.

—
${advisorName}
Mortgage Advisor, Inspired Mortgage
${advisorEmail}${advisorPhone ? `\n${advisorPhone}` : ''}`;

  return { subject, html, text };
}

/**
 * Email 2 — Day 3: "Did you get a chance to read the report?"
 *
 * Gentle follow-up. Not pushy. Creates curiosity about what they might have missed.
 */
export function buildDay3FollowUpEmail(params: PostCallEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { clientFirstName, advisorName, advisorEmail, advisorPhone, advisorCalLink } = params;

  const subject = 'Did you get a chance to read the report?';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #FBF3E7;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #625FFF 0%, #B1AFFF 100%);
      padding: 32px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 800;
    }
    .header .brand-name {
      font-style: italic;
      font-weight: 800;
    }
    .content {
      padding: 40px 30px;
      color: #1C1B1A;
      line-height: 1.7;
    }
    .content p {
      margin: 16px 0;
      color: #1C1B1A;
    }
    .cta-button {
      display: inline-block;
      background-color: #625FFF;
      color: #ffffff !important;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
    }
    .footer {
      background-color: #F5F5F5;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid #E4DDD3;
    }
    .footer-signature {
      color: #1C1B1A;
      font-size: 15px;
      font-weight: 600;
    }
    .footer-contact {
      color: #55514D;
      font-size: 13px;
      margin: 6px 0;
    }
    .footer-contact a {
      color: #625FFF;
      text-decoration: none;
    }
    .footer-disclaimer {
      color: #999;
      font-size: 11px;
      margin-top: 16px;
    }
    @media only screen and (max-width: 600px) {
      .content { padding: 30px 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>
        <span class="brand-name">inspired</span> <span style="font-weight: 900;">mortgage.</span>
      </h1>
    </div>

    <div class="content">
      <p>Hi ${clientFirstName},</p>

      <p>Just a quick check-in — did you get a chance to look at your Mortgage Strategy Report?</p>

      <p>I know life gets busy, so no pressure. But if you did read it, I'm curious — was there anything in there that surprised you? (Most people tell me pages 3–5 were the eye-opener.)</p>

      <p>If you haven't had a chance yet, it's still sitting in your inbox from a few days ago. Worth 10 minutes of your evening.</p>

      <p>And whenever you're ready, your application is right here:</p>

      <p style="text-align: center;">
        <a href="${APPLICATION_URL}" class="cta-button">Complete Your Application</a>
      </p>

      <p>Takes about 10–15 minutes, doesn't affect your credit, and once it's in, ${advisorName} can start shopping your mortgage to 30+ lenders.</p>

      <p>Questions? Just hit reply — I'm here.</p>

      <p>— ${advisorName}</p>
    </div>

    <div class="footer">
      <div class="footer-signature">${advisorName} · Inspired Mortgage</div>
      <div class="footer-contact"><a href="mailto:${advisorEmail}">${advisorEmail}</a></div>
      ${advisorPhone ? `<div class="footer-contact">${advisorPhone}</div>` : ''}
      ${advisorCalLink ? `<div class="footer-contact"><a href="${advisorCalLink}">📅 Book a Call</a></div>` : ''}
      <div class="footer-disclaimer">Questions? Just reply to this email anytime.</div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Hi ${clientFirstName},

Just a quick check-in — did you get a chance to look at your Mortgage Strategy Report?

I know life gets busy, so no pressure. But if you did read it, I'm curious — was there anything in there that surprised you? (Most people tell me pages 3–5 were the eye-opener.)

If you haven't had a chance yet, it's still sitting in your inbox from a few days ago. Worth 10 minutes of your evening.

Whenever you're ready, your application is here: ${APPLICATION_URL}

Takes about 10–15 minutes, doesn't affect your credit, and once it's in, ${advisorName} can start shopping your mortgage to 30+ lenders.

Questions? Just hit reply — I'm here.

— ${advisorName}
Inspired Mortgage | ${advisorEmail}${advisorPhone ? ` | ${advisorPhone}` : ''}`;

  return { subject, html, text };
}

/**
 * Email 3 — Day 7: "Quick question"
 *
 * Final touch. Friendly, short, low pressure. Creates a gentle close.
 */
export function buildDay7FollowUpEmail(params: PostCallEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { clientFirstName, advisorName, advisorEmail, advisorPhone, advisorCalLink } = params;

  const subject = 'Quick question';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #FBF3E7;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #625FFF 0%, #B1AFFF 100%);
      padding: 32px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 800;
    }
    .header .brand-name {
      font-style: italic;
      font-weight: 800;
    }
    .content {
      padding: 40px 30px;
      color: #1C1B1A;
      line-height: 1.7;
    }
    .content p {
      margin: 16px 0;
      color: #1C1B1A;
    }
    .cta-button {
      display: inline-block;
      background-color: #625FFF;
      color: #ffffff !important;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
    }
    .footer {
      background-color: #F5F5F5;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid #E4DDD3;
    }
    .footer-signature {
      color: #1C1B1A;
      font-size: 15px;
      font-weight: 600;
    }
    .footer-contact {
      color: #55514D;
      font-size: 13px;
      margin: 6px 0;
    }
    .footer-contact a {
      color: #625FFF;
      text-decoration: none;
    }
    .footer-disclaimer {
      color: #999;
      font-size: 11px;
      margin-top: 16px;
    }
    @media only screen and (max-width: 600px) {
      .content { padding: 30px 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>
        <span class="brand-name">inspired</span> <span style="font-weight: 900;">mortgage.</span>
      </h1>
    </div>

    <div class="content">
      <p>Hi ${clientFirstName},</p>

      <p>Just wanted to check — are you still thinking about your mortgage, or have things changed?</p>

      <p>Either way is totally fine. If your situation has shifted or you went a different direction, no worries at all. But if you're still mulling it over, I wanted to make sure you know the door is open.</p>

      <p>Your Mortgage Strategy Report is still valid, and your application link is still active:</p>

      <p style="text-align: center;">
        <a href="${APPLICATION_URL}" class="cta-button">Pick Up Where You Left Off</a>
      </p>

      <p>If there's something holding you back — a question, a concern, a conversation you need to have first — just reply and let me know. Happy to help however I can.</p>

      <p>Wishing you all the best either way, ${clientFirstName}.</p>

      <p>— ${advisorName}</p>
    </div>

    <div class="footer">
      <div class="footer-signature">${advisorName} · Inspired Mortgage</div>
      <div class="footer-contact"><a href="mailto:${advisorEmail}">${advisorEmail}</a></div>
      ${advisorPhone ? `<div class="footer-contact">${advisorPhone}</div>` : ''}
      ${advisorCalLink ? `<div class="footer-contact"><a href="${advisorCalLink}">📅 Book a Call</a></div>` : ''}
      <div class="footer-disclaimer">This is our last scheduled follow-up. Reply anytime if you need anything.</div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `Hi ${clientFirstName},

Just wanted to check — are you still thinking about your mortgage, or have things changed?

Either way is totally fine. If your situation has shifted or you went a different direction, no worries at all. But if you're still mulling it over, I wanted to make sure you know the door is open.

Your Mortgage Strategy Report is still valid, and your application link is still active:
${APPLICATION_URL}

If there's something holding you back — a question, a concern, a conversation you need to have first — just reply and let me know. Happy to help however I can.

Wishing you all the best either way, ${clientFirstName}.

— ${advisorName}
Inspired Mortgage | ${advisorEmail}${advisorPhone ? ` | ${advisorPhone}` : ''}`;

  return { subject, html, text };
}
