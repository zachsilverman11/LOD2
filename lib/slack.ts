import { prisma } from './db';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
// Use hardcoded production URL to avoid NEXT_PUBLIC_APP_URL build-time issues (localhost in production)
const DASHBOARD_URL = "https://lod2.vercel.app";

interface SlackNotification {
  type: "new_lead" | "no_response" | "lead_rotting" | "hot_lead_going_cold" | "call_booked" | "call_missed" | "converted" | "lead_escalated" | "app_nudge" | "lead_updated" | "warning" | "error";
  leadName?: string;
  leadId?: string;
  details?: string;
  message?: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface ErrorAlert {
  error: Error;
  context: {
    location: string;
    leadId?: string;
    details?: any;
  };
}

export async function sendSlackNotification(notification: SlackNotification) {
  const { type, leadName, leadId, details, metadata } = notification;

  let emoji = "📋";
  let color = "#625FFF";
  let title = "";
  let message = "";

  switch (type) {
    case "new_lead":
      emoji = "✨";
      color = "#625FFF";
      title = "New Lead Created";
      message = `*${leadName}* just came in!\n${details || ""}`;
      break;

    case "no_response":
      emoji = "⚠️";
      color = "#F6D7FF";
      title = "Lead Not Responding";
      message = `*${leadName}* hasn't replied.\n${details || "Check in?"}`;
      break;

    case "lead_rotting":
      emoji = "🔴";
      color = "#FF6B6B";
      title = "Lead Going Cold";
      message = `*${leadName}* is going cold!\n${details || "Time to take action"}`;
      break;

    case "hot_lead_going_cold":
      emoji = "🚨";
      color = "#FFA500";
      title = "HOT LEAD GOING COLD";
      message = `*${leadName}* hasn't responded in 24 hours.\n\n${details || ""}\n\n💡 *Consider personal outreach from Greg or Jakub*`;
      break;

    case "call_booked":
      emoji = "📞";
      color = "#D9F36E";
      title = "Call Scheduled!";
      message = `*${leadName}* booked a call!\n${details || ""}`;
      break;

    case "call_missed":
      emoji = "❌";
      color = "#FF6B6B";
      title = "Call Time Passed";
      message = `*${leadName}*'s call time has passed.\n${details || "Confirm if meeting happened"}`;
      break;

    case "converted":
      emoji = "🎉";
      color = "#D9F36E";
      title = "Lead Converted!";
      message = `*${leadName}* converted! 🎉\n${details || ""}`;
      break;

    case "lead_escalated":
      emoji = "🚨";
      color = "#FF0000";
      title = "HOLLY ESCALATION - Action Required";
      message = `*${leadName}* has been escalated by Holly.\n\n${details || "Review needed"}`;
      break;
  }

  const payload = {
    attachments: [
      {
        color,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `${emoji} ${title}`,
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: message,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `<${DASHBOARD_URL}/dashboard|View Dashboard> • Lead ID: \`${leadId}\``,
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Slack notification failed:", errorText);

      // Log to database as fallback
      await logFailedSlackAlert({
        type: 'notification',
        title,
        leadId,
        payload: JSON.stringify(payload),
        error: `Slack API returned ${response.status}: ${errorText}`,
      });
    }
  } catch (error) {
    console.error("Failed to send Slack notification:", error);

    // Log to database as fallback
    await logFailedSlackAlert({
      type: 'notification',
      title,
      leadId,
      payload: JSON.stringify(payload),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function sendDevCardNotification(card: {
  id: string;
  title: string;
  type: string;
  priority: string;
  createdBy: string;
  description?: string | null;
}) {
  const isAI = card.createdBy === "HOLLY_AI";
  const priorityEmoji = card.priority === "CRITICAL" ? "🚨" : card.priority === "HIGH" ? "⚠️" : "📋";
  const typeEmoji = card.type === "BUG_FIX" ? "🐛" : card.type === "FEATURE_REQUEST" ? "✨" : "🔧";

  const payload = {
    attachments: [
      {
        color: card.priority === "CRITICAL" ? "#FF0000" : card.priority === "HIGH" ? "#FFA500" : "#625FFF",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `${priorityEmoji} ${typeEmoji} ${isAI ? "Holly Detected Issue" : "New Dev Card"}`,
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${card.title}*${card.description ? `\n\n${card.description.substring(0, 200)}${card.description.length > 200 ? "..." : ""}` : ""}`,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `${isAI ? "🤖 AI-Detected" : `Created by ${card.createdBy}`} • Priority: ${card.priority} • Type: ${card.type.replace(/_/g, " ")}`,
              },
            ],
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "View Dev Board",
                  emoji: true,
                },
                url: `${DASHBOARD_URL}/dev-board`,
                style: card.priority === "CRITICAL" ? "danger" : "primary",
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Slack dev card notification failed:", errorText);

      // Log to database as fallback
      await logFailedSlackAlert({
        type: 'dev_card',
        title: card.title,
        leadId: null,
        payload: JSON.stringify(payload),
        error: `Slack API returned ${response.status}: ${errorText}`,
      });
    }
  } catch (error) {
    console.error("Failed to send Slack dev card notification:", error);

    // Log to database as fallback
    await logFailedSlackAlert({
      type: 'dev_card',
      title: card.title,
      leadId: null,
      payload: JSON.stringify(payload),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function sendErrorAlert({ error, context }: ErrorAlert) {
  const { location, leadId, details } = context;

  const errorMessage = error.message || "Unknown error";
  const errorStack = error.stack?.split("\n").slice(0, 5).join("\n") || "No stack trace available";

  const payload = {
    attachments: [
      {
        color: "#FF0000",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🚨 Critical Error Alert",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Location:* \`${location}\`\n*Error:* ${errorMessage}`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `\`\`\`${errorStack}\`\`\``,
            },
          },
          ...(leadId
            ? [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `*Lead ID:* \`${leadId}\``,
                  },
                },
              ]
            : []),
          ...(details
            ? [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `*Details:*\n\`\`\`${JSON.stringify(details, null, 2)}\`\`\``,
                  },
                },
              ]
            : []),
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `<${DASHBOARD_URL}/dashboard|View Dashboard> • ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Slack error alert failed:", errorText);

      // Log to database as fallback
      await logFailedSlackAlert({
        type: 'error_alert',
        title: `Error in ${location}`,
        leadId: leadId || null,
        payload: JSON.stringify(payload),
        error: `Slack API returned ${response.status}: ${errorText}`,
      });
    }
  } catch (sendError) {
    console.error("Failed to send Slack error alert:", sendError);

    // Log to database as fallback - use try/catch to prevent recursive errors
    try {
      await logFailedSlackAlert({
        type: 'error_alert',
        title: `Error in ${location}`,
        leadId: leadId || null,
        payload: JSON.stringify(payload),
        error: sendError instanceof Error ? sendError.message : String(sendError),
      });
    } catch (dbError) {
      console.error("Failed to log Slack alert failure to database:", dbError);
    }
  }
}

/**
 * Log failed Slack alerts to database as fallback
 * This ensures we don't lose important notifications if Slack is down
 */
async function logFailedSlackAlert(data: {
  type: string;
  title: string;
  leadId?: string | null;
  payload: string;
  error: string;
}) {
  try {
    if (!data.leadId) {
      console.error(`[Slack Fallback] Cannot log failed alert to DB — no leadId. Title: ${data.title}, Error: ${data.error}`);
      return;
    }
    await prisma.leadActivity.create({
      data: {
        leadId: data.leadId,
        type: 'NOTE_ADDED' as any,
        channel: 'SYSTEM' as any,
        subject: `⚠️ Failed Slack Alert: ${data.title}`,
        content: `Slack notification failed to send.\n\n**Type:** ${data.type}\n**Error:** ${data.error}\n\n**Payload:**\n\`\`\`\n${data.payload.substring(0, 500)}${data.payload.length > 500 ? '...' : ''}\n\`\`\``,
        metadata: {
          slackAlertFailed: true,
          slackAlertType: data.type,
          slackError: data.error,
        } as any,
      },
    });
  } catch (dbError) {
    console.error("Failed to log Slack alert failure to database:", dbError);
  }
}

