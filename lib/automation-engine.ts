import { prisma } from "@/lib/db";
import { sendEmail, interpolateTemplate, EMAIL_TEMPLATES } from "@/lib/email";
import { sendSms, SMS_TEMPLATES } from "@/lib/sms";
import { initiateCall } from "@/lib/voice-ai";
import { normalizePhoneNumber } from "@/lib/sms";
import { LeadStatus, ActivityType, CommunicationChannel } from "@/app/generated/prisma";
import { handleConversation, executeDecision } from "@/lib/ai-conversation-enhanced";
import { sendSlackNotification, sendErrorAlert } from "@/lib/slack";

/**
 * Automation rule trigger types
 */
export type TriggerType = "time_based" | "event_based" | "status_based";

/**
 * Automation action types
 */
export type ActionType = "send_email" | "send_sms" | "make_call" | "change_status" | "add_note";

export interface AutomationCondition {
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains";
  value: any;
}

export interface AutomationAction {
  type: ActionType;
  config: {
    template?: string;
    subject?: string;
    body?: string;
    status?: LeadStatus;
    note?: string;
    variables?: Record<string, string>;
  };
}

/**
 * Evaluate if a lead matches automation conditions
 */
export function evaluateConditions(lead: any, conditions: AutomationCondition[]): boolean {
  return conditions.every((condition) => {
    const leadValue = lead[condition.field];

    switch (condition.operator) {
      case "equals":
        return leadValue === condition.value;
      case "not_equals":
        return leadValue !== condition.value;
      case "greater_than":
        return leadValue > condition.value;
      case "less_than":
        return leadValue < condition.value;
      case "contains":
        return String(leadValue).includes(condition.value);
      default:
        return false;
    }
  });
}

/**
 * Execute automation actions for a lead
 */
export async function executeActions(leadId: string, actions: AutomationAction[]) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  for (const action of actions) {
    try {
      switch (action.type) {
        case "send_email":
          await executeSendEmail(lead, action.config);
          break;
        case "send_sms":
          await executeSendSms(lead, action.config);
          break;
        case "make_call":
          await executeMakeCall(lead, action.config);
          break;
        case "change_status":
          await executeChangeStatus(lead, action.config);
          break;
        case "add_note":
          await executeAddNote(lead, action.config);
          break;
      }
    } catch (error) {
      console.error(`Error executing action ${action.type} for lead ${leadId}:`, error);
    }
  }
}

async function executeSendEmail(lead: any, config: any) {
  if (!lead.consentEmail) {
    console.log("Skipping email - no consent");
    return;
  }

  const variables = {
    firstName: lead.firstName,
    lastName: lead.lastName,
    ...config.variables,
  };

  const subject = interpolateTemplate(config.subject || "Update from your mortgage team", variables);
  const body = interpolateTemplate(config.body || "", variables);

  await sendEmail({
    to: lead.email,
    subject,
    html: body,
  });

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: ActivityType.EMAIL_SENT,
      channel: CommunicationChannel.EMAIL,
      subject,
      content: body,
      metadata: { automated: true, template: config.template },
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastContactedAt: new Date() },
  });
}

async function executeSendSms(lead: any, config: any) {
  if (!lead.consentSms || !lead.phone) {
    console.log("Skipping SMS - no consent or phone");
    return;
  }

  const variables = {
    firstName: lead.firstName,
    ...config.variables,
  };

  const body = interpolateTemplate(config.body || "", variables);

  await sendSms({
    to: normalizePhoneNumber(lead.phone),
    body,
  });

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: ActivityType.SMS_SENT,
      channel: CommunicationChannel.SMS,
      content: body,
      metadata: { automated: true },
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastContactedAt: new Date() },
  });
}

