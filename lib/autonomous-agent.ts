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

// Environment variables for safe rollout
const ENABLE_AUTONOMOUS_AGENT = process.env.ENABLE_AUTONOMOUS_AGENT === 'true';
const DRY_RUN_MODE = process.env.DRY_RUN_MODE === 'true';
const AUTONOMOUS_LEAD_PERCENTAGE = parseInt(process.env.AUTONOMOUS_LEAD_PERCENTAGE || '0');

/**
 * Process a single lead through autonomous Holly agent
 * Used for instant responses (SMS replies, new leads)
 */
export async function processLeadWithAutonomousAgent(leadId: string) {
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

      // Schedule retry in 1 hour
      await prisma.lead.update({
        where: { id: lead.id },
        data: { nextReviewAt: new Date(now.getTime() + 60 * 60 * 1000) },
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
    const leadsToReview = await prisma.lead.findMany({
      where: {
        status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON'] },
        consentSms: true,
        managedByAutonomous: true, // Only autonomous leads
        hollyDisabled: false, // Skip leads with Holly disabled (manual relationships)
        OR: [
          { nextReviewAt: null }, // Never reviewed
          { nextReviewAt: { lte: now } }, // Review time passed
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
      take: 50, // Process max 50 leads per cycle (safety limit)
    });

    console.log(`[Holly Agent] 📊 Reviewing ${leadsToReview.length} leads due for review...`);

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
    }

    console.log(
      `[Holly Agent] ✨ Cycle complete - acted: ${results.acted}, waited: ${results.waited}, escalated: ${results.escalated}, skipped: ${results.skipped}`
    );
    console.log(`[Holly Agent] 📊 Next cycle in 15 minutes`);
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
