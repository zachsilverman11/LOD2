import { PrismaClient, LeadStatus, ActivityType, CommunicationChannel } from '../app/generated/prisma';

const prisma = new PrismaClient();

/**
 * Fix lead that's generating Twilio error 21610 (opted out)
 *
 * Lead ID: cmglbi5op0008la04yhx7f0rw
 * Phone: +17805547956
 * Error: Twilio "Attempt to send to unsubscribed recipient"
 *
 * This script:
 * 1. Marks the lead as SMS opted-out (consentSms: false)
 * 2. Moves lead to LOST status (can't contact)
 * 3. Logs the activity
 * 4. Prevents Holly from retrying every 15 minutes
 */
async function fixOptedOutLead() {
  const leadId = "cmglbi5op0008la04yhx7f0rw";
  const phone = "+17805547956";

  try {
    console.log(`\n🔍 Finding lead ${leadId}...`);

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        consentSms: true,
        nextReviewAt: true,
      },
    });

    if (!lead) {
      console.error(`❌ Lead ${leadId} not found`);
      return;
    }

    console.log(`\nLead: ${lead.firstName} ${lead.lastName}`);
    console.log(`Phone: ${lead.phone}`);
    console.log(`Current Status: ${lead.status}`);
    console.log(`SMS Consent: ${lead.consentSms}`);

    // Check if already fixed
    if (!lead.consentSms && lead.status === LeadStatus.LOST) {
      console.log(`\n✅ Lead already marked as opted-out and LOST. No action needed.`);
      return;
    }

    console.log(`\n🔧 Fixing lead...`);

    // Update lead
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        consentSms: false, // Mark as opted out
        status: LeadStatus.LOST, // Can't contact = lost
        nextReviewAt: new Date("2099-12-31"), // Never review again
        updatedAt: new Date(),
      },
    });

    console.log(`   ✓ Updated consentSms: false`);
    console.log(`   ✓ Updated status: LOST`);
    console.log(`   ✓ Set nextReviewAt to far future`);

    // Log activity
    await prisma.leadActivity.create({
      data: {
        leadId: leadId,
        type: ActivityType.NOTE_ADDED,
        channel: CommunicationChannel.SYSTEM,
        subject: "🚫 Lead Opted Out - Twilio Server-Side Block",
        content: `Lead has been blocked by Twilio from receiving SMS messages (Error 21610: Unsubscribed recipient).

This typically means:
- Lead replied "STOP" to Twilio number
- Carrier-level opt-out
- Regulatory compliance block

Actions taken:
- Marked consentSms: false
- Moved to LOST status
- Disabled all future Holly contact attempts

Holly will no longer attempt to contact this lead via any channel.`,
        metadata: {
          twilioError: "21610",
          errorMessage: "Attempt to send to unsubscribed recipient",
          phone: phone,
          fixedAt: new Date().toISOString(),
          fixedBy: "scripts/fix-opted-out-lead.ts",
        },
      },
    });

    console.log(`   ✓ Created activity log`);

    console.log(`\n✅ Lead fixed successfully!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Lead ${lead.firstName} ${lead.lastName} marked as opted-out`);
    console.log(`   - Status: ${lead.status} → LOST`);
    console.log(`   - SMS Consent: ${lead.consentSms} → false`);
    console.log(`   - Holly will no longer contact this lead`);
    console.log(`\n🎯 This should stop the repeating Twilio error 21610 alerts!`);

  } catch (error) {
    console.error(`\n❌ Error fixing lead:`, error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixOptedOutLead();