async function executeMakeCall(lead: any, config: any) {
  if (!lead.consentCall || !lead.phone) {
    console.log("Skipping call - no consent or phone");
    return;
  }

  const callResult = await initiateCall({
    phoneNumber: normalizePhoneNumber(lead.phone),
    metadata: {
      leadId: lead.id,
      automated: true,
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: ActivityType.CALL_INITIATED,
      channel: CommunicationChannel.VOICE,
      content: "Automated outbound call initiated",
      metadata: { callId: callResult.id, automated: true },
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastContactedAt: new Date() },
  });
}

async function executeChangeStatus(lead: any, config: any) {
  if (!config.status) return;

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: config.status },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: ActivityType.STATUS_CHANGE,
      channel: CommunicationChannel.SYSTEM,
      content: `Status automatically changed to ${config.status}`,
      metadata: { automated: true },
    },
  });
}

async function executeAddNote(lead: any, config: any) {
  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: ActivityType.NOTE_ADDED,
      channel: CommunicationChannel.SYSTEM,
      content: config.note || "Automated note",
      metadata: { automated: true },
    },
  });
}

/**
 * Process time-based automation rules
 * This should be called by a cron job
 */
export async function processTimeBasedAutomations() {
  console.log("[Automation] Starting time-based automations...");

  try {
    // Run the built-in smart automations
    await processAppointmentReminders();
    await processSmartFollowUps();
    await processPostCallConfirmations();
    await processApplicationNudges();
    await processStaleLeadAlerts();

    // Then process custom automation rules from database
    const rules = await prisma.automationRule.findMany({
      where: {
        isActive: true,
        triggerType: "time_based",
      },
      orderBy: { priority: "desc" },
    });

    for (const rule of rules) {
      try {
        const condition = rule.triggerCondition as any;
        const actions = rule.actions as AutomationAction[];

        // Example: Find leads that match the time condition
        // e.g., "24 hours since creation with no contact"
        const leads = await findLeadsMatchingTimeCondition(condition);

        for (const lead of leads) {
          if (evaluateConditions(lead, condition.conditions || [])) {
            await executeActions(lead.id, actions);
          }
        }
      } catch (error) {
        console.error(`Error processing automation rule ${rule.id}:`, error);

        await sendErrorAlert({
          error: error instanceof Error ? error : new Error(String(error)),
          context: {
            location: "automation-engine - Custom automation rule",
            details: { ruleId: rule.id, ruleName: rule.name },
          },
        });
      }
    }

    console.log("[Automation] Completed time-based automations");
  } catch (error) {
    console.error("[Automation] Critical error in processTimeBasedAutomations:", error);

    await sendErrorAlert({
      error: error instanceof Error ? error : new Error(String(error)),
      context: {
        location: "automation-engine - processTimeBasedAutomations",
        details: { message: "Critical failure in automation engine" },
      },
    });
  }
}

async function findLeadsMatchingTimeCondition(condition: any) {
  const { timeField, timeValue, timeUnit, status } = condition;

  const now = new Date();
  const timeAgo = new Date(
    now.getTime() - timeValue * (timeUnit === "hours" ? 3600000 : 86400000)
  );

  return await prisma.lead.findMany({
    where: {
      status,
      [timeField]: {
        lte: timeAgo,
      },
    },
  });
}

/**
 * Default automation rules to seed the database
 */
