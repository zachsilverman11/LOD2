import { prisma } from "@/lib/db";
import { sendErrorAlert } from "@/lib/slack";
import { DevCardType, DevCardPriority } from "@/app/generated/prisma";

interface DevCardData {
  title: string;
  description: string;
  type: DevCardType;
  priority: DevCardPriority;
  metadata: {
    impact?: string;
    evidence?: string;
    suggestion?: string;
    detectedAt?: string;
  };
}

/**
 * Holly's AI System Monitor
 * Analyzes system health and creates dev cards for detected issues
 */
export async function runSystemMonitor() {
  console.log("🤖 Holly: Starting system health check...");

  const detectedIssues: DevCardData[] = [];

  try {
    // 1. Check for error patterns in recent communications
    const errorPatterns = await detectErrorPatterns();
    detectedIssues.push(...errorPatterns);

    // 2. Check performance anomalies (conversion rates)
    const performanceIssues = await detectPerformanceAnomalies();
    detectedIssues.push(...performanceIssues);

    // 3. Check for stuck leads
    const stuckLeads = await detectStuckLeads();
    detectedIssues.push(...stuckLeads);

    // 4. Check engagement rate drops
    const engagementIssues = await detectEngagementIssues();
    detectedIssues.push(...engagementIssues);

    // Create dev cards for all detected issues
    for (const issue of detectedIssues) {
      await createDevCard(issue);
    }

    console.log(`🤖 Holly: System check complete. Created ${detectedIssues.length} cards.`);

    return {
      success: true,
      issuesDetected: detectedIssues.length,
      issues: detectedIssues,
    };
  } catch (error) {
    console.error("Error in system monitor:", error);
    await sendErrorAlert("System Monitor Failed", error as Error, {});
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Detect repeated error patterns in communications
 */
async function detectErrorPatterns(): Promise<DevCardData[]> {
  const issues: DevCardData[] = [];

  // Check last 24 hours for failed communications
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const failedSms = await prisma.communication.count({
    where: {
      channel: "SMS",
      createdAt: { gte: oneDayAgo },
      metadata: {
        path: ["error"],
        not: null,
      },
    },
  });

  if (failedSms >= 5) {
    // Get sample error messages
    const sampleErrors = await prisma.communication.findMany({
      where: {
        channel: "SMS",
        createdAt: { gte: oneDayAgo },
        metadata: {
          path: ["error"],
          not: null,
        },
      },
      take: 3,
      select: {
        id: true,
        leadId: true,
        metadata: true,
      },
    });

    issues.push({
      title: `${failedSms} SMS delivery failures detected in last 24h`,
      description: `Multiple SMS messages are failing to send. This could indicate:\n- Invalid phone number formatting\n- Twilio account issues\n- Rate limiting\n- Recipient opt-outs`,
      type: "BUG_FIX",
      priority: failedSms >= 10 ? "HIGH" : "MEDIUM",
      metadata: {
        impact: `${failedSms} leads not contacted via SMS`,
        evidence: `Sample errors: ${sampleErrors.map(e => e.id).join(", ")}`,
        suggestion: "Check Twilio logs, verify phone number formatting, review opt-out list",
        detectedAt: new Date().toISOString(),
      },
    });
  }

  return issues;
}

/**
 * Detect performance anomalies by comparing to targets
 */
async function detectPerformanceAnomalies(): Promise<DevCardData[]> {
  const issues: DevCardData[] = [];

  // Get analytics targets
  const targets = await prisma.analyticsTarget.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!targets) return issues;

  // Calculate actual engagement rate
  const totalContacted = await prisma.lead.count({
    where: {
      status: { not: "NEW" },
    },
  });

  const totalEngaged = await prisma.lead.count({
    where: {
      status: { in: ["ENGAGED", "CALL_SCHEDULED", "CALL_COMPLETED", "APPLICATION_STARTED", "CONVERTED", "DEALS_WON"] },
    },
  });

  const engagementRate = totalContacted > 0 ? (totalEngaged / totalContacted) * 100 : 0;
  const targetGap = targets.engagementRateTarget - engagementRate;

  // Alert if 15% or more below target
  if (targetGap >= 15) {
    issues.push({
      title: `Engagement rate ${engagementRate.toFixed(1)}% is significantly below target ${targets.engagementRateTarget}%`,
      description: `Current engagement rate is ${targetGap.toFixed(1)}% below target.\n\nPossible causes:\n- Message templates not resonating\n- Wrong audience/lead quality\n- Timing of messages\n- Offer not compelling`,
      type: "IMPROVEMENT",
      priority: "HIGH",
      metadata: {
        impact: `${totalContacted - totalEngaged} contacted leads not engaging`,
        evidence: `Actual: ${engagementRate.toFixed(1)}%, Target: ${targets.engagementRateTarget}%`,
        suggestion: "A/B test new message templates, review lead source quality, adjust messaging timing",
        detectedAt: new Date().toISOString(),
      },
    });
  }

  return issues;
}

/**
 * Detect leads stuck in the same stage for too long
 */
async function detectStuckLeads(): Promise<DevCardData[]> {
  const issues: DevCardData[] = [];

  // Find leads contacted 7+ days ago but never engaged
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const stuckInContacted = await prisma.lead.count({
    where: {
      status: "CONTACTED",
      updatedAt: { lte: sevenDaysAgo },
    },
  });

  if (stuckInContacted >= 10) {
    const sampleLeads = await prisma.lead.findMany({
      where: {
        status: "CONTACTED",
        updatedAt: { lte: sevenDaysAgo },
      },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        updatedAt: true,
      },
    });

    issues.push({
      title: `${stuckInContacted} leads stuck in CONTACTED for 7+ days`,
      description: `These leads were contacted but never replied. This could indicate:\n- Messages going to spam\n- Wrong contact info\n- Poor message quality\n- Leads not interested`,
      type: "IMPROVEMENT",
      priority: "MEDIUM",
      metadata: {
        impact: `${stuckInContacted} leads not progressing through pipeline`,
        evidence: `Sample leads: ${sampleLeads.map(l => `${l.firstName} ${l.lastName} (${l.id})`).join(", ")}`,
        suggestion: "Review message templates, verify contact info accuracy, consider alternative channels",
        detectedAt: new Date().toISOString(),
      },
    });
  }

  return issues;
}

