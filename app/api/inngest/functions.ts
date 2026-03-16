/**
 * Inngest Worker Functions
 * Processes lead SMS replies + automated post-call email/SMS sequences
 */

import { inngest } from "@/lib/inngest";
import { processLeadWithAutonomousAgent } from "@/lib/holly/agent";
import { sendErrorAlert } from "@/lib/slack";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { ActivityType, CommunicationChannel } from "@/app/generated/prisma";
import {
  buildDay3FollowUpEmail,
  buildDay7FollowUpEmail,
  type PostCallEmailParams,
} from "@/lib/email-templates/post-call-sequence";
import {
  buildDay2FollowUpSms,
  buildDay5UrgencySms,
  buildDay10FinalSms,
  type PostCallSmsParams,
} from "@/lib/sms-templates/post-call-sequence";

// ============================================================
// Existing: Process Lead SMS Reply
// ============================================================

/**
 * Process Lead SMS Reply
 *
 * Triggered when a lead replies to an SMS
 * Runs Holly's autonomous agent to analyze and respond
 */
export const processLeadReply = inngest.createFunction(
  {
    id: "process-lead-reply",
    name: "Process Lead SMS Reply with Autonomous Holly",
    retries: 2, // Auto-retry on failure
    rateLimit: {
      limit: 10,
      period: "1m", // Max 10 concurrent leads (prevents Claude API rate limits)
    },
  },
  { event: "lead/reply" },
  async ({ event, step }) => {
    const { leadId, message, phone } = event.data;

    console.log(`[Inngest Worker] Processing lead reply: ${leadId}`);

    // Step 1: Process with Autonomous Holly Agent
    const result = await step.run("process-with-autonomous-holly", async () => {
      try {
        // Pass 'sms_reply' to allow processing of CONVERTED leads (reactive responses)
        return await processLeadWithAutonomousAgent(leadId, 'sms_reply');
      } catch (error) {
        console.error(`[Inngest Worker] Error processing lead ${leadId}:`, error);
        throw error; // Re-throw so Inngest retries
      }
    });

    // Step 2: Handle result
    const typedResult = result as any;
    if (typedResult.success) {
      console.log(`[Inngest Worker] ✅ Success: ${leadId} → ${typedResult.action}`);
      return {
        success: true,
        action: typedResult.action,
        message: typedResult.message,
      };
    } else {
      console.log(`[Inngest Worker] ⏭️  Deferred: ${leadId} → ${typedResult.reason}`);

      // Only send error alert if it's an actual error (not just "wait" decision or safety guardrail block)
      const reasonLower = (typedResult.reason || '').toLowerCase();
      const isError =
        typedResult.reason &&
        !reasonLower.includes("wait") &&
        !reasonLower.includes("blocked") &&
        !reasonLower.includes("disabled") &&
        !reasonLower.includes("critical:") && // Safety guardrail blocks start with "CRITICAL:"
        !reasonLower.includes("outside sms hours") &&
        !reasonLower.includes("too soon") &&
        !reasonLower.includes("opted out") &&
        !reasonLower.includes("no proactive outreach"); // Status guard for CONVERTED/LOST/DEALS_WON leads

      if (isError) {
        await sendErrorAlert({
          error: new Error(typedResult.reason || "Unknown error"),
          context: {
            location: "Inngest Worker - process-lead-reply",
            leadId,
            details: { message, phone, reason: typedResult.reason },
          },
        });
      }

      return {
        success: false,
        reason: typedResult.reason,
      };
    }
  }
);

// ============================================================
// Post-Call Email Sequence (automated_sequence)
// ============================================================

/**
 * Helper: Check if lead has started or completed application
 * If so, skip the follow-up (they've already converted)
 */
async function hasApplicationStarted(leadId: string): Promise<boolean> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { applicationStartedAt: true, applicationCompletedAt: true },
  });
  return !!(lead?.applicationStartedAt || lead?.applicationCompletedAt);
}

/**
 * Helper: Get lead email params for email sequence
 */
async function getEmailParams(leadId: string, reportId: string): Promise<{
  lead: { email: string; firstName: string; consentEmail: boolean };
  params: PostCallEmailParams;
} | null> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      lead: {
        select: {
          id: true,
          email: true,
          firstName: true,
          consentEmail: true,
        },
      },
      generatedBy: {
        select: {
          name: true,
          email: true,
          phone: true,
          calLink: true,
        },
      },
    },
  });

  if (!report || !report.lead.email) return null;

  return {
    lead: {
      email: report.lead.email,
      firstName: report.lead.firstName || 'there',
      consentEmail: report.lead.consentEmail ?? true,
    },
    params: {
      clientFirstName: report.lead.firstName || 'there',
      advisorName: report.consultantName || report.generatedBy.name || 'Your Advisor',
      advisorEmail: report.generatedBy.email,
      advisorPhone: report.generatedBy.phone || undefined,
      advisorCalLink: report.generatedBy.calLink || undefined,
    },
  };
}

/**
 * Email Follow-Up Day 3
 * Fires 3 days after report sent. Checks if application started (skip if so).
 */