export const DEFAULT_AUTOMATION_RULES = [
  {
    name: "Welcome Email - New Leads",
    description: "Send welcome email immediately after lead creation",
    triggerType: "event_based",
    triggerCondition: {
      event: "lead.created",
    },
    actions: [
      {
        type: "send_email",
        config: {
          template: "WELCOME",
          subject: EMAIL_TEMPLATES.WELCOME.subject,
          body: EMAIL_TEMPLATES.WELCOME.html,
        },
      },
    ],
    isActive: true,
    priority: 10,
  },
  {
    name: "Follow-up SMS - 24 Hours No Response",
    description: "Send SMS if no contact within 24 hours",
    triggerType: "time_based",
    triggerCondition: {
      timeField: "createdAt",
      timeValue: 24,
      timeUnit: "hours",
      status: "NEW",
      conditions: [
        {
          field: "lastContactedAt",
          operator: "equals",
          value: null,
        },
      ],
    },
    actions: [
      {
        type: "send_sms",
        config: {
          body: SMS_TEMPLATES.SCHEDULE_CALL,
          variables: {
            advisorName: "Your Mortgage Team",
            schedulingLink: process.env.NEXT_PUBLIC_APP_URL + "/schedule",
          },
        },
      },
      {
        type: "change_status",
        config: {
          status: "CONTACTED",
        },
      },
    ],
    isActive: true,
    priority: 8,
  },
  {
    name: "Voice AI Call - 48 Hours No Response",
    description: "Initiate AI call if no response within 48 hours",
    triggerType: "time_based",
    triggerCondition: {
      timeField: "lastContactedAt",
      timeValue: 48,
      timeUnit: "hours",
      status: "CONTACTED",
    },
    actions: [
      {
        type: "make_call",
        config: {},
      },
    ],
    isActive: true,
    priority: 7,
  },
  {
    name: "Call Reminder - 1 Day Before",
    description: "Send reminder 24 hours before scheduled call",
    triggerType: "time_based",
    triggerCondition: {
      timeField: "appointments.scheduledAt",
      timeValue: 24,
      timeUnit: "hours",
      status: "CALL_SCHEDULED",
    },
    actions: [
      {
        type: "send_email",
        config: {
          template: "CALL_REMINDER",
          subject: EMAIL_TEMPLATES.CALL_REMINDER.subject,
          body: EMAIL_TEMPLATES.CALL_REMINDER.html,
        },
      },
    ],
    isActive: true,
    priority: 9,
  },
];

/**
 * Appointment Reminders: Send automated reminders 24h and 1h before appointments
 */
async function processAppointmentReminders() {
  console.log("[Automation] Processing appointment reminders...");

  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 3600000);
  const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 3600000);
  const oneHourFromNow = new Date(now.getTime() + 1 * 3600000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 3600000);

  // Find appointments scheduled in 24-25 hours (1-hour window for cron tolerance)
  // Use scheduledFor if available, otherwise fall back to scheduledAt
  const allAppointments = await prisma.appointment.findMany({
    where: {
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    include: {
      lead: true,
    },
  });

  const appointments24h = allAppointments.filter((apt) => {
    const appointmentTime = apt.scheduledFor || apt.scheduledAt;
    return (
      appointmentTime >= twentyFourHoursFromNow &&
      appointmentTime <= twentyFiveHoursFromNow &&
      !apt.reminder24hSent
    );
  });

  const appointments1h = allAppointments.filter((apt) => {
    const appointmentTime = apt.scheduledFor || apt.scheduledAt;
    return (
      appointmentTime >= oneHourFromNow &&
      appointmentTime <= twoHoursFromNow &&
      !apt.reminder1hSent
    );
  });

  // Send 24-hour reminders
  for (const appointment of appointments24h) {
    try {
      const lead = appointment.lead;
      const appointmentTime = (appointment.scheduledFor || appointment.scheduledAt).toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Vancouver'
      });

      const reminderMessage = `Hey ${lead.name?.split(' ')[0] || 'there'}! Just a friendly reminder - your mortgage discovery call is tomorrow at ${appointmentTime} PT. Looking forward to it! 📅`;

      await sendSms({
        to: lead.phone || '',
        body: reminderMessage,
      });

      await prisma.communication.create({
        data: {
          leadId: lead.id,
          channel: "SMS",
          direction: "OUTBOUND",
          content: reminderMessage,
          intent: "appointment_reminder_24h",
          metadata: { automated: true, appointmentId: appointment.id },
        },
      });

      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminder24hSent: true },
      });

      console.log(`[Automation] 24h reminder sent for appointment ${appointment.id}, lead ${lead.id}`);
    } catch (error) {
      console.error(`[Automation] Error sending 24h reminder for appointment ${appointment.id}:`, error);
      await sendErrorAlert({
        error: error instanceof Error ? error : new Error(String(error)),
        context: {
          location: "automation-engine - 24h appointment reminder",
          details: { appointmentId: appointment.id, leadId: appointment.lead.id },
        },
      });
    }
  }

  // Send 1-hour reminders
  for (const appointment of appointments1h) {
    try {
      const lead = appointment.lead;
      const appointmentTime = (appointment.scheduledFor || appointment.scheduledAt).toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Vancouver'
      });

      const reminderMessage = `Quick reminder - your mortgage discovery call is in 1 hour at ${appointmentTime} PT. See you soon! 🎯`;

      await sendSms({
        to: lead.phone || '',
        body: reminderMessage,
      });

      await prisma.communication.create({
        data: {
          leadId: lead.id,
          channel: "SMS",
          direction: "OUTBOUND",
          content: reminderMessage,
          intent: "appointment_reminder_1h",
          metadata: { automated: true, appointmentId: appointment.id },
        },
      });

      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminder1hSent: true },
      });

      console.log(`[Automation] 1h reminder sent for appointment ${appointment.id}, lead ${lead.id}`);
    } catch (error) {
      console.error(`[Automation] Error sending 1h reminder for appointment ${appointment.id}:`, error);
      await sendErrorAlert({
        error: error instanceof Error ? error : new Error(String(error)),
        context: {
          location: "automation-engine - 1h appointment reminder",
          details: { appointmentId: appointment.id, leadId: appointment.lead.id },
        },
      });
    }
  }

  console.log(`[Automation] Sent ${appointments24h.length} x 24h reminders, ${appointments1h.length} x 1h reminders`);
}

