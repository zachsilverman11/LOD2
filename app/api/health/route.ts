import { NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';

const prisma = new PrismaClient();

/**
 * Health Check Endpoint
 *
 * Returns system health metrics for monitoring:
 * - Leads overdue for contact
 * - Leads never contacted
 * - Severely overdue leads (>24h)
 *
 * External monitoring systems can ping this endpoint to detect issues.
 */
export async function GET() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Count leads overdue for contact
    const leadsOverdue = await prisma.lead.count({
      where: {
        nextReviewAt: { lte: now },
        hollyDisabled: false,
        consentSms: true,
        managedByAutonomous: true,
        status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON', 'APPLICATION_STARTED'] },
      },
    });

    // Count leads never contacted
    const leadsNeverContacted = await prisma.lead.count({
      where: {
        lastContactedAt: null,
        hollyDisabled: false,
        consentSms: true,
        managedByAutonomous: true,
        status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON', 'APPLICATION_STARTED'] },
        createdAt: { lte: oneDayAgo }, // Created >24h ago
      },
    });

    // Count severely overdue leads (>24h past nextReviewAt)
    const leadsSeverelyOverdue = await prisma.lead.count({
      where: {
        nextReviewAt: { lte: oneDayAgo },
        hollyDisabled: false,
        consentSms: true,
        managedByAutonomous: true,
        status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON', 'APPLICATION_STARTED'] },
      },
    });

    // Get the most recent lead activity to infer cron execution
    const recentActivity = await prisma.leadActivity.findFirst({
      where: {
        type: 'NOTE_ADDED',
        content: { contains: 'Holly Agent' },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const health = {
      timestamp: now.toISOString(),
      cronLastInferred: recentActivity?.createdAt.toISOString() || 'unknown',
      minutesSinceLastActivity: recentActivity
        ? Math.floor((now.getTime() - recentActivity.createdAt.getTime()) / (1000 * 60))
        : null,
      leadsOverdue,
      leadsNeverContacted,
      leadsSeverelyOverdue,
      status: leadsSeverelyOverdue > 0 ? 'warning' : 'healthy',
    };

    return NextResponse.json(health);
  } catch (error) {
    console.error('[Health Check] Error:', error);

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
