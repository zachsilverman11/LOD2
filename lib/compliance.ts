/**
 * Canadian Privacy and Compliance Utilities
 *
 * PIPEDA (Personal Information Protection and Electronic Documents Act)
 * - Right to access personal information
 * - Right to correct inaccurate information
 * - Right to withdraw consent
 * - Right to delete personal information
 *
 * CASL (Canadian Anti-Spam Legislation)
 * - Express consent required for commercial electronic messages
 * - Must include identification and unsubscribe mechanism
 * - Must honor unsubscribe requests within 10 business days
 */

import { prisma } from "@/lib/db";

/**
 * Data retention periods (in days)
 */
export const RETENTION_PERIODS = {
  ACTIVE_LEAD: 730, // 2 years
  CONVERTED_LEAD: 2555, // 7 years (financial records)
  LOST_LEAD: 365, // 1 year
  WEBHOOK_LOGS: 90, // 3 months
  ACTIVITY_LOGS: 730, // 2 years
};

/**
 * Export all personal data for a lead (PIPEDA compliance)
 */
export async function exportLeadData(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
      },
      appointments: {
        orderBy: { scheduledAt: "desc" },
      },
    },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  return {
    exportDate: new Date().toISOString(),
    personalInformation: {
      id: lead.id,
      email: lead.email,
      phone: lead.phone,
      firstName: lead.firstName,
      lastName: lead.lastName,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    },
    consent: {
      email: lead.consentEmail,
      sms: lead.consentSms,
      call: lead.consentCall,
    },
    status: {
      current: lead.status,
      lastContactedAt: lead.lastContactedAt,
      convertedAt: lead.convertedAt,
    },
    source: {
      origin: lead.source,
      rawData: lead.rawData,
    },
    activities: lead.activities.map((activity) => ({
      type: activity.type,
      channel: activity.channel,
      subject: activity.subject,
      content: activity.content,
      createdAt: activity.createdAt,
    })),
    appointments: lead.appointments.map((appointment) => ({
      scheduledAt: appointment.scheduledAt,
      duration: appointment.duration,
      status: appointment.status,
      notes: appointment.notes,
    })),
  };
}

/**
 * Delete all personal data for a lead (PIPEDA "right to be forgotten")
 */
export async function deleteLeadData(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  // Soft delete by anonymizing data
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      email: `deleted-${leadId}@anonymized.local`,
      phone: null,
      firstName: "Deleted",
      lastName: "User",
      rawData: null,
      consentEmail: false,
      consentSms: false,
      consentCall: false,
    },
  });

  // Delete activities (or anonymize if needed for audit)
  await prisma.leadActivity.deleteMany({
    where: { leadId },
  });

  // Delete appointments
  await prisma.appointment.deleteMany({
    where: { leadId },
  });

  return {
    success: true,
    message: "Personal data has been deleted",
    leadId,
  };
}

/**
 * Withdraw consent for a specific communication channel (CASL compliance)
 */
export async function withdrawConsent(
  leadId: string,
  channel: "email" | "sms" | "call" | "all"
) {
  const updates: any = {};

  if (channel === "all") {
    updates.consentEmail = false;
    updates.consentSms = false;
    updates.consentCall = false;
  } else {
    updates[`consent${channel.charAt(0).toUpperCase() + channel.slice(1)}`] = false;
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: updates,
  });

  await prisma.leadActivity.create({
    data: {
      leadId,
      type: "NOTE_ADDED" as any,
      channel: "SYSTEM" as any,
      content: `Consent withdrawn for ${channel}`,
    },
  });

  return {
    success: true,
    message: `Consent withdrawn for ${channel}`,
  };
}

/**
 * Clean up old data based on retention policies
 * This should be run periodically via cron
 */
export async function cleanupOldData() {
  const now = new Date();

  // Delete old webhook events
  const webhookCutoff = new Date(now.getTime() - RETENTION_PERIODS.WEBHOOK_LOGS * 24 * 60 * 60 * 1000);
  const deletedWebhooks = await prisma.webhookEvent.deleteMany({
    where: {
      createdAt: { lt: webhookCutoff },
    },
  });

  // Anonymize old lost leads
  const lostLeadCutoff = new Date(now.getTime() - RETENTION_PERIODS.LOST_LEAD * 24 * 60 * 60 * 1000);
  const lostLeads = await prisma.lead.findMany({
    where: {
      status: "LOST",
      updatedAt: { lt: lostLeadCutoff },
    },
  });

  for (const lead of lostLeads) {
    await deleteLeadData(lead.id);
  }

  return {
    deletedWebhooks: deletedWebhooks.count,
    anonymizedLostLeads: lostLeads.length,
  };
}

/**
 * Validate CASL compliance for outbound messages
 */
export function validateCASLCompliance(message: string, unsubscribeUrl?: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for unsubscribe mechanism
  if (!message.toLowerCase().includes("unsubscribe") &&
      !message.toLowerCase().includes("stop") &&
      !message.toLowerCase().includes("opt out") &&
      !unsubscribeUrl) {
    errors.push("Message must include unsubscribe mechanism");
  }

  // Check message length (SMS)
  if (message.length > 1600) {
    errors.push("Message exceeds maximum length");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate privacy policy content
 */
export function getPrivacyPolicyContent() {
  return {
    dataCollection: [
      "Name and contact information (email, phone)",
      "Communication preferences and consent records",
      "Interaction history (emails, SMS, calls)",
      "Appointment scheduling information",
      "Information provided through web forms and conversations",
    ],
    dataUsage: [
      "To provide mortgage advisory services",
      "To communicate with you about your mortgage needs",
      "To schedule and manage appointments",
      "To improve our services",
    ],
    dataSharing: [
      "We do not sell your personal information",
      "We may share information with service providers (email, SMS, scheduling platforms)",
      "All service providers are contractually obligated to protect your data",
    ],
    yourRights: [
      "Right to access your personal information",
      "Right to correct inaccurate information",
      "Right to withdraw consent for communications",
      "Right to request deletion of your personal information",
      "Right to file a complaint with the Privacy Commissioner of Canada",
    ],
    dataRetention: `Active leads: ${RETENTION_PERIODS.ACTIVE_LEAD / 365} years, Converted leads: ${RETENTION_PERIODS.CONVERTED_LEAD / 365} years, Lost leads: ${RETENTION_PERIODS.LOST_LEAD / 365} year`,
    dataLocation: "Canada (compliant with PIPEDA requirements)",
    contact: "To exercise your privacy rights or ask questions, contact us at privacy@yourdomain.com",
  };
}
