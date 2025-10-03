import { prisma } from "@/lib/db";
import { sendEmail, interpolateTemplate, EMAIL_TEMPLATES } from "@/lib/email";
import { sendSms, SMS_TEMPLATES } from "@/lib/sms";
import { initiateCall } from "@/lib/voice-ai";
import { normalizePhoneNumber } from "@/lib/sms";
import { LeadStatus, ActivityType, CommunicationChannel } from "@/app/generated/prisma";

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
    }
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
