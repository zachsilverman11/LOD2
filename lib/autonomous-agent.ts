/**
 * Autonomous Holly Agent
 * Smart scheduling loop that reviews leads and makes autonomous decisions
 */

import { prisma } from './db';
import { analyzeDealHealth } from './deal-intelligence';
import { askHollyToDecide } from './claude-decision';
import { validateDecision, detectMessageRepetition } from './safety-guardrails';
import { executeDecision } from './ai-conversation-enhanced';
import { sendSlackNotification } from './slack';
import { trackConversationOutcome } from './conversation-outcome-tracker';
import { getNext8AM, getLocalTimeString } from './timezone-utils';

// Environment variables for safe rollout
const ENABLE_AUTONOMOUS_AGENT = process.env.ENABLE_AUTONOMOUS_AGENT === 'true';
const DRY_RUN_MODE = process.env.DRY_RUN_MODE === 'true';
const AUTONOMOUS_LEAD_PERCENTAGE = parseInt(process.env.AUTONOMOUS_LEAD_PERCENTAGE || '0');

// Rate limiting configuration
const RATE_LIMIT_DELAY_MS = 500; // 500ms delay between Claude API calls (max 120 calls/min)

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a single lead through autonomous Holly agent
 * Used for instant responses (SMS replies, new leads)
 *
 * @param leadId - The ID of the lead to process
 * @param triggerSource - Whether this is proactive (cron) or reactive (sms_reply)
 *   - 'cron': Proactive outreach via scheduled review (blocks CONVERTED leads)
 *   - 'sms_reply': Reactive response to lead's SMS (allows CONVERTED leads)
 */
