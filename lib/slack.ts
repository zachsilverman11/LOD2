const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL || "https://lod2.vercel.app";

interface SlackNotification {
  type: "new_lead" | "no_response" | "lead_rotting" | "hot_lead_going_cold" | "call_booked" | "call_missed" | "converted";
  leadName: string;
  leadId: string;
  details?: string;
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
      console.error("Slack notification failed:", await response.text());
    }
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
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
                url: "https://lod2.vercel.app/dev-board",
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
      console.error("Slack dev card notification failed:", await response.text());
    }
  } catch (error) {
    console.error("Failed to send Slack dev card notification:", error);
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
      console.error("Slack error alert failed:", await response.text());
    }
  } catch (sendError) {
    console.error("Failed to send Slack error alert:", sendError);
  }
}