/**
 * Smart Follow-Ups: Send AI-driven follow-ups to non-responsive leads
 */
async function processSmartFollowUps() {
  console.log("[Automation] Processing smart follow-ups...");

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 1 * 3600000);
  const fourHoursAgo = new Date(now.getTime() - 4 * 3600000);
  const twelveHoursAgo = new Date(now.getTime() - 12 * 3600000);
  const oneDayAgo = new Date(now.getTime() - 24 * 3600000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 3600000);

  // Find leads in CONTACTED or ENGAGED that haven't been contacted recently
  const leads = await prisma.lead.findMany({
    where: {
      status: {
        in: ["CONTACTED", "ENGAGED", "NURTURING"],
      },
      consentSms: true,
      lastContactedAt: {
        lte: oneHourAgo, // Check if need follow-up (starts at 1 hour)
      },
    },
    include: {
      communications: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  for (const lead of leads) {
    try {
      const hoursSinceContact = Math.floor(
        (now.getTime() - (lead.lastContactedAt?.getTime() || lead.createdAt.getTime())) / 3600000
      );
      const daysSinceContact = Math.floor(hoursSinceContact / 24);

      // Check if they ever replied
      const hasReplied = lead.communications.some((c) => c.direction === "INBOUND");

      // Count total outbound messages to this lead
      const outboundCount = lead.communications.filter((c) => c.direction === "OUTBOUND").length;

      // Multi-phase follow-up strategy
      let shouldFollowUp = false;
      let followUpReason = "";

      if (!hasReplied && daysSinceContact >= 60) {
        // 60+ days, no response ever -> archive to LOST
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "LOST" },
        });

        await sendSlackNotification({
          type: "lead_rotting",
          leadName: `${lead.firstName} ${lead.lastName}`,
          leadId: lead.id,
          details: `60 days, ${outboundCount} messages, no response. Archived to LOST.`,
        });

        console.log(`[Automation] Lead ${lead.id} moved to LOST after 60 days`);
        continue;
      }

      // 🔥 FIRST 48 HOURS: STRIKE WHILE HOT (Critical window!)
      if (daysSinceContact === 0) {
        if (outboundCount === 1 && hoursSinceContact >= 1) {
          // Message 2: 1 hour after initial contact
          shouldFollowUp = true;
          followUpReason = "1-hour hot follow-up";
        } else if (outboundCount === 2 && hoursSinceContact >= 4) {
          // Message 3: 4 hours after initial
          shouldFollowUp = true;
          followUpReason = "4-hour follow-up";
        } else if (outboundCount === 3 && hoursSinceContact >= 12) {
          // Message 4: 12 hours after initial
          shouldFollowUp = true;
          followUpReason = "12-hour follow-up";
        }
      } else if (daysSinceContact === 1 && outboundCount <= 5) {
        // Day 2: Morning follow-up
        shouldFollowUp = true;
        followUpReason = "Day 2 morning touch";
      } else if (daysSinceContact === 2 && outboundCount <= 6) {
        // Day 3: Afternoon check-in
        shouldFollowUp = true;
        followUpReason = "Day 3 check-in";
      } else if (daysSinceContact === 4 && outboundCount <= 7) {
        // Day 5: Mid-week touch
        shouldFollowUp = true;
        followUpReason = "Day 5 mid-week";
      } else if (daysSinceContact === 6 && outboundCount <= 8) {
        // Day 7: End of week
        shouldFollowUp = true;
        followUpReason = "Day 7 week-end";
      }
      // 📅 WEEK 2 (Days 8-14): Every 2-3 days
      else if (daysSinceContact >= 8 && daysSinceContact <= 14) {
        const daysSinceLastMessage = Math.floor(
          (now.getTime() - (lead.lastContactedAt?.getTime() || 0)) / 86400000
        );
        if (daysSinceLastMessage >= 2) {
          shouldFollowUp = true;
          followUpReason = "Week 2 follow-up";
        }
      }
      // 📅 WEEK 3-4 (Days 15-30): Every 4 days
      else if (daysSinceContact >= 15 && daysSinceContact <= 30) {
        const daysSinceLastMessage = Math.floor(
          (now.getTime() - (lead.lastContactedAt?.getTime() || 0)) / 86400000
        );
        if (daysSinceLastMessage >= 4) {
          shouldFollowUp = true;
          followUpReason = "Week 3-4 nurture";
        }
      }
      // 📅 MONTH 2 (Days 31-60): Weekly
      else if (daysSinceContact >= 31 && daysSinceContact <= 60) {
        const daysSinceLastMessage = Math.floor(
          (now.getTime() - (lead.lastContactedAt?.getTime() || 0)) / 86400000
        );
        if (daysSinceLastMessage >= 7) {
          shouldFollowUp = true;
          followUpReason = "Month 2 weekly";
        }
      }

      // Send Slack alerts at key milestones
      if ([3, 7, 10, 15, 21, 28, 35, 45, 55].includes(daysSinceContact)) {
        const phase = daysSinceContact <= 14 ? "Active Pursuit" : daysSinceContact <= 30 ? "Nurturing" : "Long-term";
        await sendSlackNotification({
          type: daysSinceContact >= 30 ? "lead_rotting" : "no_response",
          leadName: `${lead.firstName} ${lead.lastName}`,
          leadId: lead.id,
          details: `Day ${daysSinceContact} | ${outboundCount} messages sent | ${phase} phase | ${hasReplied ? "Has replied before" : "Never replied"}`,
        });
      }

      // Send AI follow-up if it's time
      if (shouldFollowUp) {
        console.log(`[Automation] ${followUpReason} - Sending to lead ${lead.id} (Day ${daysSinceContact}, Hour ${hoursSinceContact}, Message #${outboundCount + 1})`);

        try {
          const decision = await handleConversation(lead.id);
          await executeDecision(lead.id, decision);

          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              lastContactedAt: now,
              status: outboundCount >= 5 ? "NURTURING" : lead.status,
            },
          });
        } catch (followUpError) {
          await sendErrorAlert({
            error: followUpError instanceof Error ? followUpError : new Error(String(followUpError)),
            context: {
              location: "automation-engine - Smart follow-up",
              leadId: lead.id,
              details: { followUpReason, daysSinceContact, outboundCount },
            },
          });
          throw followUpError;
        }
      }
    } catch (error) {
      console.error(`[Automation] Error processing follow-up for lead ${lead.id}:`, error);

      // Send error alert for automation failure
      await sendErrorAlert({
        error: error instanceof Error ? error : new Error(String(error)),
        context: {
          location: "automation-engine - processSmartFollowUps loop",
          leadId: lead.id,
          details: { message: "Failed to process smart follow-up" },
        },
      });
    }
  }
}

