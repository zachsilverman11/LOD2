/**
 * Email sending via SendGrid or Resend
 * Supports both providers - automatically detects which one to use based on API key
 */

import { wrapEmailTemplate } from "./email-template";

export interface SendEmailParams {
  to: string;
  subject: string;
  html?: string;
  htmlContent?: string; // AI-generated content that will be wrapped in branded template
  text?: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(params: SendEmailParams) {
  // If htmlContent is provided (from AI), wrap it in branded template
  const html = params.htmlContent
    ? wrapEmailTemplate(params.htmlContent)
    : params.html || "";

  const emailParams = { ...params, html };

  // Check which email provider to use
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (sendgridApiKey) {
    return sendEmailViaSendGrid(emailParams, sendgridApiKey);
  } else if (resendApiKey) {
    return sendEmailViaResend(emailParams, resendApiKey);
  } else {
    throw new Error("No email API key found. Set either SENDGRID_API_KEY or RESEND_API_KEY");
  }
}

async function sendEmailViaSendGrid(params: SendEmailParams, apiKey: string) {
  const fromEmail = params.from || process.env.FROM_EMAIL || "noreply@example.com";

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: params.to }],
          subject: params.subject,
        },
      ],
      from: { email: fromEmail },
      content: [
        {
          type: "text/html",
          value: params.html,
        },
        ...(params.text ? [{ type: "text/plain", value: params.text }] : []),
      ],
      reply_to: params.replyTo ? { email: params.replyTo } : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid API error: ${error}`);
  }

  // SendGrid returns 202 with no body on success
  return { success: true, provider: "sendgrid" };
}

async function sendEmailViaResend(params: SendEmailParams, apiKey: string) {
  const fromEmail = params.from || process.env.FROM_EMAIL || "noreply@example.com";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: params.replyTo,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return response.json();
}

/**
 * Replace template variables in email content
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Default email templates
 */
export const EMAIL_TEMPLATES = {
  WELCOME: {
    subject: "Welcome {{firstName}} - Let's discuss your mortgage options",
    html: `
      <h2>Hi {{firstName}},</h2>
      <p>Thank you for your interest in our mortgage services!</p>
      <p>We're excited to help you navigate your mortgage journey. Our team of experienced advisors is ready to provide personalized guidance tailored to your needs.</p>
      <p>We'll be reaching out shortly to schedule a discovery call at your convenience.</p>
      <p>In the meantime, feel free to reply to this email with any questions.</p>
      <br>
      <p>Best regards,<br>Your Mortgage Advisor Team</p>
    `,
    text: `Hi {{firstName}},\n\nThank you for your interest in our mortgage services!\n\nWe're excited to help you navigate your mortgage journey. Our team of experienced advisors is ready to provide personalized guidance tailored to your needs.\n\nWe'll be reaching out shortly to schedule a discovery call at your convenience.\n\nIn the meantime, feel free to reply to this email with any questions.\n\nBest regards,\nYour Mortgage Advisor Team`,
  },
  SCHEDULE_CALL: {
    subject: "{{firstName}}, let's schedule your discovery call",
    html: `
      <h2>Hi {{firstName}},</h2>
      <p>I hope this email finds you well!</p>
      <p>I'd love to schedule a quick 30-minute discovery call to discuss your mortgage needs and how we can help.</p>
      <p><a href="{{schedulingLink}}" style="background-color: #4CAF50; color: white; padding: 14px 25px; text-decoration: none; display: inline-block; border-radius: 4px;">Schedule Your Call</a></p>
      <p>During this call, we'll:</p>
      <ul>
        <li>Review your current situation and goals</li>
        <li>Discuss mortgage options available to you</li>
        <li>Answer any questions you may have</li>
      </ul>
      <p>Looking forward to speaking with you!</p>
      <br>
      <p>Best regards,<br>{{advisorName}}</p>
    `,
    text: `Hi {{firstName}},\n\nI hope this email finds you well!\n\nI'd love to schedule a quick 30-minute discovery call to discuss your mortgage needs and how we can help.\n\nSchedule your call here: {{schedulingLink}}\n\nDuring this call, we'll:\n- Review your current situation and goals\n- Discuss mortgage options available to you\n- Answer any questions you may have\n\nLooking forward to speaking with you!\n\nBest regards,\n{{advisorName}}`,
  },
  CALL_REMINDER: {
    subject: "Reminder: Your discovery call is tomorrow",
    html: `
      <h2>Hi {{firstName}},</h2>
      <p>This is a friendly reminder that your discovery call is scheduled for:</p>
      <p style="background-color: #f0f0f0; padding: 15px; border-left: 4px solid #4CAF50;">
        <strong>{{callDate}}</strong><br>
        {{callTime}}<br>
        Duration: 30 minutes
      </p>
      <p><a href="{{meetingLink}}" style="background-color: #4CAF50; color: white; padding: 14px 25px; text-decoration: none; display: inline-block; border-radius: 4px;">Join Meeting</a></p>
      <p>Please have any questions or documents ready that you'd like to discuss.</p>
      <p>If you need to reschedule, please let me know as soon as possible.</p>
      <br>
      <p>See you soon!<br>{{advisorName}}</p>
    `,
    text: `Hi {{firstName}},\n\nThis is a friendly reminder that your discovery call is scheduled for:\n\n{{callDate}} at {{callTime}}\nDuration: 30 minutes\n\nJoin here: {{meetingLink}}\n\nPlease have any questions or documents ready that you'd like to discuss.\n\nIf you need to reschedule, please let me know as soon as possible.\n\nSee you soon!\n{{advisorName}}`,
  },
  FOLLOW_UP: {
    subject: "Great speaking with you, {{firstName}}!",
    html: `
      <h2>Hi {{firstName}},</h2>
      <p>Thank you for taking the time to speak with me today!</p>
      <p>As discussed, here are the next steps:</p>
      <ul>
        <li>{{nextStep1}}</li>
        <li>{{nextStep2}}</li>
      </ul>
      <p>I'll follow up with you by {{followUpDate}} to check on your progress.</p>
      <p>If you have any questions in the meantime, please don't hesitate to reach out.</p>
      <br>
      <p>Best regards,<br>{{advisorName}}</p>
    `,
    text: `Hi {{firstName}},\n\nThank you for taking the time to speak with me today!\n\nAs discussed, here are the next steps:\n- {{nextStep1}}\n- {{nextStep2}}\n\nI'll follow up with you by {{followUpDate}} to check on your progress.\n\nIf you have any questions in the meantime, please don't hesitate to reach out.\n\nBest regards,\n{{advisorName}}`,
  },
};
