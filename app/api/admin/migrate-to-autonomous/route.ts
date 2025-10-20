/**
 * API endpoint to migrate all active leads to Autonomous Holly
 * POST /api/admin/migrate-to-autonomous
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Update all active leads to autonomous
    const result = await prisma.lead.updateMany({
      where: {
        status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON'] },
        consentSms: true,
        managedByAutonomous: false,
        hollyDisabled: false,
      },
      data: {
        managedByAutonomous: true,
        nextReviewAt: new Date(), // Review immediately
      },
    });

    // Get breakdown by status
    const statusBreakdown = await prisma.lead.groupBy({
      by: ['status'],
      where: {
        managedByAutonomous: true,
        hollyDisabled: false,
      },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      migratedCount: result.count,
      statusBreakdown: statusBreakdown.map((group) => ({
        status: group.status,
        count: group._count,
      })),
      message: `Successfully migrated ${result.count} leads to Enhanced Autonomous Holly`,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