/**
 * Slack alert types that should be deduplicated per lead
 */
type DeduplicatedAlertType = "no_response" | "lead_rotting" | "hot_lead_going_cold" | "app_nudge";

/**
 * Send Slack notification with deduplication
 *
 * Prevents spam by checking if we've already sent this type of alert
 * for this lead within the cooldown period.
 *
 * @param notification - The notification to send
 * @param cooldownHours - Hours to wait before sending same alert type for same lead (default: 12)
 * @returns true if sent, false if skipped due to cooldown
 */
export async function sendSlackAlertWithDedup(
  notification: {
    type: DeduplicatedAlertType;
    leadName: string;
    leadId: string;
    details?: string;
    metadata?: Record<string, any>;
  },
  cooldownHours: number = 12
): Promise<boolean> {
  const { type, leadId } = notification;

  try {
    // Check if we've already sent this type of alert recently
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        lastSlackAlertAt: true,
        lastSlackAlertType: true,
      },
    });

    if (!lead) {
      console.log(`[Slack Dedup] Lead ${leadId} not found, skipping alert`);
      return false;
    }

    const now = new Date();
    const cooldownMs = cooldownHours * 60 * 60 * 1000;

    // Check if same alert type was sent within cooldown period
    if (
      lead.lastSlackAlertAt &&
      lead.lastSlackAlertType === type &&
      now.getTime() - lead.lastSlackAlertAt.getTime() < cooldownMs
    ) {
      const hoursSinceLast = Math.floor(
        (now.getTime() - lead.lastSlackAlertAt.getTime()) / (1000 * 60 * 60)
      );
      console.log(
        `[Slack Dedup] Skipping ${type} alert for lead ${leadId} - already sent ${hoursSinceLast}h ago (cooldown: ${cooldownHours}h)`
      );
      return false;
    }

    // Send the notification
    await sendSlackNotification(notification);

    // Update the lead's alert tracking
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        lastSlackAlertAt: now,
        lastSlackAlertType: type,
      },
    });

    console.log(`[Slack Dedup] Sent ${type} alert for lead ${leadId}`);
    return true;
  } catch (error) {
    console.error(`[Slack Dedup] Error checking/sending alert for lead ${leadId}:`, error);
    // Fall back to sending without dedup if there's an error
    await sendSlackNotification(notification);
    return true;
  }
}

/**
 * Check if a lead has an upcoming booked appointment
 * Used to prevent "going cold" alerts for leads who have already booked
 */
export async function hasUpcomingAppointment(leadId: string): Promise<boolean> {
  const now = new Date();

  const upcomingAppointment = await prisma.appointment.findFirst({
    where: {
      leadId,
      status: { in: ["SCHEDULED", "CONFIRMED", "scheduled", "confirmed"] },
      OR: [
        { scheduledFor: { gte: now } },
        { scheduledAt: { gte: now } },
      ],
    },
  });

  return upcomingAppointment !== null;
}
