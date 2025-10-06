const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";

interface SlackNotification {
  type: "new_lead" | "no_response" | "lead_rotting" | "call_booked" | "call_missed" | "converted";
  leadName: string;
  leadId: string;
  details?: string;
  metadata?: Record<string, any>;
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
                text: `<https://lod2-5e814kgl0-zach-silvermans-projects.vercel.app/dashboard|View Dashboard> • Lead ID: \`${leadId}\``,
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
