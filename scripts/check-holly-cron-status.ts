import { prisma } from '../lib/db';

async function checkCronStatus() {
  console.log('=== HOLLY CRON STATUS CHECK ===\n');

  // Check environment
  console.log('ENVIRONMENT:');
  console.log(`  ENABLE_AUTONOMOUS_AGENT: ${process.env.ENABLE_AUTONOMOUS_AGENT}`);
  console.log(`  DRY_RUN_MODE: ${process.env.DRY_RUN_MODE}`);
  console.log(`  AUTONOMOUS_LEAD_PERCENTAGE: ${process.env.AUTONOMOUS_LEAD_PERCENTAGE || '100 (default)'}`);
  console.log('\n');

  // Check how many leads are eligible for autonomous management
  const totalLeads = await prisma.lead.count();
  const managedByAutonomous = await prisma.lead.count({
    where: { managedByAutonomous: true }
  });
  const hollyDisabled = await prisma.lead.count({
    where: { hollyDisabled: true }
  });
  const noConsent = await prisma.lead.count({
    where: { consentSms: false }
  });

  console.log('LEAD MANAGEMENT STATUS:');
  console.log(`  Total leads: ${totalLeads}`);
  console.log(`  Managed by autonomous: ${managedByAutonomous} (${((managedByAutonomous/totalLeads)*100).toFixed(1)}%)`);
  console.log(`  Holly disabled: ${hollyDisabled}`);
  console.log(`  No SMS consent: ${noConsent}`);
  console.log('\n');

  // Check leads due for review NOW
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  const eligibleLeads = await prisma.lead.findMany({
    where: {
      status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON', 'APPLICATION_STARTED'] },
      consentSms: true,
      managedByAutonomous: true,
      hollyDisabled: false,
      OR: [
        {
          AND: [
            { nextReviewAt: null },
            {
              OR: [
                { lastContactedAt: null },
                { lastContactedAt: { lte: tenMinutesAgo } },
              ],
            },
          ],
        },
        {
          AND: [
            { nextReviewAt: { lte: now } },
            {
              OR: [
                { lastContactedAt: null },
                { lastContactedAt: { lte: tenMinutesAgo } },
              ],
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      nextReviewAt: true,
      lastContactedAt: true,
    },
    orderBy: { nextReviewAt: 'asc' },
    take: 20
  });

  console.log('LEADS ELIGIBLE FOR CRON PROCESSING NOW:');
  console.log(`  Count: ${eligibleLeads.length}`);

  if (eligibleLeads.length > 0) {
    console.log('\n  Next 20 leads Holly should process:');
    eligibleLeads.forEach(lead => {
      const overdueBy = lead.nextReviewAt
        ? Math.floor((now.getTime() - lead.nextReviewAt.getTime()) / (1000 * 60 * 60))
        : 0;
      const overdueText = overdueBy > 0 ? ` (${overdueBy}h overdue)` : '';
      console.log(`    - ${lead.firstName} ${lead.lastName} | ${lead.status} | nextReview: ${lead.nextReviewAt?.toISOString() || 'null'}${overdueText}`);
    });
  }
  console.log('\n');

  // Check recent cron execution by looking at recent SMS activity
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentSMS = await prisma.communication.count({
    where: {
      channel: 'SMS',
      direction: 'OUTBOUND',
      createdAt: { gte: oneHourAgo }
    }
  });

  console.log('RECENT ACTIVITY (Last 1 hour):');
  console.log(`  Outbound SMS: ${recentSMS}`);

  if (recentSMS === 0 && eligibleLeads.length > 0) {
    console.log('\n⚠️  WARNING: Holly has eligible leads but sent 0 SMS in last hour!');
    console.log('  Possible causes:');
    console.log('    - Cron is not running');
    console.log('    - Cron is running but Holly is crashing');
    console.log('    - All decisions are "wait" actions');
  } else if (recentSMS > 0) {
    console.log('  ✅ Holly appears to be working - sent messages in last hour');
  }
  console.log('\n');

  // Check for leads that are VERY overdue (> 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const veryOverdueLeads = await prisma.lead.count({
    where: {
      status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON', 'APPLICATION_STARTED'] },
      managedByAutonomous: true,
      hollyDisabled: false,
      nextReviewAt: { lt: oneDayAgo }
    }
  });

  console.log('CONCERNING METRICS:');
  console.log(`  Leads >24h overdue: ${veryOverdueLeads}`);

  if (veryOverdueLeads > 10) {
    console.log('  ⚠️  More than 10 leads are >24h overdue - Holly may not be processing properly');
  }
}

checkCronStatus()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
