import { prisma } from '../lib/db';

async function investigateHollyInactivity() {
  console.log('=== HOLLY INACTIVITY INVESTIGATION ===');
  console.log('Current time (UTC):', new Date().toISOString());
  console.log('Current time (Local):', new Date().toString());
  console.log('\n');

  // 1. Check recent SMS communications (last 24 hours)
  console.log('1. RECENT SMS COMMUNICATIONS (Last 24 hours)');
  console.log('='.repeat(80));
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentSMS = await prisma.communication.findMany({
    where: {
      channel: 'SMS',
      direction: 'OUTBOUND',
      createdAt: {
        gte: oneDayAgo
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      createdAt: true,
      lead: {
        select: {
          firstName: true,
          lastName: true,
          status: true
        }
      }
    },
    take: 20
  });

  console.log(`Total outbound SMS in last 24h: ${recentSMS.length}`);
  if (recentSMS.length > 0) {
    console.log('\nMost recent:');
    recentSMS.slice(0, 5).forEach(sms => {
      console.log(`  - ${sms.createdAt.toISOString()} | ${sms.lead.firstName} ${sms.lead.lastName} | ${sms.lead.status}`);
    });
  } else {
    console.log('NO OUTBOUND SMS IN LAST 24 HOURS! ⚠️');
  }
  console.log('\n');

  // 2. Check recent LeadActivity (last 24 hours)
  console.log('2. RECENT LEAD ACTIVITY (Last 24 hours)');
  console.log('='.repeat(80));

  const recentActivity = await prisma.leadActivity.findMany({
    where: {
      createdAt: {
        gte: oneDayAgo
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      createdAt: true,
      type: true,
      content: true,
      metadata: true,
      lead: {
        select: {
          firstName: true,
          lastName: true,
          status: true
        }
      }
    },
    take: 50
  });

  console.log(`Total activity records in last 24h: ${recentActivity.length}`);

  // SMS_SENT indicates Holly activity
  const smsSentActivity = recentActivity.filter(a => a.type === 'SMS_SENT');
  const statusChanges = recentActivity.filter(a => a.type === 'STATUS_CHANGE');

  console.log(`SMS_SENT activities: ${smsSentActivity.length}`);
  console.log(`STATUS_CHANGE activities: ${statusChanges.length}`);

  if (smsSentActivity.length > 0) {
    console.log('\nRecent SMS_SENT activity:');
    smsSentActivity.slice(0, 10).forEach(activity => {
      console.log(`  - ${activity.createdAt.toISOString()} | ${activity.lead.firstName} ${activity.lead.lastName}`);
      if (activity.content) {
        const preview = activity.content.length > 80 ? activity.content.substring(0, 77) + '...' : activity.content;
        console.log(`    Message: ${preview}`);
      }
    });
  } else {
    console.log('NO SMS_SENT ACTIVITY IN LAST 24 HOURS! ⚠️');
  }

  if (statusChanges.length > 0) {
    console.log('\nRecent status changes:');
    statusChanges.slice(0, 10).forEach(activity => {
      console.log(`  - ${activity.createdAt.toISOString()} | ${activity.lead.firstName} ${activity.lead.lastName} | New status: ${activity.lead.status}`);
      if (activity.metadata) {
        console.log(`    Metadata: ${JSON.stringify(activity.metadata)}`);
      }
    });
  }
  console.log('\n');

  // 3. Check current lead status
  console.log('3. CURRENT LEAD STATUS');
  console.log('='.repeat(80));

  const now = new Date();

  const overdueLeads = await prisma.lead.count({
    where: {
      nextReviewAt: {
        lt: now
      },
      status: {
        notIn: ['CONVERTED', 'LOST']
      }
    }
  });

  const contactedLeads = await prisma.lead.findMany({
    where: {
      status: 'CONTACTED'
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nextReviewAt: true,
      lastContactedAt: true,
      createdAt: true
    }
  });

  const nurturingLeads = await prisma.lead.findMany({
    where: {
      status: 'NURTURING'
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nextReviewAt: true,
      lastContactedAt: true,
      createdAt: true
    }
  });

  console.log(`Overdue for review (nextReviewAt < now): ${overdueLeads}`);
  console.log(`CONTACTED status: ${contactedLeads.length}`);
  console.log(`NURTURING status: ${nurturingLeads.length}`);

  if (contactedLeads.length > 0) {
    console.log('\nCONTACTED leads:');
    contactedLeads.forEach(lead => {
      const isOverdue = lead.nextReviewAt && lead.nextReviewAt < now;
      console.log(`  - ${lead.firstName} ${lead.lastName}`);
      console.log(`    nextReviewAt: ${lead.nextReviewAt?.toISOString()} ${isOverdue ? '⚠️ OVERDUE' : ''}`);
      console.log(`    lastContactedAt: ${lead.lastContactedAt?.toISOString()}`);
    });
  }

  if (nurturingLeads.length > 0) {
    console.log('\nNURTURING leads:');
    nurturingLeads.forEach(lead => {
      const isOverdue = lead.nextReviewAt && lead.nextReviewAt < now;
      console.log(`  - ${lead.firstName} ${lead.lastName}`);
      console.log(`    nextReviewAt: ${lead.nextReviewAt?.toISOString()} ${isOverdue ? '⚠️ OVERDUE' : ''}`);
      console.log(`    lastContactedAt: ${lead.lastContactedAt?.toISOString()}`);
    });
  }
  console.log('\n');

  // 4. Check activity metadata for errors/issues
  console.log('4. ACTIVITY METADATA ANALYSIS (Last 48 hours)');
  console.log('='.repeat(80));

  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const allRecentActivity = await prisma.leadActivity.findMany({
    where: {
      createdAt: {
        gte: twoDaysAgo
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      createdAt: true,
      type: true,
      content: true,
      metadata: true,
      lead: {
        select: {
          firstName: true,
          lastName: true,
          status: true
        }
      }
    }
  });

  const activitiesWithErrors = allRecentActivity.filter(a => {
    const meta = a.metadata as any;
    return meta && (meta.error || meta.errorMessage || meta.guardrailBlock);
  });

  console.log(`Total activities with potential errors: ${activitiesWithErrors.length}`);

  if (activitiesWithErrors.length > 0) {
    console.log('\nActivities with error metadata:');
    activitiesWithErrors.forEach(activity => {
      console.log(`\n  [${activity.createdAt.toISOString()}] ${activity.type} - ${activity.lead.firstName} ${activity.lead.lastName}`);
      console.log(`  Status: ${activity.lead.status}`);

      const metadata = activity.metadata as any;
      if (metadata?.error || metadata?.errorMessage) {
        console.log(`  Error: ${metadata.error || metadata.errorMessage}`);
      }
      if (metadata?.guardrailBlock) {
        console.log(`  Guardrail blocked: ${JSON.stringify(metadata.guardrailBlock)}`);
      }
      if (metadata?.stack) {
        console.log(`  Stack (first 200 chars): ${metadata.stack.substring(0, 200)}`);
      }
      if (metadata) {
        console.log(`  Full metadata: ${JSON.stringify(metadata).substring(0, 300)}`);
      }
    });
  }
  console.log('\n');

  // 6. Summary
  console.log('6. SUMMARY & DIAGNOSIS');
  console.log('='.repeat(80));
  console.log(`Environment check:`);
  console.log(`  ENABLE_AUTONOMOUS_AGENT: ${process.env.ENABLE_AUTONOMOUS_AGENT}`);
  console.log(`  DRY_RUN_MODE: ${process.env.DRY_RUN_MODE}`);
  console.log(`  AUTONOMOUS_LEAD_PERCENTAGE: ${process.env.AUTONOMOUS_LEAD_PERCENTAGE || 'not set (100% default)'}`);

  console.log('\nKey metrics:');
  console.log(`  ✉️  Outbound SMS (24h): ${recentSMS.length}`);
  console.log(`  📤 SMS_SENT activities (24h): ${smsSentActivity.length}`);
  console.log(`  🔄 Status changes (24h): ${statusChanges.length}`);
  console.log(`  ❌ Activities with errors (48h): ${activitiesWithErrors.length}`);
  console.log(`  ⏰ Overdue leads: ${overdueLeads}`);
  console.log(`  📞 CONTACTED leads: ${contactedLeads.length}`);
  console.log(`  💬 NURTURING leads: ${nurturingLeads.length}`);

  console.log('\n🔍 DIAGNOSIS:');
  if (recentSMS.length === 0 && smsSentActivity.length === 0) {
    console.log('❌ CRITICAL: Holly appears to be completely inactive - no SMS in 24h');
  } else if (recentSMS.length === 0 && smsSentActivity.length > 0) {
    console.log('⚠️  WARNING: SMS_SENT activities recorded but no actual SMS communications found');
  } else if (overdueLeads > 0 && recentSMS.length < overdueLeads) {
    console.log('⚠️  WARNING: Holly is not processing all overdue leads');
  } else if (recentSMS.length > 0) {
    console.log('✅ Holly appears to be active and sending messages');
  }

  if (activitiesWithErrors.length > 0) {
    console.log(`⚠️  Found ${activitiesWithErrors.length} activities with errors in last 48h - check logs above`);
  }
}

investigateHollyInactivity()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
