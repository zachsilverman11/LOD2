/**
 * Guardrail escalation: the side-effecting half of guardrail-retry.ts.
 *
 * Shared by the autonomous agent (lib/holly/agent.ts) and the cron nudge path
 * (lib/automation-engine.ts) so a lead that hits the threshold on either path
 * is handed to a human the same way: one activity row (the marker the
 * awaiting-human gate keys on), one Slack alert to the shared escalation
 * channel, and a far-out nextReviewAt so the lead is parked but never
 * orphaned. Same 'lead_escalated' channel the existing escalate action and the
 * post-cancellation alert (PR #22) use; there is no assigned-advisor concept.
 */

import { prisma } from '../db';
import { sendSlackNotification } from '../slack';
import {
  GUARDRAIL_ESCALATION_PARK_HOURS,
  GUARDRAIL_ESCALATION_THRESHOLD,
  buildGuardrailEscalationDetails,
  resolveGuardrailLoopState,
  type GuardrailActivityRow,
  type GuardrailLoopState,
} from './guardrail-retry';

/**
 * Activity rows that can carry guardrail state for this lead: NOTE_ADDED rows
 * newer than the last communication. Bounded; the streak is at most a handful.
 */
export async function loadGuardrailActivities(
  leadId: string,
  since: Date | null
): Promise<GuardrailActivityRow[]> {
  return prisma.leadActivity.findMany({
    where: {
      leadId,
      type: 'NOTE_ADDED',
      ...(since ? { createdAt: { gt: since } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { createdAt: true, metadata: true },
  });
}

export async function loadGuardrailLoopState(lead: {
  id: string;
  communications?: { createdAt: Date; direction: string }[] | null;
}): Promise<GuardrailLoopState> {
  const communications = lead.communications ?? [];
  const provisional = resolveGuardrailLoopState({ activities: [], communications });
  const activities = await loadGuardrailActivities(lead.id, provisional.lastCommunicationAt);
  return resolveGuardrailLoopState({ activities, communications });
}

/**
 * Hand the lead to a human. `reminder` is the weekly re-park when nobody has
 * acted since the original escalation.
 */
export async function escalateGuardrailLoop(params: {
  lead: { id: string; firstName: string | null; lastName: string | null };
  state: GuardrailLoopState;
  now: Date;
  reminder?: boolean;
  source: 'agent' | 'automation';
}): Promise<{ nextReviewAt: Date }> {
  const { lead, state, now } = params;
  const nextReviewAt = new Date(now.getTime() + GUARDRAIL_ESCALATION_PARK_HOURS * 60 * 60 * 1000);
  const details = buildGuardrailEscalationDetails({ state, reminder: params.reminder });

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: 'NOTE_ADDED',
      channel: 'SYSTEM',
      content: `🚨 ${params.reminder ? 'STILL AWAITING HUMAN' : 'ESCALATED'}: guardrail retry loop\n\n${details}\n\nNext safety-net review: ${nextReviewAt.toISOString()}`,
      metadata: {
        automated: true,
        autonomous: true,
        guardrailEscalation: true,
        guardrailEscalationReminder: params.reminder === true,
        consecutiveBlocks: state.consecutiveBlocks,
        threshold: GUARDRAIL_ESCALATION_THRESHOLD,
        errors: state.lastBlock?.errors ?? [],
        blockedAction: state.lastBlock?.blockedAction ?? null,
        source: params.source,
      },
    },
  });

  await sendSlackNotification({
    type: 'lead_escalated',
    leadName: `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim(),
    leadId: lead.id,
    details,
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { nextReviewAt },
  });

  return { nextReviewAt };
}