/**
 * Post-Call Confirmations: Check if scheduled calls have passed
 */
async function processPostCallConfirmations() {
  console.log("[Automation] Processing post-call confirmations...");

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);

  // Find leads with scheduled appointments that have passed
  const appointments = await prisma.appointment.findMany({
    where: {
      status: "scheduled",
      scheduledAt: {
        lte: oneHourAgo, // Call was scheduled for at least 1 hour ago
      },
    },
    include: {
      lead: true,
    },
  });

  for (const appointment of appointments) {
    try {
      // Send Slack alert to confirm if call happened
      await sendSlackNotification({
        type: "call_missed",
        leadName: `${appointment.lead.firstName} ${appointment.lead.lastName}`,
        leadId: appointment.lead.id,
        details: `Call was scheduled for ${appointment.scheduledAt.toLocaleString()}. Did it happen? You have 1 hour to mark as no-show if needed.`,
      });

      // Mark appointment as completed
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: "completed" },
      });

      // Move lead to CALL_COMPLETED
      await prisma.lead.update({
        where: { id: appointment.lead.id },
        data: { status: "CALL_COMPLETED" },
      });

      // Queue post-call follow-up message for 1 hour later (gives team time to mark no-show)
      const scheduledFor = new Date();
      scheduledFor.setHours(scheduledFor.getHours() + 1);

      await prisma.scheduledMessage.create({
        data: {
          leadId: appointment.lead.id,
          channel: "SMS",
          content: "POST_CALL_FOLLOWUP", // Special marker - actual message will be generated by AI
          scheduledFor,
          metadata: {
            messageType: "post_call_followup",
            appointmentId: appointment.id,
            automated: true,
          },
        },
      });

      console.log(`[Automation] Post-call confirmation sent for appointment ${appointment.id}, follow-up queued for ${scheduledFor.toLocaleString()}`);
    } catch (error) {
      console.error(`[Automation] Error processing post-call for appointment ${appointment.id}:`, error);
    }
  }
}

