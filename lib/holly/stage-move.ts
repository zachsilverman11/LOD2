/**
 * Stage-move resolution for Holly's `move_stage` action.
 *
 * Pure helpers so the agent loop's handling of a non-move (same stage, or an
 * invalid transition) is testable. Every outcome carries a `nextReviewHours`,
 * because a non-move that fails to schedule a next review leaves the lead due
 * and the cron re-runs Holly every 15 minutes (observed 2026-09-01 as ten
 * consecutive NURTURING → NURTURING cycles, one Claude call each).
 */

export const VALID_STAGE_TRANSITIONS: Record<string, string[]> = {
  CONTACTED: ['ENGAGED', 'NURTURING', 'LOST'],
  ENGAGED: ['NURTURING', 'CALL_SCHEDULED', 'LOST'],
  CALL_SCHEDULED: ['WAITING_FOR_APPLICATION', 'NURTURING', 'LOST'],
  WAITING_FOR_APPLICATION: ['NURTURING', 'LOST'],
  NURTURING: ['ENGAGED', 'CALL_SCHEDULED', 'LOST'],
};

/** Hours until the next autonomous review once a lead is (or stays) in a stage. */
export function defaultReviewHoursForStage(stage: string): number {
  switch (stage) {
    case 'LOST':
      return 24 * 365; // effectively never
    case 'NURTURING':
      return 24 * 14; // long-term follow-up cadence
    case 'WAITING_FOR_APPLICATION':
      return 48;
    default:
      return 24;
  }
}

export type StageMoveResolution =
  | { kind: 'ok'; nextReviewHours: number }
  | { kind: 'same_stage'; nextReviewHours: number }
  | { kind: 'invalid'; allowed: string[]; nextReviewHours: number };

export function resolveStageMove(currentStatus: string, newStage: string): StageMoveResolution {
  if (newStage === currentStatus) {
    return { kind: 'same_stage', nextReviewHours: defaultReviewHoursForStage(currentStatus) };
  }
  const allowed = VALID_STAGE_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStage)) {
    return { kind: 'invalid', allowed, nextReviewHours: 24 };
  }
  return { kind: 'ok', nextReviewHours: defaultReviewHoursForStage(newStage) };
}
