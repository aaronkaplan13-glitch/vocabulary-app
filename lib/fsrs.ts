import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  forgetting_curve,
  type Card,
  type Grade,
} from "ts-fsrs";
import { DEFAULT_REQUEST_RETENTION, MAXIMUM_INTERVAL } from "./config";
import type { FsrsState } from "./types";

/** Build an FSRS scheduler with the given target retention. */
export function scheduler(requestRetention = DEFAULT_REQUEST_RETENTION) {
  return fsrs(
    generatorParameters({
      request_retention: requestRetention,
      maximum_interval: MAXIMUM_INTERVAL,
      enable_fuzz: true,
    }),
  );
}

/** Convert the FSRS columns stored on a `words` row into a ts-fsrs Card. */
export function toCard(s: FsrsState): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    reps: s.reps,
    lapses: s.lapses,
    learning_steps: s.learning_steps,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  };
}

/** Flatten a ts-fsrs Card back into the DB column shape. */
export function fromCard(card: Card): FsrsState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learning_steps,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

export interface ReviewResult {
  card: Card;
  /** The full ReviewLog from ts-fsrs for the chosen grade. */
  log: {
    rating: number;
    state: number;
    elapsed_days: number;
    scheduled_days: number;
    last_elapsed_days: number;
  };
}

/**
 * Apply a rating (1=Again..4=Easy) to a stored card and return the next state.
 */
export function applyReview(
  state: FsrsState,
  rating: Grade,
  now: Date,
  requestRetention?: number,
): ReviewResult {
  const f = scheduler(requestRetention);
  const card = toCard(state);
  const result = f.next(card, now, rating);
  return {
    card: result.card,
    log: {
      rating: result.log.rating,
      state: result.log.state,
      elapsed_days: result.log.elapsed_days,
      scheduled_days: result.log.scheduled_days,
      last_elapsed_days: result.log.last_elapsed_days,
    },
  };
}

/** A fresh card's FSRS state for a brand-new word. */
export function emptyCardState(now: Date): FsrsState {
  return fromCard(createEmptyCard(now));
}

/**
 * Current probability of recall (retrievability) for a card, given how many
 * days have elapsed since it was last scheduled. Used for display + logging.
 */
export function retrievability(state: FsrsState, now: Date): number {
  if (state.stability <= 0 || !state.last_review) return 0;
  const elapsed =
    (now.getTime() - new Date(state.last_review).getTime()) /
    (1000 * 60 * 60 * 24);
  return forgetting_curve(scheduler().parameters.w[20], Math.max(0, elapsed), state.stability);
}
