import { Rating, type Grade } from "ts-fsrs";

/**
 * Production-over-recognition stage ladder. A word climbs one rung each time it
 * is recalled successfully on a *due* day, so progression is naturally gated by
 * the passage of days (FSRS decides when the word resurfaces). A lapse demotes
 * one rung (never below Recognition once introduced).
 *
 *   0 Encounter        — just added; shown the word, definition, morphemes. No test.
 *   1 Recognition      — see the word, recall its meaning (self-graded).
 *   2 Cued Recall      — given the definition + a blanked example, produce the word.
 *   3 Production       — write your own sentence that uses the word correctly.
 *   4 Conversation     — use the word naturally in the Claude coaching chat (mastery).
 */
export const STAGE = {
  ENCOUNTER: 0,
  RECOGNITION: 1,
  CUED_RECALL: 2,
  PRODUCTION: 3,
  CONVERSATION: 4,
} as const;

export const MAX_STAGE = STAGE.CONVERSATION;

export const STAGE_LABELS: Record<number, string> = {
  0: "Encounter",
  1: "Recognition",
  2: "Cued Recall",
  3: "Production",
  4: "Conversation",
};

export const STAGE_PROMPTS: Record<number, string> = {
  0: "Meet this word — read the definition, example, and how it's built.",
  1: "Do you recall what this word means?",
  2: "Fill in the blank with the target word.",
  3: "Write a sentence that uses this word correctly.",
  4: "Use this word naturally in conversation.",
};

/** Is a rating a passing grade (Good / Easy)? Hard counts as a near-miss hold. */
export function isPass(rating: Grade): boolean {
  return rating === Rating.Good || rating === Rating.Easy;
}

/**
 * Compute the next stage after a review.
 * - Encounter (0): any acknowledgement promotes to Recognition (1).
 * - Again (1): demote one rung, floored at Recognition.
 * - Hard (2): hold at the current stage (more spacing handled by FSRS).
 * - Good/Easy (3/4): promote one rung, capped at Conversation (4).
 */
export function nextStage(currentStage: number, rating: Grade): number {
  if (currentStage === STAGE.ENCOUNTER) return STAGE.RECOGNITION;
  if (rating === Rating.Again) {
    return Math.max(STAGE.RECOGNITION, currentStage - 1);
  }
  if (rating === Rating.Hard) return currentStage;
  return Math.min(MAX_STAGE, currentStage + 1);
}