export const emailFollowUpDay3 = inngest.createFunction(
  {
    id: "email-followup-day3",
    name: "Post-Call Email: Day 3 Follow-Up",
    retries: 2,
  },
  { event: "report/sent" },
  async ({ event, step }) => {
    const { leadId, reportId } = event.data;

    // Wait 3 days
    await step.sleep("wait-3-days", "3d");

    // Check if application started — skip if so
    const appStarted = await step.run("check-application-day3", async () => {
      return await hasApplicationStarted(leadId);
    });

    if (appStarted) {
      console.log(`[Email Sequence] Day 3: Skipping ${leadId} — application already started`);
      return { skipped: true, reason: "application_started" };
    }

    // Get email params
    const data = await step.run("get-email-params-day3", async () => {
      return await getEmailParams(leadId, reportId);
    });

    if (!data || !data.lead.consentEmail) {
      console.log(`[Email Sequence] Day 3: Skipping ${leadId} — no email or no consent`);
      return { skipped: true, reason: "no_email_or_consent" };
    }

    // Send Day 3 email
    await step.run("send-day3-email", async () => {
      const email = buildDay3FollowUpEmail(data.params);

      await sendEmail({
        to: data.lead.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      // Log activity
      await prisma.leadActivity.create({
        data: {
          leadId,
          type: ActivityType.EMAIL_SENT,
          channel: CommunicationChannel.EMAIL,
          subject: email.subject,
          content: `[Automated Sequence - Day 3] ${email.subject}`,
          metadata: {
            sequenceType: "automated_sequence",
            sequenceStep: "day3",
            reportId,
          },
        },
      });

      console.log(`[Email Sequence] Day 3: Sent to ${leadId}`);
    });

    return { success: true, step: "day3" };
  }
);

/**
 * Email Follow-Up Day 7
 * Fires 7 days after report sent. Checks if application started (skip if so).
 */
export const emailFollowUpDay7 = inngest.createFunction(
  {
    id: "email-followup-day7",
    name: "Post-Call Email: Day 7 Follow-Up",
    retries: 2,
  },
  { event: "report/sent" },
  async ({ event, step }) => {
    const { leadId, reportId } = event.data;

    // Wait 7 days
    await step.sleep("wait-7-days", "7d");

    // Check if application started — skip if so
    const appStarted = await step.run("check-application-day7", async () => {
      return await hasApplicationStarted(leadId);
    });

    if (appStarted) {
      console.log(`[Email Sequence] Day 7: Skipping ${leadId} — application already started`);
      return { skipped: true, reason: "application_started" };
    }

    // Get email params
    const data = await step.run("get-email-params-day7", async () => {
      return await getEmailParams(leadId, reportId);
    });

    if (!data || !data.lead.consentEmail) {
      console.log(`[Email Sequence] Day 7: Skipping ${leadId} — no email or no consent`);
      return { skipped: true, reason: "no_email_or_consent" };
    }

    // Send Day 7 email
    await step.run("send-day7-email", async () => {
      const email = buildDay7FollowUpEmail(data.params);

      await sendEmail({
        to: data.lead.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      // Log activity
      await prisma.leadActivity.create({
        data: {
          leadId,
          type: ActivityType.EMAIL_SENT,
          channel: CommunicationChannel.EMAIL,
          subject: email.subject,
          content: `[Automated Sequence - Day 7] ${email.subject}`,
          metadata: {
            sequenceType: "automated_sequence",
            sequenceStep: "day7",
            reportId,
          },
        },
      });

      console.log(`[Email Sequence] Day 7: Sent to ${leadId}`);
    });

    return { success: true, step: "day7" };
  }
);

// ============================================================
// Post-Call SMS Sequence (automated_sequence)
// ============================================================

/**
 * Helper: Get SMS params for SMS sequence
 */
async function getSmsParams(leadId: string, reportId: string): Promise<{
  lead: { phone: string; firstName: string; consentSms: boolean };
  params: PostCallSmsParams;
} | null> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      lead: {
        select: {
          id: true,
          phone: true,
          firstName: true,
          consentSms: true,
        },
      },
      generatedBy: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!report || !report.lead.phone) return null;

  return {
    lead: {
      phone: report.lead.phone,
      firstName: report.lead.firstName || 'there',
      consentSms: report.lead.consentSms ?? true,
    },
    params: {
      clientFirstName: report.lead.firstName || 'there',
      advisorName: report.consultantName || report.generatedBy.name || 'Your Advisor',
    },
  };
}

/**
 * SMS Follow-Up Day 2
 * Fires 2 days after report sent.
 */
export const smsFollowUpDay2 = inngest.createFunction(
  {
    id: "sms-followup-day2",
    name: "Post-Call SMS: Day 2 Follow-Up",
    retries: 2,
  },
  { event: "report/sent" },
  async ({ event, step }) => {
    const { leadId, reportId } = event.data;

    // Wait 2 days
    await step.sleep("wait-2-days", "2d");

    // Check if application started — skip if so
    const appStarted = await step.run("check-application-sms-day2", async () => {
      return await hasApplicationStarted(leadId);
    });

    if (appStarted) {
      console.log(`[SMS Sequence] Day 2: Skipping ${leadId} — application already started`);
      return { skipped: true, reason: "application_started" };
    }

    // Get SMS params
    const data = await step.run("get-sms-params-day2", async () => {
      return await getSmsParams(leadId, reportId);
    });

    if (!data || !data.lead.consentSms) {
      console.log(`[SMS Sequence] Day 2: Skipping ${leadId} — no phone or no consent`);
      return { skipped: true, reason: "no_phone_or_consent" };
    }

    // Send Day 2 SMS
    await step.run("send-day2-sms", async () => {
      const message = buildDay2FollowUpSms(data.params);

      await sendSms({
        to: data.lead.phone,
        body: message,
      });

      // Log activity
      await prisma.leadActivity.create({
        data: {
          leadId,
          type: ActivityType.SMS_SENT,
          channel: CommunicationChannel.SMS,
          subject: "[Automated Sequence - Day 2] Follow-up SMS",
          content: message,
          metadata: {
            sequenceType: "automated_sequence",
            sequenceStep: "sms_day2",
            reportId,
          },
        },
      });

      console.log(`[SMS Sequence] Day 2: Sent to ${leadId}`);
    });

    return { success: true, step: "sms_day2" };
  }
);

/**
 * SMS Follow-Up Day 5
 * Fires 5 days after report sent.
 */
export const smsFollowUpDay5 = inngest.createFunction(
  {
    id: "sms-followup-day5",
    name: "Post-Call SMS: Day 5 Urgency",
    retries: 2,
  },
  { event: "report/sent" },
  async ({ event, step }) => {
    const { leadId, reportId } = event.data;

    // Wait 5 days
    await step.sleep("wait-5-days", "5d");

    // Check if application started
    const appStarted = await step.run("check-application-sms-day5", async () => {
      return await hasApplicationStarted(leadId);
    });

    if (appStarted) {
      console.log(`[SMS Sequence] Day 5: Skipping ${leadId} — application already started`);
      return { skipped: true, reason: "application_started" };
    }

    const data = await step.run("get-sms-params-day5", async () => {
      return await getSmsParams(leadId, reportId);
    });

    if (!data || !data.lead.consentSms) {
      console.log(`[SMS Sequence] Day 5: Skipping ${leadId} — no phone or no consent`);
      return { skipped: true, reason: "no_phone_or_consent" };
    }

    await step.run("send-day5-sms", async () => {
      const message = buildDay5UrgencySms(data.params);

      await sendSms({
        to: data.lead.phone,
        body: message,
      });

      await prisma.leadActivity.create({
        data: {
          leadId,
          type: ActivityType.SMS_SENT,
          channel: CommunicationChannel.SMS,
          subject: "[Automated Sequence - Day 5] Urgency SMS",
          content: message,
          metadata: {
            sequenceType: "automated_sequence",
            sequenceStep: "sms_day5",
            reportId,
          },
        },
      });

      console.log(`[SMS Sequence] Day 5: Sent to ${leadId}`);
    });

    return { success: true, step: "sms_day5" };
  }
);

/**
 * SMS Follow-Up Day 10
 * Fires 10 days after report sent. Final touch.
 */
export const smsFollowUpDay10 = inngest.createFunction(
  {
    id: "sms-followup-day10",
    name: "Post-Call SMS: Day 10 Final Touch",
    retries: 2,
  },
  { event: "report/sent" },
  async ({ event, step }) => {
    const { leadId, reportId } = event.data;

    // Wait 10 days
    await step.sleep("wait-10-days", "10d");

    // Check if application started
    const appStarted = await step.run("check-application-sms-day10", async () => {
      return await hasApplicationStarted(leadId);
    });

    if (appStarted) {
      console.log(`[SMS Sequence] Day 10: Skipping ${leadId} — application already started`);
      return { skipped: true, reason: "application_started" };
    }

    const data = await step.run("get-sms-params-day10", async () => {
      return await getSmsParams(leadId, reportId);
    });

    if (!data || !data.lead.consentSms) {
      console.log(`[SMS Sequence] Day 10: Skipping ${leadId} — no phone or no consent`);
      return { skipped: true, reason: "no_phone_or_consent" };
    }

    await step.run("send-day10-sms", async () => {
      const message = buildDay10FinalSms(data.params);

      await sendSms({
        to: data.lead.phone,
        body: message,
      });

      await prisma.leadActivity.create({
        data: {
          leadId,
          type: ActivityType.SMS_SENT,
          channel: CommunicationChannel.SMS,
          subject: "[Automated Sequence - Day 10] Final touch SMS",
          content: message,
          metadata: {
            sequenceType: "automated_sequence",
            sequenceStep: "sms_day10",
            reportId,
          },
        },
      });

      console.log(`[SMS Sequence] Day 10: Sent to ${leadId}`);
    });

    return { success: true, step: "sms_day10" };
  }
);
