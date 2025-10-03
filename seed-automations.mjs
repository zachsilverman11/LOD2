import { PrismaClient } from './app/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding automation rules...');
  
  // 1. Welcome Email - Immediate
  await prisma.automationRule.create({
    data: {
      name: 'Welcome Email - New Leads',
      description: 'Send welcome email immediately after lead creation',
      triggerType: 'event_based',
      triggerCondition: { event: 'lead.created' },
      actions: [{
        type: 'send_email',
        config: {
          subject: 'Welcome {{firstName}} - Let\'s discuss your mortgage options',
          body: '<h2>Hi {{firstName}},</h2><p>Thank you for your interest in our mortgage services!</p><p>We\'re excited to help you navigate your mortgage journey. Our team of experienced advisors is ready to provide personalized guidance.</p><p>We\'ll reach out soon to schedule a discovery call.</p><p>Best regards,<br>Your Mortgage Advisor Team</p>',
        }
      }],
      isActive: true,
      priority: 10,
    }
  });
  
  // 2. SMS Follow-up - 24 hours
  await prisma.automationRule.create({
    data: {
      name: 'SMS Follow-up - 24 Hours',
      description: 'Send SMS if no appointment booked within 24 hours',
      triggerType: 'time_based',
      triggerCondition: {
        timeField: 'createdAt',
        timeValue: 24,
        timeUnit: 'hours',
        status: 'NEW'
      },
      actions: [
        {
          type: 'send_sms',
          config: {
            body: 'Hi {{firstName}}! Ready to discuss your mortgage options? Book a free discovery call: ' + process.env.NEXT_PUBLIC_APP_URL + '/schedule'
          }
        },
        {
          type: 'change_status',
          config: { status: 'CONTACTED' }
        }
      ],
      isActive: true,
      priority: 8,
    }
  });
  
  // 3. Voice AI Call - 48 hours
  await prisma.automationRule.create({
    data: {
      name: 'Voice AI Call - 48 Hours',
      description: 'AI call if still no appointment after 48 hours',
      triggerType: 'time_based',
      triggerCondition: {
        timeField: 'createdAt',
        timeValue: 48,
        timeUnit: 'hours',
        status: 'CONTACTED'
      },
      actions: [{
        type: 'make_call',
        config: {}
      }],
      isActive: true,
      priority: 7,
    }
  });
  
  // 4. Email Reminder - 3 days
  await prisma.automationRule.create({
    data: {
      name: 'Email Reminder - 3 Days',
      description: 'Send reminder email after 3 days if still not qualified',
      triggerType: 'time_based',
      triggerCondition: {
        timeField: 'createdAt',
        timeValue: 72,
        timeUnit: 'hours',
        status: 'CONTACTED'
      },
      actions: [{
        type: 'send_email',
        config: {
          subject: 'Still interested in mortgage advice, {{firstName}}?',
          body: '<p>Hi {{firstName}},</p><p>I noticed you haven\'t scheduled your free discovery call yet. Our mortgage advisors are ready to help you find the best options.</p><p><a href="' + process.env.NEXT_PUBLIC_APP_URL + '/schedule">Click here to book your call</a></p><p>No pressure - just here to help when you\'re ready!</p>'
        }
      }],
      isActive: true,
      priority: 6,
    }
  });
  
  // 5. Call Reminder - 1 day before
  await prisma.automationRule.create({
    data: {
      name: 'Call Reminder - 24h Before',
      description: 'Send reminder 24 hours before scheduled call',
      triggerType: 'time_based',
      triggerCondition: {
        timeField: 'appointments.scheduledAt',
        timeValue: 24,
        timeUnit: 'hours',
        status: 'CALL_SCHEDULED'
      },
      actions: [{
        type: 'send_email',
        config: {
          subject: 'Reminder: Your discovery call is tomorrow',
          body: '<p>Hi {{firstName}},</p><p>This is a friendly reminder that your discovery call is scheduled for tomorrow.</p><p>Looking forward to speaking with you!</p>'
        }
      }],
      isActive: true,
      priority: 9,
    }
  });
  
  console.log('✅ Created 5 automation rules');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
