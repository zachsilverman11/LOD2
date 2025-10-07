/**
 * Wrap AI-generated email content in Inspired Mortgage branded template
 */
export function wrapEmailTemplate(content: string): string {
  const calComLink = process.env.CAL_COM_BOOKING_URL || "https://cal.com/inspired-mortgage";

  return `
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
      line-height: 1.6;
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
    .content ul {
      margin: 16px 0;
      padding-left: 24px;
    }
    .content li {
      margin: 8px 0;
      color: #1C1B1A;
    }
    .content strong {
      color: #625FFF;
      font-weight: 600;
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
      transition: background-color 0.2s;
    }
    .cta-button:hover {
      background-color: #4F4DCC;
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
      margin-bottom: 12px;
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
      .header {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 28px;
      }
      .content {
        padding: 30px 20px;
      }
      .footer {
        padding: 20px;
      }
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
      <div class="tagline">Your Path to Homeownership Starts Here</div>
    </div>

    <!-- Content -->
    <div class="content">
      ${content}
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-signature">
        Holly from Inspired Mortgage
      </div>
      <div style="color: #55514D; font-size: 14px; margin-bottom: 16px;">
        Scheduling & Lead Nurturing Specialist
      </div>
      <div class="footer-contact">
        <a href="mailto:info@inspired.mortgage">info@inspired.mortgage</a>
      </div>
      <div class="footer-contact">
        <a href="${calComLink}" style="color: #625FFF; font-weight: 600;">📅 Book a 15-Min Discovery Call</a>
      </div>
      <div class="footer-disclaimer">
        You received this email because you inquired about mortgage services with Inspired Mortgage.<br>
        Questions? Just reply to this email anytime.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