/**
 * Detect sudden drops in engagement
 */
async function detectEngagementIssues(): Promise<DevCardData[]> {
  const issues: DevCardData[] = [];

  // Compare engagement from last 7 days vs previous 7 days
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recentEngaged = await prisma.lead.count({
    where: {
      status: { in: ["ENGAGED", "CALL_SCHEDULED", "CALL_COMPLETED"] },
      updatedAt: { gte: sevenDaysAgo },
    },
  });

  const previousEngaged = await prisma.lead.count({
    where: {
      status: { in: ["ENGAGED", "CALL_SCHEDULED", "CALL_COMPLETED"] },
      updatedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
    },
  });

  // Alert if engagement dropped by 30% or more
  if (previousEngaged > 0) {
    const dropPercentage = ((previousEngaged - recentEngaged) / previousEngaged) * 100;

    if (dropPercentage >= 30) {
      issues.push({
        title: `Engagement dropped ${dropPercentage.toFixed(0)}% in last 7 days`,
        description: `Significant drop in lead engagement detected.\n\nLast 7 days: ${recentEngaged} engaged leads\nPrevious 7 days: ${previousEngaged} engaged leads\n\nThis could indicate a system issue or market change.`,
        type: "BUG_FIX",
        priority: "CRITICAL",
        metadata: {
          impact: `${previousEngaged - recentEngaged} fewer engaged leads than expected`,
          evidence: `Week-over-week comparison: ${recentEngaged} vs ${previousEngaged}`,
          suggestion: "Check for system errors, review recent message changes, verify automation is running",
          detectedAt: new Date().toISOString(),
        },
      });
    }
  }

  return issues;
}

/**
 * Create a dev card in the database
 */
async function createDevCard(data: DevCardData): Promise<void> {
  // Check if similar card already exists (avoid duplicates)
  const existing = await prisma.devCard.findFirst({
    where: {
      title: data.title,
      status: { not: "DEPLOYED" },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    },
  });

  if (existing) {
    console.log(`🤖 Holly: Skipping duplicate card: ${data.title}`);
    return;
  }

  await prisma.devCard.create({
    data: {
      title: data.title,
      description: data.description,
      type: data.type,
      priority: data.priority,
      createdBy: "HOLLY_AI",
      metadata: data.metadata,
    },
  });

  console.log(`🤖 Holly: Created dev card: ${data.title}`);
}
