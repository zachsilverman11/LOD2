import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/activity/recent
 *
 * Returns recent activity across all leads for the activity feed widget
 * Combines LeadActivity and Communication tables for a unified timeline
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const hours = parseInt(searchParams.get('hours') || '24');

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get recent communications (SMS/Email sent/received)
    const communications = await prisma.communication.findMany({
      where: {
        createdAt: { gte: since },
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get recent lead activities (status changes, appointments, etc)
    const activities = await prisma.leadActivity.findMany({
      where: {
        createdAt: { gte: since },
        type: {
          in: [
            'STATUS_CHANGE',
            'APPOINTMENT_BOOKED',
            'APPOINTMENT_CANCELLED',
            'CALL_COMPLETED',
            'NOTE_ADDED',
          ],
        },
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Combine and format activities
    const combinedActivities = [
      ...communications.map((comm) => ({
        id: `comm-${comm.id}`,
        type: comm.direction === 'OUTBOUND'
          ? (comm.channel === 'SMS' ? 'SMS_SENT' : 'EMAIL_SENT')
          : (comm.channel === 'SMS' ? 'SMS_RECEIVED' : 'EMAIL_RECEIVED'),
        leadId: comm.lead.id,
        leadName: `${comm.lead.firstName} ${comm.lead.lastName}`,
        leadStatus: comm.lead.status,
        content: comm.content,
        channel: comm.channel,
        direction: comm.direction,
        createdAt: comm.createdAt,
        metadata: comm.metadata,
      })),
      ...activities.map((activity) => ({
        id: `activity-${activity.id}`,
        type: activity.type,
        leadId: activity.lead.id,
        leadName: `${activity.lead.firstName} ${activity.lead.lastName}`,
        leadStatus: activity.lead.status,
        content: activity.content,
        subject: activity.subject,
        createdAt: activity.createdAt,
        metadata: activity.metadata,
      })),
    ];

    // Sort by most recent
    combinedActivities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Take only the requested limit
    const recentActivities = combinedActivities.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: recentActivities,
      count: recentActivities.length,
      since: since.toISOString(),
    });
  } catch (error) {
    console.error('[Activity API] Error fetching recent activity:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch recent activity',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