export async function processLeadWithAutonomousAgent(
  leadId: string,
  triggerSource: 'cron' | 'sms_reply' = 'cron'
) {
  if (!ENABLE_AUTONOMOUS_AGENT) {
    console.log(`[Holly Agent] ⏸️  Disabled via ENABLE_AUTONOMOUS_AGENT env var - skipping lead ${leadId}`);
    return { success: false, reason: 'Agent disabled' };
  }

  const now = new Date();

  try {
    // Fetch lead with related data
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        communications: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        appointments: {
          where: { status: { in: ['SCHEDULED', 'CONFIRMED'] } },
        },
        callOutcomes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!lead) {
      console.error(`[Holly Agent] ❌ Lead ${leadId} not found`);
      return { success: false, reason: 'Lead not found' };
    }

    // Skip processing leads that have completed their journey (proactive mode only)
    // Allow reactive responses when leads text us, even if CONVERTED
    const excludedStatuses = ['CONVERTED', 'DEALS_WON', 'LOST'];

    if (triggerSource === 'cron' && excludedStatuses.includes(lead.status)) {
      console.log(`[Holly Agent] ⏭️  Skipping ${lead.firstName} ${lead.lastName} - status is ${lead.status} (no proactive outreach to completed leads)`);
      return { success: false, reason: `Lead status is ${lead.status} - no proactive outreach` };
    }

    // If triggered by SMS reply from CONVERTED lead, allow processing but log it
    if (triggerSource === 'sms_reply' && excludedStatuses.includes(lead.status)) {
      console.log(`[Holly Agent] 💬 Processing SMS reply from ${lead.firstName} ${lead.lastName} (status: ${lead.status}) - reactive response allowed`);
    }

    console.log(`[Holly Agent] 🔍 Processing ${lead.firstName} ${lead.lastName}...`);

    // === ANALYZE DEAL HEALTH ===
    const signals = analyzeDealHealth(lead);

    // === ASK HOLLY TO DECIDE ===
    const decision = await askHollyToDecide(lead, signals);

    // === VALIDATE DECISION ===
    const validation = validateDecision(decision, { lead, signals });

    // Log warnings
    if (validation.warnings.length > 0) {
      console.warn(`[Holly Agent] ⚠️  ${lead.firstName}: ${validation.warnings.join(', ')}`);
    }

    if (!validation.isValid) {
      console.log(
        `[Holly Agent] ❌ ${lead.firstName}: Blocked - ${validation.errors.join(', ')}`
      );

      // Log the guardrail block to database for visibility
      if (!DRY_RUN_MODE) {
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: 'NOTE_ADDED',
            channel: 'SYSTEM',
            content: `⛔ Holly Blocked by Safety Guardrails\n\n${validation.errors.map(e => `• ${e}`).join('\n')}\n\n**Holly's attempted decision:**\nAction: ${decision.action}\n${decision.message ? `Message: "${decision.message.substring(0, 200)}${decision.message.length > 200 ? '...' : ''}"\n` : ''}Thinking: ${decision.thinking}`,
            metadata: {
              automated: true,
              autonomous: true,
              guardrailBlock: true,
              blockedAction: decision.action,
              errors: validation.errors,
            },
          },
        });
      }

      // Smart retry scheduling based on block reason
      const isTimeBlock = validation.errors.some(error =>
        error.includes('Outside SMS hours') || error.includes('can only send 8am-9pm')
      );

      let nextReviewAt: Date;
      if (isTimeBlock) {
        // TIME BLOCK: Schedule for next 8 AM in lead's timezone
        const rawData = lead.rawData as any;
        const province = rawData?.province || 'British Columbia';
        nextReviewAt = getNext8AM(province);

        console.log(
          `[Holly Agent] ⏰ ${lead.firstName}: Scheduled for next 8 AM (${getLocalTimeString(province)}) due to time restriction`
        );
      } else {
        // OTHER BLOCKS (anti-spam, opt-out, etc.): Retry in 1 hour
        nextReviewAt = new Date(now.getTime() + 60 * 60 * 1000);

        console.log(
          `[Holly Agent] ⏱️  ${lead.firstName}: Retry in 1 hour due to: ${validation.errors[0]}`
        );
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: { nextReviewAt },
      });

      return { success: false, reason: validation.errors.join(', ') };
    }

    // === CHECK FOR REPETITION (if sending message) ===
    if (decision.message) {
      const repetitionCheck = detectMessageRepetition(decision.message, lead.communications || []);

      if (repetitionCheck.isRepetitive) {
        console.log(
          `[Holly Agent] 🔁 ${lead.firstName}: Repetitive message blocked - ${repetitionCheck.suggestion}`
        );

        // Log the blocked repetition
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: 'NOTE_ADDED',
            channel: 'SYSTEM',
            content: `🔁 Repetitive message blocked by safety guardrails: "${repetitionCheck.suggestion}"\n\nBlocked message: "${decision.message}"`,
            metadata: { automated: true, autonomous: true },
          },
        });

        // Wait longer before trying again
        await prisma.lead.update({
          where: { id: lead.id },
          data: { nextReviewAt: new Date(now.getTime() + 6 * 60 * 60 * 1000) }, // 6 hours
        });

        return { success: false, reason: 'Repetitive message blocked' };
      }
    }

    // === EXECUTE DECISION ===
    if (decision.action === 'escalate') {
      console.log(`[Holly Agent] 🚨 ${lead.firstName}: ESCALATED - ${decision.thinking}`);

      if (!DRY_RUN_MODE) {
        // Create alert for human review
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: 'NOTE_ADDED',
            channel: 'SYSTEM',
            content: `🚨 ESCALATED BY HOLLY: ${decision.thinking}\nSuggested action: ${decision.suggestedAction || 'Review needed'}`,
            metadata: { automated: true, autonomous: true },
          },
        });

        // Send Slack alert
        await sendSlackNotification({
          type: 'lead_escalated',
          leadName: `${lead.firstName} ${lead.lastName}`,
          leadId: lead.id,
          details: `${decision.thinking}\nSuggested: ${decision.suggestedAction || 'Review needed'}`,
        });

        // Don't auto-review for 48 hours (human will handle)
        await prisma.lead.update({
          where: { id: lead.id },
          data: { nextReviewAt: new Date(now.getTime() + 48 * 60 * 60 * 1000) },
        });
      }

      return { success: true, action: 'escalated' };
    } else if (decision.action === 'wait') {
      console.log(
        `[Holly Agent] ⏸️  ${lead.firstName}: WAITING ${decision.waitHours}h - ${decision.thinking}`
      );

      const nextReview = new Date(
        now.getTime() + (decision.waitHours || signals.nextReviewHours) * 60 * 60 * 1000
      );

      if (!DRY_RUN_MODE) {
        // Log the wait decision so we can debug
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: 'NOTE_ADDED',
            channel: 'SYSTEM',
            content: `⏸️ Holly decided to WAIT ${decision.waitHours || signals.nextReviewHours}h\n\nReasoning: ${decision.thinking}\n\nCustomer mindset: ${decision.customerMindset || 'N/A'}\n\nNext check: ${decision.nextCheckCondition || 'Scheduled review'}`,
            metadata: { automated: true, autonomous: true },
          },
        });

        await prisma.lead.update({
          where: { id: lead.id },
          data: { nextReviewAt: nextReview },
        });
      }

      return { success: true, action: 'wait', waitHours: decision.waitHours };
    } else if (decision.action === 'move_stage') {
      // Stage movement - Holly is moving the lead to a new status
      console.log(
        `[Holly Agent] 🚦 ${lead.firstName}: MOVING ${lead.status} → ${decision.newStage} - ${decision.thinking}`
      );

      if (!decision.newStage) {
        console.error(`[Holly Agent] ❌ move_stage action missing newStage field`);
        return { success: false, action: 'move_stage', error: 'Missing newStage' };
      }

      // CRITICAL: Prevent Holly from moving leads to Finmo-managed statuses
      // These statuses are controlled by external systems, not Holly
      if (['APPLICATION_STARTED', 'CONVERTED', 'DEALS_WON'].includes(decision.newStage)) {
        console.error(
          `[Holly Agent] 🚨 BLOCKED: Attempted to move ${lead.firstName} to ${decision.newStage}. This status is managed by Finmo/external systems.`
        );

        // Escalate to team
        await sendSlackNotification({
          type: 'lead_escalated',
          leadName: `${lead.firstName} ${lead.lastName}`,
          leadId: lead.id,
          details: `🚨 Holly tried to move lead to ${decision.newStage}\n\nThis status is reserved for Finmo/external systems. Holly's reasoning: ${decision.thinking}\n\nPlease review and manually update if needed.`,
        });

        return { success: false, action: 'move_stage', error: 'Invalid status transition' };
      }

      if (!DRY_RUN_MODE) {
        // Validate transition is allowed
        const validTransitions: Record<string, string[]> = {
          CONTACTED: ['ENGAGED', 'NURTURING', 'LOST'],
          ENGAGED: ['NURTURING', 'CALL_SCHEDULED', 'LOST'],
          CALL_SCHEDULED: ['WAITING_FOR_APPLICATION', 'NURTURING', 'LOST'],
          WAITING_FOR_APPLICATION: ['NURTURING', 'LOST'],
          NURTURING: ['ENGAGED', 'CALL_SCHEDULED', 'LOST'],
        };

        const allowedMoves = validTransitions[lead.status] || [];
        if (!allowedMoves.includes(decision.newStage)) {
          console.error(
            `[Holly Agent] ❌ Invalid transition: ${lead.status} → ${decision.newStage}. Allowed: ${allowedMoves.join(', ')}`
          );
          return { success: false, action: 'move_stage', error: 'Invalid transition' };
        }

        // Update lead status
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: decision.newStage as LeadStatus },
        });

        // Log the stage change
        await prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            type: 'NOTE_ADDED',
            channel: 'SYSTEM',
            subject: `🚦 Stage Changed: ${lead.status} → ${decision.newStage}`,
            content: `Holly moved this lead from ${lead.status} to ${decision.newStage}.\n\nReasoning: ${decision.thinking}\n\nCustomer mindset: ${decision.customerMindset || 'N/A'}`,
            metadata: {
              automated: true,
              autonomous: true,
              previousStatus: lead.status,
              newStatus: decision.newStage,
              hollyReasoning: decision.thinking,
            },
          },
        });

        // Set next review time based on new stage
        let nextReviewHours = 24; // Default
        if (decision.newStage === 'LOST') {
          nextReviewHours = 24 * 365; // 1 year (never)
        } else if (decision.newStage === 'NURTURING') {
          nextReviewHours = 24 * 14; // 14 days for nurturing
        } else if (decision.newStage === 'WAITING_FOR_APPLICATION') {
          nextReviewHours = 48; // Check in 2 days
        }

        const nextReview = new Date(now.getTime() + nextReviewHours * 60 * 60 * 1000);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { nextReviewAt: nextReview },
        });

        // Send Slack notification for LOST transitions
        if (decision.newStage === 'LOST') {
          await sendSlackNotification({
            type: 'lead_rotting',
            leadName: `${lead.firstName} ${lead.lastName}`,
            leadId: lead.id,
            details: `Holly marked this lead as LOST.\n\nReason: ${decision.thinking}`,
          });
        }
      }

      return { success: true, action: 'move_stage', newStage: decision.newStage };
    } else {
      // Send message
      console.log(
        `[Holly Agent] ✅ ${lead.firstName}: ${decision.action.toUpperCase()} - ${decision.thinking}`
      );

      if (!DRY_RUN_MODE) {
        // Real execution
        await executeDecision(lead.id, {
          action: decision.action,
          message: decision.message,
          reasoning: decision.thinking,
        });

        // Track conversation outcome for continuous learning
        trackConversationOutcome({
          leadId: lead.id,
          messageSent: decision.message || '',
          hollyDecision: {
            ...decision,
            sentAt: now,
            signals,
          },
        });

        // Schedule next review based on temperature
        const nextReview = new Date(now.getTime() + signals.nextReviewHours * 60 * 60 * 1000);
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            nextReviewAt: nextReview,
            lastContactedAt: now,
          },
        });
      }

      return { success: true, action: decision.action, message: decision.message };
    }
  } catch (error) {
    console.error(`[Holly Agent] ❌ Error processing lead ${leadId}:`, error);

    // Schedule retry in 2 hours
    await prisma.lead.update({
      where: { id: leadId },
      data: { nextReviewAt: new Date(now.getTime() + 2 * 60 * 60 * 1000) },
    });

    return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Main agent loop - run this on a schedule (e.g., every 15 minutes)
 */
export async function runHollyAgentLoop() {
  if (!ENABLE_AUTONOMOUS_AGENT) {
    console.log('[Holly Agent] ⏸️  Disabled via ENABLE_AUTONOMOUS_AGENT env var');
    return;
  }

  console.log('[Holly Agent] 🤖 Starting review cycle...');
  console.log(`[Holly Agent] Mode: ${DRY_RUN_MODE ? 'DRY RUN (logging only)' : 'LIVE'}`);
  console.log(`[Holly Agent] Testing: ${AUTONOMOUS_LEAD_PERCENTAGE}% of leads`);

  const now = new Date();

  try {
    // === SMART QUERY: Only leads due for review ===
    // Increased from 5 to 10 minutes to prevent race conditions with Inngest queue
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    const leadsToReview = await prisma.lead.findMany({
      where: {
        status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON', 'APPLICATION_STARTED'] },
        consentSms: true,
        managedByAutonomous: true, // Only autonomous leads
        hollyDisabled: false, // Skip leads with Holly disabled (manual relationships)
        // Skip leads recently contacted by Inngest queue (avoid duplicate processing)
        OR: [
          {
            AND: [
              { nextReviewAt: null }, // Never reviewed
              {
                OR: [
                  { lastContactedAt: null },
                  { lastContactedAt: { lte: tenMinutesAgo } }, // Not contacted in last 10min
                ],
              },
            ],
          },
          {
            AND: [
              { nextReviewAt: { lte: now } }, // Review time passed
              {
                OR: [
                  { lastContactedAt: null },
                  { lastContactedAt: { lte: tenMinutesAgo } }, // Not contacted in last 10min
                ],
              },
            ],
          },
        ],
      },
      include: {
        communications: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        appointments: {
          where: { status: { in: ['SCHEDULED', 'CONFIRMED'] } },
        },
        callOutcomes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { nextReviewAt: 'asc' }, // Prioritize overdue reviews
      take: 50, // Process max 50 leads per cycle (increased from 15 to clear backlog faster)
    });

    console.log(`[Holly Agent] 📊 Found ${leadsToReview.length} leads due for review at ${now.toISOString()}...`);

    const results = {
      acted: 0,
      waited: 0,
      escalated: 0,
      skipped: 0,
    };

    for (const lead of leadsToReview) {
      try {
        // === ANALYZE DEAL HEALTH ===
        const signals = analyzeDealHealth(lead);

        console.log(
          `[Holly Agent] 🔍 ${lead.firstName} ${lead.lastName}: ${signals.temperature} (${signals.engagementTrend})`
        );

        // === ASK HOLLY TO DECIDE ===
        const decision = await askHollyToDecide(lead, signals);

        // === VALIDATE DECISION ===
        const validation = validateDecision(decision, { lead, signals });

        // Log warnings
        if (validation.warnings.length > 0) {
          console.warn(`[Holly Agent] ⚠️  ${lead.firstName}: ${validation.warnings.join(', ')}`);
        }

        if (!validation.isValid) {
          console.log(
            `[Holly Agent] ❌ ${lead.firstName}: Blocked - ${validation.errors.join(', ')}`
          );

          // Schedule retry in 1 hour
          await prisma.lead.update({
            where: { id: lead.id },
            data: { nextReviewAt: new Date(now.getTime() + 60 * 60 * 1000) },
          });

          results.skipped++;
          continue;
        }

        // === CHECK FOR REPETITION (if sending message) ===
        if (decision.message) {
          const repetitionCheck = detectMessageRepetition(decision.message, lead.communications || []);

          if (repetitionCheck.isRepetitive) {
            console.log(
              `[Holly Agent] 🔁 ${lead.firstName}: Repetitive message blocked - ${repetitionCheck.suggestion}`
            );

            // Log the blocked repetition
            await prisma.leadActivity.create({
              data: {
                leadId: lead.id,
                type: 'NOTE_ADDED',
                channel: 'SYSTEM',
                content: `🔁 Repetitive message blocked by safety guardrails: "${repetitionCheck.suggestion}"\n\nBlocked message: "${decision.message}"`,
                metadata: { automated: true, autonomous: true },
              },
            });

            // Wait longer before trying again
            await prisma.lead.update({
              where: { id: lead.id },
              data: { nextReviewAt: new Date(now.getTime() + 6 * 60 * 60 * 1000) }, // 6 hours
            });

            results.skipped++;
            continue;
          }
        }

        // === EXECUTE DECISION ===
        if (decision.action === 'escalate') {
          console.log(`[Holly Agent] 🚨 ${lead.firstName}: ESCALATED - ${decision.thinking}`);

          if (!DRY_RUN_MODE) {
            // Create alert for human review
            await prisma.leadActivity.create({
              data: {
                leadId: lead.id,
                type: 'NOTE_ADDED',
                channel: 'SYSTEM',
                subject: '🚨 ESCALATED BY HOLLY',
                content: `${decision.thinking}\n\nSuggested action: ${decision.suggestedAction || 'Review needed'}`,
                metadata: {
                  automated: true,
                  autonomous: true,
                  escalation: true,
                  leadPhone: lead.phone,
                  leadEmail: lead.email,
                },
              },
            });

            // Send Slack alert with actionable information
            const advisorInfo = lead.appointments?.[0]?.advisorName || 'Jakub or Greg';
            const slackDetails = [
              decision.thinking,
              '',
              `*Suggested Action:* ${decision.suggestedAction || 'Review needed'}`,
              `*Lead Contact:* ${lead.phone}${lead.email ? ` • ${lead.email}` : ''}`,
              `*Advisor:* ${advisorInfo}`,
              `*Status:* ${lead.status}`,
            ].join('\n');

            await sendSlackNotification({
              type: 'lead_escalated',
              leadName: `${lead.firstName} ${lead.lastName}`,
              leadId: lead.id,
              details: slackDetails,
            });

            // Don't auto-review for 48 hours (human will handle)
            await prisma.lead.update({
              where: { id: lead.id },
              data: { nextReviewAt: new Date(now.getTime() + 48 * 60 * 60 * 1000) },
            });
          } else {
            // Dry run: just log
            await prisma.leadActivity.create({
              data: {
                leadId: lead.id,
                type: 'NOTE_ADDED',
                channel: 'SYSTEM',
                content: `[DRY RUN] Would escalate: ${decision.thinking}`,
                metadata: { dryRun: true, autonomous: true },
              },
            });
          }

          results.escalated++;
        } else if (decision.action === 'wait') {
          console.log(
            `[Holly Agent] ⏸️  ${lead.firstName}: WAITING ${decision.waitHours}h - ${decision.thinking}`
          );

          const nextReview = new Date(
            now.getTime() + (decision.waitHours || signals.nextReviewHours) * 60 * 60 * 1000
          );

          if (!DRY_RUN_MODE) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { nextReviewAt: nextReview },
            });
          } else {
            // Dry run: just log
            await prisma.leadActivity.create({
              data: {
                leadId: lead.id,
                type: 'NOTE_ADDED',
                channel: 'SYSTEM',
                content: `[DRY RUN] Would wait ${decision.waitHours}h: ${decision.thinking}`,
                metadata: { dryRun: true, autonomous: true },
              },
            });
          }

          results.waited++;
        } else {
          // Send message
          console.log(
            `[Holly Agent] ✅ ${lead.firstName}: ${decision.action.toUpperCase()} - ${decision.thinking}`
          );

          if (!DRY_RUN_MODE) {
            // Real execution
            await executeDecision(lead.id, {
              action: decision.action,
              message: decision.message,
              reasoning: decision.thinking,
            });

            // Schedule next review based on temperature
            const nextReview = new Date(now.getTime() + signals.nextReviewHours * 60 * 60 * 1000);
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                nextReviewAt: nextReview,
                lastContactedAt: now,
              },
            });
          } else {
            // Dry run: just log what would happen
            await prisma.leadActivity.create({
              data: {
                leadId: lead.id,
                type: 'NOTE_ADDED',
                channel: 'SYSTEM',
                content: `[DRY RUN] Would ${decision.action}: "${decision.message}"\n\nReasoning: ${decision.thinking}`,
                metadata: { dryRun: true, autonomous: true },
              },
            });
          }

          results.acted++;
        }
      } catch (error) {
        console.error(`[Holly Agent] ❌ Error with ${lead.firstName}:`, error);

        // Schedule retry in 2 hours
        await prisma.lead.update({
          where: { id: lead.id },
          data: { nextReviewAt: new Date(now.getTime() + 2 * 60 * 60 * 1000) },
        });

        results.skipped++;
      }

      // Rate limiting: Add small delay between leads to prevent Claude API quota exhaustion
      if (leadsToReview.indexOf(lead) < leadsToReview.length - 1) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    console.log(
      `[Holly Agent] ✨ Cycle complete - acted: ${results.acted}, waited: ${results.waited}, escalated: ${results.escalated}, skipped: ${results.skipped}`
    );
    console.log(`[Holly Agent] 📊 Next cycle in 15 minutes`);

    // Check for severely overdue leads (>24h past their nextReviewAt)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const severelyOverdueLeads = await prisma.lead.findMany({
      where: {
        nextReviewAt: { lte: oneDayAgo },
        hollyDisabled: false,
        consentSms: true,
        managedByAutonomous: true,
        status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON', 'APPLICATION_STARTED'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        nextReviewAt: true,
        lastContactedAt: true,
        createdAt: true,
      },
      take: 10, // Only show top 10 worst cases
      orderBy: { nextReviewAt: 'asc' },
    });

    if (severelyOverdueLeads.length > 0) {
      console.warn(`[Holly Agent] ⚠️  Found ${severelyOverdueLeads.length} leads >24h overdue`);

      const leadDetails = severelyOverdueLeads.map(lead => {
        const hoursOverdue = lead.nextReviewAt
          ? Math.floor((now.getTime() - lead.nextReviewAt.getTime()) / (1000 * 60 * 60))
          : 0;
        const daysSinceCreated = Math.floor((now.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        return `• ${lead.firstName} ${lead.lastName} (${lead.status}): ${hoursOverdue}h overdue, ${lead.lastContactedAt ? 'contacted' : 'NEVER contacted'}, ${daysSinceCreated}d in pipeline`;
      }).join('\n');

      await sendSlackNotification({
        type: 'warning',
        message: `⚠️  ${severelyOverdueLeads.length} leads are >24h overdue for contact`,
        context: {
          timestamp: now.toISOString(),
          details: leadDetails,
          action: 'Check if cron is running properly or if there are processing issues',
        },
      });
    }
  } catch (error) {
    console.error('[Holly Agent] 💥 Critical error in agent loop:', error);
  }
}

/**
 * Assign leads to autonomous management (for percentage rollout)
 * Call this once to mark leads for autonomous management
 */
export async function assignLeadsToAutonomous(percentage: number) {
  console.log(`[Holly Agent] Assigning ${percentage}% of leads to autonomous management...`);

  const allLeads = await prisma.lead.findMany({
    where: {
      status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON'] },
      consentSms: true,
    },
    select: { id: true },
  });

  let assignedCount = 0;

  for (const lead of allLeads) {
    // Use lead ID hash to deterministically assign to test group
    const hash = parseInt(lead.id.slice(-8), 16);
    const shouldManage = hash % 100 < percentage;

    if (shouldManage) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          managedByAutonomous: true,
          nextReviewAt: new Date(), // Review immediately
        },
      });
      assignedCount++;
    }
  }

  console.log(
    `[Holly Agent] ✅ Assigned ${assignedCount}/${allLeads.length} leads to autonomous management`
  );
}