/**
 * Application Nudges: Follow up with leads who have started but not completed applications
 */
async function processApplicationNudges() {
  console.log("[Automation] Processing application nudges...");

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 3600000);
  const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 3600000);

  // 1. Find leads with APPLICATION_STARTED for 24+ hours (first nudge)
  const incompleteApps24h = await prisma.lead.findMany({
    where: {
      status: LeadStatus.APPLICATION_STARTED,
      applicationStartedAt: {
        lte: twentyFourHoursAgo,
        gte: fortyEightHoursAgo, // Only those between 24-48h
      },
    },
    include: {
      communications: {
        where: {
          createdAt: { gte: twentyFourHoursAgo },
        },
      },
    },
  });

  // 2. Find leads with APPLICATION_STARTED for 48+ hours (urgent nudge)
  const incompleteApps48h = await prisma.lead.findMany({
    where: {
      status: LeadStatus.APPLICATION_STARTED,
      applicationStartedAt: {
        lte: fortyEightHoursAgo,
      },
    },
    include: {
      communications: {
        where: {
          createdAt: { gte: fortyEightHoursAgo },
        },
      },
    },
  });

  // 3. Find leads with CALL_COMPLETED for 72+ hours (no app started)
  const callsWithoutApp = await prisma.lead.findMany({
    where: {
      status: LeadStatus.CALL_COMPLETED,
      updatedAt: {
        lte: seventyTwoHoursAgo,
      },
    },
    include: {
      communications: {
        where: {
          createdAt: { gte: seventyTwoHoursAgo },
        },
      },
    },
  });

  // Send 24-hour nudges
  for (const lead of incompleteApps24h) {
    if (lead.communications.length > 0) continue; // Already messaged in last 24h

    try {
      console.log(`[Automation] Sending 24h app nudge to lead ${lead.id}`);

      const decision = await handleConversation(lead.id);
      await executeDecision(lead.id, decision);

      await prisma.lead.update({
        where: { id: lead.id },
        data: { lastContactedAt: now },
      });

      await sendSlackNotification({
        type: "lead_updated",
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadId: lead.id,
        details: "📝 Application started 24h ago - Holly sent encouragement",
      });
    } catch (error) {
      console.error(`[Automation] Error sending 24h app nudge to lead ${lead.id}:`, error);
    }
  }

  // Send 48-hour urgent nudges
  for (const lead of incompleteApps48h) {
    if (lead.communications.length > 0) continue; // Already messaged in last 48h

    try {
      console.log(`[Automation] Sending 48h URGENT app nudge to lead ${lead.id}`);

      const decision = await handleConversation(lead.id);
      await executeDecision(lead.id, decision);

      await prisma.lead.update({
        where: { id: lead.id },
        data: { lastContactedAt: now },
      });

      await sendSlackNotification({
        type: "lead_updated",
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadId: lead.id,
        details: "⚠️ Application started 48h ago - Holly sent urgent nudge",
      });
    } catch (error) {
      console.error(`[Automation] Error sending 48h app nudge to lead ${lead.id}:`, error);
    }
  }

  // Send "ready to start app?" to completed calls
  for (const lead of callsWithoutApp) {
    if (lead.communications.length > 0) continue; // Already messaged in last 72h

    try {
      console.log(`[Automation] Sending app start prompt to lead ${lead.id} (call completed 72h ago)`);

      const decision = await handleConversation(lead.id);
      await executeDecision(lead.id, decision);

      await prisma.lead.update({
        where: { id: lead.id },
        data: { lastContactedAt: now },
      });

      await sendSlackNotification({
        type: "lead_updated",
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadId: lead.id,
        details: "🚀 Call completed 72h ago, no app - Holly sending application link",
      });
    } catch (error) {
      console.error(`[Automation] Error sending app start prompt to lead ${lead.id}:`, error);
    }
  }

  console.log(`[Automation] Sent ${incompleteApps24h.length} x 24h nudges, ${incompleteApps48h.length} x 48h nudges, ${callsWithoutApp.length} x app start prompts`);
}

/**
 * Stale Lead Alerts: Alert team about leads that need attention
 */
async function processStaleLeadAlerts() {
  console.log("[Automation] Processing stale lead alerts...");

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 72 * 3600000);

  // Find leads that haven't been updated in 3+ days and aren't lost/converted
  const staleLeads = await prisma.lead.findMany({
    where: {
      status: {
        notIn: ["LOST", "CONVERTED"],
      },
      updatedAt: {
        lte: threeDaysAgo,
      },
    },
    include: {
      communications: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  for (const lead of staleLeads) {
    const daysSinceUpdate = Math.floor((now.getTime() - lead.updatedAt.getTime()) / 86400000);
    const lastComm = lead.communications[0];

    if (daysSinceUpdate >= 5) {
      await sendSlackNotification({
        type: "lead_rotting",
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadId: lead.id,
        details: `No activity in ${daysSinceUpdate} days. Last message: ${lastComm ? lastComm.content.substring(0, 50) + "..." : "None"}`,
      });
    }
  }
}
